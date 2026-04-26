/**
 * 阶段 1：录制（record.js）
 *
 * Puppeteer 接管 TimelineEngine 时钟，逐帧截图 pipe 进 FFmpeg → silent.mp4
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const { createProgressBar } = require('./utils/progress');
const { ResourceGuard, sleep } = require('./utils/resource-guard');

const FPS = 30;
const FRAME_MS = 1000 / FPS;       // 33.333...ms per frame

/**
 * 从 HTML 文件中提取 timelineConfig 来计算总时长
 */
async function getTotalDurationFromHtml(page) {
  return page.evaluate(() => {
    /* eslint-disable no-undef */
    const tc = window.timelineConfig;
    if (!tc || !tc.scenes) throw new Error('未找到 window.timelineConfig');

    let total = 0;
    const transitionDuration = tc.transitionDuration || 800;

    for (let i = 0; i < tc.scenes.length; i++) {
      total += tc.scenes[i].duration;
      // 场景间过渡时间（最后一个场景后面没有过渡）
      if (i < tc.scenes.length - 1) {
        total += transitionDuration;
      }
    }
    return total;
    /* eslint-enable no-undef */
  });
}

/**
 * 在浏览器中注入接管代码，暂停自动播放并暴露 advanceBy 方法
 */
async function injectTimelineControl(page) {
  await page.evaluate(() => {
    /* eslint-disable no-undef */
    // 找到 TimelineEngine 实例
    const engine = window.timelineEngine || window._timelineEngine;
    if (!engine) {
      throw new Error('未找到 TimelineEngine 实例（检查 window.timelineEngine）');
    }

    // 暂停自动播放
    if (typeof engine.pause === 'function') {
      engine.pause();
    }

    // 暴露手动推进方法
    window.__videoRender = {
      currentTime: 0,
      advanceBy(ms) {
        this.currentTime += ms;
        // 调用 TimelineEngine 的 seek/setCurrentTime 来推进时间
        if (typeof engine.seek === 'function') {
          engine.seek(this.currentTime);
        } else if (typeof engine.setCurrentTime === 'function') {
          engine.setCurrentTime(this.currentTime);
        } else if (typeof engine.update === 'function') {
          engine.update(this.currentTime);
        }
      },
      getCurrentTime() {
        return this.currentTime;
      }
    };

    // 初始 seek 到 0
    window.__videoRender.advanceBy(0);
    /* eslint-enable no-undef */
  });
}

/**
 * 执行录制阶段
 *
 * @param {Object} opts
 * @param {string} opts.htmlPath - HTML 文件路径
 * @param {string} opts.outputDir - 输出目录
 * @returns {Promise<string>} silent.mp4 路径
 */
async function runRecord({ htmlPath, outputDir }) {
  const silentMp4 = path.join(outputDir, 'silent.mp4');

  // 确保输出目录存在
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('🎬 阶段 1：录制（Puppeteer 逐帧截图 → silent.mp4）');
  console.log(`   HTML: ${htmlPath}`);
  console.log(`   输出: ${silentMp4}`);
  console.log(`   帧率: ${FPS}fps`);

  // ---- 启动 FFmpeg 进程 ----
  const ffmpegArgs = [
    '-y',
    '-f', 'image2pipe',
    '-framerate', String(FPS),
    '-i', 'pipe:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-r', String(FPS),
    silentMp4,
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let ffmpegStderr = '';
  ffmpeg.stderr.on('data', (chunk) => {
    ffmpegStderr += chunk.toString();
  });

  const ffmpegExit = new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg 退出码 ${code}\n${ffmpegStderr.slice(-500)}`));
    });
    ffmpeg.on('error', reject);
  });

  // ---- 启动 Puppeteer ----
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--renderer-process-limit=1',
      '--max-old-space-size=1536',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // 加载 HTML（用 file:// 协议）
    const fileUrl = `file://${path.resolve(htmlPath)}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // 等待 TimelineEngine 就绪
    await page.waitForFunction(
      () => window.timelineEngine || window._timelineEngine,
      { timeout: 15000 }
    );

    // 获取总时长并计算总帧数
    const totalDurationMs = await getTotalDurationFromHtml(page);
    const totalFrames = Math.ceil(totalDurationMs * FPS / 1000);

    console.log(`   总时长: ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`   总帧数: ${totalFrames}`);

    // 注入时钟接管代码
    await injectTimelineControl(page);

    // ---- 逐帧截图循环 ----
    const bar = createProgressBar({ stage: 'record', total: totalFrames });
    const guard = new ResourceGuard();

    for (let frame = 0; frame < totalFrames; frame++) {
      // 推进时间
      await page.evaluate((ms) => {
        window.__videoRender.advanceBy(ms);
      }, FRAME_MS);

      // 等待一小段让渲染完成
      await sleep(2);

      // 截图
      const { quality } = await guard.check();
      const buffer = await page.screenshot({
        type: 'jpeg',
        quality,
        encoding: 'binary',
      });

      // 写入 FFmpeg stdin
      const canWrite = ffmpeg.stdin.write(buffer);
      if (!canWrite) {
        await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
      }

      // 更新进度条
      bar.update(frame + 1, { memory: guard.getMemoryShort() });

      // 给系统喘息
      await sleep(3);
    }

    bar.finish();

    // 关闭 FFmpeg stdin，等待编码完成
    ffmpeg.stdin.end();
    await ffmpegExit;

    console.log(`✅ 阶段 1 完成: ${silentMp4}`);
    return silentMp4;

  } finally {
    await browser.close();
  }
}

module.exports = { runRecord, FPS, FRAME_MS };
