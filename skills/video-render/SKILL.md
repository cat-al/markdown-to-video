---
name: video-render
description: "Use when rendering the final MP4 video from upstream artifacts (HTML slides, TTS audio, SRT subtitles). Orchestrates a three-stage pipeline: Puppeteer frame capture → audio concatenation → FFmpeg composition."
---

# Video Render — 视频输出

消费上游所有产物（HTML 幻灯片、配音音频、SRT 字幕），输出可直接发布的 MP4 视频。

## 核心原则

1. **三阶段管线** — record → audio → compose，每阶段独立可运行、可断点恢复
2. **接管时钟** — 不用真实时间驱动，手动逐帧推进 TimelineEngine，动画与机器性能解耦
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

## 输入

| 文件 | 来源 | 说明 |
|------|------|------|
| `tts-manifest.json` | `tts-voiceover` | 含 `html_path`、每句音频路径和 `duration_ms` |
| HTML 文件 | `markdown-to-html` + `subtitle-timeline` | 含 `stepConfig`、`timelineConfig`、`TimelineEngine`，时长已校准 |
| `output/subtitles.srt` | `subtitle-timeline` | 带时间戳的 SRT 字幕 |
| `output/audio/scene-NN/NNN.wav` | `tts-voiceover` | 逐句配音 WAV |

## 输出

| 文件 | 说明 |
|------|------|
| `output/video/silent.mp4` | 无声视频（中间产物） |
| `output/video/full-audio.wav` | 完整音轨（中间产物） |
| **`output/video/final.mp4`** | **最终可发布视频** |

## 三阶段管线

```
阶段 1：record   — Puppeteer 截帧 pipe FFmpeg → silent.mp4
阶段 2：audio    — FFmpeg concat 逐句 WAV    → full-audio.wav
阶段 3：compose  — FFmpeg 合成视频+音频+字幕  → final.mp4
```

每阶段独立可运行，某阶段失败只需重跑该阶段。

## 阶段 1：录制（record.js）

### 核心策略：接管时钟逐帧推进

1. 在浏览器中注入代码，暂停 TimelineEngine 的自动播放
2. 手动推进时间：每次推进 `1000/fps` 毫秒（30fps = 33.3ms/帧）
3. 推进后截一帧，再推进下一帧
4. 动画效果与机器性能完全解耦

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

按 `tts-manifest.json` 顺序拼接逐句 WAV：
- `line_gap_ms = 300`（句间呼吸）
- `scene_gap_ms = 800`（场景切换静默）

拼接后校验总时长与 HTML timelineConfig 的偏差（允许 ±500ms）。

## 阶段 3：合成（compose.js）

合成无声视频 + 完整音轨 + SRT 字幕 → 最终 MP4。

字幕样式：白字 + 黑描边（PingFang SC, 42pt），`MarginV=60`。

## 使用方式

```bash
# 一键全流程
node .codebuddy/skills/video-render/scripts/video_render.js \
  --manifest output/tts-manifest.json \
  --srt output/subtitles.srt

# 单独跑某个阶段
node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage record --manifest output/tts-manifest.json

node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage audio --manifest output/tts-manifest.json

node .codebuddy/skills/video-render/scripts/video_render.js \
  --stage compose --manifest output/tts-manifest.json --srt output/subtitles.srt
```

## 前置依赖

| 依赖 | 安装方式 | 用途 |
|------|----------|------|
| Node.js | 已有 | 运行脚本 |
| FFmpeg | `brew install ffmpeg` | 视频编码、音频拼接、字幕烧录 |
| Puppeteer | `npm install puppeteer` | 控制 Chrome 截帧 |

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
| 输入 | `tts-manifest.json` + HTML + SRT + WAV 音频 |
| 输出 | `output/video/final.mp4` |
| 中间产物 | `output/video/silent.mp4`、`output/video/full-audio.wav` |
| 上游 | `markdown-to-html` + `tts-voiceover` + `subtitle-timeline` |
| 下游 | 无（最终产物） |
| 主入口 | `node .codebuddy/skills/video-render/scripts/video_render.js` |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 用真实时间驱动 HTML 播放 | 必须接管 TimelineEngine 时钟，逐帧推进 |
| 截图落盘为 PNG 再读取 | 截图 Buffer 直接 pipe 进 FFmpeg stdin |
| 忘记内存限制 | Chrome 1.5GB + Node 0.5GB，每 100 帧检查 |
| 音频拼接忘记 line_gap_ms | 句间 300ms、场景间 800ms 静音间隔 |
| 字幕用 SRT 软字幕 | 用 FFmpeg subtitles filter 硬烧录 |
| 不检查音视频时长偏差 | 拼接后校验，偏差 > 500ms 输出警告 |
