#!/usr/bin/env node

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '..');
const manifestPath = join(__dirname, 'voices.json');
const rawDir = join(__dirname, 'raw');
const samplesDir = join(__dirname, 'samples');
const summaryPath = join(__dirname, 'samples-summary.json');
const pythonCommand = process.env.QWEN_PYTHON || join(workspaceRoot, '.venv-qwen', 'bin', 'python');
const workerPath = join(workspaceRoot, 'scripts', 'qwen_tts_worker.py');
const modelPath = join(workspaceRoot, '.models', 'Qwen3-TTS-12Hz-0.6B-CustomVoice');

mkdirSync(rawDir, {recursive: true});
mkdirSync(samplesDir, {recursive: true});

const voices = JSON.parse(readFileSync(manifestPath, 'utf8'));

const payload = {
  model: modelPath,
  mode: 'custom-voice',
  device: process.platform === 'darwin' ? 'cpu' : 'auto',
  dtype: process.platform === 'darwin' ? 'float32' : 'auto',
  attnImplementation: 'auto',
  items: voices.map((voice) => ({
    text: voice.text,
    language: voice.language,
    speaker: voice.speaker,
    instruct: voice.instruction,
    outputPath: join(rawDir, `${voice.speaker}.wav`),
  })),
};

const synthResult = spawnSync(pythonCommand, [workerPath], {
  cwd: workspaceRoot,
  encoding: 'utf8',
  input: JSON.stringify(payload),
  maxBuffer: 20 * 1024 * 1024,
});

if (synthResult.status !== 0) {
  console.error(synthResult.stderr || synthResult.stdout || 'Qwen3-TTS 样例生成失败');
  process.exit(synthResult.status ?? 1);
}

const summary = [];

for (const voice of voices) {
  const rawPath = join(rawDir, `${voice.speaker}.wav`);
  const outputPath = join(samplesDir, `${voice.speaker}.wav`);

  const trimResult = spawnSync(
    'ffmpeg',
    ['-y', '-i', rawPath, '-af', 'apad=pad_dur=2', '-t', '2', outputPath],
    {cwd: workspaceRoot, encoding: 'utf8'},
  );

  if (trimResult.status !== 0) {
    console.error(trimResult.stderr || trimResult.stdout || `裁剪样例失败: ${voice.speaker}`);
    process.exit(trimResult.status ?? 1);
  }

  const probeResult = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration,size', '-of', 'json', outputPath],
    {cwd: workspaceRoot, encoding: 'utf8'},
  );

  const parsed = JSON.parse(probeResult.stdout || '{"format":{}}');
  summary.push({
    speaker: voice.speaker,
    language: voice.language,
    text: voice.text,
    output: `samples/${voice.speaker}.wav`,
    duration: Number(parsed.format?.duration || 0),
    size: Number(parsed.format?.size || 0),
  });
}

writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`已生成 ${summary.length} 个音色样例到 ${samplesDir}`);
console.log(`摘要文件: ${summaryPath}`);
