---
title: MiMo-V2-TTS 云端语音演示
subtitle: 使用小米 MiMo-V2-TTS API 生成配音
themeColor: "#ff6900"
ttsProvider: mimo
ttsModel: mimo-v2-tts
ttsVoice: default_zh
ttsLanguage: Chinese
ttsInstruction: 自然、清晰
---
# MiMo-V2-TTS 云端语音合成

这是一个使用小米 MiMo-V2-TTS 云端 API 生成配音的演示。

- 无需本地 GPU，直接调用云端 API
- 支持中文、英文多种音色
- 支持风格控制：情绪、语速、方言

<!-- voiceover
大家好，这是一个使用小米 MiMo-V2-TTS 云端语音合成的演示。它不需要本地 GPU，直接调用云端 API 就能生成高质量的配音。
-->

---

## 三种内置音色

MiMo-V2-TTS 目前提供三种预置音色：

- **mimo_default**：默认音色，平衡自然
- **default_zh**：中文女声，适合中文内容
- **default_en**：英文女声，适合英文内容

在 Markdown 的 frontmatter 中通过 `ttsVoice` 字段指定即可。

<!-- voiceover
MiMo-V2-TTS 目前提供三种预置音色。mimo_default 是默认音色，default_zh 是中文女声，default_en 是英文女声。你只需要在 Markdown 的 frontmatter 中设置 ttsVoice 字段就能切换。
-->

---

## 风格控制

MiMo-V2-TTS 支持通过 `ttsInstruction` 控制语音风格：

- 情绪：开心、悲伤、生气
- 语速：变快、变慢
- 方言：东北话、四川话、粤语
- 特殊：悄悄话、角色扮演

<!-- voiceover
MiMo-V2-TTS 还支持丰富的风格控制。你可以在 frontmatter 的 ttsInstruction 字段中写入风格描述，比如"开心"、"悲伤"、"东北话"等，模型会自动调整语音的情感和风格。
-->
