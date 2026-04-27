#!/usr/bin/env node

/**
 * parse-markdown.js
 *
 * 将 markdown-scriptwriter 输出的标准格式 Markdown 解析为 JSON 场景数据。
 * 供 markdown-to-html 生成 HTML 幻灯片时消费。
 *
 * 用法:
 *   node parse-markdown.js <input.md> [--output output.json]
 *   cat input.md | node parse-markdown.js
 *
 * 输出 JSON 结构:
 * {
 *   "meta": { "title": "...", "author": "...", ... },
 *   "scenes": [
 *     {
 *       "id": 1,
 *       "title": "场景标题",
 *       "visual": "画面描述",
 *       "elements": [
 *         { "type": "flowchart", "content": "..." },
 *         { "type": "table", "headers": [...], "rows": [[...], ...] },
 *         { "type": "keypoints", "items": [{ "key": "...", "desc": "..." }] },
 *         { "type": "data", "items": [{ "value": "95%", "label": "..." }] },
 *         { "type": "code", "lang": "python", "content": "..." },
 *         { "type": "timeline", "items": [{ "step": "...", "status": "ok|warn|error|critical", "indent": 0 }] },
 *         { "type": "quote", "content": "..." }
 *       ],
 *       "subtitles": ["第一句字幕", "第二句字幕", ...],
 *       "pageConfigOverrides": {
 *         "sceneRole": "cover",
 *         "titleSize": "hero"
 *       },
 *       "pageConfig": {
 *         "sceneRole": "cover",
 *         "sceneVariant": "cover-immersive",
 *         "titleSize": "hero",
 *         "titleMaxWidth": "10ch",
 *         "bodyColumns": 1,
 *         "subtitlePlacement": "bottom-band",
 *         "headlineLayout": "hero-stack"
 *       },
 *       "layoutHints": {
 *         "primaryElementType": "none",
 *         "elementTypes": [],
 *         "subtitleCount": 2,
 *         "elementCount": 0,
 *         "density": "low",
 *         "titleLength": 4,
 *         "manualOverrideKeys": ["sceneRole", "titleSize"]
 *       }
 *     }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

const PAGE_CONFIG_KEYS = [
  'sceneRole',
  'sceneVariant',
  'titleSize',
  'titleMaxWidth',
  'bodyColumns',
  'subtitlePlacement',
  'headlineLayout'
];

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/^-?\d+$/.test(value)) value = parseInt(value, 10);
    else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);
    meta[key] = value;
  }

  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

function parseScalarValue(rawValue) {
  let value = rawValue.trim();
  if (!value) return '';

  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  if (/^(true|false)$/i.test(value)) {
    return value.toLowerCase() === 'true';
  }
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  return value;
}

function parseYamlLikeBlock(blockContent) {
  const result = {};
  const lines = blockContent.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const value = parseScalarValue(line.slice(colonIdx + 1));
    result[key] = value;
  }

  return result;
}

function pickPageConfigOverrides(rawConfig) {
  const overrides = {};

  for (const key of PAGE_CONFIG_KEYS) {
    if (rawConfig[key] !== undefined && rawConfig[key] !== '') {
      overrides[key] = rawConfig[key];
    }
  }

  return overrides;
}

function readFencedConfigBlock(lines, startIdx) {
  let idx = startIdx;
  while (idx < lines.length && !lines[idx].trim()) idx++;
  if (idx >= lines.length) return null;

  const opening = lines[idx].trim();
  const openMatch = opening.match(/^(```|~~~)(yaml|yml)?$/i);
  if (!openMatch) return null;

  const fence = openMatch[1];
  idx++;

  const blockLines = [];
  while (idx < lines.length && lines[idx].trim() !== fence) {
    blockLines.push(lines[idx]);
    idx++;
  }

  if (idx >= lines.length) return null;

  return {
    content: blockLines.join('\n').trim(),
    nextIndex: idx + 1
  };
}

function getElementTypes(elements) {
  return [...new Set(elements.map(element => element.type))];
}

function getPrimaryElementType(elements) {
  if (!elements.length) return 'none';

  const priority = ['quote', 'table', 'timeline', 'flowchart', 'data', 'keypoints', 'code'];
  const types = getElementTypes(elements);
  for (const type of priority) {
    if (types.includes(type)) return type;
  }

  return elements[0].type || 'none';
}

function countElementWeight(element) {
  switch (element.type) {
    case 'table':
      return (element.rows?.length || 0) + 1;
    case 'timeline':
    case 'data':
    case 'keypoints':
      return element.items?.length || 1;
    case 'flowchart':
    case 'code':
      return element.content ? element.content.split('\n').filter(Boolean).length : 1;
    case 'quote':
      return 1;
    default:
      return 1;
  }
}

function getDensity(scene) {
  const unitCount = scene.subtitles.length + scene.elements.reduce((sum, element) => sum + countElementWeight(element), 0);
  if (unitCount >= 12) return 'high';
  if (unitCount >= 6) return 'medium';
  return 'low';
}

function inferSceneRole(scene) {
  if (scene.id === 1) return 'cover';

  const primaryElementType = getPrimaryElementType(scene.elements);
  if (primaryElementType === 'quote') return 'conclusion';
  if (primaryElementType === 'table') return 'comparison';
  if (primaryElementType === 'timeline' || primaryElementType === 'flowchart' || primaryElementType === 'code') {
    return 'explanation';
  }

  return 'content';
}

function inferSceneVariant({ scene, sceneRole, primaryElementType, density }) {
  if (sceneRole === 'cover') return 'cover-immersive';
  if (primaryElementType === 'timeline') return 'timeline-track';
  if (primaryElementType === 'table') return 'comparison-board';
  if (primaryElementType === 'flowchart') return 'process-diagram';
  if (primaryElementType === 'data') return 'metric-wall';
  if (primaryElementType === 'quote') return 'quote-focus';
  if (primaryElementType === 'code') return 'code-spotlight';
  if (primaryElementType === 'keypoints') return density === 'high' ? 'grid-summary' : 'stacked-points';
  if (!scene.elements.length && scene.subtitles.length >= 5) return 'narration-panel';
  return scene.id % 2 === 0 ? 'split-left-focus' : 'split-right-focus';
}

function inferTitleSize({ sceneRole, titleLength, subtitleCount, elementCount, primaryElementType }) {
  if (sceneRole === 'cover') {
    return titleLength <= 14 ? 'hero' : 'xl';
  }

  if (titleLength >= 24 || subtitleCount >= 6 || elementCount >= 3) return 'md';
  if (primaryElementType === 'table' || primaryElementType === 'flowchart') return 'md';
  if (primaryElementType === 'quote') return 'lg';
  return 'lg';
}

function inferTitleMaxWidth({ sceneRole, titleLength, primaryElementType }) {
  if (sceneRole === 'cover') return titleLength <= 12 ? '10ch' : '12ch';
  if (primaryElementType === 'table' || primaryElementType === 'flowchart') return '16ch';
  if (titleLength >= 24) return '18ch';
  return '14ch';
}

function inferBodyColumns({ primaryElementType, elements, density }) {
  if (primaryElementType === 'data') {
    const dataElement = elements.find(element => element.type === 'data');
    return dataElement && dataElement.items && dataElement.items.length >= 4 ? 3 : 2;
  }
  if (primaryElementType === 'table' || primaryElementType === 'flowchart') return 2;
  if (primaryElementType === 'keypoints') return density === 'high' ? 2 : 1;
  return 1;
}

function inferSubtitlePlacement({ scene, sceneRole, primaryElementType, density }) {
  if (sceneRole === 'cover') return 'bottom-band';
  if (primaryElementType === 'quote') return 'inset';
  if (primaryElementType === 'table') return 'bottom-band';
  if (primaryElementType === 'flowchart') return 'right-rail';
  if (primaryElementType === 'timeline') return scene.id % 2 === 0 ? 'right-rail' : 'left-rail';
  if (primaryElementType === 'data') return density === 'high' ? 'bottom-band' : 'left-rail';
  return scene.id % 2 === 0 ? 'right-rail' : 'bottom-band';
}

function inferHeadlineLayout({ sceneRole, titleLength, primaryElementType }) {
  if (sceneRole === 'cover') return 'hero-stack';
  if (titleLength >= 22) return 'stacked';
  if (primaryElementType === 'data') return 'inline-kicker';
  return 'stacked';
}

function resolvePageConfig(scene, overrides) {
  const primaryElementType = getPrimaryElementType(scene.elements);
  const density = getDensity(scene);
  const titleLength = Array.from(scene.title || '').length;
  const sceneRole = overrides.sceneRole || inferSceneRole(scene);

  return {
    sceneRole,
    sceneVariant: overrides.sceneVariant || inferSceneVariant({ scene, sceneRole, primaryElementType, density }),
    titleSize: overrides.titleSize || inferTitleSize({
      sceneRole,
      titleLength,
      subtitleCount: scene.subtitles.length,
      elementCount: scene.elements.length,
      primaryElementType
    }),
    titleMaxWidth: overrides.titleMaxWidth ?? inferTitleMaxWidth({ sceneRole, titleLength, primaryElementType }),
    bodyColumns: overrides.bodyColumns ?? inferBodyColumns({ primaryElementType, elements: scene.elements, density }),
    subtitlePlacement: overrides.subtitlePlacement || inferSubtitlePlacement({ scene, sceneRole, primaryElementType, density }),
    headlineLayout: overrides.headlineLayout || inferHeadlineLayout({ sceneRole, titleLength, primaryElementType })
  };
}

function buildLayoutHints(scene, overrides) {
  const elementTypes = getElementTypes(scene.elements);
  return {
    primaryElementType: getPrimaryElementType(scene.elements),
    elementTypes,
    subtitleCount: scene.subtitles.length,
    elementCount: scene.elements.length,
    density: getDensity(scene),
    titleLength: Array.from(scene.title || '').length,
    manualOverrideKeys: Object.keys(overrides)
  };
}

function parseScenes(body) {
  const scenes = [];
  const sceneRegex = /^## 场景(\d+)[：:]\s*(.+)$/gm;
  const matches = [...body.matchAll(sceneRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIdx = match.index + match[0].length;
    const endIdx = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const content = body.slice(startIdx, endIdx).trim();

    const scene = {
      id: parseInt(match[1], 10),
      title: match[2].trim(),
      visual: '',
      elements: [],
      subtitles: [],
      pageConfigOverrides: {},
      pageConfig: {},
      layoutHints: {}
    };

    const visualMatch = content.match(/\*\*画面描述\*\*[：:]\s*(.+)/);
    if (visualMatch) {
      scene.visual = visualMatch[1].trim();
    }

    const lines = content.split('\n');
    let idx = 0;

    while (idx < lines.length) {
      const line = lines[idx];
      const trimmedLine = line.trim();

      if (/^\*\*页面配置\*\*(?:[：:]\s*)?$/.test(trimmedLine)) {
        const block = readFencedConfigBlock(lines, idx + 1);
        if (block) {
          const rawConfig = parseYamlLikeBlock(block.content);
          scene.pageConfigOverrides = pickPageConfigOverrides(rawConfig);
          idx = block.nextIndex;
          continue;
        }
      }

      if (trimmedLine.startsWith('~~~flowchart')) {
        let flowContent = '';
        idx++;
        while (idx < lines.length && !lines[idx].trim().startsWith('~~~')) {
          flowContent += lines[idx] + '\n';
          idx++;
        }
        scene.elements.push({ type: 'flowchart', content: flowContent.trim() });
        idx++;
        continue;
      }

      if (trimmedLine.startsWith(':::quote')) {
        let quoteContent = '';
        idx++;
        while (idx < lines.length && !lines[idx].trim().startsWith(':::')) {
          quoteContent += lines[idx] + '\n';
          idx++;
        }
        scene.elements.push({ type: 'quote', content: quoteContent.trim() });
        idx++;
        continue;
      }

      const codeMatch = trimmedLine.match(/^```(\w*)$/);
      if (codeMatch && !trimmedLine.startsWith('```markdown')) {
        const lang = codeMatch[1] || 'text';
        let codeContent = '';
        idx++;
        while (idx < lines.length && !lines[idx].trim().startsWith('```')) {
          codeContent += lines[idx] + '\n';
          idx++;
        }
        scene.elements.push({ type: 'code', lang, content: codeContent.trim() });
        idx++;
        continue;
      }

      const tableMatch = line.match(/^\|(.+)\|$/);
      if (tableMatch && idx + 1 < lines.length && lines[idx + 1].match(/^\|[-:\s|]+\|$/)) {
        const headers = tableMatch[1].split('|').map(h => h.trim()).filter(Boolean);
        idx += 2;
        const rows = [];
        while (idx < lines.length && lines[idx].match(/^\|(.+)\|$/)) {
          const cells = lines[idx].match(/^\|(.+)\|$/)[1].split('|').map(c => c.trim()).filter(Boolean);
          rows.push(cells);
          idx++;
        }
        scene.elements.push({ type: 'table', headers, rows });
        continue;
      }

      const dataMatch = line.match(/^-\s*「(.+?)」(.*)$/);
      if (dataMatch) {
        const items = [];
        while (idx < lines.length) {
          const dm = lines[idx].match(/^-\s*「(.+?)」(.*)$/);
          if (!dm) break;
          items.push({ value: dm[1], label: dm[2].replace(/^\s*[-—]\s*/, '').trim() });
          idx++;
        }
        scene.elements.push({ type: 'data', items });
        continue;
      }

      const timelineMatch = line.match(/^(\s*)-\s*→\s*(.+)$/);
      if (timelineMatch) {
        const items = [];
        while (idx < lines.length) {
          const tm = lines[idx].match(/^(\s*)-\s*→\s*(.+)$/);
          if (!tm) break;
          const indent = tm[1].length;
          const text = tm[2].trim();
          let status = 'ok';
          if (text.includes('💥')) status = 'critical';
          else if (text.includes('❌')) status = 'error';
          else if (text.includes('⚠️')) status = 'warn';
          const normalizedStep = text.replace(/[✅⚠️❌💥]/g, '').replace(/\s+/g, ' ').trim();
          items.push({ step: normalizedStep, status, indent });
          idx++;
        }
        scene.elements.push({ type: 'timeline', items });
        continue;
      }

      const keypointMatch = line.match(/^-\s*\*\*(.+?)\*\*[：:]\s*(.+)$/);
      if (keypointMatch) {
        const items = [];
        while (idx < lines.length) {
          const km = lines[idx].match(/^-\s*\*\*(.+?)\*\*[：:]\s*(.+)$/);
          if (!km) break;
          items.push({ key: km[1], desc: km[2].trim() });
          idx++;
        }
        scene.elements.push({ type: 'keypoints', items });
        continue;
      }

      const subtitleMatch = line.match(/^>\s*(.+)/);
      if (subtitleMatch) {
        // 收集连续 > 行，合并为一段
        let paragraphParts = [subtitleMatch[1].trim()];
        idx++;
        while (idx < lines.length) {
          const nextMatch = lines[idx].match(/^>\s*(.+)/);
          if (nextMatch) {
            paragraphParts.push(nextMatch[1].trim());
            idx++;
          } else {
            break;
          }
        }
        scene.subtitles.push(paragraphParts.join(' '));
        continue;
      }

      idx++;
    }

    scene.pageConfig = resolvePageConfig(scene, scene.pageConfigOverrides);
    scene.layoutHints = buildLayoutHints(scene, scene.pageConfigOverrides);
    scenes.push(scene);
  }

  return scenes;
}

function parseMarkdown(content) {
  const { meta, body } = parseFrontmatter(content);
  const scenes = parseScenes(body);
  return { meta, scenes };
}

function main() {
  const args = process.argv.slice(2);
  let input = '';
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[++i];
    } else if (!args[i].startsWith('-')) {
      input = args[i];
    }
  }

  let content;
  if (input) {
    content = fs.readFileSync(path.resolve(input), 'utf-8');
  } else if (!process.stdin.isTTY) {
    content = fs.readFileSync('/dev/stdin', 'utf-8');
  } else {
    console.error('用法: node parse-markdown.js <input.md> [--output output.json]');
    console.error('  或: cat input.md | node parse-markdown.js');
    process.exit(1);
  }

  const result = parseMarkdown(content);
  const json = JSON.stringify(result, null, 2);

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
    parseMarkdown,
    parseFrontmatter,
    parseScenes,
    parseYamlLikeBlock,
    resolvePageConfig,
    buildLayoutHints
  };
}
