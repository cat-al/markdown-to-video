## 在 Markdown 文件中使用 Qwen3-TTS 音色

本项目支持在 `markdown` 的 frontmatter 中直接配置 `Qwen3-TTS`。

### 最小配置示例

```md
---
title: Serena Demo
subtitle: 使用 Serena 音色做一段中文讲解
themeColor: #14b8a6
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Serena
ttsLanguage: Chinese
ttsInstruction: 温柔、亲切、自然，像在轻声讲述一段温暖的开场。
---
# 这是标题

这里是页面内容。

<!-- voiceover
今天是一个阳光明媚的一天。
-->
```

### 常用字段说明

- `ttsProvider`：固定写 `qwen-local`
- `ttsModel`：推荐写 `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`
- `ttsVoice`：指定音色名，例如 `Serena`
- `ttsLanguage`：当前旁白语言，例如 `Chinese`、`English`、`Japanese`、`Korean`
- `ttsInstruction`：补充语气、情绪、节奏等风格控制

### 可用音色

- **中文**：`Vivian`、`Serena`、`Uncle_Fu`、`Dylan`、`Eric`
- **英文**：`Ryan`、`Aiden`
- **日文**：`Ono_Anna`
- **韩文**：`Sohee`

### 不同音色的 frontmatter 示例

#### Serena

```md
---
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Serena
ttsLanguage: Chinese
ttsInstruction: 温柔、亲切、自然，像在轻声讲述一段温暖的开场。
---
```

#### Uncle_Fu

```md
---
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Uncle_Fu
ttsLanguage: Chinese
ttsInstruction: 沉稳、宽厚、松弛，像一位有经验的长者在安抚听众。
---
```

#### Ryan

```md
---
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Ryan
ttsLanguage: English
ttsInstruction: Energetic, rhythmic, and confident, like a modern product launch intro.
---
```

### 渲染命令

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run render:md -- your-file.md dist/your-file.mp4
```

### 建议

- 最好让音色和旁白语言保持一致，这样效果通常更自然
- `ttsInstruction` 不宜过长，保持一句话最稳
- 如果页面里有代码、链接、日期，建议在 `voiceover` 里写更适合口播的版本
