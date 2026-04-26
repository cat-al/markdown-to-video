/**
 * 阶段 3：合成（compose.js）
 *
 * 将无声视频 + 完整音轨 + SRT 字幕合成为最终 MP4。
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');
const { createProgressBar } = require('./utils/progress');

/**
 * 检测当前 FFmpeg 是否编译了 subtitles filter（需要 libass）
 */
function hasSubtitlesFilter() {
  try {
    const filters = execSync('ffmpeg -filters 2>&1', { encoding: 'utf-8' });
    return /\bsubtitles\b/.test(filters);
  } catch {
    return false;
  }
}

/**
 * 前置检测 libass，缺失则报错退出并引导安装
 */
function checkLibass() {
  if (!hasSubtitlesFilter()) {
    console.error('');
    console.error('❌ FFmpeg 缺少 libass，无法硬烧录字幕。');
    console.error('');
    console.error('   当前 FFmpeg 未编译 subtitles filter（需要 libass 库）。');
    console.error('   请按以下步骤安装含 libass 的 FFmpeg：');
    console.error('');
    console.error('   # 方式 1：Homebrew 从源码编译（推荐）');
    console.error('   brew uninstall ffmpeg');
    console.error('   brew install libass');
    console.error('   brew install ffmpeg --build-from-source');
    console.error('');
    console.error('   # 方式 2：使用 ffmpeg-full cask');
    console.error('   brew tap homebrew-ffmpeg/ffmpeg');
    console.error('   brew install homebrew-ffmpeg/ffmpeg/ffmpeg --with-libass');
    console.error('');
    console.error('   安装后验证：');
    console.error('   ffmpeg -filters 2>&1 | grep subtitle');
    console.error('');
    process.exit(1);
  }
}

/**
 * 执行合成阶段
 *
 * @param {Object} opts
 * @param {string} opts.silentMp4 - 无声视频路径
 * @param {string} opts.fullAudio - 完整音轨路径
 * @param {string} opts.srtPath - SRT 字幕路径
 * @param {string} opts.outputDir - 输出目录
 * @returns {Promise<string>} final.mp4 路径
 */
async function runCompose({ silentMp4, fullAudio, srtPath, outputDir }) {
  const finalMp4 = path.join(outputDir, 'final.mp4');

  fs.mkdirSync(outputDir, { recursive: true });

  console.log('🎞️  阶段 3：合成（视频 + 音频 + 字幕 → final.mp4）');
  console.log(`   视频: ${silentMp4}`);
  console.log(`   音频: ${fullAudio}`);
  console.log(`   字幕: ${srtPath}`);
  console.log(`   输出: ${finalMp4}`);

  // 验证输入文件存在
  for (const [label, filePath] of [['视频', silentMp4], ['音频', fullAudio], ['字幕', srtPath]]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`${label}文件不存在: ${filePath}`);
    }
  }

  // 前置检测 libass
  checkLibass();

  // 获取视频总时长（用于进度计算）
  const totalDuration = await getVideoDuration(silentMp4);

  // SRT 路径转义：反斜杠 → \\\\，冒号 → \:
  const escapedSrt = path.resolve(srtPath)
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\\\:');

  // 构建 -vf 参数（force_style 内逗号转义为 \,）
  // 方案C：深棕字 #2a2218 + 半透明纸浆米白底条 #FAF3E9 (70%不透明)
  // ASS 颜色格式 &HAABBGGRR（注意 BGR 顺序）
  const vfArg = `subtitles=${escapedSrt}:force_style='FontName=PingFang SC\\,FontSize=14\\,PrimaryColour=&H0018222A\\,OutlineColour=&H0018222A\\,BackColour=&HB3E9F3FA\\,BorderStyle=4\\,Outline=0\\,Shadow=0\\,MarginV=30'`;

  const ffmpegArgs = [
    '-y',
    '-i', silentMp4,
    '-i', fullAudio,
    '-vf', vfArg,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-map', '0:v',
    '-map', '1:a',
    '-shortest',
    finalMp4,
  ];

  // 启动 FFmpeg
  const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const bar = totalDuration > 0
    ? createProgressBar({ stage: 'compose', total: Math.round(totalDuration) })
    : null;

  let stderr = '';

  ffmpeg.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;

    // 解析 FFmpeg 的 time= 字段来更新进度
    if (bar) {
      const match = text.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (match) {
        const seconds = parseInt(match[1]) * 3600
          + parseInt(match[2]) * 60
          + parseInt(match[3])
          + parseInt(match[4]) / 100;
        bar.update(Math.round(seconds));
      }
    }
  });

  // 等待完成
  const exitCode = await new Promise((resolve, reject) => {
    ffmpeg.on('close', resolve);
    ffmpeg.on('error', reject);
  });

  if (bar) bar.finish();

  if (exitCode !== 0) {
    throw new Error(`FFmpeg 合成失败 (exit ${exitCode})\n${stderr.slice(-800)}`);
  }

  // 输出最终文件信息
  const stats = fs.statSync(finalMp4);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(1);

  console.log('');
  console.log('✅ 视频生成完成');
  console.log(`   📁 ${finalMp4}`);
  console.log(`   🕐 总时长: ${formatDuration(totalDuration)}`);
  console.log(`   📐 分辨率: 1920×1080`);
  console.log(`   🎞️ 帧率: 30fps`);
  console.log(`   📦 文件大小: ${sizeMB}MB`);

  return finalMp4;
}

/**
 * 获取视频文件时长（秒）
 */
function getVideoDuration(videoPath) {
  return new Promise((resolve) => {
    try {
      const result = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${videoPath}"`,
        { encoding: 'utf-8' }
      ).trim();
      resolve(parseFloat(result) || 0);
    } catch {
      resolve(0);
    }
  });
}

/**
 * 格式化秒为 NmNNs
 */
function formatDuration(seconds) {
  if (!seconds || !isFinite(seconds)) return '--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m${String(s).padStart(2, '0')}s`;
}

module.exports = { runCompose };
