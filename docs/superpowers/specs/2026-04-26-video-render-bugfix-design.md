# video-render 录制 & 合成 Bug 修复设计文档

**日期**: 2026-04-26
**状态**: 设计阶段
**范围**: 修复 `record.js` 时钟接管失效 + `compose.js` 字幕烧录失败
**关联**: `BUGFIX-NOTES.md`

## 1. 问题摘要

| # | 文件 | 严重度 | 问题 |
|---|------|--------|------|
| 1 | `record.js` | 🔴 阻塞 | 假设引擎有 `seek` 接口且变量名为 `window.timelineEngine`，两者均与实际 HTML 不符，录制阶段完全无法工作 |
| 2 | `compose.js` | 🟡 中等 | `subtitles` filter 依赖 libass（macOS 默认 FFmpeg 未编译）；`force_style` 语法逗号/冒号未转义 |

## 2. 修复策略总览

| 文件 | 改动方式 | 核心思路 |
|------|---------|---------|
| `record.js` | **整体重写** | 采用 JS 假时钟方案，在页面加载前注入假时钟劫持所有时间源，逐帧推进虚拟时间 |
| `compose.js` | **局部修复** | 增加 libass 检测 + 软字幕回退；修复 `force_style` 转义语法；清理死代码 |
| `SKILL.md` | **局部更新** | 更新"阶段 1"描述为假时钟方案；前置依赖表注明 libass 可选 |

## 3. record.js 重写设计（JS 假时钟方案）

### 3.1 为什么现有方案不可行

现有 `record.js` 的 `injectTimelineControl()` 做了两个错误假设：

1. **变量名** — 查找 `window.timelineEngine` / `window._timelineEngine`，实际 HTML 暴露的是 `window.timeline`
2. **seek 接口** — 依赖 `engine.seek()` / `engine.setCurrentTime()` / `engine.update()`，但实际 TimelineEngine 只有 `start/pause/resume/next/prev`，无任意时间跳转

根据 `canvas-continuous-evolution-design.md`，TimelineEngine 的时间驱动机制是：
- 自动播放靠 `setTimeout`（step.duration + 间隔）
- 动画靠 CSS `animation` / `transition`
- `applyStepAction` 中 `action.delay` 通过 `setTimeout` 实现

这意味着**不可能**通过调用引擎 API 跳到任意时间点。唯一的路径是劫持底层时间源。

### 3.2 假时钟架构

```
┌─────────────────────────────────────────────────┐
│  page.evaluateOnNewDocument（页面加载前注入）       │
│                                                   │
│  劫持 6 组 API：                                   │
│  ┌───────────────┐  ┌───────────────┐            │
│  │ setTimeout     │  │ Date.now      │            │
│  │ clearTimeout   │  │ performance   │            │
│  │ setInterval    │  │   .now        │            │
│  │ clearInterval  │  │               │            │
│  └───────────────┘  └───────────────┘            │
│  ┌───────────────┐  ┌──────────────────────┐     │
│  │ requestAnim-  │  │ CSS Animations       │     │
│  │ ationFrame    │  │ document             │     │
│  │ cancelAnim-   │  │   .getAnimations()   │     │
│  │ ationFrame    │  │   .pause() + manual  │     │
│  └───────────────┘  │   currentTime        │     │
│                      └──────────────────────┘     │
│                                                   │
│  暴露 window.__advanceClock(deltaMs)               │
│  暴露 window.__clockReady (Promise)                │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Node.js 截帧循环                                  │
│                                                   │
│  for each frame:                                  │
│    1. page.evaluate: __advanceClock(33.3)         │
│       → 触发到期 setTimeout/setInterval 回调       │
│       → 触发 rAF 回调                              │
│       → 推进所有 CSS animation.currentTime         │
│    2. 等两次真实 rAF（compositor 绘制）              │
│    3. page.screenshot → FFmpeg stdin              │
└─────────────────────────────────────────────────┘
```

### 3.3 假时钟注入代码设计

在 `page.evaluateOnNewDocument` 中注入，在任何页面 JS 执行之前生效。

#### 3.3.1 保留原始引用

```javascript
const _origSetTimeout = window.setTimeout;
const _origClearTimeout = window.clearTimeout;
const _origSetInterval = window.setInterval;
const _origClearInterval = window.clearInterval;
const _origRAF = window.requestAnimationFrame;
const _origCancelRAF = window.cancelAnimationFrame;
const _origDateNow = Date.now;
const _origPerfNow = performance.now.bind(performance);
```

保留原始 `requestAnimationFrame` 引用的原因：截帧循环中需要用**真实 rAF** 等待 compositor 完成绘制，假 rAF 已被劫持。

#### 3.3.2 虚拟时钟状态

```javascript
let virtualNow = 0;                    // 当前虚拟时间（ms）
let nextTimerId = 1;                   // 自增 timer ID
const timers = new Map();              // id → { callback, fireAt, interval?, cleared }
const rafQueue = [];                   // rAF 回调队列
```

#### 3.3.3 劫持 setTimeout / clearTimeout

```javascript
window.setTimeout = (cb, delay = 0, ...args) => {
  const id = nextTimerId++;
  timers.set(id, { callback: () => cb(...args), fireAt: virtualNow + delay, interval: null });
  return id;
};
window.clearTimeout = (id) => {
  const t = timers.get(id);
  if (t) t.cleared = true;
};
```

#### 3.3.4 劫持 setInterval / clearInterval

```javascript
window.setInterval = (cb, interval = 0, ...args) => {
  const id = nextTimerId++;
  timers.set(id, { callback: () => cb(...args), fireAt: virtualNow + interval, interval });
  return id;
};
window.clearInterval = (id) => {
  const t = timers.get(id);
  if (t) t.cleared = true;
};
```

#### 3.3.5 劫持 rAF / cancelRAF

```javascript
window.requestAnimationFrame = (cb) => {
  const id = nextTimerId++;
  rafQueue.push({ id, callback: cb });
  return id;
};
window.cancelAnimationFrame = (id) => {
  const idx = rafQueue.findIndex(r => r.id === id);
  if (idx >= 0) rafQueue.splice(idx, 1);
};
```

#### 3.3.6 劫持 Date.now / performance.now

```javascript
Date.now = () => _origDateNow() - _origDateNow() + virtualNow;
// 简化：返回 virtualNow 的整数部分
Date.now = () => Math.floor(virtualNow);

const perfOrigin = _origPerfNow();
Object.defineProperty(performance, 'now', {
  value: () => virtualNow,
  configurable: true,
});
```

#### 3.3.7 CSS 动画接管

CSS 动画不受 JS 时间劫持影响（由浏览器 compositor 驱动），需要额外处理：

```javascript
function advanceCSSAnimations(deltaMs) {
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
```

**注意**：`document.getAnimations()` 只在 DOMContentLoaded 之后可用。注入代码中需在 DOMContentLoaded 事件后才启用 CSS 动画接管。

#### 3.3.8 核心推进函数

```javascript
window.__advanceClock = function(deltaMs) {
  virtualNow += deltaMs;

  // 1. 触发到期的 setTimeout/setInterval 回调
  //    用循环处理：回调中可能注册新 timer
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
```

**safety 上限说明**：防止死循环。正常情况下一次推进 33.3ms，不应触发超过几十个回调。10000 是极端安全阀。

#### 3.3.9 autoPlay 控制

TimelineEngine 的自动播放在页面加载时启动。需要在 DOMContentLoaded 时阻止，等截帧循环就绪后再由 Node.js 触发 `timeline.start()`。

```javascript
// 注入代码中
document.addEventListener('DOMContentLoaded', () => {
  // 等待 timeline 实例就绪
  const waitTimeline = _origSetInterval(() => {
    if (window.timeline) {
      _origClearInterval(waitTimeline);
      // 阻止自动播放
      if (window.timeline.autoPlay !== undefined) {
        window.timeline.autoPlay = false;
      }
      window.__clockReady = true;
    }
  }, 50);
});
```

Node.js 侧在确认 `__clockReady === true` 后，调用：
```javascript
await page.evaluate(() => {
  window.timeline.autoPlay = true;
  window.timeline.start();
});
```

### 3.4 Node.js 侧截帧循环设计

```javascript
async function runRecord({ htmlPath, outputDir }) {
  // ... FFmpeg 启动（不变）...
  // ... Puppeteer 启动（不变）...

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

  // 4. 获取总时长
  const totalDurationMs = await getTotalDurationFromHtml(page);
  const totalFrames = Math.ceil(totalDurationMs * FPS / 1000);

  // 5. 启动引擎
  await page.evaluate(() => {
    if (window.timeline) {
      window.timeline.autoPlay = true;
      window.timeline.start();
    }
  });

  // 6. 逐帧截图循环
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

    // 截图 + pipe FFmpeg（与现有逻辑相同）
    const { quality } = await guard.check();
    const buffer = await page.screenshot({ type: 'jpeg', quality, encoding: 'binary' });
    // ... write to FFmpeg stdin ...
  }
}
```

**关键点：等两次真实 rAF**

假时钟劫持了 `requestAnimationFrame`，但 compositor 绘制需要真实的帧周期。注入代码中需把原始 rAF 引用暴露到 `window.__origRAF`，截帧循环用它来等待浏览器真正把像素画到屏幕上。

### 3.5 getTotalDurationFromHtml 改动

现有实现不变 — 它读的是 `window.timelineConfig`（数据对象），不是引擎实例，无兼容问题。

### 3.6 保留不变的部分

| 组件 | 是否改动 |
|------|---------|
| FFmpeg 启动参数 | 不变 |
| Puppeteer 启动参数 | 不变 |
| `ResourceGuard` 内存检查 | 不变 |
| 进度条 | 不变 |
| 流式管道（screenshot → FFmpeg stdin） | 不变 |

### 3.7 导出接口

保持不变：`module.exports = { runRecord, FPS, FRAME_MS }`

`video_render.js` 主入口无需改动。

## 4. compose.js 局部修复设计

### 4.1 修复点一览

| # | 问题 | 修复 |
|---|------|------|
| 1 | `subtitles` filter 依赖 libass | 运行时检测，无 libass 回退软字幕 |
| 2 | `force_style` 逗号未转义 | 逗号转义为 `\\,` |
| 3 | SRT 路径冒号转义不对 | 统一用 FFmpeg 的 `\\:` 转义 |
| 4 | 第 50-58 行 `subtitleFilter` 变量未使用 | 删除死代码 |

### 4.2 libass 检测逻辑

```javascript
const { execSync } = require('child_process');

function hasSubtitlesFilter() {
  try {
    const filters = execSync('ffmpeg -filters 2>&1', { encoding: 'utf-8' });
    return /\bsubtitles\b/.test(filters);
  } catch {
    return false;
  }
}
```

### 4.3 硬烧录路径（有 libass）

```javascript
// SRT 路径转义：反斜杠 → \\\\，冒号 → \\:
const escapedSrt = path.resolve(srtPath)
  .replace(/\\/g, '\\\\\\\\')
  .replace(/:/g, '\\\\:');

// force_style 内逗号需转义为 \\,
const vfArg = `subtitles=${escapedSrt}:force_style='FontName=PingFang SC\\,FontSize=42\\,PrimaryColour=&H00FFFFFF\\,OutlineColour=&H00000000\\,Outline=3\\,Shadow=1\\,MarginV=60'`;
```

关键改动：`force_style` 内部的逗号从 `,` 改为 `\\,`。

### 4.4 软字幕回退路径（无 libass）

```javascript
const ffmpegArgs = [
  '-y',
  '-i', silentMp4,
  '-i', fullAudio,
  '-i', srtPath,              // SRT 作为第三个输入
  '-c:v', 'libx264',
  '-preset', 'medium',
  '-crf', '18',
  '-c:a', 'aac',
  '-b:a', '192k',
  '-c:s', 'mov_text',         // 软字幕编码
  '-map', '0:v',
  '-map', '1:a',
  '-map', '2:s',              // 映射字幕流
  '-shortest',
  finalMp4,
];
```

软字幕嵌入在播放器中显示（可开关），不硬烧到画面上。会输出提示告知用户。

### 4.5 分支逻辑

```javascript
const canHardSub = hasSubtitlesFilter();

if (!canHardSub) {
  console.warn('⚠️  FFmpeg 未编译 libass，字幕将以软字幕嵌入（播放器中可开关）');
  console.warn('   如需硬烧录，请安装含 libass 的 FFmpeg：');
  console.warn('   brew install ffmpeg --build-from-source --with-libass');
}
```

## 5. SKILL.md 更新

### 5.1 阶段 1 描述更新

将"接管时钟逐帧推进"的描述更新为假时钟方案：

```
### 核心策略：JS 假时钟逐帧推进

1. 页面加载前注入假时钟，劫持 setTimeout/setInterval/rAF/Date.now/performance.now
2. 页面加载后阻止 TimelineEngine 自动播放
3. 截帧循环就绪后启动引擎，每帧调用 __advanceClock(33.3) 推进虚拟时间
4. 等待 compositor 绘制完成后截图
5. 与引擎实现完全解耦 — 无论引擎内部如何调度，只要用标准 Web API 就能正确录制
```

### 5.2 前置依赖表更新

```
| FFmpeg | `brew install ffmpeg` | 视频编码、音频拼接 |
| FFmpeg + libass | 可选：`brew install ffmpeg --build-from-source --with-libass` | 字幕硬烧录（无 libass 时自动回退软字幕） |
```

### 5.3 Common Mistakes 更新

```
| 用 engine.seek() 跳转时间 | 引擎无 seek 接口，必须用 JS 假时钟劫持时间源 |
| 字幕 force_style 逗号不转义 | FFmpeg filter chain 中逗号是分隔符，force_style 内部逗号必须转义为 \, |
```

## 6. 对现有文件的影响

| 文件 | 动作 | 说明 |
|------|------|------|
| `scripts/record.js` | **重写** | 删除 `injectTimelineControl`，新增假时钟注入 + 新截帧循环 |
| `scripts/compose.js` | **局部修复** | libass 检测 + 软字幕回退 + force_style 转义修复 + 删死代码 |
| `SKILL.md` | **局部更新** | 阶段 1 描述 + 前置依赖 + Common Mistakes |
| `scripts/video_render.js` | **不变** | 主入口接口不变 |
| `scripts/audio.js` | **不变** | |
| `scripts/utils/progress.js` | **不变** | |
| `scripts/utils/resource-guard.js` | **不变** | |

## 7. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|------|------|
| 假时钟未覆盖某些 Web API（如 Web Animations API 的 `element.animate()`） | 低 | 当前 HTML 只用 CSS animation + setTimeout，暂不需要覆盖。未来若引入 `element.animate()` 再扩展 |
| `document.getAnimations()` 在 Headless Chrome 中行为不一致 | 低 | Puppeteer headless: 'new' 模式下该 API 正常，已有先例验证 |
| 假时钟 timer 回调中注册新 timer 导致死循环 | 低 | safety 上限 10000 次迭代保护 |
| 软字幕回退时，视频发布到某些不支持 mov_text 的平台 | 中 | 日志中明确警告，引导用户安装含 libass 的 FFmpeg |

## 8. 验收标准

1. **record 阶段能成功生成 silent.mp4** — 不再报 "未找到 TimelineEngine 实例" 错误
2. **录制帧准确** — CSS 动画、setTimeout 驱动的步骤切换在录制中正确呈现，无跳帧、无卡帧
3. **compose 阶段在无 libass 环境下正常完成** — 自动回退软字幕，不报错
4. **compose 阶段在有 libass 环境下正常硬烧录** — force_style 语法正确，字幕样式与预期一致
5. **全流程端到端** — `node video_render.js --manifest ... --srt ...` 三阶段顺利跑完，输出 final.mp4

## 9. 实施顺序

1. **重写 `record.js`** — 假时钟注入 + 新截帧循环
2. **修复 `compose.js`** — libass 检测 + 转义修复 + 清理死代码
3. **更新 `SKILL.md`** — 同步文档
4. **端到端测试** — 用现有 HTML 产物跑全流程验证
