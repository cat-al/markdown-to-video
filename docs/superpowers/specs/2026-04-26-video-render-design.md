# Video Render — 视频输出设计规格

## 概述

`video-render` 是 markdown-to-video 链路的最后一个 skill，消费上游所有产物（HTML 幻灯片、配音音频、SRT 字幕），输出可直接发布的 MP4 视频。

## 设计决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 最终产物 | 完整 MP4 视频 | 一步到位可发布 |
| 字幕处理 | 硬字幕烧录 | 保证所有平台可见 |
| 录屏技术 | Puppeteer 逐帧截图 + FFmpeg 流式管道 | 画质最佳；Playwright recordVideo 画面模糊，已排除 |
| 运行环境 | Mac 本机 | 纯本地运行，依赖 Node + FFmpeg + Chrome |
| 内存限制 | 硬限 2GB | 用户明确要求：可以慢，不能崩 |
| 架构 | 三阶段管线 | 职责清晰、断点可恢复、录制阶段隔离 |
| 字幕配色 | 白字 + 黑描边（万能样式） | 适配深色和浅色背景 |
| 视频时长 | 支持 1~15 分钟 | 短视频为常态，偶尔长视频 |

## 上游依赖

| 输入文件 | 来源 skill | 说明 |
|----------|-----------|------|
| HTML 文件（时长已校准） | `markdown-to-html` + `subtitle-timeline` | 含 `stepConfig`、`timelineConfig`、`TimelineEngine` |
| `tts-manifest.json` | `tts-voiceover` | 含每句音频路径、`duration_ms`、`html_path` |
| `output/subtitles.srt` | `subtitle-timeline` | 带时间戳的 SRT 字幕 |
| `output/audio/scene-NN/NNN.wav` | `tts-voiceover` | 逐句配音音频 |

## 三阶段管线

```
阶段 1：record   — Puppeteer 截帧 pipe FFmpeg → silent.mp4
阶段 2：audio    — FFmpeg concat 逐句 WAV    → full-audio.wav
阶段 3：compose  — FFmpeg 合成视频+音频+字幕  → final.mp4
```

每阶段独立可运行，某阶段失败只需重跑该阶段，不影响其他已完成的产物。

## 阶段 1：录制（record.js）

### 核心策略：接管时钟逐帧推进

不用真实时间驱动 HTML 自动播放，而是接管 TimelineEngine 的时钟：

1. 在浏览器中注入代码，暂停 TimelineEngine 的自动播放
2. 手动推进时间：每次推进 `1000/fps` 毫秒（30fps = 33.3ms/帧）
3. 推进后截一帧，再推进下一帧
4. 动画效果与机器性能完全解耦——慢机器也能录出流畅 30fps 视频

### 流式管道（防崩核心）

```
循环每一帧 {
  page.evaluate(() => timeline.advanceBy(33.3))   // 推进一帧时间
  buffer = await page.screenshot({ type: 'jpeg', quality: 95 })
  ffmpegProcess.stdin.write(buffer)                // 直接 pipe，不存盘
  buffer = null                                    // 立即释放引用
  await sleep(5)                                   // 给系统喘息
}
```

关键点：截图 Buffer 直接 pipe 进 FFmpeg stdin，不落地为 PNG/JPEG 文件，内存占用恒定。

### FFmpeg 接收端

```bash
ffmpeg -f image2pipe -framerate 30 -i pipe:0 \
  -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -r 30 output/video/silent.mp4
```

- `image2pipe`：从 stdin 读 JPEG 流
- `crf 18`：高画质
- `preset medium`：编码速度与压缩率的平衡

### 内存硬限制（2GB 总量）

| 组件 | 限制 | 实现方式 |
|------|------|----------|
| Chrome 渲染进程 | 1.5GB | `--max-old-space-size=1536` 启动参数 |
| Node.js 主进程 | 0.5GB | `--max-old-space-size=512` 启动参数 |
| 渲染进程数 | 1 个 | `--renderer-process-limit=1` |

`resource-guard.js` 每 100 帧检查一次 `process.memoryUsage()`，超过阈值主动暂停等待 GC。

### 帧数预算

```
总帧数 = 总时长ms × fps / 1000
```

总时长从 HTML 的 `timelineConfig` 计算：所有 scene.duration 之和 + 场景间过渡时间。

## 阶段 2：音频拼接（audio.js）

按 `tts-manifest.json` 的场景和字幕行顺序，拼接逐句 WAV 为完整音轨。

### 拼接逻辑

```
遍历 manifest.scenes:
  遍历 scene.lines:
    拼入 line.audio_path 的 WAV
    拼入 300ms 静音（line_gap_ms）
  场景结束后:
    拼入 800ms 静音（scene_gap_ms）
```

间隔参数与 `subtitle-timeline` skill 一致：
- `line_gap_ms = 300`（句间呼吸）
- `scene_gap_ms = 800`（场景切换静默）

### 实现方式

1. 用 FFmpeg 预生成静音片段：`ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t 0.3 silence_300ms.wav`
2. 生成 concat 列表文件（`filelist.txt`）
3. 一条命令拼接：`ffmpeg -f concat -safe 0 -i filelist.txt -c:a pcm_s16le output/video/full-audio.wav`

### 校验

拼接后音频总时长应与 HTML timelineConfig 总时长基本一致（允许 ±500ms 误差）。偏差过大输出警告。

## 阶段 3：合成（compose.js）

将无声视频、完整音轨、SRT 字幕合成为最终 MP4。

### FFmpeg 命令

```bash
ffmpeg -i output/video/silent.mp4 -i output/video/full-audio.wav \
  -vf "subtitles=output/subtitles.srt:force_style='FontName=PingFang SC,FontSize=42,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=3,Shadow=1,MarginV=60'" \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 192k \
  -map 0:v -map 1:a \
  -shortest \
  -y output/video/final.mp4
```

### 字幕样式

| 属性 | 值 | 说明 |
|------|-----|------|
| FontName | PingFang SC | Mac 自带，中文渲染好 |
| FontSize | 42 | 1080p 下清晰可读 |
| PrimaryColour | `&H00FFFFFF`（白） | 万能配色 |
| OutlineColour | `&H00000000`（黑） | 描边保证可读性 |
| Outline | 3 | 较粗描边，深浅背景都可读 |
| Shadow | 1 | 轻阴影增加层次 |
| MarginV | 60 | 底部安全边距 |

### 音视频对齐

- `-shortest`：以较短的轨为准截断
- 若音频比视频长（防御性处理），视频最后一帧静止保持

### 中间产物

合成成功后提示用户是否清理 `silent.mp4` 和 `full-audio.wav`，默认保留方便调试。

## 进度条

三个阶段各有独立终端进度条：

```
🎬 录制中  [████░░░░░░] 40% | 帧 600/1500 | 内存 1.1GB | 剩余 ~3m12s
🔊 音频拼接 [████████░░] 80% | 场景 6/8 | 已用 2s
🎞️ 合成中  [██████░░░░] 60% | 已用 12s | 剩余 ~8s
```

- 录制阶段：总帧数预算，每帧更新，显示内存用量
- 音频阶段：按场景计数
- 合成阶段：解析 FFmpeg stderr 的 `time=` 字段计算进度

## 文件结构

```
video-render/
  SKILL.md                          # Skill 定义
  scripts/
    video_render.js                 # 主入口（调度三阶段）
    record.js                       # 阶段1：Puppeteer 截帧 → 无声视频
    audio.js                        # 阶段2：FFmpeg 拼接音频
    compose.js                      # 阶段3：合成最终 MP4
    utils/
      progress.js                   # 终端进度条
      resource-guard.js             # 内存/资源监控
```

## 输入输出

### 输入

| 文件 | 说明 |
|------|------|
| `tts-manifest.json` | 含 `html_path`、每句音频路径和 `duration_ms` |
| HTML 文件 | manifest 的 `html_path` 指向，时长已由 `subtitle-timeline` 校准 |
| `output/subtitles.srt` | SRT 字幕文件 |
| `output/audio/scene-NN/NNN.wav` | 逐句配音 WAV |

### 输出

| 文件 | 说明 |
|------|------|
| `output/video/silent.mp4` | 无声视频（中间产物） |
| `output/video/full-audio.wav` | 完整音轨（中间产物） |
| **`output/video/final.mp4`** | **最终可发布视频** |

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

HTML 路径从 manifest 的 `html_path` 字段自动读取。

## 前置依赖

| 依赖 | 安装方式 | 用途 |
|------|----------|------|
| Node.js | 已有 | 运行脚本 |
| FFmpeg | `brew install ffmpeg` | 视频编码、音频拼接、字幕烧录 |
| Puppeteer | `npm install puppeteer` | 控制 Chrome 截帧 |

## 最终输出摘要

脚本执行完毕后输出：

```
✅ 视频生成完成
   📁 output/video/final.mp4
   🕐 总时长: 3m24s
   📐 分辨率: 1920×1080
   🎞️ 帧率: 30fps
   📦 文件大小: 48.2MB
```

## 错误处理

| 场景 | 处理 |
|------|------|
| FFmpeg 未安装 | 启动时检测，提示 `brew install ffmpeg` |
| Puppeteer/Chrome 启动失败 | 报告错误，提示检查 Puppeteer 安装 |
| manifest 文件不存在 | 报错退出，提示先运行 `tts-voiceover` |
| HTML 文件不存在 | 报错退出，提示检查 manifest 的 `html_path` |
| SRT 文件不存在 | 报错退出，提示先运行 `subtitle-timeline` |
| 音频文件缺失 | 报告缺失的文件路径，跳过并用静音填充 |
| 内存超阈值 | 暂停截帧等待 GC，连续超标则降低截图质量 |
| FFmpeg 进程崩溃 | 报告 stderr，保留已生成的中间产物 |
| 音视频时长偏差 > 500ms | 输出警告，仍继续合成 |

## 在完整链路中的位置

```
markdown-scriptwriter → Markdown 文案
    ├──→ markdown-to-html → HTML（估算 duration）
    │         ↓
    │    html-layout-review → 视觉验收
    │
    └──→ tts-voiceover → 音频 + tts-manifest.json
                                    ↓
                          subtitle-timeline
                              ├── subtitles.srt
                              └── 原地修改 HTML（真实 duration）
                                    ↓
                          video-render          ← 本 skill
                              ├── 阶段1: record  → silent.mp4
                              ├── 阶段2: audio   → full-audio.wav
                              └── 阶段3: compose → final.mp4 ✅
```
