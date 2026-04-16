---
title: Patrick Voice Clone Demo
subtitle: 先用仓库内录音接通 Qwen3 Base，再逐步补齐转写
themeColor: #ec4899
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-Base
ttsLanguage: Chinese
ttsReferenceAudio: ../findings.wav
ttsXVectorOnlyMode: true
---
# Qwen3-TTS Base 语音克隆

这份示例已经接入仓库里的 `examples/findings.wav`，用于先把派大星参考音色跑通。

- `ttsReferenceAudio` 指向 `examples/findings.wav`
- 当前先使用 `ttsXVectorOnlyMode: true`，所以**只有参考音频也能直接试听**
- 等你补上逐字转写后，再把 `ttsReferenceText` 填回 frontmatter，效果通常会更稳

<!-- voiceover
这一页演示的是 Qwen3-TTS Base 模型的语音克隆模式。我们已经把仓库里的派大星参考录音接进来了，所以现在就可以直接试听第一版效果。后续如果补上逐字转写，整体的咬字和韵律通常还会再稳一些。
-->

---

## 推荐工作流

1. 先用当前 `findings.wav` 跑单页试听，确认音色方向对不对
2. 如果音色对了，再补一版逐字转写，关闭 `ttsXVectorOnlyMode`
3. 最后整篇渲染，必要时用 `npm run tts:redo` 单页重做

<!-- voiceover
现在最适合的工作流，是先用现有的参考录音跑单页试听，确认派大星的感觉有没有出来。如果方向对，再把参考文本按听写稿补进去，这样咬字和停顿通常会更稳定。最后再做整篇渲染，有问题的页也可以单独重生成音频。
-->
