# HTML-PPT 渲染模式指南

## 概述

`html-ppt` 渲染模式让你可以使用来自 [html-ppt-skill](https://github.com/lewislulu/html-ppt-skill) 的高质量 HTML 模板效果（含动态 Canvas 特效和 CSS 动画）生成视频。

**工作原理**：
1. Markdown 幻灯片 → 生成独立 HTML 文件（含主题、动画、Canvas 特效）
2. Playwright Headless Chrome 录制每页 HTML 为视频片段
3. Remotion 以 `<OffthreadVideo>` 加载视频背景 + 叠加字幕 + 音频
4. 输出最终 .mp4

## 快速开始

### 1. 启用 html-ppt 模式

在 Markdown frontmatter 中添加 `renderer: html-ppt`：

```yaml
---
title: 我的技术分享
renderer: html-ppt
theme: tokyo-night
ttsProvider: qwen-local
ttsVoice: Vivian
---
```

### 2. 可选配置

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `renderer` | 渲染模式：`html-ppt` 或 `native` | `native` |
| `theme` | html-ppt 主题名称（36 个可选） | `tokyo-night` |
| `template` | 使用哪个 full-deck 模板（15 个可选） | 自动选择 |

### 3. 使用 Canvas 特效

在幻灯片中添加 HTML 注释指定特效：

```markdown
## 我的标题

<!-- fx: particle-burst -->

正文内容...
```

### 4. 渲染

```bash
# 标准渲染
npm run render:md -- examples/demo/html-ppt-demo.md

# 增量渲染
npm run render:fast -- examples/demo/html-ppt-demo.md

# 预览模式
PREVIEW_MARKDOWN=examples/demo/html-ppt-demo.md npm run dev
```

## 可用主题（36 个）

| 主题 | 风格 |
|------|------|
| `tokyo-night` | 暗色技术风（推荐默认） |
| `minimal-white` | 极简白色 |
| `aurora` | 极光渐变 |
| `cyberpunk-neon` | 赛博朋克霓虹 |
| `dracula` | 暗色经典 |
| `catppuccin-mocha` | 柔和暗色 |
| `catppuccin-latte` | 柔和亮色 |
| `glassmorphism` | 毛玻璃效果 |
| `neo-brutalism` | 新粗野主义 |
| `terminal-green` | 终端绿色 |
| `xiaohongshu-white` | 小红书白色 |
| `editorial-serif` | 编辑衬线体 |
| `swiss-grid` | 瑞士网格 |
| `blueprint` | 蓝图工程 |
| `academic-paper` | 学术论文 |
| ... | 更多请查看 `vendor/html-ppt/assets/themes/` |

## 可用 Canvas 特效（20 个）

在 `<!-- fx: name -->` 中使用：

| 特效 | 说明 |
|------|------|
| `particle-burst` | 粒子爆发 |
| `confetti-cannon` | 彩纸炮 |
| `firework` | 烟花 |
| `starfield` | 星空 |
| `matrix-rain` | 矩阵雨 |
| `knowledge-graph` | 知识图谱 |
| `neural-net` | 神经网络 |
| `constellation` | 星座连线 |
| `orbit-ring` | 轨道环 |
| `galaxy-swirl` | 银河旋涡 |
| `word-cascade` | 文字瀑布 |
| `letter-explode` | 字母爆炸 |
| `chain-react` | 链式反应 |
| `magnetic-field` | 磁场 |
| `data-stream` | 数据流 |
| `gradient-blob` | 渐变色块 |
| `sparkle-trail` | 闪光拖尾 |
| `shockwave` | 冲击波 |
| `typewriter-multi` | 多行打字机 |
| `counter-explosion` | 计数爆炸 |

## 架构说明

```
Markdown → parseFrontmatter (renderer=html-ppt)
    │
    ├── generateHtmlSlides()     → vendor/html-ppt/生成 HTML 文件
    ├── startHtmlServer()        → 本地 HTTP 服务
    ├── recordHtmlVideos()       → Playwright 录制 → ffmpeg 转码 → .mp4
    │
    ├── generateSpeech()         → TTS 音频（不变）
    ├── buildCaptionCues()       → 字幕分段（不变）
    │
    └── Remotion 渲染
        ├── <OffthreadVideo> — 播放录制的视频背景
        ├── 字幕层 — captionCues
        └── <Audio> — TTS 音频
```

## 依赖

- **Playwright**：用于 Headless Chrome 录制
- **ffmpeg**：视频格式转换（webm → mp4）
- 两者均需预先安装

## 注意事项

1. 首次录制较慢（需启动 Chromium + 逐页录制），后续可通过缓存优化
2. Canvas 特效在 Headless Chrome 中完整保留，但需确保 GPU 支持
3. 字体加载依赖网络，建议使用本地字体或预加载
4. 增量渲染模式下，只有内容变化的页面才会重新录制
