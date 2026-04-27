#!/usr/bin/env node

/**
 * incremental-assemble.js
 *
 * 增量场景组装工具。将 AI 逐场景创作的 HTML 片段增量组装到 presentation.html。
 *
 * 子命令:
 *   init     — 从 slide-base.html 生成骨架 HTML，创建 .build/ 目录
 *   append   — 将场景 HTML 片段追加到 presentation.html
 *   finalize — 注入所有 config 占位符，清理临时文件
 *   status   — 输出当前构建进度
 *
 * 用法:
 *   node incremental-assemble.js init     --project-dir <path> --context <json>
 *   node incremental-assemble.js append   --project-dir <path> --scene-id <N> --slides-html <file> [--step-config <json-file>]
 *   node incremental-assemble.js finalize --project-dir <path>
 *   node incremental-assemble.js status   --project-dir <path>
 */

const fs = require('fs');
const path = require('path');

const TEMPLATE_PATH = path.resolve(__dirname, '../templates/slide-base.html');
const ASSETS_DIR = path.resolve(__dirname, '../assets');
const INSERT_MARKER = '<!-- __INCREMENTAL_INSERT__ -->';

// ── 工具函数 ──

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getBuildDir(projectDir) {
  return path.join(projectDir, '.build');
}

function getBuildStatePath(projectDir) {
  return path.join(getBuildDir(projectDir), 'build-state.json');
}

function getContextPath(projectDir) {
  return path.join(getBuildDir(projectDir), 'context.json');
}

function getHtmlPath(projectDir) {
  return path.join(projectDir, 'presentation.html');
}

// ── buildTimelineConfig（与 render-presentation.js 保持一致）──

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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── init ──

function cmdInit(projectDir, contextPath) {
  const buildDir = getBuildDir(projectDir);
  const htmlPath = getHtmlPath(projectDir);

  // 读取模板
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');

  // 读取 planner 上下文
  const context = readJSON(contextPath);
  const plan = context.presentationPlan || context.plan || {};
  const scenePlans = plan.scenePlans || [];

  // 提取所有唯一的 baseSceneId
  const sceneIds = [...new Set(scenePlans.map(sp => sp.baseSceneId))].sort((a, b) => a - b);

  // 生成骨架 HTML：将 __SLIDES__ 替换为插入标记，其他占位符保留
  const skeleton = template.replace('__SLIDES__', `\n${INSERT_MARKER}\n`);

  // 写入骨架 HTML
  ensureDir(projectDir);
  fs.writeFileSync(htmlPath, skeleton, 'utf-8');

  // 创建 .build/ 目录
  ensureDir(buildDir);

  // 复制 context 到 .build/
  const buildContextPath = getContextPath(projectDir);
  fs.copyFileSync(path.resolve(contextPath), buildContextPath);

  // 初始化 build-state.json
  const buildState = {
    totalScenes: sceneIds.length,
    sceneIds: sceneIds,
    completedScenes: [],
    stepConfig: {},
    startedAt: new Date().toISOString()
  };
  writeJSON(getBuildStatePath(projectDir), buildState);

  console.error(`✓ init 完成`);
  console.error(`  骨架 HTML: ${htmlPath}`);
  console.error(`  构建目录: ${buildDir}`);
  console.error(`  场景总数: ${sceneIds.length}（${sceneIds.join(', ')}）`);
}

// ── append ──

function cmdAppend(projectDir, sceneId, slidesHtmlPath, stepConfigPath) {
  const htmlPath = getHtmlPath(projectDir);
  const buildDir = getBuildDir(projectDir);
  const buildStatePath = getBuildStatePath(projectDir);

  // 验证构建状态存在
  if (!fs.existsSync(buildStatePath)) {
    console.error('✗ 未找到 build-state.json，请先运行 init');
    process.exit(1);
  }

  const buildState = readJSON(buildStatePath);

  // 检查是否重复追加
  if (buildState.completedScenes.includes(sceneId)) {
    console.error(`⚠ 场景 ${sceneId} 已经追加过，跳过`);
    return;
  }

  // 读取 slide HTML 片段
  const slidesHtml = fs.readFileSync(slidesHtmlPath, 'utf-8');

  // 读取 presentation.html 并在标记处插入
  let html = fs.readFileSync(htmlPath, 'utf-8');
  const markerIndex = html.indexOf(INSERT_MARKER);
  if (markerIndex === -1) {
    console.error('✗ 未找到插入标记 <!-- __INCREMENTAL_INSERT__ -->，HTML 可能已被 finalize');
    process.exit(1);
  }

  // 在标记之前插入内容
  html = html.slice(0, markerIndex) + slidesHtml + '\n' + html.slice(markerIndex);
  fs.writeFileSync(htmlPath, html, 'utf-8');

  // 备份片段
  const backupPath = path.join(buildDir, `scene-${sceneId}.html`);
  fs.writeFileSync(backupPath, slidesHtml, 'utf-8');

  // 合并 stepConfig
  if (stepConfigPath && fs.existsSync(stepConfigPath)) {
    const sceneStepConfig = readJSON(stepConfigPath);
    Object.assign(buildState.stepConfig, sceneStepConfig);

    // 备份 stepConfig
    const stepBackupPath = path.join(buildDir, `scene-${sceneId}-step-config.json`);
    fs.copyFileSync(stepConfigPath, stepBackupPath);
  }

  // 更新状态
  buildState.completedScenes.push(sceneId);
  buildState.completedScenes.sort((a, b) => a - b);
  writeJSON(buildStatePath, buildState);

  const remaining = buildState.sceneIds.filter(id => !buildState.completedScenes.includes(id));
  console.error(`✓ 场景 ${sceneId} 追加完成`);
  console.error(`  进度: ${buildState.completedScenes.length}/${buildState.totalScenes}`);
  if (remaining.length > 0) {
    console.error(`  剩余: ${remaining.join(', ')}`);
  }
}

// ── finalize ──

function cmdFinalize(projectDir) {
  const htmlPath = getHtmlPath(projectDir);
  const buildDir = getBuildDir(projectDir);
  const buildStatePath = getBuildStatePath(projectDir);
  const contextPath = getContextPath(projectDir);

  if (!fs.existsSync(buildStatePath)) {
    console.error('✗ 未找到 build-state.json，请先运行 init');
    process.exit(1);
  }

  const buildState = readJSON(buildStatePath);
  const context = readJSON(contextPath);
  const parsedResult = context.parsedResult || context.parsed || {};
  const plan = context.presentationPlan || context.plan || {};

  // 检查是否所有场景已完成
  const remaining = buildState.sceneIds.filter(id => !buildState.completedScenes.includes(id));
  if (remaining.length > 0) {
    console.error(`⚠ 还有 ${remaining.length} 个场景未完成: ${remaining.join(', ')}`);
    console.error('  继续 finalize 将只包含已完成的场景');
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');

  // 移除插入标记
  html = html.replace(INSERT_MARKER, '');

  // 替换占位符
  const timelineConfig = buildTimelineConfig(plan);
  const presentationData = { parsed: parsedResult, plan };
  const title = escapeHtml(parsedResult.meta?.title || 'Visual Narrative Output');
  const tag = escapeHtml(parsedResult.meta?.theme || parsedResult.meta?.topic || 'visual narrative');
  const stepConfig = buildState.stepConfig || {};

  html = html
    .replace(/__APP_TITLE__/g, title)
    .replace('__PRESENTATION_TAG__', tag)
    .replace('__TIMELINE_CONFIG__', JSON.stringify(timelineConfig, null, 2))
    .replace('__PRESENTATION_DATA__', JSON.stringify(presentationData, null, 2))
    .replace('__STEP_CONFIG__', JSON.stringify(stepConfig, null, 2));

  fs.writeFileSync(htmlPath, html, 'utf-8');

  // 复制背景纹理
  const bgSrc = path.join(ASSETS_DIR, 'paper-texture-bg.png');
  const bgDest = path.join(projectDir, 'paper-texture-bg.png');
  if (fs.existsSync(bgSrc) && !fs.existsSync(bgDest)) {
    fs.copyFileSync(bgSrc, bgDest);
    console.error(`  背景纹理已复制: ${bgDest}`);
  }

  // 删除 .build/ 目录
  fs.rmSync(buildDir, { recursive: true, force: true });

  console.error(`✓ finalize 完成`);
  console.error(`  产物: ${htmlPath}`);
  console.error(`  已完成场景: ${buildState.completedScenes.length}/${buildState.totalScenes}`);
  console.error(`  .build/ 已清理`);
}

// ── status ──

function cmdStatus(projectDir) {
  const buildStatePath = getBuildStatePath(projectDir);
  const contextPath = getContextPath(projectDir);

  if (!fs.existsSync(buildStatePath)) {
    // 检查是否已经 finalize（无 .build/ 但有 presentation.html）
    if (fs.existsSync(getHtmlPath(projectDir))) {
      const result = { status: 'finalized', message: '构建已完成，.build/ 已清理' };
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const result = { status: 'not-started', message: '未找到构建状态，请先运行 init' };
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const buildState = readJSON(buildStatePath);
  const remaining = buildState.sceneIds.filter(id => !buildState.completedScenes.includes(id));

  const result = {
    status: 'in-progress',
    total: buildState.totalScenes,
    completed: buildState.completedScenes,
    remaining: remaining,
    progress: `${buildState.completedScenes.length}/${buildState.totalScenes}`,
    startedAt: buildState.startedAt
  };

  // 如果有 context，提取下一个待创作场景的摘要
  if (remaining.length > 0 && fs.existsSync(contextPath)) {
    const context = readJSON(contextPath);
    const plan = context.presentationPlan || context.plan || {};
    const nextSceneId = remaining[0];
    const nextPlans = (plan.scenePlans || []).filter(sp => sp.baseSceneId === nextSceneId);
    result.nextScene = {
      sceneId: nextSceneId,
      slideCount: nextPlans.length,
      plans: nextPlans.map(sp => ({
        planId: sp.planId,
        contentType: sp.contentType,
        mode: sp.mode,
        layoutIntent: sp.layoutIntent,
        baseSceneTitle: sp.baseSceneTitle
      }))
    };
  }

  console.log(JSON.stringify(result, null, 2));
}

// ── 参数解析 ──

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    command: null,
    projectDir: null,
    context: null,
    sceneId: null,
    slidesHtml: null,
    stepConfig: null
  };

  if (args.length === 0) {
    return options;
  }

  // 第一个非 -- 参数是子命令
  let i = 0;
  if (!args[0].startsWith('-')) {
    options.command = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--project-dir':
        options.projectDir = path.resolve(args[++i]);
        break;
      case '--context':
        options.context = path.resolve(args[++i]);
        break;
      case '--scene-id':
        options.sceneId = parseInt(args[++i], 10);
        break;
      case '--slides-html':
        options.slidesHtml = path.resolve(args[++i]);
        break;
      case '--step-config':
        options.stepConfig = path.resolve(args[++i]);
        break;
      default:
        if (!arg.startsWith('-') && !options.command) {
          options.command = arg;
        }
        break;
    }
  }

  return options;
}

function printUsage() {
  console.error(`用法:
  node incremental-assemble.js init     --project-dir <path> --context <json>
  node incremental-assemble.js append   --project-dir <path> --scene-id <N> --slides-html <file> [--step-config <json>]
  node incremental-assemble.js finalize --project-dir <path>
  node incremental-assemble.js status   --project-dir <path>`);
}

// ── main ──

function main() {
  const options = parseArgs(process.argv);

  if (!options.command) {
    printUsage();
    process.exit(1);
  }

  if (!options.projectDir && options.command !== 'help') {
    console.error('✗ 缺少 --project-dir 参数');
    printUsage();
    process.exit(1);
  }

  switch (options.command) {
    case 'init':
      if (!options.context) {
        console.error('✗ init 需要 --context 参数');
        process.exit(1);
      }
      cmdInit(options.projectDir, options.context);
      break;

    case 'append':
      if (options.sceneId == null || isNaN(options.sceneId)) {
        console.error('✗ append 需要 --scene-id 参数');
        process.exit(1);
      }
      if (!options.slidesHtml) {
        console.error('✗ append 需要 --slides-html 参数');
        process.exit(1);
      }
      cmdAppend(options.projectDir, options.sceneId, options.slidesHtml, options.stepConfig);
      break;

    case 'finalize':
      cmdFinalize(options.projectDir);
      break;

    case 'status':
      cmdStatus(options.projectDir);
      break;

    default:
      console.error(`✗ 未知子命令: ${options.command}`);
      printUsage();
      process.exit(1);
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    cmdInit,
    cmdAppend,
    cmdFinalize,
    cmdStatus,
    buildTimelineConfig,
    parseArgs
  };
}
