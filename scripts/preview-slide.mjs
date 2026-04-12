#!/usr/bin/env node

/**
 * 单页预览工具 —— 逐页确认画面 + 音频后再合成完整视频
 *
 * 用法:
 *   node scripts/preview-slide.mjs <input.md> <页码>
 *   node scripts/preview-slide.mjs <input.md> all
 *
 * 示例:
 *   # 预览第 5 页（生成单页 mp4 + 打开播放）
 *   node scripts/preview-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 5
 *
 *   # 逐页预览所有页（每页生成一个 mp4）
 *   node scripts/preview-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md all
 *
 * 输出:
 *   dist/preview/<assetKey>/slide-05.mp4   单页视频
 *   public/generated/<assetKey>/slide-05.wav  单页音频（可单独试听）
 */

import {existsSync, mkdirSync, writeFileSync, unlinkSync} from 'node:fs';
import {basename, extname, resolve, join, dirname} from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  createPresentationAssets,
  DEFAULT_FPS,
  readMarkdownFile,
  sanitizeFileSegment,
} from './lib/markdown-video-pipeline.mjs';

const args = process.argv.slice(2);
const inputArg = args[0];
const slideSpec = args[1];

if (!inputArg || !slideSpec) {
  console.log(`
用法: node scripts/preview-slide.mjs <input.md> <页码|all>

示例:
  node scripts/preview-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 5
  node scripts/preview-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md all

说明:
  - 指定页码时，只生成该页的单页视频
  - 使用 all 时，为每一页分别生成单页视频
  - 输出到 dist/preview/<name>/slide-NN.mp4
  - 音频在 public/generated/<name>/slide-NN.wav
  `.trim());
  process.exit(1);
}

const cwd = process.cwd();
const inputPath = resolve(cwd, inputArg);

if (!existsSync(inputPath)) {
  console.error(`找不到 Markdown 文件: ${inputPath}`);
  process.exit(1);
}

// Step 1: Generate all TTS assets (with cache)
const markdownText = readMarkdownFile(inputPath);
const assetKey = sanitizeFileSegment(basename(inputPath, extname(inputPath))) || 'presentation';
const assetDir = resolve(cwd, 'public', 'generated', assetKey);
const assetPrefix = `generated/${assetKey}`;
const previewDir = resolve(cwd, 'dist', 'preview', assetKey);

mkdirSync(previewDir, {recursive: true});

console.log(`[preview] 生成 TTS 音频 ...`);
const presentation = createPresentationAssets({
  markdownText,
  fps: DEFAULT_FPS,
  assetDir,
  assetPrefix,
});

const totalSlides = presentation.slides.length;
console.log(`[preview] 共 ${totalSlides} 页\n`);

// Parse which slides to preview
const slideNumbers = slideSpec.toLowerCase() === 'all'
  ? Array.from({length: totalSlides}, (_, i) => i + 1)
  : slideSpec.split(',').map((s) => Number(s.trim())).filter((n) => n > 0 && n <= totalSlides);

if (slideNumbers.length === 0) {
  console.error(`无效的页码: ${slideSpec} (共 ${totalSlides} 页)`);
  process.exit(1);
}

// Step 2: Render each slide as individual video
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const results = [];

for (const num of slideNumbers) {
  const slideIndex = num - 1;
  const slide = presentation.slides[slideIndex];
  const outputPath = resolve(previewDir, `slide-${String(num).padStart(2, '0')}.mp4`);
  const audioPath = join(assetDir, `slide-${String(num).padStart(2, '0')}.wav`);

// Step 2: Render each slide as individual video
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const results = [];

// Calculate frame offsets
const slideOffsets = [];
let frameOffset = 0;
for (const s of presentation.slides) {
  slideOffsets.push(frameOffset);
  frameOffset += s.durationInFrames;
}

const fullProps = JSON.stringify({markdown: markdownText, presentation});
const fullPropsFile = resolve(previewDir, '_tmp_slide_props.json');
writeFileSync(fullPropsFile, fullProps, 'utf8');

for (const num of slideNumbers) {
  const slideIndex = num - 1;
  const slide = presentation.slides[slideIndex];
  const outputPath = resolve(previewDir, `slide-${String(num).padStart(2, '0')}.mp4`);
  const audioPath = join(assetDir, `slide-${String(num).padStart(2, '0')}.wav`);
  const startFrame = slideOffsets[slideIndex];
  const endFrame = startFrame + slide.durationInFrames - 1;

  console.log(`[preview] 第 ${num}/${totalSlides} 页: "${slide.heading}" (${(slide.durationInFrames / DEFAULT_FPS).toFixed(1)}s)`);

  const result = spawnSync(command, [
    'remotion', 'render', 'src/index.ts', 'MarkdownVideo', outputPath,
    '--props', fullPropsFile,
    '--frames', `${startFrame}-${endFrame}`,
  ], {cwd, stdio: 'pipe', env: process.env});

  if (result.status === 0) {
    console.log(`  ✓ 视频: ${outputPath}`);
    if (existsSync(audioPath)) {
      console.log(`  ✓ 音频: ${audioPath}`);
    }
    results.push({num, heading: slide.heading, video: outputPath, audio: audioPath, ok: true});
  } else {
    const stderr = result.stderr?.toString().slice(-300) ?? '';
    console.error(`  ✗ 渲染失败: ${stderr}`);
    results.push({num, heading: slide.heading, ok: false});
  }
  console.log('');
}

// Clean up
try { unlinkSync(fullPropsFile); } catch {}

// Step 3: Summary
console.log('='.repeat(60));
console.log(`[preview] 预览完成: ${results.filter((r) => r.ok).length}/${slideNumbers.length} 页成功\n`);

console.log('逐页检查清单:');
results.forEach((r) => {
  const status = r.ok ? '✓' : '✗';
  console.log(`  ${status} 第 ${r.num} 页: ${r.heading}`);
  if (r.ok) {
    console.log(`    视频: open ${r.video}`);
    console.log(`    音频: open ${r.audio}`);
  }
});

console.log(`\n确认所有页面无误后，运行以下命令生成完整视频:`);
console.log(`  npm run render:md -- ${inputArg}`);
console.log(`\n如需重新生成某页音频:`);
console.log(`  npm run tts:redo -- ${inputArg} <页码>`);
