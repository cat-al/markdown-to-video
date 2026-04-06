#!/usr/bin/env node

import {existsSync, mkdirSync, writeFileSync, unlinkSync} from 'node:fs';
import {basename, dirname, extname, resolve} from 'node:path';
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
const inputArg = args[0];
const outputArg = args[1];

if (!inputArg) {
  console.error('用法: npm run render:md -- <input.md> [output.mp4]');
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

mkdirSync(dirname(outputPath), {recursive: true});

const markdownText = readMarkdownFile(inputPath);
const presentation = createPresentationAssets({
  markdownText,
  fps: DEFAULT_FPS,
  assetDir,
  assetPrefix,
});

writeTextFile(subtitlesPath, buildSrt(presentation, DEFAULT_FPS));

const props = JSON.stringify({
  markdown: markdownText,
  presentation,
});

// Write props to a temp file to avoid Windows command-line length limits
const propsFilePath = resolve(cwd, 'dist', `${assetKey}.props.json`);
writeFileSync(propsFilePath, props, 'utf8');

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  command,
  ['remotion', 'render', 'src/index.ts', 'MarkdownVideo', outputPath, '--props', propsFilePath],
  {
    cwd,
    stdio: 'inherit',
    env: process.env,
  },
);

// Clean up temp props file
try { unlinkSync(propsFilePath); } catch {}

if (result.status === 0) {
  console.log(`字幕文件已生成: ${subtitlesPath}`);
}

process.exit(result.status ?? 0);
