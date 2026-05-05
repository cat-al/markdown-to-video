#!/usr/bin/env node

/**
 * incremental-assemble.js — 镜头蒙太奇增量组装
 *
 * 逐画布组构建 presentation.html，支持断点恢复。
 *
 * 命令：
 *   init     - 初始化骨架 HTML 和 .build/ 目录
 *   append   - 追加一个画布组的镜头 HTML
 *   finalize - 完成组装，注入配置，清理临时文件
 *   status   - 查看当前进度
 *
 * 用法：
 *   node incremental-assemble.js init --project-dir <dir>
 *   node incremental-assemble.js append --project-dir <dir> --group-id N --shots-html <file>
 *   node incremental-assemble.js finalize --project-dir <dir>
 *   node incremental-assemble.js status --project-dir <dir>
 */

const fs = require('fs');
const path = require('path');

const SKILL_DIR = path.resolve(__dirname, '..');
const TEMPLATE_PATH = path.join(SKILL_DIR, 'templates', 'slide-base.html');
const TEXTURE_PATH = path.join(SKILL_DIR, 'assets', 'paper-texture-bg.png');

// ─── 参数解析 ───
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = (i + 1 < args.length && !args[i + 1].startsWith('--')) ? args[++i] : true;
      result[key] = val;
    } else if (!result._command) {
      result._command = args[i];
    }
  }
  return result;
}

// ─── init ───
function init(projectDir) {
  const buildDir = path.join(projectDir, '.build');
  fs.mkdirSync(buildDir, { recursive: true });

  // 读取解析结果（如果存在）
  const scriptPath = path.join(projectDir, 'script.md');
  let meta = {};
  if (fs.existsSync(scriptPath)) {
    const { parseMarkdown } = require('./parse-markdown.js');
    const content = fs.readFileSync(scriptPath, 'utf-8');
    const parsed = parseMarkdown(content);
    meta = parsed.meta;

    // 保存解析结果
    fs.writeFileSync(path.join(buildDir, 'parsed.json'), JSON.stringify(parsed, null, 2));
  }

  // 写入进度文件
  const progress = {
    status: 'initialized',
    totalGroups: meta.canvas_groups || 0,
    totalShots: meta.total_shots || 0,
    completedGroups: [],
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(buildDir, 'progress.json'), JSON.stringify(progress, null, 2));

  // 创建骨架 HTML（仅占位）
  const skeletonHtml = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const html = skeletonHtml
    .replace('__APP_TITLE__', meta.title || 'Presentation')
    .replace('__PRESENTATION_TAG__', meta.topic || '')
    .replace('__SLIDES__', '<!-- SLIDES_PLACEHOLDER -->')
    .replace('__PRESENTATION_DATA__', '{}')
    .replace('__TIMELINE_CONFIG__', JSON.stringify({
      autoPlay: true,
      shots: [],
      shotGap: 300,
      groupTransition: 600
    }));

  fs.writeFileSync(path.join(projectDir, 'presentation.html'), html);

  console.log(`✓ 初始化完成`);
  console.log(`  项目目录: ${projectDir}`);
  console.log(`  画布组数: ${meta.canvas_groups || '未知'}`);
  console.log(`  镜头总数: ${meta.total_shots || '未知'}`);
}

// ─── append ───
function append(projectDir, groupId, shotsHtmlPath) {
  const buildDir = path.join(projectDir, '.build');
  const progressPath = path.join(buildDir, 'progress.json');

  if (!fs.existsSync(progressPath)) {
    console.error('错误：请先运行 init');
    process.exit(1);
  }

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  const shotsHtml = fs.readFileSync(shotsHtmlPath, 'utf-8');

  // 保存画布组 HTML
  fs.writeFileSync(path.join(buildDir, `group-${groupId}.html`), shotsHtml);

  // 更新进度
  if (!progress.completedGroups.includes(parseInt(groupId))) {
    progress.completedGroups.push(parseInt(groupId));
    progress.completedGroups.sort((a, b) => a - b);
  }
  progress.status = 'in-progress';
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

  console.log(`✓ 画布组 ${groupId} 已追加`);
  console.log(`  进度: ${progress.completedGroups.length}/${progress.totalGroups}`);
}

// ─── finalize ───
function finalize(projectDir) {
  const buildDir = path.join(projectDir, '.build');
  const progressPath = path.join(buildDir, 'progress.json');

  if (!fs.existsSync(progressPath)) {
    console.error('错误：请先运行 init');
    process.exit(1);
  }

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  const parsedPath = path.join(buildDir, 'parsed.json');
  const parsed = fs.existsSync(parsedPath) ? JSON.parse(fs.readFileSync(parsedPath, 'utf-8')) : { meta: {}, shots: [] };

  // 收集所有画布组 HTML
  const allSlides = [];
  for (const gid of progress.completedGroups) {
    const groupHtmlPath = path.join(buildDir, `group-${gid}.html`);
    if (fs.existsSync(groupHtmlPath)) {
      allSlides.push(fs.readFileSync(groupHtmlPath, 'utf-8'));
    }
  }

  const slidesHtml = allSlides.join('\n\n');

  // 构建 timelineConfig
  const timelineConfig = {
    autoPlay: true,
    shots: parsed.shots.map(shot => ({
      id: shot.id,
      canvasGroup: shot.canvasGroup,
      duration: 3000  // 默认值，后续由 subtitle-timeline 回填
    })),
    shotGap: 300,
    groupTransition: 600
  };

  // 构建 presentationData
  const presentationData = {
    title: parsed.meta.title || '',
    totalShots: parsed.shots.length,
    canvasGroups: parsed.canvasGroups ? parsed.canvasGroups.length : 0,
    shots: parsed.shots.map(s => ({
      id: s.id,
      canvasGroup: s.canvasGroup,
      narration: s.narration
    }))
  };

  // 读取模板并注入
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const html = template
    .replace('__APP_TITLE__', parsed.meta.title || 'Presentation')
    .replace('__PRESENTATION_TAG__', parsed.meta.topic || '')
    .replace('__SLIDES__', slidesHtml)
    .replace('__PRESENTATION_DATA__', JSON.stringify(presentationData))
    .replace('__TIMELINE_CONFIG__', JSON.stringify(timelineConfig));

  fs.writeFileSync(path.join(projectDir, 'presentation.html'), html);

  // 复制背景纹理
  if (fs.existsSync(TEXTURE_PATH)) {
    fs.copyFileSync(TEXTURE_PATH, path.join(projectDir, 'paper-texture-bg.png'));
  }

  // 更新进度
  progress.status = 'completed';
  progress.completedAt = new Date().toISOString();
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

  // 清理（保留 progress.json 用于状态查询，删除临时 HTML）
  for (const gid of progress.completedGroups) {
    const groupHtmlPath = path.join(buildDir, `group-${gid}.html`);
    if (fs.existsSync(groupHtmlPath)) fs.unlinkSync(groupHtmlPath);
  }

  console.log(`✓ 组装完成`);
  console.log(`  输出: ${path.join(projectDir, 'presentation.html')}`);
  console.log(`  镜头数: ${parsed.shots.length}`);
  console.log(`  画布组: ${progress.completedGroups.length}`);
}

// ─── status ───
function status(projectDir) {
  const buildDir = path.join(projectDir, '.build');
  const progressPath = path.join(buildDir, 'progress.json');

  if (!fs.existsSync(progressPath)) {
    console.log(JSON.stringify({ status: 'not-initialized' }));
    return;
  }

  const progress = JSON.parse(fs.readFileSync(progressPath, 'utf-8'));
  const remaining = [];
  for (let i = 1; i <= progress.totalGroups; i++) {
    if (!progress.completedGroups.includes(i)) remaining.push(i);
  }

  const output = {
    status: progress.status,
    totalGroups: progress.totalGroups,
    totalShots: progress.totalShots,
    completed: progress.completedGroups,
    remaining,
    progress: `${progress.completedGroups.length}/${progress.totalGroups}`
  };

  console.log(JSON.stringify(output, null, 2));
}

// ─── main ───
function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._command;
  const projectDir = args['project-dir'];

  if (!command) {
    console.error('用法: node incremental-assemble.js <init|append|finalize|status> --project-dir <dir>');
    process.exit(1);
  }

  if (!projectDir) {
    console.error('错误：必须指定 --project-dir');
    process.exit(1);
  }

  switch (command) {
    case 'init':
      init(projectDir);
      break;
    case 'append':
      if (!args['group-id'] || !args['shots-html']) {
        console.error('错误：append 需要 --group-id 和 --shots-html 参数');
        process.exit(1);
      }
      append(projectDir, args['group-id'], args['shots-html']);
      break;
    case 'finalize':
      finalize(projectDir);
      break;
    case 'status':
      status(projectDir);
      break;
    default:
      console.error(`未知命令: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { init, append, finalize, status };
