#!/usr/bin/env node

/**
 * video_render.js — 视频输出主入口
 *
 * 调度三阶段管线：
 *   1. record  — Puppeteer 截帧 pipe FFmpeg → silent.mp4
 *   2. audio   — FFmpeg concat 逐句 WAV    → full-audio.wav
 *   3. compose — FFmpeg 合成视频+音频+字幕  → final.mp4
 *
 * 用法:
 *   node video_render.js --manifest output/tts-manifest.json --srt output/subtitles.srt
 *   node video_render.js --stage record --manifest output/tts-manifest.json
 *   node video_render.js --stage audio --manifest output/tts-manifest.json
 *   node video_render.js --stage compose --manifest output/tts-manifest.json --srt output/subtitles.srt
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// skill 根目录（package.json 所在位置）
const SKILL_DIR = path.resolve(__dirname, '..');

/**
 * 确保 skill 目录下的 node_modules 已安装。
 * 如果 node_modules 不存在，自动执行 npm install。
 */
function ensureDependencies() {
  const nodeModulesDir = path.join(SKILL_DIR, 'node_modules');
  const packageJson = path.join(SKILL_DIR, 'package.json');

  if (!fs.existsSync(packageJson)) {
    console.error('❌ 缺少 package.json，skill 目录不完整');
    process.exit(1);
  }

  if (!fs.existsSync(nodeModulesDir)) {
    console.log('📦 首次运行，自动安装依赖...');
    try {
      execSync('npm install --production', {
        cwd: SKILL_DIR,
        stdio: 'inherit',
      });
      console.log('✅ 依赖安装完成\n');
    } catch {
      console.error('❌ npm install 失败，请手动在 skill 目录执行: npm install');
      process.exit(1);
    }
  }
}

// 先确保依赖就绪，再 require 第三方包
ensureDependencies();

const { runRecord } = require('./record');
const { runAudio } = require('./audio');
const { runCompose } = require('./compose');

// ---- 参数解析 ----

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    stage: null,        // null = 全部阶段
    manifest: null,
    srt: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--stage':
        opts.stage = args[++i];
        break;
      case '--manifest':
        opts.manifest = args[++i];
        break;
      case '--srt':
        opts.srt = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  return opts;
}

function printUsage() {
  console.log(`
用法: node video_render.js [选项]

选项:
  --manifest <path>  tts-manifest.json 路径（必需）
  --srt <path>       SRT 字幕文件路径（compose 阶段必需）
  --stage <name>     只运行指定阶段: record | audio | compose
  -h, --help         显示帮助

示例:
  node video_render.js --manifest output/tts-manifest.json --srt output/subtitles.srt
  node video_render.js --stage record --manifest output/tts-manifest.json
`);
}

// ---- 前置检查 ----

function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    console.error('❌ FFmpeg 未安装。请运行: brew install ffmpeg');
    process.exit(1);
  }
}

function checkPuppeteer() {
  try {
    require.resolve('puppeteer', { paths: [SKILL_DIR] });
  } catch {
    console.error('❌ Puppeteer 未安装。请在 skill 目录执行: cd ' + SKILL_DIR + ' && npm install');
    process.exit(1);
  }
}

function loadManifest(manifestPath) {
  if (!manifestPath) {
    console.error('❌ 缺少 --manifest 参数');
    process.exit(1);
  }

  const absPath = path.resolve(manifestPath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ manifest 文件不存在: ${absPath}`);
    console.error('   请先运行 tts-voiceover skill 生成 tts-manifest.json');
    process.exit(1);
  }

  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } catch (err) {
    console.error(`❌ manifest 解析失败: ${err.message}`);
    process.exit(1);
  }
}

function validateInputs(manifest, srtPath, stage) {
  // 检查 HTML 文件
  const htmlPath = manifest.html_path;
  if (!htmlPath || !fs.existsSync(htmlPath)) {
    console.error(`❌ HTML 文件不存在: ${htmlPath || '(未指定)'}`);
    console.error('   请检查 manifest 的 html_path 字段');
    process.exit(1);
  }

  // compose 阶段需要 SRT
  if (stage === 'compose' || stage === null) {
    if (!srtPath) {
      console.error('❌ compose 阶段需要 --srt 参数');
      process.exit(1);
    }
    if (!fs.existsSync(srtPath)) {
      console.error(`❌ SRT 文件不存在: ${srtPath}`);
      console.error('   请先运行 subtitle-timeline skill 生成 subtitles.srt');
      process.exit(1);
    }
  }

  return htmlPath;
}

// ---- 主流程 ----

async function main() {
  const startTime = Date.now();
  const opts = parseArgs();

  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('  🎬 Video Render — 视频输出');
  console.log('═══════════════════════════════════════════');
  console.log('');

  // 前置检查
  checkFFmpeg();

  const stages = opts.stage ? [opts.stage] : ['record', 'audio', 'compose'];

  if (stages.includes('record')) {
    checkPuppeteer();
  }

  // 加载 manifest
  const manifest = loadManifest(opts.manifest);
  const htmlPath = validateInputs(manifest, opts.srt, opts.stage);
  const outputDir = path.join(path.dirname(opts.manifest), 'video');

  console.log(`📂 输出目录: ${outputDir}`);
  console.log(`📋 阶段: ${stages.join(' → ')}`);
  console.log('');

  // ---- 执行管线 ----

  let silentMp4 = path.join(outputDir, 'silent.mp4');
  let fullAudio = path.join(outputDir, 'full-audio.wav');

  for (const stage of stages) {
    switch (stage) {
      case 'record':
        silentMp4 = await runRecord({ htmlPath, outputDir });
        break;

      case 'audio':
        fullAudio = await runAudio({ manifest, outputDir, htmlPath });
        break;

      case 'compose':
        await runCompose({
          silentMp4,
          fullAudio,
          srtPath: path.resolve(opts.srt),
          outputDir,
        });
        break;

      default:
        console.error(`❌ 未知阶段: ${stage}`);
        console.error('   可选: record | audio | compose');
        process.exit(1);
    }

    console.log('');
  }

  // 总耗时
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`⏱️  总耗时: ${elapsed}s`);
}

main().catch((err) => {
  console.error('');
  console.error('❌ 视频渲染失败:');
  console.error(err.message || err);
  process.exit(1);
});
