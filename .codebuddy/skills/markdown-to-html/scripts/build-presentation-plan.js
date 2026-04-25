#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('./parse-markdown');

const PLANNABLE_TYPES = new Set(['flowchart', 'timeline', 'keypoints']);
const DEFAULT_TRANSITION_DURATION = 800;

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function normalizeText(value) {
  return String(value || '')
    .replace(/[\[\](){}]/g, ' ')
    .replace(/[“”"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countTextLength(value) {
  return Array.from(String(value || '')).length;
}

const SUMMARY_HINTS = ['整体', '总体', '总览', '概括', '先看', '先说', '先来看', '这张图', '这条时间线', '这些要点'];
const SEQUENCE_HINTS = ['首先', '第一', '第一步', '然后', '接着', '随后', '下一步', '最后', '最终'];
const LAYOUT_INTENTS = Object.freeze({
  FLOW_OVERVIEW: 'flow-overview',
  FLOW_OVERVIEW_FOCUS: 'flow-overview-focus',
  FLOW_DETAIL_NODE: 'flow-detail-node',
  TIMELINE_OVERVIEW: 'timeline-overview',
  TIMELINE_OVERVIEW_FOCUS: 'timeline-overview-focus',
  TIMELINE_DETAIL_STAGE: 'timeline-detail-stage',
  KEYPOINTS_OVERVIEW: 'keypoints-overview',
  KEYPOINTS_OVERVIEW_FOCUS: 'keypoints-overview-focus',
  KEYPOINTS_DETAIL_ITEM: 'keypoints-detail-item',
  FALLBACK_SUMMARY: 'fallback-summary',
  FALLBACK_VISUAL_FIRST: 'fallback-visual-first'
});

function extractCandidateTerms(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const pieces = normalized
    .split(/[\s\-_/：:，,。；;、]+/)
    .map(item => item.trim())
    .filter(item => item.length >= 2);

  return [...new Set([
    normalized,
    ...pieces
  ].filter(item => item.length >= 2))];
}

function analyzeSubtitleLines(subtitles) {
  const safeSubtitles = Array.isArray(subtitles) ? subtitles : [];
  return safeSubtitles.map((line, index) => {
    const normalized = normalizeText(line);
    return {
      index,
      line,
      normalized,
      hasSummaryHint: SUMMARY_HINTS.some(hint => normalized.includes(hint)),
      hasSequenceHint: SEQUENCE_HINTS.some(hint => normalized.includes(hint)),
      textLength: countTextLength(normalized)
    };
  });
}

function scoreSubtitleForItem(lineInfo, item, itemIndex) {
  if (!lineInfo?.normalized) return 0;

  const label = normalizeText(item?.label || item?.key || item?.step || '');
  const desc = normalizeText(item?.desc || '');
  const terms = [...new Set([
    ...extractCandidateTerms(label),
    ...extractCandidateTerms(desc).slice(0, 2)
  ])];

  let score = 0;

  if (label && lineInfo.normalized.includes(label)) {
    score += 14;
  }

  for (const term of terms) {
    if (!term || term === label) continue;
    if (lineInfo.normalized.includes(term)) {
      score += Math.min(6, Math.max(2, Math.floor(term.length / 2) + 1));
    }
  }

  if (lineInfo.hasSequenceHint) score += 1;
  if (lineInfo.index === itemIndex) score += 2;
  if (Math.abs(lineInfo.index - itemIndex) === 1) score += 1;

  return score;
}

function buildSliceFromIndices(indices, subtitles) {
  const safeSubtitles = Array.isArray(subtitles) ? subtitles : [];
  const uniqueIndices = [...new Set((indices || []).filter(index => index >= 0 && index < safeSubtitles.length))]
    .sort((left, right) => left - right);

  if (uniqueIndices.length === 0) {
    return { start: -1, end: -1, lines: [] };
  }

  return {
    start: uniqueIndices[0],
    end: uniqueIndices[uniqueIndices.length - 1],
    lines: uniqueIndices.map(index => safeSubtitles[index])
  };
}

function splitSubtitles(subtitles, segmentCount) {
  const safeSubtitles = Array.isArray(subtitles) ? subtitles : [];
  if (segmentCount <= 1 || safeSubtitles.length === 0) {
    return [{ start: 0, end: Math.max(safeSubtitles.length - 1, -1), lines: safeSubtitles.slice() }];
  }

  const slices = [];
  const overviewCount = clamp(Math.min(2, safeSubtitles.length - (segmentCount - 1)), 1, safeSubtitles.length);
  slices.push({
    start: 0,
    end: overviewCount - 1,
    lines: safeSubtitles.slice(0, overviewCount)
  });

  let offset = overviewCount;
  let remaining = safeSubtitles.length - overviewCount;

  for (let index = 1; index < segmentCount; index++) {
    const segmentsLeft = segmentCount - index;
    const take = segmentsLeft <= 0 ? remaining : Math.max(1, Math.ceil(remaining / segmentsLeft));
    const lines = safeSubtitles.slice(offset, offset + take);
    slices.push({
      start: offset,
      end: lines.length ? offset + lines.length - 1 : offset - 1,
      lines
    });
    offset += take;
    remaining = Math.max(0, safeSubtitles.length - offset);
  }

  return slices;
}

function buildSceneSubtitleSlices({ subtitles, overviewFocusItems = [], detailTargets = [] }) {
  const safeSubtitles = Array.isArray(subtitles) ? subtitles : [];
  const safeDetailTargets = Array.isArray(detailTargets) ? detailTargets.filter(Boolean) : [];

  if (safeSubtitles.length === 0) {
    return splitSubtitles(safeSubtitles, 1 + safeDetailTargets.length);
  }

  if (safeDetailTargets.length === 0) {
    return [buildSliceFromIndices(safeSubtitles.map((_, index) => index), safeSubtitles)];
  }

  const lineInfos = analyzeSubtitleLines(safeSubtitles);
  const reservedOverviewCount = clamp(
    safeSubtitles.length >= 5 || lineInfos[0]?.hasSummaryHint || overviewFocusItems.length >= 2 ? 2 : 1,
    1,
    safeSubtitles.length
  );

  const overviewReserved = new Set(Array.from({ length: reservedOverviewCount }, (_, index) => index));
  const usedIndices = new Set(overviewReserved);
  const detailAssignments = safeDetailTargets.map((target, targetIndex) => {
    const matchedIndices = lineInfos
      .map(lineInfo => ({ index: lineInfo.index, score: scoreSubtitleForItem(lineInfo, target, targetIndex + reservedOverviewCount) }))
      .filter(item => item.score >= 6 && !overviewReserved.has(item.index))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .slice(0, 2)
      .map(item => item.index)
      .sort((left, right) => left - right);

    return [...new Set(matchedIndices)];
  });

  let cursor = reservedOverviewCount;
  const takeNextUnassigned = () => {
    while (cursor < safeSubtitles.length && usedIndices.has(cursor)) {
      cursor += 1;
    }

    if (cursor >= safeSubtitles.length) {
      return -1;
    }

    const next = cursor;
    cursor += 1;
    return next;
  };

  detailAssignments.forEach(indices => {
    indices.forEach(index => usedIndices.add(index));
  });

  detailAssignments.forEach(indices => {
    if (indices.length > 0) return;
    const fallbackIndex = takeNextUnassigned();
    if (fallbackIndex >= 0) {
      indices.push(fallbackIndex);
      usedIndices.add(fallbackIndex);
    }
  });

  const overviewIndices = safeSubtitles
    .map((_, index) => index)
    .filter(index => overviewReserved.has(index) || !usedIndices.has(index));

  const slices = [
    buildSliceFromIndices(overviewIndices, safeSubtitles),
    ...detailAssignments.map(indices => buildSliceFromIndices(indices, safeSubtitles))
  ];

  const emptyDetailCount = slices.slice(1).filter(slice => !slice.lines.length).length;
  if (emptyDetailCount > 0) {
    return splitSubtitles(safeSubtitles, 1 + safeDetailTargets.length);
  }

  return slices;
}

function withSliceFallback(slice, fallbackText) {
  if (slice && slice.lines && slice.lines.length) return slice;
  return {
    start: -1,
    end: -1,
    lines: fallbackText ? [fallbackText] : []
  };
}

function estimatePageDuration({ subtitleSlice, steps, renderData, mode }) {
  const subtitleCount = subtitleSlice?.lines?.length || 0;
  const focusCount = renderData?.focusItems?.length || 0;
  const detailBoost = mode === 'detail' ? 800 : 0;
  const duration = 5200 + subtitleCount * 1400 + focusCount * 700 + (steps?.length || 0) * 220 + detailBoost;
  return clamp(duration, 6200, 18000);
}

function buildSubtitleIndexRanges(subtitleSlice, segmentCount) {
  const total = subtitleSlice?.lines?.length || 0;
  if (segmentCount <= 0 || total <= 0) return [];

  const ranges = [];
  let cursor = 0;

  for (let index = 0; index < segmentCount; index++) {
    const segmentsLeft = segmentCount - index;
    const remaining = total - cursor;
    const take = segmentsLeft <= 0 ? remaining : Math.max(1, Math.ceil(remaining / segmentsLeft));
    const start = cursor;
    const end = Math.min(total - 1, cursor + take - 1);
    ranges.push({ start, end });
    cursor = end + 1;
  }

  return ranges;
}

function buildStepTimeline(focusItems, targetGroup, options = {}) {
  const safeItems = Array.isArray(focusItems) ? focusItems : [];
  const subtitleRanges = buildSubtitleIndexRanges(options.subtitleSlice, safeItems.length);

  return safeItems.flatMap((item, index) => {
    const enterAt = 1500 + index * 1180;
    const subtitleIndexRange = subtitleRanges[index] || null;

    return [
      {
        enterAt: Math.max(0, enterAt - 120),
        duration: 680,
        actionType: 'dim-others',
        target: {
          focusId: item.id,
          group: targetGroup
        },
        payload: {
          label: item.label,
          subtitleIndexRange
        }
      },
      {
        enterAt,
        duration: 980,
        actionType: index === 0 && options.preferHighlight ? 'highlight' : 'focus-item',
        target: {
          focusId: item.id,
          group: targetGroup
        },
        payload: {
          label: item.label,
          subtitleIndexRange,
          resetGroup: false
        }
      }
    ];
  });
}

function parseFlowchartNodes(content) {
  const lines = String(content || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const rawTokens = [];
  let branchCount = 0;

  for (const line of lines) {
    const parts = line.split(/-->/).map(normalizeText).filter(Boolean);
    if (parts.length > 2) branchCount += parts.length - 2;
    rawTokens.push(...parts);
  }

  const nodes = dedupeBy(
    rawTokens.map((label, index) => ({
      id: `flow-${index + 1}-${slugify(label)}`,
      label
    })),
    item => item.label
  );

  return {
    nodes,
    lineCount: lines.length,
    branchCount,
    nodeCount: nodes.length
  };
}

function analyzeTimeline(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const minIndent = safeItems.length ? Math.min(...safeItems.map(item => item.indent || 0)) : 0;
  const normalizedItems = safeItems.map((item, index) => {
    const level = Math.max(0, Math.round(((item.indent || 0) - minIndent) / 2));
    return {
      id: `timeline-${index + 1}-${slugify(item.step)}`,
      label: item.step,
      status: item.status || 'ok',
      level
    };
  });

  const groups = [];
  let currentTopLevel = null;

  for (const item of normalizedItems) {
    if (item.level === 0) {
      currentTopLevel = { item, children: [] };
      groups.push(currentTopLevel);
    } else if (currentTopLevel) {
      currentTopLevel.children.push(item);
    }
  }

  const maxLevel = normalizedItems.length ? Math.max(...normalizedItems.map(item => item.level)) : 0;

  return {
    items: normalizedItems,
    groups,
    maxLevel,
    itemCount: normalizedItems.length
  };
}

function analyzeKeypoints(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const normalizedItems = safeItems.map((item, index) => ({
    id: `keypoint-${index + 1}-${slugify(item.key)}`,
    label: item.key,
    desc: item.desc,
    textLength: countTextLength(`${item.key} ${item.desc}`)
  }));

  const maxDescLength = normalizedItems.length ? Math.max(...normalizedItems.map(item => countTextLength(item.desc))) : 0;

  return {
    items: normalizedItems,
    itemCount: normalizedItems.length,
    maxDescLength
  };
}

function selectPlannableElement(scene) {
  const primaryType = scene.layoutHints?.primaryElementType;
  if (PLANNABLE_TYPES.has(primaryType)) {
    return scene.elements.find(element => element.type === primaryType) || null;
  }

  return scene.elements.find(element => PLANNABLE_TYPES.has(element.type)) || null;
}

function average(values) {
  const safeValues = (values || []).filter(value => Number.isFinite(value));
  if (!safeValues.length) return 0;
  return safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length;
}

function scoreStructureComplexity({ items, analysis }) {
  const safeItems = Array.isArray(items) ? items : [];

  if (analysis?.nodeCount !== undefined) {
    return clamp(average([
      analysis.nodeCount / 7,
      analysis.branchCount / 3,
      analysis.lineCount / 6
    ]), 0, 1);
  }

  if (analysis?.groups) {
    const maxChildren = analysis.groups.length
      ? Math.max(...analysis.groups.map(group => group.children.length))
      : 0;
    return clamp(average([
      analysis.itemCount / 6,
      (analysis.maxLevel + 1) / 3,
      maxChildren / 3
    ]), 0, 1);
  }

  if (analysis?.maxDescLength !== undefined) {
    const avgTextLength = safeItems.length
      ? safeItems.reduce((sum, item) => sum + (item.textLength || 0), 0) / safeItems.length
      : 0;
    const topGap = safeItems.length >= 2
      ? (safeItems[0].textLength || 0) - (safeItems[1].textLength || 0)
      : 0;
    return clamp(average([
      analysis.itemCount / 6,
      analysis.maxDescLength / 44,
      avgTextLength / 36,
      topGap / 18
    ]), 0, 1);
  }

  return clamp(safeItems.length / 5, 0, 1);
}

function buildPlanningSignals({ scene, subtitles, items, analysis, contentType = 'generic' }) {
  const safeItems = Array.isArray(items) ? items : [];
  const lineInfos = analyzeSubtitleLines(subtitles);
  const matchedLineCount = lineInfos.filter(lineInfo => safeItems.some((item, index) => scoreSubtitleForItem(lineInfo, item, index) >= 6)).length;
  const subtitleGuidanceStrength = lineInfos.length === 0 ? 0 : matchedLineCount / lineInfos.length;
  const sequenceHintCount = lineInfos.filter(lineInfo => lineInfo.hasSequenceHint).length;
  const structureComplexity = scoreStructureComplexity({ items: safeItems, analysis });
  const density = scene.layoutHints?.density || 'low';

  let singlePagePressure = 'low';
  if (density === 'high' || structureComplexity >= 0.7) {
    singlePagePressure = 'high';
  } else if (density === 'medium' || structureComplexity >= 0.42) {
    singlePagePressure = 'medium';
  }

  const singlePagePressureScore = singlePagePressure === 'high' ? 1 : singlePagePressure === 'medium' ? 0.62 : 0.28;
  const hasClearSequence = sequenceHintCount > 0 || (matchedLineCount >= 2 && safeItems.length >= 3);
  const detailWorthiness = clamp(average([
    structureComplexity,
    Math.min(1, subtitleGuidanceStrength + (hasClearSequence ? 0.18 : 0)),
    singlePagePressureScore
  ]), 0, 1);
  const fallbackConfidence = clamp(1 - average([
    structureComplexity,
    subtitleGuidanceStrength,
    singlePagePressureScore * 0.92
  ]), 0, 1);

  return {
    contentType,
    structureComplexity,
    subtitleGuidanceStrength,
    matchedLineCount,
    hasClearSequence,
    hasSummaryLead: lineInfos[0]?.hasSummaryHint || false,
    lineInfos,
    singlePagePressure,
    detailWorthiness,
    fallbackConfidence
  };
}

function derivePlanningDecision({ signals, focusItemCount = 0, detailItemCount = 0, allowFocus = true, allowDetail = true }) {
  const overviewOnlyCandidate = signals.fallbackConfidence >= 0.72
    && signals.structureComplexity < 0.4
    && detailItemCount === 0;
  const focusCandidate = allowFocus
    && focusItemCount > 0
    && (
      signals.hasClearSequence
      || signals.subtitleGuidanceStrength >= 0.28
      || signals.structureComplexity >= 0.34
      || signals.singlePagePressure !== 'low'
    );
  const detailCandidate = allowDetail
    && detailItemCount > 0
    && (
      signals.detailWorthiness >= 0.56
      || signals.singlePagePressure === 'high'
      || (signals.structureComplexity >= 0.52 && signals.subtitleGuidanceStrength >= 0.2)
    );

  let strategy = 'overview-only';
  if (focusCandidate && detailCandidate) strategy = 'overview+focus+detail';
  else if (detailCandidate) strategy = 'overview+detail';
  else if (focusCandidate) strategy = 'overview+focus';

  return {
    overviewOnlyCandidate,
    focusCandidate,
    detailCandidate,
    shouldFocus: focusCandidate,
    shouldDetail: detailCandidate,
    strategy,
    detailCount: detailCandidate ? detailItemCount : 0
  };
}

function explainPlanningDecision({ contentType, signals, decision }) {
  const reasons = [];

  if (signals.hasSummaryLead) reasons.push('字幕开头存在总述导语');
  if (signals.hasClearSequence) reasons.push('字幕存在明显顺序推进');
  if (signals.structureComplexity >= 0.6) reasons.push(`${contentType} 结构复杂度较高`);
  if (signals.detailWorthiness >= 0.56) reasons.push('单页承载压力较大，值得拆 detail');
  if (signals.subtitleGuidanceStrength >= 0.34) reasons.push('字幕和结构项存在较强对应关系');
  if (decision.strategy === 'overview-only') reasons.push('当前更适合收敛成单页概述');

  return reasons;
}

function derivePageConfig(scene, contentType, mode, layoutIntent, fallbackKind) {
  const density = scene.layoutHints?.density || 'medium';
  const base = {
    ...scene.pageConfig,
    titleSize: scene.pageConfig?.titleSize || 'lg',
    headlineLayout: scene.pageConfig?.headlineLayout || 'stacked'
  };

  if (layoutIntent === LAYOUT_INTENTS.FALLBACK_SUMMARY || layoutIntent === LAYOUT_INTENTS.FALLBACK_VISUAL_FIRST) {
    base.sceneRole = scene.pageConfig?.sceneRole || 'content';
    base.sceneVariant = fallbackKind === 'visual-first'
      ? (scene.pageConfig?.sceneVariant || 'split-left-focus')
      : (scene.pageConfig?.sceneVariant || 'narration-panel');
    base.subtitlePlacement = scene.pageConfig?.subtitlePlacement || (fallbackKind === 'visual-first' ? 'bottom-band' : 'inset');
    base.bodyColumns = scene.pageConfig?.bodyColumns || (fallbackKind === 'visual-first' ? 2 : 1);
    base.titleSize = scene.pageConfig?.titleSize || (fallbackKind === 'visual-first' ? 'lg' : 'xl');
    base.titleMaxWidth = scene.pageConfig?.titleMaxWidth || (fallbackKind === 'visual-first' ? '14ch' : '12ch');
    return base;
  }

  if (contentType === 'flowchart') {
    base.sceneRole = 'explanation';
    base.sceneVariant = layoutIntent === LAYOUT_INTENTS.FLOW_DETAIL_NODE ? 'process-node-focus' : 'process-diagram';
    base.subtitlePlacement = mode === 'detail' ? 'bottom-band' : 'right-rail';
    base.bodyColumns = mode === 'detail' ? 3 : 2;
    base.titleSize = mode === 'detail' ? 'lg' : 'md';
    base.titleMaxWidth = '14ch';
  }

  if (contentType === 'timeline') {
    base.sceneRole = 'explanation';
    base.sceneVariant = layoutIntent === LAYOUT_INTENTS.TIMELINE_DETAIL_STAGE ? 'timeline-stage-focus' : 'timeline-track';
    base.subtitlePlacement = mode === 'detail' ? 'bottom-band' : 'right-rail';
    base.bodyColumns = mode === 'detail' ? 3 : 2;
    base.titleSize = mode === 'detail' ? 'lg' : 'md';
    base.titleMaxWidth = '14ch';
  }

  if (contentType === 'keypoints') {
    base.sceneRole = 'content';
    base.sceneVariant = layoutIntent === LAYOUT_INTENTS.KEYPOINTS_DETAIL_ITEM
      ? 'keypoint-spotlight'
      : (density === 'high' ? 'grid-summary' : 'stacked-points');
    base.subtitlePlacement = 'bottom-band';
    base.bodyColumns = mode === 'detail' ? 2 : Math.max(base.bodyColumns || 1, 2);
    base.titleSize = 'lg';
    base.titleMaxWidth = '15ch';
  }

  if (mode === 'detail') {
    base.headlineLayout = 'stacked';
  }

  return base;
}

function createScenePlan({
  scene,
  contentType,
  mode,
  suffix,
  layoutIntent,
  focusTarget = null,
  subtitleSlice,
  steps = [],
  renderData = {},
  derivedFrom = null,
  titleSuffix = '',
  fallbackKind = null,
  fallbackReason = null
}) {
  const planId = `scene-${scene.id}-${suffix}`;
  const title = titleSuffix ? `${scene.title} · ${titleSuffix}` : scene.title;
  const safeSubtitleSlice = withSliceFallback(subtitleSlice, scene.subtitles?.[0] || scene.visual);

  const plan = {
    planId,
    baseSceneId: scene.id,
    baseSceneTitle: scene.title,
    mode,
    contentType,
    derivedFrom,
    focusTarget,
    layoutIntent,
    fallbackKind,
    fallbackReason,
    subtitleSlice: safeSubtitleSlice,
    steps,
    assetSlots: [],
    pageOrder: 0,
    pageDuration: 0,
    pageConfig: derivePageConfig(scene, contentType, mode, layoutIntent, fallbackKind),
    sourceScene: {
      visual: scene.visual,
      pageConfig: scene.pageConfig,
      layoutHints: scene.layoutHints,
      elements: scene.elements
    },
    renderData: {
      ...renderData,
      title,
      visual: scene.visual,
      subtitles: safeSubtitleSlice.lines,
      focusItems: renderData.focusItems || [],
      fallbackKind,
      fallbackReason
    }
  };

  plan.pageDuration = estimatePageDuration(plan);
  return plan;
}

function planFlowchartScene(scene, element) {
  const analysis = parseFlowchartNodes(element.content);
  const subtitles = Array.isArray(scene.subtitles) ? scene.subtitles : [];
  const signals = buildPlanningSignals({
    scene,
    subtitles,
    items: analysis.nodes,
    analysis,
    contentType: 'flowchart'
  });

  const overviewFocusBase = analysis.nodes.slice(0, Math.min(3, analysis.nodes.length));
  const detailCandidatesBase = analysis.nodes.filter((_, index) => index > 0).slice(0, 2);
  const decision = derivePlanningDecision({
    signals,
    focusItemCount: overviewFocusBase.length,
    detailItemCount: detailCandidatesBase.length,
    allowFocus: analysis.nodeCount >= 2,
    allowDetail: analysis.nodeCount >= 4
  });

  const overviewFocus = decision.shouldFocus ? overviewFocusBase : [];
  const detailCandidates = decision.shouldDetail ? detailCandidatesBase : [];
  const slices = buildSceneSubtitleSlices({
    subtitles,
    overviewFocusItems: overviewFocus,
    detailTargets: detailCandidates
  });
  const planningExplanation = explainPlanningDecision({ contentType: 'flowchart', signals, decision });

  const overviewPlan = createScenePlan({
    scene,
    contentType: 'flowchart',
    mode: 'overview',
    suffix: 'overview',
    layoutIntent: decision.shouldFocus ? LAYOUT_INTENTS.FLOW_OVERVIEW_FOCUS : LAYOUT_INTENTS.FLOW_OVERVIEW,
    subtitleSlice: slices[0],
    steps: buildStepTimeline(overviewFocus, 'content-items', {
      subtitleSlice: slices[0],
      preferHighlight: true
    }),
    renderData: {
      structureSummary: analysis,
      planningSignals: signals,
      planningDecision: decision,
      planningExplanation,
      items: analysis.nodes,
      focusItems: overviewFocus,
      description: `流程节点 ${analysis.nodeCount} 个，分支 ${analysis.branchCount} 处。`
    }
  });

  const detailPlans = detailCandidates.map((item, index) => createScenePlan({
    scene,
    contentType: 'flowchart',
    mode: 'detail',
    suffix: `detail-${index + 1}`,
    derivedFrom: overviewPlan.planId,
    titleSuffix: `细讲 ${item.label}`,
    layoutIntent: LAYOUT_INTENTS.FLOW_DETAIL_NODE,
    focusTarget: {
      type: 'flow-node',
      id: item.id,
      label: item.label
    },
    subtitleSlice: slices[index + 1],
    steps: buildStepTimeline([item], 'content-items', {
      subtitleSlice: slices[index + 1],
      preferHighlight: true
    }),
    renderData: {
      structureSummary: analysis,
      planningSignals: signals,
      planningDecision: decision,
      planningExplanation,
      items: analysis.nodes,
      focusItems: [item],
      primaryItem: item,
      contextItems: analysis.nodes.filter(node => node.id !== item.id).slice(0, 4),
      description: '单页重点拆解某个关键节点与其上下文关系。'
    }
  }));

  return [overviewPlan, ...detailPlans];
}

function planTimelineScene(scene, element) {
  const analysis = analyzeTimeline(element.items);
  const subtitles = Array.isArray(scene.subtitles) ? scene.subtitles : [];
  const signals = buildPlanningSignals({
    scene,
    subtitles,
    items: analysis.items,
    analysis,
    contentType: 'timeline'
  });

  const overviewFocusBase = analysis.groups.slice(0, Math.min(3, analysis.groups.length)).map(group => group.item);
  const detailGroupsBase = analysis.groups.filter(group => group.children.length > 0).slice(0, 2);
  const decision = derivePlanningDecision({
    signals,
    focusItemCount: overviewFocusBase.length,
    detailItemCount: detailGroupsBase.length,
    allowFocus: analysis.itemCount >= 3,
    allowDetail: analysis.groups.some(group => group.children.length > 0)
  });

  const overviewFocus = decision.shouldFocus ? overviewFocusBase : [];
  const detailGroups = decision.shouldDetail ? detailGroupsBase : [];
  const slices = buildSceneSubtitleSlices({
    subtitles,
    overviewFocusItems: overviewFocus,
    detailTargets: detailGroups.map(group => group.item)
  });
  const planningExplanation = explainPlanningDecision({ contentType: 'timeline', signals, decision });

  const overviewPlan = createScenePlan({
    scene,
    contentType: 'timeline',
    mode: 'overview',
    suffix: 'overview',
    layoutIntent: decision.shouldFocus ? LAYOUT_INTENTS.TIMELINE_OVERVIEW_FOCUS : LAYOUT_INTENTS.TIMELINE_OVERVIEW,
    subtitleSlice: slices[0],
    steps: buildStepTimeline(overviewFocus, 'content-items', {
      subtitleSlice: slices[0],
      preferHighlight: true
    }),
    renderData: {
      structureSummary: analysis,
      planningSignals: signals,
      planningDecision: decision,
      planningExplanation,
      items: analysis.items,
      focusItems: overviewFocus,
      description: `阶段 ${analysis.itemCount} 个，层级深度 ${analysis.maxLevel + 1} 层。`
    }
  });

  const detailPlans = detailGroups.map((group, index) => {
    const detailFocusItems = [group.item, ...group.children.slice(0, 2)];
    return createScenePlan({
      scene,
      contentType: 'timeline',
      mode: 'detail',
      suffix: `detail-${index + 1}`,
      derivedFrom: overviewPlan.planId,
      titleSuffix: `展开 ${group.item.label}`,
      layoutIntent: LAYOUT_INTENTS.TIMELINE_DETAIL_STAGE,
      focusTarget: {
        type: 'timeline-stage',
        id: group.item.id,
        label: group.item.label
      },
      subtitleSlice: slices[index + 1],
      steps: buildStepTimeline(detailFocusItems, 'content-items', {
        subtitleSlice: slices[index + 1],
        preferHighlight: true
      }),
      renderData: {
        structureSummary: analysis,
        planningSignals: signals,
        planningDecision: decision,
        planningExplanation,
        items: [group.item, ...group.children],
        focusItems: detailFocusItems,
        primaryItem: group.item,
        contextItems: group.children,
        description: '把某个阶段及其子层级拆出来单独讲解。'
      }
    });
  });

  return [overviewPlan, ...detailPlans];
}

function planKeypointsScene(scene, element) {
  const analysis = analyzeKeypoints(element.items);
  const subtitles = Array.isArray(scene.subtitles) ? scene.subtitles : [];
  const signals = buildPlanningSignals({
    scene,
    subtitles,
    items: analysis.items,
    analysis,
    contentType: 'keypoints'
  });

  const sortedByDensity = [...analysis.items].sort((left, right) => right.textLength - left.textLength);
  const detailCandidatesBase = sortedByDensity
    .filter(item => countTextLength(item.desc) >= 18 || analysis.itemCount >= 5)
    .slice(0, 2);
  const overviewFocusBase = analysis.items.slice(0, Math.min(3, analysis.items.length));
  const decision = derivePlanningDecision({
    signals,
    focusItemCount: overviewFocusBase.length,
    detailItemCount: detailCandidatesBase.length,
    allowFocus: analysis.itemCount >= 3,
    allowDetail: analysis.itemCount >= 4 || analysis.maxDescLength >= 18
  });

  const overviewFocus = decision.shouldFocus ? overviewFocusBase : [];
  const detailCandidates = decision.shouldDetail ? detailCandidatesBase : [];
  const slices = buildSceneSubtitleSlices({
    subtitles,
    overviewFocusItems: overviewFocus,
    detailTargets: detailCandidates
  });
  const planningExplanation = explainPlanningDecision({ contentType: 'keypoints', signals, decision });

  const overviewPlan = createScenePlan({
    scene,
    contentType: 'keypoints',
    mode: 'overview',
    suffix: 'overview',
    layoutIntent: decision.shouldFocus ? LAYOUT_INTENTS.KEYPOINTS_OVERVIEW_FOCUS : LAYOUT_INTENTS.KEYPOINTS_OVERVIEW,
    subtitleSlice: slices[0],
    steps: buildStepTimeline(overviewFocus, 'content-items', {
      subtitleSlice: slices[0],
      preferHighlight: true
    }),
    renderData: {
      structureSummary: analysis,
      planningSignals: signals,
      planningDecision: decision,
      planningExplanation,
      items: analysis.items,
      focusItems: overviewFocus,
      description: `核心要点 ${analysis.itemCount} 条。`
    }
  });

  const detailPlans = detailCandidates.map((item, index) => createScenePlan({
    scene,
    contentType: 'keypoints',
    mode: 'detail',
    suffix: `detail-${index + 1}`,
    derivedFrom: overviewPlan.planId,
    titleSuffix: `拆解 ${item.label}`,
    layoutIntent: LAYOUT_INTENTS.KEYPOINTS_DETAIL_ITEM,
    focusTarget: {
      type: 'keypoint',
      id: item.id,
      label: item.label
    },
    subtitleSlice: slices[index + 1],
    steps: buildStepTimeline([item], 'content-items', {
      subtitleSlice: slices[index + 1],
      preferHighlight: true
    }),
    renderData: {
      structureSummary: analysis,
      planningSignals: signals,
      planningDecision: decision,
      planningExplanation,
      items: analysis.items,
      focusItems: [item],
      primaryItem: item,
      contextItems: analysis.items.filter(candidate => candidate.id !== item.id).slice(0, 3),
      description: '单独展开解释信息密度较高的关键要点。'
    }
  }));

  return [overviewPlan, ...detailPlans];
}

function summarizeElementTypes(scene) {
  const types = Array.isArray(scene.elements)
    ? [...new Set(scene.elements.map(element => element.type).filter(Boolean))]
    : [];
  return types;
}

function inferFallbackKind(scene) {
  const primaryType = scene.layoutHints?.primaryElementType || 'none';
  const density = scene.layoutHints?.density || 'low';
  const elementTypes = summarizeElementTypes(scene);

  if (primaryType === 'quote' || primaryType === 'none') return 'summary';
  if (['table', 'data', 'code'].includes(primaryType)) return 'visual-first';
  if (density === 'high' || elementTypes.length >= 2) return 'visual-first';
  return 'summary';
}

function buildFallbackSummaryLines(scene) {
  const lines = [];

  if (scene.visual) lines.push(scene.visual);
  if (Array.isArray(scene.subtitles) && scene.subtitles.length) {
    lines.push(...scene.subtitles.slice(0, 3));
  }

  const uniqueLines = [...new Set(lines.map(line => String(line || '').trim()).filter(Boolean))];
  return uniqueLines.slice(0, 4);
}

function buildFallbackReason(scene) {
  const primaryType = scene.layoutHints?.primaryElementType || 'none';
  if (primaryType === 'none') return 'scene-without-structured-element';
  if (primaryType === 'quote') return 'quote-scene-better-as-single-summary';
  if (['table', 'data', 'code'].includes(primaryType)) return `non-plannable-${primaryType}-scene`;
  return 'non-plannable-scene';
}

function buildFallbackScenePlan(scene) {
  const fallbackKind = inferFallbackKind(scene);
  const fallbackReason = buildFallbackReason(scene);
  const elementTypes = summarizeElementTypes(scene);
  const summaryLines = buildFallbackSummaryLines(scene);

  return createScenePlan({
    scene,
    contentType: scene.layoutHints?.primaryElementType || 'none',
    mode: 'overview',
    suffix: 'fallback',
    layoutIntent: fallbackKind === 'visual-first' ? LAYOUT_INTENTS.FALLBACK_VISUAL_FIRST : LAYOUT_INTENTS.FALLBACK_SUMMARY,
    subtitleSlice: {
      start: 0,
      end: Math.max((scene.subtitles?.length || 0) - 1, -1),
      lines: scene.subtitles?.slice() || []
    },
    steps: [],
    fallbackKind,
    fallbackReason,
    renderData: {
      items: [],
      focusItems: [],
      summaryLines,
      structureTags: elementTypes,
      description: fallbackKind === 'visual-first'
        ? '当前场景未进入多页 planner，但仍保留视觉优先的表达方式。'
        : '当前场景更适合用单页总结式回退来承接讲解。'
    }
  });
}

function planScene(scene) {
  const plannableElement = selectPlannableElement(scene);
  if (!plannableElement) {
    return [buildFallbackScenePlan(scene)];
  }

  if (plannableElement.type === 'flowchart') {
    return planFlowchartScene(scene, plannableElement);
  }

  if (plannableElement.type === 'timeline') {
    return planTimelineScene(scene, plannableElement);
  }

  if (plannableElement.type === 'keypoints') {
    return planKeypointsScene(scene, plannableElement);
  }

  return [buildFallbackScenePlan(scene)];
}

function buildPresentationPlan(parsedResult) {
  const scenePlans = [];

  for (const scene of parsedResult.scenes || []) {
    scenePlans.push(...planScene(scene));
  }

  const normalizedPlans = scenePlans.map((plan, index) => ({
    ...plan,
    pageOrder: index + 1,
    pageDuration: estimatePageDuration(plan)
  }));

  return {
    meta: parsedResult.meta || {},
    globalTimelineDefaults: {
      autoPlay: true,
      transitionDuration: DEFAULT_TRANSITION_DURATION
    },
    resources: {
      assetSlots: []
    },
    scenePlans: normalizedPlans
  };
}

function main() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let outputPath = null;

  for (let index = 0; index < args.length; index++) {
    const current = args[index];
    if (current === '--output' && args[index + 1]) {
      outputPath = args[++index];
    } else if (!current.startsWith('-')) {
      inputPath = current;
    }
  }

  let markdown = '';
  if (inputPath) {
    markdown = fs.readFileSync(path.resolve(inputPath), 'utf-8');
  } else if (!process.stdin.isTTY) {
    markdown = fs.readFileSync('/dev/stdin', 'utf-8');
  } else {
    console.error('用法: node build-presentation-plan.js <input.md> [--output plan.json]');
    console.error('  或: cat input.md | node build-presentation-plan.js');
    process.exit(1);
  }

  const parsed = parseMarkdown(markdown);
  const plan = buildPresentationPlan(parsed);
  const json = JSON.stringify(plan, null, 2);

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), json, 'utf-8');
    console.error(`已写入: ${outputPath}`);
  } else {
    console.log(json);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    LAYOUT_INTENTS,
    buildPresentationPlan,
    planScene,
    planFlowchartScene,
    planTimelineScene,
    planKeypointsScene,
    buildFallbackScenePlan,
    parseFlowchartNodes,
    analyzeTimeline,
    analyzeKeypoints,
    analyzeSubtitleLines,
    buildPlanningSignals,
    derivePlanningDecision,
    explainPlanningDecision,
    buildSceneSubtitleSlices,
    buildStepTimeline,
    inferFallbackKind,
    scoreSubtitleForItem,
    splitSubtitles,
    estimatePageDuration
  };
}
