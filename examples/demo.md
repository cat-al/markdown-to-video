---
title: Markdown to Video Demo
subtitle: 一个基于 Remotion 的最小可运行原型
themeColor: #8b5cf6
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
---
# 你好，Markdown 视频

把你的文稿按页写好，就可以自动生成视频。

- 每一页用 `---` 分隔
- 标题会被识别为当前页主题
- 内容越多，默认时长越长

<!-- voiceover
你好，这是一段由 Markdown 驱动的视频示例。你继续像平时写文档一样写内容，系统会帮你生成配音和字幕。
-->

---

## 这类项目为什么值得做

- 对开发者和内容团队都友好
- 适合批量生产教程、解说、产品介绍
- 后续可以接入 TTS、字幕、品牌模板

<!-- voiceover
对很多内容团队来说，真正需要的不是复杂剪辑，而是把已经写好的文稿快速稳定地变成视频。这正是这类系统的价值。
-->

---

## 你可以这样扩展

1. 支持封面和结尾模板
2. 给每一页增加 `<!-- duration: 6 -->`
3. 接 AI 自动生成配图和旁白

<!-- duration: 7 -->
<!-- voiceover
如果某一页你想停留更久，可以显式指定 duration。后面我们还可以把旁白、字幕、品牌模板和批量渲染继续接上。
-->
