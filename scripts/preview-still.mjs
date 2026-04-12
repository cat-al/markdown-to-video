#!/usr/bin/env node

/**
 * 单页截图预览 —— 只生成图片看样式，不生成音频和视频
 *
 * 用法:
 *   node scripts/preview-still.mjs <input.md> <页码|all>
 *
 * 示例:
 *   node scripts/preview-still.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 5
 *   node scripts/preview-still.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md all
 *
 * 输出:
 *   dist/preview/<name>/slide-05.png
 */

import {existsSync, mkdirSync, writeFileSync, unlinkSync} from 'node:fs';
import {basename, extname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  DEFAULT_FPS,
  readMarkdownFile,
  sanitizeFileSegment,
  parseFrontmatter,
  normalize,
  extractVoiceover,
  extractDurationInFrames,
  extractSlideDirectives,
  stripControlComments,
  markdownToPlainText,
  getWordCount,
  getHeading,
  buildCaptionCues,
  clamp,
  MIN_SLIDE_SECONDS,
  MAX_SLIDE_SECONDS,
} from './lib/markdown-video-pipeline.mjs';

const args = process.argv.slice(2);
const inputArg = args[0];
const slideSpec = args[1];

if (!inputArg || !slideSpec) {
  console.log(`
用法: node scripts/preview-still.mjs <input.md> <页码|all>

示例:
  node scripts/preview-still.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 5
  node scripts/preview-still.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md all

说明:
  - 只生成 PNG 截图，不跑 TTS，不生成视频
  - 用于快速检查每页的布局和样式
  `.trim());
  process.exit(1);
}

const cwd = process.cwd();
const inputPath = resolve(cwd, inputArg);

if (!existsSync(inputPath)) {
  console.error(`找不到 Markdown 文件: ${inputPath}`);
  process.exit(1);
}

const markdownText = readMarkdownFile(inputPath);
const assetKey = sanitizeFileSegment(basename(inputPath, extname(inputPath))) || 'presentation';
const previewDir = resolve(cwd, 'dist', 'preview', assetKey);
mkdirSync(previewDir, {recursive: true});

// Build a lightweight presentation without TTS
const fps = DEFAULT_FPS;
const {body, meta} = parseFrontmatter(markdownText);
const rawSlides = body.split(/\n-{3,}\n/g).filter((s) => s.trim().length > 0);
const slidesSource = rawSlides.length > 0 ? rawSlides : [body];

const slides = slidesSource.map((slideSource, index) => {
  const cleanedMarkdown = stripControlComments(slideSource);
  const {voiceoverText} = extractVoiceover(slideSource);
  const directives = extractSlideDirectives(slideSource);
  const narration = voiceoverText || markdownToPlainText(cleanedMarkdown);
  const wordCount = getWordCount(cleanedMarkdown);
  const explicitDuration = extractDurationInFrames(slideSource, fps);
  const estimatedSeconds = 2.5 + getWordCount(narration || cleanedMarkdown) * 0.2;
  const durationInFrames = explicitDuration ?? Math.round(clamp(estimatedSeconds, MIN_SLIDE_SECONDS, MAX_SLIDE_SECONDS) * fps);

  return {
    id: `slide-${index + 1}`,
    heading: getHeading(cleanedMarkdown, index),
    markdown: cleanedMarkdown,
    narration,
    wordCount,
    durationInFrames,
    captionCues: buildCaptionCues(narration, durationInFrames, fps),
    layout: directives.layout,
    accentColor: directives.accentColor,
  };
});

const totalSlides = slides.length;
const presentation = {
  meta: {...meta, themeColor: meta.themeColor ?? '#7c3aed'},
  slides,
  totalFrames: slides.reduce((sum, s) => sum + s.durationInFrames, 0),
};

console.log(`[still] 共 ${totalSlides} 页\n`);

// Parse slide numbers
const slideNumbers = slideSpec.toLowerCase() === 'all'
  ? Array.from({length: totalSlides}, (_, i) => i + 1)
  : slideSpec.split(',').map((s) => Number(s.trim())).filter((n) => n > 0 && n <= totalSlides);

if (slideNumbers.length === 0) {
  console.error(`无效的页码: ${slideSpec} (共 ${totalSlides} 页)`);
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const outputs = [];

// Calculate frame offsets for each slide
const slideOffsets = [];
let offset = 0;
for (const s of slides) {
  slideOffsets.push(offset);
  offset += s.durationInFrames;
}

// Use the full presentation so slideIndex is correct for layout selection
const fullProps = JSON.stringify({markdown: markdownText, presentation});
const fullPropsFile = resolve(previewDir, '_tmp_still_props.json');
writeFileSync(fullPropsFile, fullProps, 'utf8');

for (const num of slideNumbers) {
  const slideIndex = num - 1;
  const slide = slides[slideIndex];
  const outputPath = resolve(previewDir, `slide-${String(num).padStart(2, '0')}.png`);
  const targetFrame = slideOffsets[slideIndex] + 15; // 15 frames in to skip entrance animation

  console.log(`[still] 第 ${num}/${totalSlides} 页: "${slide.heading}"`);

  const result = spawnSync(command, [
    'remotion', 'still', 'src/index.ts', 'MarkdownVideo', outputPath,
    '--props', fullPropsFile,
    '--frame', String(Math.min(targetFrame, presentation.totalFrames - 1)),
  ], {cwd, stdio: 'pipe', env: process.env});

  if (result.status === 0) {
    console.log(`  ✓ ${outputPath}`);
    outputs.push({num, heading: slide.heading, path: outputPath, ok: true});
  } else {
    const stderr = result.stderr?.toString().slice(-200) ?? '';
    console.error(`  ✗ 失败: ${stderr}`);
    outputs.push({num, heading: slide.heading, ok: false});
  }
}

try { unlinkSync(fullPropsFile); } catch {}

console.log(`\n[still] 完成: ${outputs.filter((o) => o.ok).length}/${slideNumbers.length} 页`);
console.log(`\n预览图片:`);
outputs.filter((o) => o.ok).forEach((o) => {
  console.log(`  第 ${o.num} 页: open ${o.path}`);
});

if (slideNumbers.length > 1) {
  console.log(`\n或一次打开全部:`);
  console.log(`  open ${previewDir}/slide-*.png`);
}
