#!/usr/bin/env node

/**
 * parse-markdown.js
 *
 * 将 markdown-scriptwriter 输出的镜头蒙太奇格式 Markdown 解析为 JSON。
 * 供 markdown-to-html 生成 HTML 幻灯片时消费。
 *
 * 用法:
 *   node parse-markdown.js <input.md> [--output output.json]
 *   cat input.md | node parse-markdown.js
 *
 * 输出 JSON 结构:
 * {
 *   "meta": { "title": "...", "total_shots": N, "canvas_groups": N, ... },
 *   "canvasGroups": [
 *     {
 *       "id": 1,
 *       "title": "组标题",
 *       "shots": [
 *         {
 *           "id": 1,
 *           "relation": "切换",
 *           "isInteraction": false,
 *           "narration": "话术内容",
 *           "shotType": "character + text-effect",
 *           "elements": "元素描述",
 *           "animation": "动效描述"
 *         }
 *       ]
 *     }
 *   ],
 *   "shots": [  // 扁平化的镜头列表（方便下游消费）
 *     { "id": 1, "canvasGroup": 1, "relation": "切换", ... }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

// ─── YAML frontmatter 解析 ───
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };

  const yamlStr = match[1];
  const meta = {};
  for (const line of yamlStr.split('\n')) {
    const m = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (m) {
      let val = m[2].trim();
      // 去引号
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // 尝试转数字
      if (/^\d+$/.test(val)) val = parseInt(val, 10);
      meta[m[1]] = val;
    }
  }

  const body = content.slice(match[0].length).trim();
  return { meta, body };
}

// ─── 主解析器 ───
function parseMarkdown(content) {
  const { meta, body } = parseFrontmatter(content);
  const lines = body.split('\n');

  const canvasGroups = [];
  let currentGroup = null;
  let currentShot = null;
  let globalShotId = 0;

  // 正则模式
  const groupPattern = /^## 画布组\s*(\d+)[：:]\s*(.+)$/;
  const shotPattern = /^### (?:\[互动\]\s*)?镜头\s*(\d+)(?:（(切换|延续)）)?/;
  const interactionPattern = /^### \[互动\]/;
  const narrationPattern = /^\*\*话术\*\*[：:]\s*"?(.+?)"?\s*$/;
  const typePattern = /^\*\*画面类型\*\*[：:]\s*(.+)$/;
  const elementsPattern = /^\*\*元素\*\*[：:]\s*(.+)$/;
  const animationPattern = /^\*\*动效\*\*[：:]\s*(.+)$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 画布组标题
    const groupMatch = line.match(groupPattern);
    if (groupMatch) {
      currentGroup = {
        id: parseInt(groupMatch[1], 10),
        title: groupMatch[2].trim(),
        shots: []
      };
      canvasGroups.push(currentGroup);
      currentShot = null;
      continue;
    }

    // 镜头标题
    const shotMatch = line.match(shotPattern);
    if (shotMatch) {
      globalShotId++;
      const isInteraction = interactionPattern.test(line);
      currentShot = {
        id: parseInt(shotMatch[1], 10) || globalShotId,
        relation: shotMatch[2] || '切换',
        isInteraction,
        canvasGroup: currentGroup ? currentGroup.id : 1,
        narration: '',
        shotType: '',
        elements: '',
        animation: ''
      };
      if (currentGroup) {
        currentGroup.shots.push(currentShot);
      }
      continue;
    }

    if (!currentShot) continue;

    // 话术
    const narrationMatch = line.match(narrationPattern);
    if (narrationMatch) {
      currentShot.narration = narrationMatch[1].trim();
      continue;
    }

    // 画面类型
    const typeMatch = line.match(typePattern);
    if (typeMatch) {
      currentShot.shotType = typeMatch[1].trim();
      continue;
    }

    // 元素
    const elementsMatch = line.match(elementsPattern);
    if (elementsMatch) {
      currentShot.elements = elementsMatch[1].trim();
      // 多行元素描述（后续行不以 ** 开头且不是新标题）
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.match(/^\*\*/) || nextLine.match(/^##/) || nextLine.trim() === '') break;
        currentShot.elements += '\n' + nextLine;
        i++;
      }
      continue;
    }

    // 动效
    const animationMatch = line.match(animationPattern);
    if (animationMatch) {
      currentShot.animation = animationMatch[1].trim();
      continue;
    }
  }

  // 构建扁平化 shots 列表
  const shots = [];
  for (const group of canvasGroups) {
    for (const shot of group.shots) {
      shots.push({
        id: shot.id,
        canvasGroup: group.id,
        relation: shot.relation,
        isInteraction: shot.isInteraction,
        narration: shot.narration,
        shotType: shot.shotType,
        elements: shot.elements,
        animation: shot.animation
      });
    }
  }

  return { meta, canvasGroups, shots };
}

// ─── CLI 入口 ───
function main() {
  const args = process.argv.slice(2);
  let inputFile = null;
  let outputFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && i + 1 < args.length) {
      outputFile = args[++i];
    } else if (!args[i].startsWith('-')) {
      inputFile = args[i];
    }
  }

  let content;
  if (inputFile) {
    content = fs.readFileSync(inputFile, 'utf-8');
  } else {
    // 从 stdin 读取
    content = fs.readFileSync(0, 'utf-8');
  }

  const result = parseMarkdown(content);

  const output = JSON.stringify(result, null, 2);
  if (outputFile) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
    fs.writeFileSync(outputFile, output);
    console.error(`✓ 解析完成：${result.shots.length} 个镜头，${result.canvasGroups.length} 个画布组`);
    console.error(`  输出：${outputFile}`);
  } else {
    process.stdout.write(output + '\n');
  }
}

// 导出供其他脚本使用
module.exports = { parseMarkdown, parseFrontmatter };

if (require.main === module) {
  main();
}
