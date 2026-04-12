#!/usr/bin/env node

/**
 * 单页音频重新生成工具
 *
 * 用法:
 *   node scripts/regenerate-slide.mjs <input.md> <页码|页码范围> [--render]
 *
 * 示例:
 *   node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3
 *   node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3,5,7
 *   node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3-7
 *   node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3 --render
 *
 * 说明:
 *   - 只重新生成指定页的 TTS 音频，其他页保持不变
 *   - 加 --render 会在重新生成音频后自动渲染整个视频
 *   - 不加 --render 只重新生成音频，你可以先试听再决定是否渲染
 */

import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {basename, extname, resolve, join} from 'node:path';
import {spawnSync} from 'node:child_process';

import {
  createPresentationAssets,
  DEFAULT_FPS,
  readMarkdownFile,
  sanitizeFileSegment,
} from './lib/markdown-video-pipeline.mjs';

const args = process.argv.slice(2);
const flagArgs = args.filter((a) => a.startsWith('--'));
const posArgs = args.filter((a) => !a.startsWith('--'));
const doRender = flagArgs.includes('--render');

const inputArg = posArgs[0];
const slideSpec = posArgs[1];

if (!inputArg || !slideSpec) {
  console.log(`
用法: node scripts/regenerate-slide.mjs <input.md> <页码> [--render]

示例:
  node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3
  node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3,5,7
  node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3-7
  node scripts/regenerate-slide.mjs examples/published/004-hermes-agent-vs-openclaw-zh.md 3 --render

选项:
  --render   重新生成音频后自动渲染视频
  `.trim());
  process.exit(1);
}

// Parse slide numbers from spec like "3" or "3,5,7" or "3-7"
const parseSlideSpec = (spec) => {
  const numbers = new Set();
  spec.split(',').forEach((part) => {
    const trimmed = part.trim();
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      for (let i = start; i <= end; i++) numbers.add(i);
    } else {
      const num = Number(trimmed);
      if (Number.isFinite(num) && num > 0) numbers.add(num);
    }
  });
  return Array.from(numbers).sort((a, b) => a - b);
};

const cwd = process.cwd();
const inputPath = resolve(cwd, inputArg);

if (!existsSync(inputPath)) {
  console.error(`找不到 Markdown 文件: ${inputPath}`);
  process.exit(1);
}

const slideNumbers = parseSlideSpec(slideSpec);
if (slideNumbers.length === 0) {
  console.error(`无效的页码: ${slideSpec}`);
  process.exit(1);
}

const assetKey = sanitizeFileSegment(basename(inputPath, extname(inputPath))) || 'presentation';
const assetDir = resolve(cwd, 'public', 'generated', assetKey);
const manifestPath = join(assetDir, 'tts-manifest.json');

// Step 1: Read current manifest and invalidate specified slides
let manifest = {version: 1, entries: {}};
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {}
}

const invalidated = [];

slideNumbers.forEach((num) => {
  const fileName = `slide-${String(num).padStart(2, '0')}.wav`;
  const audioPath = join(assetDir, fileName);

  // Remove cache entry so pipeline will regenerate
  if (manifest.entries?.[fileName]) {
    delete manifest.entries[fileName];
  }

  // Remove existing audio file
  if (existsSync(audioPath)) {
    rmSync(audioPath, {force: true});
  }

  invalidated.push({num, fileName});
});

// Write updated manifest (with invalidated entries removed)
mkdirSync(assetDir, {recursive: true});
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

console.log(`[regenerate] 已失效 ${invalidated.length} 页音频缓存:`);
invalidated.forEach(({num, fileName}) => {
  console.log(`  第 ${num} 页 → ${fileName}`);
});

// Step 2: Re-run createPresentationAssets (cache will handle the rest)
console.log(`[regenerate] 重新生成音频 ...`);

const markdownText = readMarkdownFile(inputPath);
const assetPrefix = `generated/${assetKey}`;

const presentation = createPresentationAssets({
  markdownText,
  fps: DEFAULT_FPS,
  assetDir,
  assetPrefix,
});

// Show results
slideNumbers.forEach((num) => {
  const fileName = `slide-${String(num).padStart(2, '0')}.wav`;
  const audioPath = join(assetDir, fileName);
  if (existsSync(audioPath)) {
    console.log(`  ✓ 第 ${num} 页音频已重新生成: ${audioPath}`);
  } else {
    console.log(`  ✗ 第 ${num} 页音频生成失败`);
  }
});

// Step 3: Optionally render video
if (doRender) {
  const outputPath = resolve(cwd, 'dist', `${assetKey}.mp4`);
  console.log(`\n[regenerate] 开始渲染视频 → ${outputPath}`);

  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const propsFilePath = resolve(cwd, 'dist', `${assetKey}.props.json`);
  const {buildSrt, writeTextFile} = await import('./lib/markdown-video-pipeline.mjs');
  const subtitlesPath = outputPath.replace(/\.[^.]+$/, '.srt');

  writeTextFile(subtitlesPath, buildSrt(presentation, DEFAULT_FPS));

  const props = JSON.stringify({markdown: markdownText, presentation});
  writeFileSync(propsFilePath, props, 'utf8');

  const result = spawnSync(command, [
    'remotion', 'render', 'src/index.ts', 'MarkdownVideo', outputPath,
    '--props', propsFilePath,
  ], {cwd, stdio: 'inherit', env: process.env});

  try { rmSync(propsFilePath, {force: true}); } catch {}

  if (result.status === 0) {
    console.log(`[regenerate] 完成: ${outputPath}`);
    console.log(`[regenerate] 字幕: ${subtitlesPath}`);
  } else {
    console.error(`[regenerate] 渲染失败，exit code: ${result.status}`);
  }

  process.exit(result.status ?? 0);
} else {
  console.log(`\n[regenerate] 音频已就绪。你可以先试听:`);
  slideNumbers.forEach((num) => {
    const fileName = `slide-${String(num).padStart(2, '0')}.wav`;
    console.log(`  open ${join(assetDir, fileName)}`);
  });
  console.log(`\n确认满意后，运行以下命令渲染视频:`);
  console.log(`  npm run render:md -- ${inputArg}`);
  console.log(`\n或者加 --render 一步到位:`);
  console.log(`  node scripts/regenerate-slide.mjs ${inputArg} ${slideSpec} --render`);
}
