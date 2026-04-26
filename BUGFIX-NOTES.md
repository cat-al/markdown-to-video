# video-render skill 适配问题记录

> 记录于 2026-04-26，合成 `claude-code-advanced-guide` 视频时遇到的问题。

---

## 问题 1：record.js 与实际 HTML TimelineEngine 不兼容

### 现象

record.js 启动后报错：`未找到 TimelineEngine 实例（检查 window.timelineEngine）`

### 根因

原代码有两处假设与实际 HTML 不符：

| 假设 | 实际 |
|------|------|
| 引擎实例在 `window.timelineEngine` 或 `window._timelineEngine` | 实际是 `window.timeline`（HTML 第1625行） |
| 引擎有 `seek(ms)` / `setCurrentTime(ms)` / `update(ms)` 方法 | 实际 TimelineEngine 只有 `start/pause/resume/next/prev`，内部靠 `setTimeout` + CSS `animation` 驱动，不支持任意时间跳转 |

### 尝试过的方案

**方案 A：CDP 虚拟时钟（失败）**

用 `Emulation.setVirtualTimePolicy` 接管浏览器全部时间源，每帧推进 33.3ms。

失败原因：compositor 死锁。虚拟时间暂停时 `Page.captureScreenshot` 需要 compositor 绘制，但 compositor 也受虚拟时钟控制，互相等待，报错 `Page.captureScreenshot timed out`。

**方案 B：JS 假时钟（成功）**

在 `page.evaluateOnNewDocument` 中注入假时钟，接管以下 API：
- `setTimeout` / `clearTimeout`
- `setInterval` / `clearInterval`
- `requestAnimationFrame` / `cancelAnimationFrame`
- `Date.now`
- `performance.now`
- CSS 动画（通过 `document.getAnimations()` + `anim.pause()` + 手动 `anim.currentTime = x`）

流程：
1. 页面加载前注入假时钟，同时在 DOMContentLoaded 时设 `autoPlay = false`
2. 页面加载完成后，设 `autoPlay = true` 并调用 `timeline.start()`
3. 所有定时器进入假时钟队列，CSS 动画被暂停
4. 每帧调用 `window.__advanceClock(33.3)` 推进虚拟时间，触发到期回调 + 推进 CSS 动画
5. 用两次真实 `requestAnimationFrame`（保留了原始引用）等待 compositor 绘制完成
6. 截图写入 FFmpeg stdin

### 建议修复方向

record.js 不应假设 TimelineEngine 有 `seek` 方法。有两种修复思路：

1. **推荐**：采用 JS 假时钟方案作为默认行为，兼容所有基于 setTimeout/CSS 动画的引擎
2. **可选**：在 HTML 模板中统一暴露 `window.timelineEngine` 并实现 `seek(ms)` 接口，record.js 按现有逻辑即可

---

## 问题 2：compose.js FFmpeg subtitles filter 不可用

### 现象

```
[AVFilterGraph] No option name near '...subtitles.srt'
Error parsing filterchain 'subtitles=...'
```

### 根因

`brew install ffmpeg` 默认安装的 FFmpeg 8.x 没有编译 libass，`ffmpeg -filters` 输出中不包含 `subtitles` filter。

验证命令：
```bash
ffmpeg -filters 2>&1 | grep -i subtitle
# 无输出 = 未编译 libass
```

### 临时修复

增加运行时检测，有 libass 走硬烧录，无 libass 回退到软字幕嵌入：

```js
// 检测
const filters = execSync('ffmpeg -filters 2>&1', { encoding: 'utf-8' });
const hasSubtitlesFilter = /\bsubtitles\b/.test(filters);

// 有 libass → 硬烧录（-vf subtitles=xxx:force_style=xxx）
// 无 libass → 软字幕（-i srt -c:s mov_text -map 2:s）
```

### 建议修复方向

1. **compose.js** 内置 libass 检测逻辑，自动选择硬烧录或软字幕
2. **SKILL.md** 前置依赖表中注明：如需硬烧录字幕，FFmpeg 需编译 libass（`brew install ffmpeg --with-libass` 或从源码编译）
3. 另外原代码中 `force_style` 的语法也有问题——逗号是 FFmpeg filter chain 分隔符，需要转义为 `\,`；路径中的冒号需要转义为 `\:`

---

## 修改的文件清单

| 文件 | 改动内容 |
|------|----------|
| `scripts/record.js` | 整体重写为 JS 假时钟方案 |
| `scripts/compose.js` | 增加 libass 检测 + 软字幕回退 + 修复 filter 语法 |

`video_render.js`、`audio.js`、`utils/` 未改动。
