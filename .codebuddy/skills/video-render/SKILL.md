---
name: video-render
description: "Use when rendering the final MP4 video from upstream artifacts (HTML slides, TTS audio, SRT subtitles). Orchestrates a three-stage pipeline: Puppeteer frame capture → audio concatenation → FFmpeg composition."
---

# Video Render — 视频输出

消费上游所有产物（HTML 幻灯片、配音音频、SRT 字幕），输出可直接发布的 MP4 视频。

## 核心原则

1. **三阶段管线** — record → audio → compose，每阶段独立可运行、可断点恢复
2. **JS 假时钟** — 页面加载前注入假时钟劫持所有时间源，逐帧推进虚拟时间，动画与机器性能解耦
3. **流式管道** — 截图 Buffer 直接 pipe 进 FFmpeg stdin，不落盘，内存恒定
4. **内存硬限 2GB** — 可以慢，不能崩

## 文件结构

```
video-render/
  SKILL.md                          # 本文件
  scripts/
    video_render.js                 # 主入口（调度三阶段）
    record.js                       # 阶段1：Puppeteer 截帧 → 无声视频
    audio.js                        # 阶段2：FFmpeg 拼接音频
    compose.js                      # 阶段3：合成最终 MP4
    utils/
      progress.js                   # 终端进度条
      resource-guard.js             # 内存/资源监控
```

## 产物目录约定

> 完整约定见 `docs/project-output-convention.md`。

本 skill 接收**项目目录路径**作为参数（如 `output/001-cognitive-awakening/`）。

### 输入路径

| 产物 | 路径 |
|------|------|
| TTS 清单 | `<项目目录>/tts-manifest.json` |
| HTML 幻灯片 | `<项目目录>/presentation.html`（从 manifest 的 `html_path` 相对路径定位） |
| SRT 字幕 | `<项目目录>/subtitles.srt` |
| 逐句音频 | `<项目目录>/audio/shot-NNN.wav`（从 manifest 的 `audio_path` 相对路径定位） |

### 输出路径

| 产物 | 路径 |
|------|------|
| 无声视频 | `<项目目录>/video/silent.mp4` |
| 完整音轨 | `<项目目录>/video/full-audio.wav` |
| 最终视频 | `<项目目录>/video/final.mp4` |

## 输入

| 文件 | 来源 | 说明 |
|------|------|------|
| `<项目目录>/tts-manifest.json` | `tts-voiceover` | 含 `html_path`、每个镜头的音频路径（相对路径）和 `duration_ms`（shots 扁平格式） |
| `<项目目录>/presentation.html` | `markdown-to-html` + `subtitle-timeline` | 含 `timelineConfig`（shots 格式）、`ShotTimelineEngine`，时长已校准 |
| `<项目目录>/subtitles.srt` | `subtitle-timeline` | 带时间戳的 SRT 字幕 |
| `<项目目录>/audio/shot-NNN.wav` | `tts-voiceover` | 逐句配音 WAV（扁平化命名） |

## 输出

| 文件 | 说明 |
|------|------|
| `<项目目录>/video/silent.mp4` | 无声视频（中间产物） |
| `<项目目录>/video/full-audio.wav` | 完整音轨（中间产物） |
| **`<项目目录>/video/final.mp4`** | **最终可发布视频** |

## 三阶段管线

```
阶段 1：record   — Puppeteer 截帧 pipe FFmpeg → silent.mp4
阶段 2：audio    — FFmpeg concat 逐句 WAV    → full-audio.wav
阶段 3：compose  — FFmpeg 合成视频+音频+字幕  → final.mp4
```

每阶段独立可运行，某阶段失败只需重跑该阶段。

## 阶段 1：录制（record.js）

### 核心策略：JS 假时钟逐帧推进

1. 页面加载前注入假时钟，劫持 setTimeout/setInterval/rAF/Date.now/performance.now
2. 页面加载后阻止 TimelineEngine 自动播放
3. 截帧循环就绪后启动引擎，每帧调用 `__advanceClock(33.3)` 推进虚拟时间
4. 等待 compositor 绘制完成后截图
5. 与引擎实现完全解耦 — 无论引擎内部如何调度，只要用标准 Web API 就能正确录制

### 流式管道

截图 Buffer 直接 pipe 进 FFmpeg stdin，不落地为文件，内存占用恒定。

### 内存硬限制（2GB 总量）

| 组件 | 限制 | 实现方式 |
|------|------|----------|
| Chrome 渲染进程 | 1.5GB | `--max-old-space-size=1536` |
| Node.js 主进程 | 0.5GB | `--max-old-space-size=512` |
| 渲染进程数 | 1 个 | `--renderer-process-limit=1` |

每 100 帧检查内存，超阈值暂停等待 GC。

## 阶段 2：音频拼接（audio.js）

按 `tts-manifest.json` 中 `shots` 数组顺序拼接逐句 WAV：
- `shot_gap_ms = 300`（镜头间呼吸）
- `group_transition_ms = 600`（画布组切换静默）

拼接后校验总时长与 HTML timelineConfig 的偏差（允许 ±500ms）。

## 阶段 3：合成（compose.js）

合成无声视频 + 完整音轨 + SRT 字幕 → 最终 MP4。

字幕样式：白字 + 黑描边（PingFang SC, 42pt），`MarginV=60`。

## 使用方式

```bash
# 一键全流程
node .codebuddy/skills/video-render/scripts/video_render.js \
  --manifest <项目目录>/tts-manifest.json \
  --srt <项目目录>/subtitles.srt

# 单独跑某个阶段
node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage record --manifest <项目目录>/tts-manifest.json

node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage audio --manifest <项目目录>/tts-manifest.json

node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage compose --manifest <项目目录>/tts-manifest.json --srt <项目目录>/subtitles.srt
```

## 前置依赖

| 依赖 | 安装方式 | 用途 |
|------|----------|------|
| Node.js | 已有 | 运行脚本 |
| FFmpeg + libass | **必需**。`brew install libass && brew install ffmpeg --build-from-source` | 视频编码、音频拼接、字幕硬烧录 |
| Puppeteer | `npm install puppeteer` | 控制 Chrome 截帧 |

验证 libass：
```bash
ffmpeg -filters 2>&1 | grep subtitle
# 应输出：T.. subtitles ...
```

## 错误处理

| 场景 | 处理 |
|------|------|
| FFmpeg 未安装 | 启动时检测，提示 `brew install ffmpeg` |
| Puppeteer/Chrome 启动失败 | 报告错误，提示检查 Puppeteer 安装 |
| manifest 文件不存在 | 报错退出，提示先运行 `tts-voiceover` |
| HTML 文件不存在 | 报错退出，提示检查 manifest 的 `html_path` |
| SRT 文件不存在 | 报错退出，提示先运行 `subtitle-timeline` |
| 音频文件缺失 | 报告缺失路径，跳过并用静音填充 |
| 内存超阈值 | 暂停截帧等待 GC，连续超标则降低截图质量 |
| FFmpeg 进程崩溃 | 报告 stderr，保留已生成的中间产物 |
| 音视频时长偏差 > 500ms | 输出警告，仍继续合成 |

## Quick Reference

| 项目 | 值 |
|------|-----|
| 输入 | `<项目目录>/tts-manifest.json` + HTML + SRT + WAV 音频 |
| 输出 | `<项目目录>/video/final.mp4` |
| 中间产物 | `<项目目录>/video/silent.mp4`、`<项目目录>/video/full-audio.wav` |
| 上游 | `markdown-to-html` + `tts-voiceover` + `subtitle-timeline` |
| 下游 | 无（最终产物） |
| 主入口 | `node .codebuddy/skills/video-render/scripts/video_render.js` |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 用真实时间驱动 HTML 播放 | 必须接管 ShotTimelineEngine 时钟，逐帧推进 |
| 截图落盘为 PNG 再读取 | 截图 Buffer 直接 pipe 进 FFmpeg stdin |
| 忘记内存限制 | Chrome 1.5GB + Node 0.5GB，每 100 帧检查 |
| 音频拼接忘记间隔 | 镜头间 300ms、画布组切换间 600ms 静音间隔 |
| 字幕用 SRT 软字幕 | 用 FFmpeg subtitles filter 硬烧录 |
| 不检查音视频时长偏差 | 拼接后校验，偏差 > 500ms 输出警告 |
| 画布组切换时截到过渡中间态 | 每次切换后等待 transition 完成再截帧 |
