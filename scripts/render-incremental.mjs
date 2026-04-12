#!/usr/bin/env node

/**
 * 增量渲染 —— 只重新渲染改动的页，其他页复用缓存片段，ffmpeg 拼接
 *
 * 用法:
 *   node scripts/render-incremental.mjs <input.md> [output.mp4]
 *
 * 原理:
 *   1. 为每页生成内容指纹（markdown + narration + audioSrc + duration）
 *   2. 与上次渲染的指纹对比，只重新渲染变化的页
 *   3. 每页渲染为独立 mp4 片段，存在 public/generated/<name>/segments/
 *   4. ffmpeg concat 拼接所有片段为最终视频
 *
 * 性能:
 *   - 首次渲染：与全量渲染相同
 *   - 只换某页音频：只渲染该页（1-2 分钟），其余复用
 *   - 只改样式代码：所有页都会重新渲染（指纹不含样式）
 *     如需强制全量：删除 segments/ 目录即可
 */

import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, statSync} from 'node:fs';
import {basename, dirname, extname, resolve, join} from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  buildSrt,
  createPresentationAssets,
  DEFAULT_FPS,
  readMarkdownFile,
  sanitizeFileSegment,
  writeTextFile,
} from './lib/markdown-video-pipeline.mjs';

const args = process.argv.slice(2);
const flagArgs = args.filter((a) => a.startsWith('--'));
const posArgs = args.filter((a) => !a.startsWith('--'));
const forceAll = flagArgs.includes('--force');

const inputArg = posArgs[0];
const outputArg = posArgs[1];

if (!inputArg) {
  console.log(`
用法: node scripts/render-incremental.mjs <input.md> [output.mp4] [--force]

示例:
  node scripts/render-incremental.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md
  node scripts/render-incremental.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md dist/output.mp4
  node scripts/render-incremental.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md --force

选项:
  --force   强制重新渲染所有页（改了样式代码时使用）
  `.trim());
  process.exit(1);
}

const cwd = process.cwd();
const inputPath = resolve(cwd, inputArg);

if (!existsSync(inputPath)) {
  console.error(`找不到 Markdown 文件: ${inputPath}`);
  process.exit(1);
}

const outputPath = outputArg
  ? resolve(cwd, outputArg)
  : resolve(cwd, 'dist', `${basename(inputPath, extname(inputPath))}.mp4`);
const subtitlesPath = outputPath.replace(/\.[^.]+$/, '.srt');

const assetKey = sanitizeFileSegment(basename(inputPath, extname(inputPath))) || 'presentation';
const assetDir = resolve(cwd, 'public', 'generated', assetKey);
const assetPrefix = `generated/${assetKey}`;
const segmentsDir = join(assetDir, 'segments');

mkdirSync(dirname(outputPath), {recursive: true});
mkdirSync(segmentsDir, {recursive: true});

// Step 1: Generate TTS assets (with cache)
console.log(`[incremental] 生成 TTS 音频 ...`);
const markdownText = readMarkdownFile(inputPath);
const presentation = createPresentationAssets({
  markdownText,
  fps: DEFAULT_FPS,
  assetDir,
  assetPrefix,
});

// Step 2: Generate SRT
writeTextFile(subtitlesPath, buildSrt(presentation, DEFAULT_FPS));

// Step 3: Compare fingerprints to find changed slides
const fingerprintPath = join(segmentsDir, 'fingerprints.json');
let oldFingerprints = {};
if (existsSync(fingerprintPath)) {
  try { oldFingerprints = JSON.parse(readFileSync(fingerprintPath, 'utf8')); } catch {}
}

const createSlideFingerprint = (slide) => {
  return createHash('sha1').update(JSON.stringify({
    markdown: slide.markdown,
    narration: slide.narration,
    audioSrc: slide.audioSrc,
    durationInFrames: slide.durationInFrames,
    layout: slide.layout,
    accentColor: slide.accentColor,
    heading: slide.heading,
  })).digest('hex');
};

const newFingerprints = {};
const slidesToRender = [];

// Calculate frame offsets
const slideOffsets = [];
let offset = 0;
for (const s of presentation.slides) {
  slideOffsets.push(offset);
  offset += s.durationInFrames;
}

presentation.slides.forEach((slide, index) => {
  const num = index + 1;
  const segmentFile = `segment-${String(num).padStart(2, '0')}.mp4`;
  const segmentPath = join(segmentsDir, segmentFile);
  const fp = createSlideFingerprint(slide);
  newFingerprints[segmentFile] = fp;

  if (forceAll || oldFingerprints[segmentFile] !== fp || !existsSync(segmentPath)) {
    slidesToRender.push({num, index, slide, segmentPath, segmentFile});
  }
});

const totalSlides = presentation.slides.length;
const cachedCount = totalSlides - slidesToRender.length;

if (cachedCount > 0) {
  console.log(`[incremental] 复用 ${cachedCount}/${totalSlides} 页视频片段`);
}

if (slidesToRender.length === 0) {
  console.log(`[incremental] 所有页均无变化，直接拼接`);
} else {
  console.log(`[incremental] 需要渲染 ${slidesToRender.length} 页: ${slidesToRender.map((s) => s.num).join(', ')}\n`);
}

// Step 4: Render changed slides
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const fullProps = JSON.stringify({markdown: markdownText, presentation});
const fullPropsFile = join(segmentsDir, '_tmp_props.json');
writeFileSync(fullPropsFile, fullProps, 'utf8');

let renderFailed = false;

for (const {num, index, slide, segmentPath} of slidesToRender) {
  const startFrame = slideOffsets[index];
  const endFrame = startFrame + slide.durationInFrames - 1;

  console.log(`[incremental] 渲染第 ${num}/${totalSlides} 页: "${slide.heading}" (${(slide.durationInFrames / DEFAULT_FPS).toFixed(1)}s)`);

  const result = spawnSync(npxCmd, [
    'remotion', 'render', 'src/index.ts', 'MarkdownVideo', segmentPath,
    '--props', fullPropsFile,
    '--frames', `${startFrame}-${endFrame}`,
  ], {cwd, stdio: 'inherit', env: process.env});

  if (result.status !== 0) {
    console.error(`[incremental] 第 ${num} 页渲染失败`);
    renderFailed = true;
    break;
  }
}

try { unlinkSync(fullPropsFile); } catch {}

if (renderFailed) {
  console.error(`[incremental] 渲染中断`);
  process.exit(1);
}

// Step 5: Save fingerprints
writeFileSync(fingerprintPath, JSON.stringify(newFingerprints, null, 2), 'utf8');

// Step 6: ffmpeg concat
console.log(`\n[incremental] 拼接 ${totalSlides} 个片段 ...`);

const concatListPath = join(segmentsDir, '_concat.txt');
const concatLines = presentation.slides.map((_, index) => {
  const segmentFile = `segment-${String(index + 1).padStart(2, '0')}.mp4`;
  return `file '${join(segmentsDir, segmentFile)}'`;
});
writeFileSync(concatListPath, concatLines.join('\n'), 'utf8');

const ffmpegResult = spawnSync('ffmpeg', [
  '-y',
  '-f', 'concat',
  '-safe', '0',
  '-i', concatListPath,
  '-c', 'copy',
  outputPath,
], {cwd, stdio: 'inherit'});

try { unlinkSync(concatListPath); } catch {}

if (ffmpegResult.status !== 0) {
  console.error(`[incremental] ffmpeg 拼接失败`);
  process.exit(1);
}

const fileSize = (statSync(outputPath).size / (1024 * 1024)).toFixed(1);
console.log(`\n[incremental] 完成: ${outputPath} (${fileSize} MB)`);
console.log(`[incremental] 字幕: ${subtitlesPath}`);
console.log(`[incremental] 渲染: ${slidesToRender.length} 页, 复用: ${cachedCount} 页`);
