---
title: Qwen3-TTS Local Demo
subtitle: 使用 Qwen3-TTS 本地模型生成更自然的中文讲解音频
themeColor: #2563eb
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
ttsInstruction: 自然、清晰、专业的中文视频讲解音色，节奏稳定，适合技术教程和产品介绍。
---
# Qwen3-TTS 本地接入

这份示例展示了如何把 `Qwen3-TTS` 作为本地 TTS provider 接到当前项目里。

- 更适合中文讲解场景
- 方便后续做品牌音色
- 也可以继续扩展到声音克隆

<!-- voiceover
这一页演示的是 Qwen3-TTS 本地接入方式。相比旧的系统 TTS 方案，它更适合做自然流畅的中文视频讲解音频。
-->

---

## 使用方式

1. 先准备 Python 环境和依赖
2. 配置 `QWEN_PYTHON` 指向虚拟环境
3. 使用这份 Markdown 直接渲染

<!-- voiceover
你可以保留现在的 Remotion 渲染链路不变，只把音频生成 provider 从 system 切换为 qwen-local。这样整体工程改动会非常可控。
-->
