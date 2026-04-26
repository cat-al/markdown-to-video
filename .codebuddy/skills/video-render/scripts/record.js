/**
 * 阶段 1：录制（record.js）
 *
 * JS 假时钟方案：在页面加载前注入假时钟劫持所有时间源，逐帧推进虚拟时间，
 * Puppeteer 截图 pipe 进 FFmpeg → silent.mp4
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

// ---- 假时钟注入脚本 ----

const FAKE_CLOCK_SCRIPT = `
(function() {
  // 3.3.1 保留原始引用
  const _origSetTimeout = window.setTimeout;
  const _origClearTimeout = window.clearTimeout;
  const _origSetInterval = window.setInterval;
  const _origClearInterval = window.clearInterval;
  const _origRAF = window.requestAnimationFrame;
  const _origCancelRAF = window.cancelAnimationFrame;
  const _origDateNow = Date.now;
  const _origPerfNow = performance.now.bind(performance);

  // 暴露原始 rAF 供 Node.js 侧截帧循环使用
  window.__origRAF = _origRAF;

  // 3.3.2 虚拟时钟状态
  let virtualNow = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const rafQueue = [];

  // 3.3.3 劫持 setTimeout / clearTimeout
  window.setTimeout = (cb, delay = 0, ...args) => {
    const id = nextTimerId++;
    timers.set(id, { callback: () => cb(...args), fireAt: virtualNow + delay, interval: null });
    return id;
  };
  window.clearTimeout = (id) => {
    const t = timers.get(id);
    if (t) t.cleared = true;
  };

  // 3.3.4 劫持 setInterval / clearInterval
  window.setInterval = (cb, interval = 0, ...args) => {
    const id = nextTimerId++;
    timers.set(id, { callback: () => cb(...args), fireAt: virtualNow + interval, interval });
    return id;
  };
  window.clearInterval = (id) => {
    const t = timers.get(id);
    if (t) t.cleared = true;
  };

  // 3.3.5 劫持 rAF / cancelRAF
  window.requestAnimationFrame = (cb) => {
    const id = nextTimerId++;
    rafQueue.push({ id, callback: cb });
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    const idx = rafQueue.findIndex(r => r.id === id);
    if (idx >= 0) rafQueue.splice(idx, 1);
  };

  // 3.3.6 劫持 Date.now / performance.now
  Date.now = () => Math.floor(virtualNow);

  Object.defineProperty(performance, 'now', {
    value: () => virtualNow,
    configurable: true,
  });

  // 3.3.7 CSS 动画接管
  function advanceCSSAnimations(deltaMs) {
    if (typeof document.getAnimations !== 'function') return;
    const animations = document.getAnimations();
    for (const anim of animations) {
      if (anim.playState === 'running') {
        anim.pause();
      }
      if (anim.playState === 'paused') {
        const ct = anim.currentTime || 0;
        anim.currentTime = ct + deltaMs;
      }
    }
  }

  // 3.3.8 核心推进函数
  window.__advanceClock = function(deltaMs) {
    virtualNow += deltaMs;

    // 1. 触发到期的 setTimeout/setInterval 回调
    let safety = 0;
    while (safety++ < 10000) {
      let fired = false;
      for (const [id, t] of timers) {
        if (t.cleared) { timers.delete(id); continue; }
        if (t.fireAt <= virtualNow) {
          timers.delete(id);
          t.callback();
          fired = true;
          // interval 重新入队
          if (t.interval != null && !t.cleared) {
            const newId = nextTimerId++;
            timers.set(newId, {
              callback: t.callback,
              fireAt: virtualNow + t.interval,
              interval: t.interval,
            });
          }
          break; // 重新遍历，因为 map 可能被修改
        }
      }
      if (!fired) break;
    }

    // 2. 触发 rAF 回调（一次推进 = 一帧）
    const currentRafs = rafQueue.splice(0);
    for (const r of currentRafs) {
      r.callback(virtualNow);
    }

    // 3. 推进 CSS 动画
    advanceCSSAnimations(deltaMs);
  };

  // 3.3.9 autoPlay 控制 — 阻止 TimelineEngine 自动播放
  window.__clockReady = false;

  document.addEventListener('DOMContentLoaded', () => {
    const waitTimeline = _origSetInterval(() => {
      if (window.timeline) {
        _origClearInterval(waitTimeline);
        if (window.timeline.autoPlay !== undefined) {
          window.timeline.autoPlay = false;
        }
        window.__clockReady = true;
      }
    }, 50);
  });
})();
`;

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

  console.log('🎬 阶段 1：录制（JS 假时钟逐帧截图 → silent.mp4）');
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

    // 1. 注入假时钟（在页面加载之前）
    await page.evaluateOnNewDocument(FAKE_CLOCK_SCRIPT);

    // 2. 加载 HTML
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    // 3. 等待假时钟就绪
    await page.waitForFunction(() => window.__clockReady === true, {
      timeout: 15000,
    });

    // 4. 获取总时长并计算总帧数
    const totalDurationMs = await getTotalDurationFromHtml(page);
    const totalFrames = Math.ceil(totalDurationMs * FPS / 1000);

    console.log(`   总时长: ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`   总帧数: ${totalFrames}`);

    // 5. 启动引擎
    await page.evaluate(() => {
      if (window.timeline) {
        window.timeline.autoPlay = true;
        window.timeline.start();
      }
    });

    // ---- 6. 逐帧截图循环 ----
    const bar = createProgressBar({ stage: 'record', total: totalFrames });
    const guard = new ResourceGuard();

    for (let frame = 0; frame < totalFrames; frame++) {
      // 推进虚拟时间
      await page.evaluate((ms) => window.__advanceClock(ms), FRAME_MS);

      // 等待 compositor 完成绘制（两次真实 rAF）
      await page.evaluate(() => {
        return new Promise(resolve => {
          const raf = window.__origRAF || requestAnimationFrame;
          raf(() => raf(() => resolve()));
        });
      });

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
