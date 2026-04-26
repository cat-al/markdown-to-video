#!/usr/bin/env node

/**
 * render-presentation.js
 *
 * Planner 上下文输出工具。
 *
 * 新链路中，HTML 由 AI 在 skill 指导下逐页手写 SVG/CSS 动画。
 * 本脚本的角色从"HTML 渲染器"变为"planner 上下文输出工具"：
 *   - 输入：Markdown 文件
 *   - 输出：JSON 文件，包含 parsedResult + presentationPlan
 *
 * 用法:
 *   node render-presentation.js input.md --plan-output context.json
 *   node render-presentation.js input.md --output output.html  (deprecated, 生成极简占位 HTML)
 *   cat input.md | node render-presentation.js --plan-output context.json
 */

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

/**
 * 构建 timelineConfig，供 slide-base.html 的 TimelineEngine 消费。
 */
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

/**
 * 生成极简占位 HTML — 仅用于快速预览骨架。
 * 真正的视觉叙事 HTML 应由 AI 在 skill 指导下手写。
 *
 * @deprecated 请使用 --plan-output 输出 JSON，然后由 AI 创作 HTML。
 */
function renderPresentation(parsed, plan) {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  const slidesMarkup = (plan.scenePlans || []).map(scenePlan => {
    const sceneTitle = escapeHtml(scenePlan.baseSceneTitle || `场景 ${scenePlan.baseSceneId}`);
    const contentType = escapeHtml(scenePlan.contentType || 'fallback');
    const layoutIntent = escapeHtml(scenePlan.layoutIntent || 'fallback-summary');

    return `
    <section
      class="slide"
      data-scene="${scenePlan.pageOrder}"
      data-duration="${scenePlan.pageDuration}"
      data-base-scene="${scenePlan.baseSceneId}"
      data-content-type="${contentType}"
      data-layout-intent="${layoutIntent}"
    >
      <!-- AI 创作占位：${sceneTitle} (${contentType} / ${layoutIntent}) -->
      <div style="display:grid;place-items:center;height:100%;padding:80px;">
        <div style="text-align:center;opacity:0.5;">
          <p style="font-size:18px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:24px;">
            ${contentType} · ${layoutIntent}
          </p>
          <h2 style="font-family:var(--font-display);font-size:64px;line-height:1.02;margin-bottom:16px;" data-enter-at="0">
            ${sceneTitle}
          </h2>
          <p style="font-size:20px;color:var(--color-text-muted);" data-enter-at="400">
            此页需要 AI 创作 SVG/CSS 动画 — 请用 skill 指导重新生成
          </p>
        </div>
      </div>
    </section>`;
  }).join('\n');

  const timelineConfig = JSON.stringify(buildTimelineConfig(plan), null, 2);
  const presentationJson = JSON.stringify({ parsed, plan }, null, 2);
  const title = escapeHtml(parsed.meta?.title || 'Visual Narrative Output');
  const tag = escapeHtml(parsed.meta?.theme || 'visual narrative');

  return template
    .replace(/__APP_TITLE__/g, title)
    .replace('__PRESENTATION_TAG__', tag)
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
    console.error('用法: node render-presentation.js <input.md> [--plan-output context.json] [--output output.html]');
    console.error('');
    console.error('  --plan-output <file>  输出 planner 上下文 JSON（推荐）');
    console.error('  --output <file>       输出占位 HTML（deprecated，真正的 HTML 由 AI 手写）');
    process.exit(1);
  }

  const parsed = parseMarkdown(markdown);
  const plan = buildPresentationPlan(parsed);

  if (planOutputPath) {
    const context = {
      parsedResult: parsed,
      presentationPlan: plan,
      timelineConfig: buildTimelineConfig(plan),
      _note: '此 JSON 供 AI 创作 SVG/CSS 动画 HTML 时参考。HTML 不再由此脚本生成。'
    };
    fs.writeFileSync(path.resolve(planOutputPath), JSON.stringify(context, null, 2), 'utf-8');
    console.error(`已写入 planner 上下文: ${planOutputPath}`);
  }

  if (outputPath) {
    console.error('[deprecated] --output 生成的是占位 HTML，请改用 AI skill 创作真正的视觉叙事页面。');
    const html = renderPresentation(parsed, plan);
    fs.writeFileSync(path.resolve(outputPath), html, 'utf-8');
    console.error(`已写入占位 HTML: ${outputPath}`);
  }

  if (!planOutputPath && !outputPath) {
    const context = {
      parsedResult: parsed,
      presentationPlan: plan,
      timelineConfig: buildTimelineConfig(plan)
    };
    console.log(JSON.stringify(context, null, 2));
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    renderPresentation,
    buildTimelineConfig,
    parseArgs
  };
}
