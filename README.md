# markdown-to-video2

一个面向 **`Markdown -> 视频`** 的 skill 项目。

采用**镜头蒙太奇架构**，将视频的最小画面单位从"场景"重定义为"镜头"（1-10秒），通过高频画面切换实现信息密度高、节奏感强的视频效果。

## 架构：镜头蒙太奇模型

| 概念 | 说明 |
|------|------|
| **镜头（Shot）** | 最小调度单位，一镜一句话术，5-40 字，1-10 秒 |
| **画布组（Canvas Group）** | 逻辑分组，3-8 个镜头共享画布，对应一个概念段落 |
| **画布演化** | 画布组内镜头做增量渲染（元素入场/退出/变化） |
| **画布切换** | 画布组间做全画面过渡（淡入淡出） |

## 当前进度

已落地六个模块，覆盖从文案到最终视频输出的完整链路：

1. `markdown-scriptwriter`：生成镜头蒙太奇格式的视频文案 Markdown
2. `markdown-to-html`：将文案转成 16:9 宽屏 HTML 动画幻灯片（镜头级渲染）
3. `html-layout-review`：对 HTML 页面做 `1920x1080` 画布视觉验收（逐镜头）
4. `tts-voiceover`：逐镜头调用 TTS 生成配音音频 + `tts-manifest.json`
5. `subtitle-timeline`：消费 manifest + HTML，生成 SRT 字幕并用真实音频时长重写时间轴
6. `video-render`：三阶段管线（Puppeteer 截帧 → 音频拼接 → FFmpeg 合成），输出可发布 MP4

## 产物目录约定

> 完整约定见 [`docs/project-output-convention.md`](docs/project-output-convention.md)。

每个视频项目的产物隔离在独立目录中，目录名格式为 `<NNN>-<slug>`：

```
output/
  001-harness-engineering/
    script.md                  ← markdown-scriptwriter（镜头蒙太奇格式）
    presentation.html          ← markdown-to-html（镜头级渲染）
    paper-texture-bg.png       ← markdown-to-html
    audio/                     ← tts-voiceover
      shot-001.wav             ← 扁平化命名
      shot-002.wav
      shot-003.wav
    tts-manifest.json          ← tts-voiceover（shots 扁平格式）
    subtitles.srt              ← subtitle-timeline
    video/                     ← video-render
      silent.mp4
      full-audio.wav
      final.mp4
  002-attention-mechanism/
    ...
```

- 编号自动递增（扫描 `output/` 下已有目录）
- slug 由用户在 brainstorming 阶段确认
- manifest 内路径全部使用相对于项目目录的相对路径
- 每个 skill 调用时附带项目目录路径

## 完整链路

```
内容/想法
    ↓
markdown-scriptwriter → <项目目录>/script.md（镜头蒙太奇格式）
    ├──→ markdown-to-html → <项目目录>/presentation.html（镜头级渲染）
    │         ↓
    │    html-layout-review → 逐镜头视觉验收
    │
    └──→ tts-voiceover → <项目目录>/audio/shot-NNN.wav + tts-manifest.json
                                    ↓
                          subtitle-timeline
                              ├── <项目目录>/subtitles.srt
                              └── 原地修改 presentation.html（duration 回填）
                                    ↓
                          video-render
                              ├── 阶段1: record  → video/silent.mp4
                              ├── 阶段2: audio   → video/full-audio.wav
                              └── 阶段3: compose → video/final.mp4 ✅
```

`tts-voiceover` 和 `markdown-to-html` 是**平行**关系，都以 Markdown 文案为输入。`subtitle-timeline` 在两者之后，消费两者的输出。

## 画面类型系统

支持 8 种画面类型，覆盖丰富的视觉表达：

| 类型 | 描述 |
|------|------|
| `character` | 角色/IP，SVG 简笔角色 |
| `screenshot` | 截图引用，SVG 模拟界面框架 |
| `icon-combo` | 图标组合，SVG 图标阵列 |
| `concept-map` | 概念图/流程图，SVG 节点图 |
| `code-demo` | 代码演示，深色终端模拟 |
| `text-effect` | 文字排版特效 |
| `comparison` | 对比展示 |
| `interaction` | 互动引导（关注/弹幕/点赞） |

## TTS 基础设施

TTS 配音通过可插拔的适配器架构支持多后端：

```
.codebuddy/skills/tts-voiceover/
  SKILL.md
  config/
    tts-providers.yaml              # 供应商配置
  scripts/
    tts_cli.py                      # CLI 入口
    tts_adapters/
      base.py                       # TTSAdapter 抽象基类
      qwen3_local.py                # Qwen3-TTS 本地模型（默认）
      minimax_api.py                # MiniMax API（预留）
      mimo_v2_api.py                # MiMo-V2 API（预留）
```

使用方式：

```bash
.venv/bin/python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --batch output/001-harness-engineering/script.md \
  --output-dir output/001-harness-engineering/audio
```

## 设计方向

- **镜头蒙太奇模型** — 最小画面单位是镜头（1-10秒），高频切换
- 每个阶段独立演进、可替换、可组合
- 通过 `tts-manifest.json`（shots 扁平格式）作为契约格式解耦
- TTS 后端通过适配器模式支持本地模型和外部 API 切换
- 品牌色系固定：纸浆米白 + 陶土棕绿
