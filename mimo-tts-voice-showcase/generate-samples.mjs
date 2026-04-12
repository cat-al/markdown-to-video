#!/usr/bin/env node

import {existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = resolve(__dirname, '..');
const manifestPath = join(__dirname, 'voices.json');
const samplesDir = join(__dirname, 'samples');
const summaryPath = join(__dirname, 'samples-summary.json');

// Load .env for MIMO_API_KEY
const envPath = join(workspaceRoot, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

const apiKey = process.env.MIMO_API_KEY ?? '';
if (!apiKey || apiKey.startsWith('<')) {
  console.error('错误: 缺少 MIMO_API_KEY');
  console.error('请先在 .env 文件中填入你的 API Key:');
  console.error('  MIMO_API_KEY=your_key_here');
  console.error('获取地址: https://platform.xiaomimimo.com/');
  process.exit(1);
}

const baseUrl = (process.env.MIMO_BASE_URL ?? 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
const endpoint = `${baseUrl}/chat/completions`;
const model = process.env.MIMO_TTS_MODEL ?? 'mimo-v2-tts';

mkdirSync(samplesDir, {recursive: true});

const voices = JSON.parse(readFileSync(manifestPath, 'utf8'));

console.log(`[mimo-showcase] 开始生成 ${voices.length} 个音色样例 ...`);
console.log(`[mimo-showcase] endpoint: ${endpoint}`);
console.log(`[mimo-showcase] model: ${model}`);

const summary = [];

for (let i = 0; i < voices.length; i++) {
  const voice = voices[i];
  const safeName = voice.style
    ? `${voice.voice}--${voice.style}`
    : voice.voice;
  const outputPath = join(samplesDir, `${safeName}.wav`);

  const contentText = voice.style
    ? `<style>${voice.style}</style>${voice.text}`
    : voice.text;

  const payload = JSON.stringify({
    model,
    audio: {
      format: 'wav',
      voice: voice.voice,
    },
    messages: [
      {
        role: 'assistant',
        content: contentText,
      },
    ],
  });

  console.log(`[${i + 1}/${voices.length}] ${safeName} — "${voice.text}"`);

  const payloadTmpPath = join(samplesDir, `_tmp_${safeName}.json`);
  writeFileSync(payloadTmpPath, payload, 'utf8');

  const curlResult = spawnSync('curl', [
    '-s', '-S', '--fail-with-body',
    '-X', 'POST', endpoint,
    '-H', 'Content-Type: application/json',
    '-H', `api-key: ${apiKey}`,
    '-d', `@${payloadTmpPath}`,
    '--max-time', '60',
  ], {encoding: 'utf8', maxBuffer: 50 * 1024 * 1024});

  try { unlinkSync(payloadTmpPath); } catch {}

  if (curlResult.status !== 0) {
    console.error(`  API 调用失败: ${curlResult.stderr || curlResult.stdout || '未知错误'}`);
    process.exit(1);
  }

  let audioBase64;
  try {
    const parsed = JSON.parse(curlResult.stdout);
    audioBase64 = parsed?.choices?.[0]?.message?.audio?.data;
    if (!audioBase64) {
      const errMsg = parsed?.error?.message ?? JSON.stringify(parsed).slice(0, 300);
      throw new Error(`响应中无音频数据: ${errMsg}`);
    }
  } catch (err) {
    console.error(`  响应解析失败: ${err.message}`);
    console.error(`  原始响应: ${(curlResult.stdout ?? '').slice(0, 300)}`);
    process.exit(1);
  }

  // Decode base64 and write wav directly (no ffmpeg trimming)
  const audioBuffer = Buffer.from(audioBase64, 'base64');
  writeFileSync(outputPath, audioBuffer);

  const sizeKB = (audioBuffer.length / 1024).toFixed(1);

  // 尝试用 ffprobe 获取时长，失败也不阻塞
  let duration = 0;
  const probeResult = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    outputPath,
  ], {encoding: 'utf8'});
  if (probeResult.status === 0 && probeResult.stdout) {
    duration = Number(probeResult.stdout.trim()) || 0;
  }

  summary.push({
    voice: voice.voice,
    style: voice.style || '(default)',
    language: voice.language,
    description: voice.description,
    text: voice.text,
    output: `samples/${safeName}.wav`,
    duration: Math.round(duration * 100) / 100,
    size: audioBuffer.length,
  });

  console.log(`  ✓ ${sizeKB} KB, ${duration.toFixed(1)}s`);
}

writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
console.log(`\n已生成 ${summary.length} 个音色样例到 ${samplesDir}`);
console.log(`摘要文件: ${summaryPath}`);
