/**
 * 阶段 2：音频拼接（audio.js）
 *
 * 按 tts-manifest.json 的场景和字幕行顺序，拼接逐句 WAV 为完整音轨。
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { execFileSync, execSync } = require('child_process');
const { createProgressBar } = require('./utils/progress');

const LINE_GAP_MS = 300;    // 句间呼吸
const SCENE_GAP_MS = 800;   // 场景切换静默
const SAMPLE_RATE = 24000;   // WAV 采样率

/**
 * 执行音频拼接阶段
 *
 * @param {Object} opts
 * @param {Object} opts.manifest - 解析后的 tts-manifest.json
 * @param {string} opts.outputDir - 输出目录
 * @param {string} opts.htmlPath - HTML 文件路径（用于校验时长）
 * @returns {Promise<string>} full-audio.wav 路径
 */
async function runAudio({ manifest, outputDir, htmlPath }) {
  const fullAudioPath = path.join(outputDir, 'full-audio.wav');
  const tempDir = path.join(outputDir, '_audio_temp');

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(tempDir, { recursive: true });

  console.log('🔊 阶段 2：音频拼接（FFmpeg concat → full-audio.wav）');
  console.log(`   输出: ${fullAudioPath}`);

  const scenes = manifest.scenes;
  const totalScenes = scenes.length;
  const bar = createProgressBar({ stage: 'audio', total: totalScenes });

  // 1. 预生成静音片段
  const silenceLinePath = path.join(tempDir, 'silence_line.wav');
  const silenceScenePath = path.join(tempDir, 'silence_scene.wav');

  generateSilence(silenceLinePath, LINE_GAP_MS);
  generateSilence(silenceScenePath, SCENE_GAP_MS);

  // 2. 构建 concat 列表
  const fileList = [];

  for (let si = 0; si < scenes.length; si++) {
    const scene = scenes[si];
    const lines = scene.lines;

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const audioPath = line.audio_path;

      // 检查音频文件是否存在
      if (!fs.existsSync(audioPath)) {
        console.warn(`⚠️  音频文件缺失: ${audioPath}，用静音替代`);
        // 生成对应时长的静音
        const fallbackPath = path.join(tempDir, `fallback_s${si}_l${li}.wav`);
        generateSilence(fallbackPath, line.duration_ms);
        fileList.push(fallbackPath);
      } else {
        fileList.push(audioPath);
      }

      // 句间静音（最后一句后面不加）
      if (li < lines.length - 1) {
        fileList.push(silenceLinePath);
      }
    }

    // 场景间静音（最后一个场景后面不加）
    if (si < scenes.length - 1) {
      fileList.push(silenceScenePath);
    }

    bar.update(si + 1);
  }

  bar.finish();

  // 3. 写入 filelist.txt
  const fileListPath = path.join(tempDir, 'filelist.txt');
  const fileListContent = fileList
    .map(f => `file '${path.resolve(f)}'`)
    .join('\n');
  fs.writeFileSync(fileListPath, fileListContent, 'utf-8');

  // 4. FFmpeg 拼接
  console.log(`   拼接 ${fileList.length} 个音频片段...`);

  try {
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', fileListPath,
      '-c:a', 'pcm_s16le',
      fullAudioPath,
    ], { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`FFmpeg 音频拼接失败: ${err.stderr?.toString().slice(-500) || err.message}`);
  }

  // 5. 校验时长
  const audioDurationMs = getWavDurationMs(fullAudioPath);
  console.log(`   音频总时长: ${(audioDurationMs / 1000).toFixed(1)}s`);

  if (htmlPath) {
    await validateDuration(audioDurationMs, htmlPath);
  }

  // 6. 清理临时目录
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(`✅ 阶段 2 完成: ${fullAudioPath}`);
  return fullAudioPath;
}

/**
 * 用 FFmpeg 生成指定时长的静音 WAV
 */
function generateSilence(outputPath, durationMs) {
  const duration = durationMs / 1000;
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
      '-t', String(duration),
      '-c:a', 'pcm_s16le',
      outputPath,
    ], { stdio: 'pipe' });
  } catch (err) {
    throw new Error(`生成静音失败: ${err.message}`);
  }
}

/**
 * 获取 WAV 文件的时长（ms）
 */
function getWavDurationMs(wavPath) {
  try {
    const result = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${wavPath}"`,
      { encoding: 'utf-8' }
    ).trim();
    return Math.round(parseFloat(result) * 1000);
  } catch {
    console.warn('⚠️  无法获取音频时长');
    return 0;
  }
}

/**
 * 校验音频时长与 HTML timelineConfig 总时长的偏差
 */
async function validateDuration(audioDurationMs, htmlPath) {
  try {
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // 提取 timelineConfig
    const match = htmlContent.match(/window\.timelineConfig\s*=\s*({[\s\S]*?});/);
    if (!match) {
      console.warn('⚠️  无法从 HTML 中提取 timelineConfig，跳过时长校验');
      return;
    }

    const config = JSON.parse(match[1]);
    const transitionDuration = config.transitionDuration || 800;

    let htmlTotalMs = 0;
    for (let i = 0; i < config.scenes.length; i++) {
      htmlTotalMs += config.scenes[i].duration;
      if (i < config.scenes.length - 1) {
        htmlTotalMs += transitionDuration;
      }
    }

    const diff = Math.abs(audioDurationMs - htmlTotalMs);
    console.log(`   HTML 总时长: ${(htmlTotalMs / 1000).toFixed(1)}s | 偏差: ${diff}ms`);

    if (diff > 500) {
      console.warn(`⚠️  音视频时长偏差 ${diff}ms 超过 500ms 阈值！`);
    }
  } catch (err) {
    console.warn(`⚠️  时长校验失败: ${err.message}`);
  }
}

module.exports = { runAudio, LINE_GAP_MS, SCENE_GAP_MS };
