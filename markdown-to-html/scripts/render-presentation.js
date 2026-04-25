#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { parseMarkdown } = require('./parse-markdown');
const { buildPresentationPlan } = require('./build-presentation-plan');

const TEMPLATE_PATH = path.resolve(__dirname, '../templates/slide-base.html');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createSceneLookup(parsed) {
  return new Map((parsed.scenes || []).map(scene => [scene.id, scene]));
}

function formatScore(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function renderMetaChips(plan, extraChips = []) {
  const chips = [plan.layoutIntent, ...(extraChips || [])].filter(Boolean);
  if (!chips.length) return '';

  return `
    <div class="meta-chip-row" data-enter-at="620">
      ${chips.map(chip => `<div class="meta-chip">${escapeHtml(chip)}</div>`).join('')}
    </div>
  `;
}

function renderSignalStrip(plan) {
  const signals = plan.renderData.planningSignals;
  const decision = plan.renderData.planningDecision;
  if (!signals) return '';

  return `
    <div class="signal-strip" data-enter-at="760">
      <div class="signal-chip">
        <span>complexity</span>
        <strong>${escapeHtml(formatScore(signals.structureComplexity))}</strong>
      </div>
      <div class="signal-chip">
        <span>subtitle</span>
        <strong>${escapeHtml(formatScore(signals.subtitleGuidanceStrength))}</strong>
      </div>
      <div class="signal-chip">
        <span>detail</span>
        <strong>${escapeHtml(formatScore(signals.detailWorthiness))}</strong>
      </div>
      <div class="signal-chip">
        <span>strategy</span>
        <strong>${escapeHtml(decision?.strategy || 'overview-only')}</strong>
      </div>
    </div>
  `;
}

function renderSubtitlePanel(plan, options = {}) {
  const lines = plan.renderData.subtitles || [];
  if (!lines.length) return '';

  const title = options.title || 'subtitle slice';
  const className = options.className || 'subtitle-panel';
  const enterAt = options.enterAt ?? 860;
  const maxLines = Number.isFinite(options.maxLines) ? options.maxLines : lines.length;
  const visibleLines = lines.slice(0, maxLines);
  const hiddenCount = Math.max(lines.length - visibleLines.length, 0);

  return `
    <div class="${escapeHtml(className)}" data-enter-at="${enterAt}">
      <div class="panel-kicker">${escapeHtml(title)}</div>
      <div class="subtitle-stack">
        ${visibleLines.map((line, index) => `
          <div class="subtitle-line">
            <span class="subtitle-index">${String(index + 1).padStart(2, '0')}</span>
            <p>${escapeHtml(line)}</p>
          </div>
        `).join('')}
        ${hiddenCount > 0 ? `<div class="panel-truncation-note">+ ${hiddenCount} 条字幕已折叠</div>` : ''}
      </div>
    </div>
  `;
}

function renderPlanningExplanation(plan, options = {}) {
  const reasons = plan.renderData.planningExplanation || [];
  if (!reasons.length) return '';

  const maxItems = Number.isFinite(options.maxItems) ? options.maxItems : reasons.length;
  const visibleReasons = reasons.slice(0, maxItems);
  const hiddenCount = Math.max(reasons.length - visibleReasons.length, 0);

  return `
    <div class="insight-panel" data-enter-at="980">
      <div class="panel-kicker">planning notes</div>
      <ul class="insight-list">
        ${visibleReasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}
        ${hiddenCount > 0 ? `<li class="panel-truncation-note">+ ${hiddenCount} 条补充判断已折叠</li>` : ''}
      </ul>
    </div>
  `;
}

function renderSupportPanel(plan, options = {}) {
  const primary = plan.renderData.primaryItem || plan.renderData.focusItems?.[0] || null;
  const kicker = options.kicker || 'focus spotlight';
  const description = options.description || primary?.desc || plan.renderData.description || plan.renderData.visual || '';
  const noteLimit = Number.isFinite(options.noteLimit) ? options.noteLimit : 3;
  const subtitleLimit = Number.isFinite(options.subtitleLimit) ? options.subtitleLimit : 2;

  return `
    <aside class="support-panel support-panel--compact" data-enter-at="700">
      <div class="panel-kicker">${escapeHtml(kicker)}</div>
      <h3>${escapeHtml(primary?.label || plan.focusTarget?.label || '当前页重点')}</h3>
      <p>${escapeHtml(description)}</p>
      ${renderSignalStrip(plan)}
      ${renderPlanningExplanation(plan, { maxItems: noteLimit })}
      ${renderSubtitlePanel(plan, { className: 'subtitle-panel subtitle-panel--compact', title: 'assigned subtitles', enterAt: 1100, maxLines: subtitleLimit })}
    </aside>
  `;
}

function renderFlowchartOverview(plan) {
  const items = plan.renderData.items || [];
  const focusIds = new Set((plan.renderData.focusItems || []).map(item => item.id));
  const cards = items.map((item, index) => `
    <article class="plan-card plan-card--flow ${focusIds.has(item.id) ? 'plan-card--priority' : ''}" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${640 + index * 150}">
      <div class="plan-card-index">${index + 1}</div>
      <h3>${escapeHtml(item.label)}</h3>
      <p>${escapeHtml(focusIds.has(item.id) ? '本页会跟着讲解节奏重点聚焦这个节点。' : '作为流程上下文保留在总览图中。')}</p>
    </article>
  `).join('');

  return `
    <div class="slide-layout slide-layout--triad slide-layout--flow-overview">
      <div class="slide-copy">
        <div class="eyebrow" data-enter-at="0">overview · flowchart</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.renderData.planningDecision?.strategy])}
      </div>
      <div class="content-surface">
        <div class="flow-grid">
          ${cards}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'flow focus', description: '总览页先交代主链路，再把讲解节奏落到重点节点上。' })}
    </div>
  `;
}

function renderTimelineOverview(plan) {
  const items = plan.renderData.items || [];
  const focusIds = new Set((plan.renderData.focusItems || []).map(item => item.id));
  const timelineItems = items.map((item, index) => `
    <article class="timeline-item ${focusIds.has(item.id) ? 'timeline-item--priority' : ''} status-${escapeHtml(item.status || 'ok')}" data-level="${item.level || 0}" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${620 + index * 140}">
      <div class="timeline-dot"></div>
      <div class="timeline-copy">
        <div class="timeline-index">阶段 ${index + 1}</div>
        <h3>${escapeHtml(item.label)}</h3>
      </div>
    </article>
  `).join('');

  return `
    <div class="slide-layout slide-layout--triad slide-layout--timeline-overview">
      <div class="slide-copy">
        <div class="eyebrow" data-enter-at="0">overview · timeline</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.renderData.planningDecision?.strategy])}
      </div>
      <div class="content-surface">
        <div class="timeline-stack">
          ${timelineItems}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'stage spotlight', description: '时间线总览会先铺开阶段顺序，再按讲解节奏推进重点阶段。' })}
    </div>
  `;
}

function renderKeypointsOverview(plan) {
  const items = plan.renderData.items || [];
  const focusIds = new Set((plan.renderData.focusItems || []).map(item => item.id));
  const cards = items.map((item, index) => `
    <article class="plan-card plan-card--keypoint ${focusIds.has(item.id) ? 'plan-card--priority' : ''}" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${620 + index * 145}">
      <div class="plan-card-index">${String(index + 1).padStart(2, '0')}</div>
      <h3>${escapeHtml(item.label)}</h3>
      <p>${escapeHtml(item.desc || '')}</p>
    </article>
  `).join('');

  return `
    <div class="slide-layout slide-layout--triad slide-layout--keypoints-overview">
      <div class="slide-copy">
        <div class="eyebrow" data-enter-at="0">overview · keypoints</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.renderData.planningDecision?.strategy])}
      </div>
      <div class="content-surface">
        <div class="card-grid card-grid--keypoints">
          ${cards}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'point spotlight', description: '要点总览保留全量信息，同时把最值得展开的项提前露出来。' })}
    </div>
  `;
}

function renderFlowchartDetail(plan) {
  const primary = plan.renderData.primaryItem || plan.renderData.focusItems?.[0] || null;
  const contextItems = plan.renderData.contextItems || [];

  return `
    <div class="slide-layout slide-layout--detail-typed slide-layout--flow-detail">
      <div class="slide-copy slide-copy--detail-header">
        <div class="eyebrow" data-enter-at="0">detail · flowchart</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.focusTarget?.label])}
      </div>
      <div class="detail-focus detail-focus--flow" data-step-target="${escapeHtml(primary?.id || 'flow-detail-focus')}" data-focus-group="content-items" data-enter-at="620">
        <div class="detail-kicker">node focus</div>
        <h3>${escapeHtml(primary?.label || plan.focusTarget?.label || '重点节点')}</h3>
        <p>${escapeHtml(plan.renderData.primaryItem?.desc || '这里强调当前主节点在整条流程中的作用，并保留必要上下文链路。')}</p>
      </div>
      <div class="content-surface content-surface--detail">
        <div class="context-grid context-grid--flow">
          ${contextItems.map((item, index) => `
            <article class="context-card" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${860 + index * 160}">
              <div class="context-label">context ${index + 1}</div>
              <h4>${escapeHtml(item.label)}</h4>
              <p>${escapeHtml(item.desc || '作为链路上下文保留，帮助观众理解当前节点所处位置。')}</p>
            </article>
          `).join('')}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'detail subtitles', description: 'detail 页优先消费最接近当前 focusTarget 的字幕句子。' })}
    </div>
  `;
}

function renderTimelineDetail(plan) {
  const primary = plan.renderData.primaryItem || plan.renderData.focusItems?.[0] || null;
  const contextItems = plan.renderData.contextItems || [];

  return `
    <div class="slide-layout slide-layout--detail-typed slide-layout--timeline-detail">
      <div class="slide-copy slide-copy--detail-header">
        <div class="eyebrow" data-enter-at="0">detail · timeline</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.focusTarget?.label])}
      </div>
      <div class="detail-focus detail-focus--timeline" data-step-target="${escapeHtml(primary?.id || 'timeline-detail-focus')}" data-focus-group="content-items" data-enter-at="620">
        <div class="detail-kicker">stage focus</div>
        <h3>${escapeHtml(primary?.label || plan.focusTarget?.label || '重点阶段')}</h3>
        <p>${escapeHtml('当前页强调主阶段与其子层级展开关系，讲解顺序跟字幕切片同步。')}</p>
      </div>
      <div class="content-surface content-surface--detail">
        <div class="timeline-detail-stack">
          ${contextItems.map((item, index) => `
            <article class="timeline-item timeline-item--detail status-${escapeHtml(item.status || 'ok')}" data-level="${item.level || 0}" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${860 + index * 160}">
              <div class="timeline-dot"></div>
              <div class="timeline-copy">
                <div class="timeline-index">sub stage ${index + 1}</div>
                <h3>${escapeHtml(item.label)}</h3>
              </div>
            </article>
          `).join('')}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'timeline slice', description: 'detail 页更强调一个阶段及其子层级，而不是整条时间线同时出现。' })}
    </div>
  `;
}

function renderKeypointsDetail(plan) {
  const primary = plan.renderData.primaryItem || plan.renderData.focusItems?.[0] || null;
  const contextItems = plan.renderData.contextItems || [];

  return `
    <div class="slide-layout slide-layout--detail-typed slide-layout--keypoint-detail">
      <div class="slide-copy slide-copy--detail-header">
        <div class="eyebrow" data-enter-at="0">detail · keypoints</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || plan.renderData.visual || '')}</p>
        ${renderMetaChips(plan, [plan.focusTarget?.label])}
      </div>
      <div class="detail-focus detail-focus--keypoint" data-step-target="${escapeHtml(primary?.id || 'keypoint-detail-focus')}" data-focus-group="content-items" data-enter-at="620">
        <div class="detail-kicker">keypoint focus</div>
        <h3>${escapeHtml(primary?.label || plan.focusTarget?.label || '重点要点')}</h3>
        <p>${escapeHtml(primary?.desc || '当前页把最高信息密度的要点单独拉出来讲清楚。')}</p>
      </div>
      <div class="content-surface content-surface--detail">
        <div class="context-grid context-grid--keypoints-detail">
          ${contextItems.map((item, index) => `
            <article class="context-card" data-step-target="${escapeHtml(item.id)}" data-focus-group="content-items" data-enter-at="${860 + index * 150}">
              <div class="context-label">related ${index + 1}</div>
              <h4>${escapeHtml(item.label)}</h4>
              ${item.desc ? `<p>${escapeHtml(item.desc)}</p>` : ''}
            </article>
          `).join('')}
        </div>
      </div>
      ${renderSupportPanel(plan, { kicker: 'keypoint slice', description: 'detail 页保留相关要点做对照，但视觉中心只留给当前重点项。' })}
    </div>
  `;
}

function describeSceneElement(element) {
  if (!element) return '未识别元素';
  if (element.type === 'table') return `表格 · ${element.headers?.length || 0} 列 / ${element.rows?.length || 0} 行`;
  if (element.type === 'quote') return '引用卡片 · 更适合单页结论式承接';
  if (element.type === 'data') return `数据卡片 · ${element.items?.length || 0} 项`;
  if (element.type === 'code') return `代码片段 · ${element.lang || 'text'}`;
  return `${element.type} 元素`;
}

function renderFallbackSummary(plan, scene) {
  const summaryLines = plan.renderData.summaryLines || [];
  const tags = plan.renderData.structureTags || [];

  return `
    <div class="slide-layout slide-layout--fallback-summary">
      <div class="slide-copy slide-copy--wide slide-copy--summary-lead">
        <div class="eyebrow" data-enter-at="0">fallback · summary</div>
        <h2 class="plan-title" data-enter-at="140">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="420">${escapeHtml(scene.visual || plan.renderData.description || '')}</p>
        ${renderMetaChips(plan, [plan.fallbackReason])}
      </div>
      <div class="fallback-panel fallback-panel--summary" data-enter-at="760">
        <div class="panel-kicker">summary path</div>
        <div class="summary-stack">
          ${summaryLines.map(line => `<div class="fallback-line">${escapeHtml(line)}</div>`).join('')}
        </div>
        <div class="tag-row">
          ${tags.map(tag => `<div class="tag-chip">${escapeHtml(tag)}</div>`).join('')}
        </div>
      </div>
      ${renderSubtitlePanel(plan, { className: 'subtitle-panel subtitle-panel--wide', title: 'fallback subtitles', enterAt: 980, maxLines: 2 })}
    </div>
  `;
}

function renderFallbackVisualFirst(plan, scene) {
  const elements = scene.elements || [];
  const summaryLines = plan.renderData.summaryLines || [];

  return `
    <div class="slide-layout slide-layout--fallback-visual">
      <div class="slide-copy">
        <div class="eyebrow" data-enter-at="0">fallback · visual-first</div>
        <h2 class="plan-title" data-enter-at="120">${escapeHtml(plan.renderData.title)}</h2>
        <p class="plan-deck" data-enter-at="360">${escapeHtml(plan.renderData.description || scene.visual || '')}</p>
        ${renderMetaChips(plan, [plan.fallbackReason])}
      </div>
      <div class="visual-frame" data-enter-at="620">
        <div class="panel-kicker">visual anchor</div>
        <p>${escapeHtml(scene.visual || summaryLines[0] || '当前场景保留主视觉与结构摘要，避免回退得像“未命中”。')}</p>
      </div>
      <div class="fallback-panel" data-enter-at="820">
        <div class="panel-kicker">structure cards</div>
        <div class="context-grid context-grid--fallback">
          ${elements.map((element, index) => `
            <article class="context-card" data-enter-at="${940 + index * 140}">
              <div class="context-label">element ${index + 1}</div>
              <h4>${escapeHtml(element.type)}</h4>
              <p>${escapeHtml(describeSceneElement(element))}</p>
            </article>
          `).join('')}
        </div>
      </div>
      ${renderSubtitlePanel(plan, { className: 'subtitle-panel subtitle-panel--wide', title: 'fallback subtitles', enterAt: 1100 })}
    </div>
  `;
}

function renderPlanBody(plan, scene) {
  const intentMap = {
    'flow-overview': () => renderFlowchartOverview(plan),
    'flow-overview-focus': () => renderFlowchartOverview(plan),
    'flow-detail-node': () => renderFlowchartDetail(plan),
    'timeline-overview': () => renderTimelineOverview(plan),
    'timeline-overview-focus': () => renderTimelineOverview(plan),
    'timeline-detail-stage': () => renderTimelineDetail(plan),
    'keypoints-overview': () => renderKeypointsOverview(plan),
    'keypoints-overview-focus': () => renderKeypointsOverview(plan),
    'keypoints-detail-item': () => renderKeypointsDetail(plan),
    'fallback-summary': () => renderFallbackSummary(plan, scene),
    'fallback-visual-first': () => renderFallbackVisualFirst(plan, scene)
  };

  return (intentMap[plan.layoutIntent] || (() => renderFallbackSummary(plan, scene)))();
}

function renderSlide(plan, scene) {
  const role = plan.pageConfig.sceneRole || scene.pageConfig?.sceneRole || 'content';
  const variant = plan.pageConfig.sceneVariant || scene.pageConfig?.sceneVariant || 'planner-generated';

  return `
    <section
      class="slide"
      data-scene="${plan.pageOrder}"
      data-duration="${plan.pageDuration}"
      data-base-scene="${plan.baseSceneId}"
      data-plan-id="${escapeHtml(plan.planId)}"
      data-mode="${escapeHtml(plan.mode)}"
      data-layout-intent="${escapeHtml(plan.layoutIntent)}"
      data-scene-role="${escapeHtml(role)}"
      data-scene-variant="${escapeHtml(variant)}"
      data-title-size="${escapeHtml(plan.pageConfig.titleSize || 'lg')}"
      data-fallback-kind="${escapeHtml(plan.fallbackKind || '')}"
    >
      <div class="footer-note">scene ${plan.baseSceneId} · ${escapeHtml(plan.layoutIntent)}</div>
      <div class="slide-shell">
        ${renderPlanBody(plan, scene)}
      </div>
    </section>
  `;
}

function buildTimelineConfig(plan) {
  return {
    autoPlay: plan.globalTimelineDefaults?.autoPlay !== false,
    transitionDuration: plan.globalTimelineDefaults?.transitionDuration || 800,
    scenes: (plan.scenePlans || []).map(scenePlan => ({
      scene: scenePlan.pageOrder,
      duration: scenePlan.pageDuration,
      actions: (scenePlan.steps || []).map(step => ({
        enterAt: step.enterAt,
        duration: step.duration,
        actionType: step.actionType,
        target: step.target,
        payload: step.payload
      }))
    }))
  };
}

function renderPresentation(parsed, plan) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const sceneLookup = createSceneLookup(parsed);
  const slidesMarkup = (plan.scenePlans || [])
    .map(scenePlan => renderSlide(scenePlan, sceneLookup.get(scenePlan.baseSceneId) || {}))
    .join('\n');

  const timelineConfig = JSON.stringify(buildTimelineConfig(plan), null, 2);
  const presentationJson = JSON.stringify({ parsed, plan }, null, 2);
  const title = escapeHtml(parsed.meta?.title || 'Presentation Planner Output');

  return template
    .replace(/__APP_TITLE__/g, title)
    .replace('__SLIDES__', slidesMarkup)
    .replace('__TIMELINE_CONFIG__', timelineConfig)
    .replace('__PRESENTATION_DATA__', presentationJson);
}

function parseArgs(args) {
  const options = {
    inputPath: null,
    outputPath: null,
    planOutputPath: null
  };

  for (let index = 0; index < args.length; index++) {
    const current = args[index];
    if (current === '--output' && args[index + 1]) {
      options.outputPath = args[++index];
    } else if (current === '--plan-output' && args[index + 1]) {
      options.planOutputPath = args[++index];
    } else if (!current.startsWith('-')) {
      options.inputPath = current;
    }
  }

  return options;
}

function main() {
  const { inputPath, outputPath, planOutputPath } = parseArgs(process.argv.slice(2));

  let markdown = '';
  if (inputPath) {
    markdown = fs.readFileSync(path.resolve(inputPath), 'utf-8');
  } else if (!process.stdin.isTTY) {
    markdown = fs.readFileSync('/dev/stdin', 'utf-8');
  } else {
    console.error('用法: node render-presentation.js <input.md> [--output output.html] [--plan-output plan.json]');
    console.error('  或: cat input.md | node render-presentation.js');
    process.exit(1);
  }

  const parsed = parseMarkdown(markdown);
  const plan = buildPresentationPlan(parsed);
  const html = renderPresentation(parsed, plan);

  if (planOutputPath) {
    fs.writeFileSync(path.resolve(planOutputPath), JSON.stringify(plan, null, 2), 'utf-8');
    console.error(`已写入 plan: ${planOutputPath}`);
  }

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), html, 'utf-8');
    console.error(`已写入 HTML: ${outputPath}`);
  } else {
    console.log(html);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    renderPresentation,
    renderSlide,
    buildTimelineConfig,
    parseArgs
  };
}
