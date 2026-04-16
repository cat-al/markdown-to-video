#!/usr/bin/env node

import {mkdirSync} from 'node:fs';
import {basename, extname, resolve} from 'node:path';

import {
  buildSrt,
  createPresentationAssets,
  DEFAULT_FPS,
  readMarkdownFile,
  sanitizeFileSegment,
  writePreviewModule,
  writeTextFile,
} from './lib/markdown-video-pipeline.mjs';

const cwd = process.cwd();
const previewSource = process.argv[2] ?? process.env.PREVIEW_MARKDOWN ?? 'examples/demo/demo.md';
const inputPath = resolve(cwd, previewSource);
const markdownText = readMarkdownFile(inputPath);
const assetKey = sanitizeFileSegment(basename(inputPath, extname(inputPath))) || 'preview';
const assetDir = resolve(cwd, 'public', 'generated', assetKey);
const assetPrefix = `generated/${assetKey}`;
const generatedSrcDir = resolve(cwd, 'src', 'generated');
const previewModulePath = resolve(generatedSrcDir, 'preview-presentation.ts');
const previewSrtPath = resolve(cwd, 'dist', `${assetKey}.preview.srt`);

mkdirSync(generatedSrcDir, {recursive: true});
mkdirSync(resolve(cwd, 'dist'), {recursive: true});

const presentation = createPresentationAssets({
  markdownText,
  markdownFilePath: inputPath,
  fps: DEFAULT_FPS,
  assetDir,
  assetPrefix,
});

writePreviewModule({
  targetPath: previewModulePath,
  markdownText,
  presentation,
});
writeTextFile(previewSrtPath, buildSrt(presentation, DEFAULT_FPS));

console.log(`预览素材已准备完成: ${previewModulePath}`);
console.log(`预览字幕已生成: ${previewSrtPath}`);
