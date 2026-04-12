## MiMo-V2-TTS 音色样例库

小米 MiMo-V2-TTS 云端语音合成的音色与风格样例集。

### 目录说明

- `voices.json`：音色清单，包含音色名、语言、描述、示例文本、风格标签
- `generate-samples.mjs`：批量生成样例音频的脚本
- `samples/`：API 直接生成的 wav 样例
- `samples-summary.json`：每个样例文件的时长和大小摘要

### 当前音色 & 风格

MiMo-V2-TTS 提供 3 种基础音色：

| 音色代码 | 说明 |
|---|---|
| `mimo_default` | 默认音色，平衡自然 |
| `default_zh` | 中文女声，清晰温和 |
| `default_en` | 英文女声，自然流畅 |

此外通过 `<style>` 标签可叠加风格，本样例库包含以下风格变体：

| 风格 | 说明 |
|---|---|
| 开心 | 情绪愉快，语调上扬 |
| 悲伤 | 情绪低沉，语速放缓 |
| 东北话 | 东北方言风格 |
| 四川话 | 四川方言风格 |
| 悄悄话 | 低声耳语，音量轻柔 |

### 生成方式

**前置条件**：需要在 `.env` 中配置 `MIMO_API_KEY`，从 [platform.xiaomimimo.com](https://platform.xiaomimimo.com/) 获取。

```bash
# 在项目根目录执行
node mimo-tts-voice-showcase/generate-samples.mjs
```

脚本会依次调用 MiMo API 生成音频，直接保存为 wav 文件。

### 在 Markdown 中使用

在 frontmatter 中设置 `ttsProvider: mimo`，然后指定音色和风格：

```md
---
title: 我的视频
ttsProvider: mimo
ttsVoice: default_zh
ttsLanguage: Chinese
ttsInstruction: 开心
---
```

#### 基础音色示例

##### mimo_default

```md
---
ttsProvider: mimo
ttsVoice: mimo_default
ttsLanguage: Chinese
---
```

##### default_zh（中文）

```md
---
ttsProvider: mimo
ttsVoice: default_zh
ttsLanguage: Chinese
ttsInstruction: 自然、清晰
---
```

##### default_en（英文）

```md
---
ttsProvider: mimo
ttsVoice: default_en
ttsLanguage: English
---
```

#### 风格控制示例

通过 `ttsInstruction` 字段控制风格，内容会自动包裹成 `<style>...</style>` 标签：

```md
---
ttsProvider: mimo
ttsVoice: default_zh
ttsLanguage: Chinese
ttsInstruction: 开心 变快
---
```

支持的风格（可混合，唱歌除外）：

- **情绪**：开心、悲伤、生气
- **语速**：变快、变慢
- **方言**：东北话、四川话、粤语、河南话
- **特殊**：悄悄话、夹子音、台湾腔
- **场景**：唱歌（须单独使用）、角色扮演（孙悟空、林黛玉等）

还可以在旁白文本中用括号标注语气：

```md
<!-- voiceover
（紧张，深呼吸）呼……冷静，冷静。接下来我们看看这段代码的运行结果。
-->
```

### 渲染命令

```bash
# 预览
npm run dev:mimo

# 渲染视频
MIMO_API_KEY=your_key npm run render:md -- your-file.md dist/output.mp4

# 也可以通过环境变量覆盖 provider
TTS_PROVIDER=mimo MIMO_API_KEY=your_key npm run render:md -- any-file.md
```

### 建议

- `ttsInstruction` 简短为佳，1-3 个关键词效果最好
- 唱歌风格必须单独使用，不可与其他风格混合
- 如需精细控制语气，可在旁白文本中直接嵌入括号标注，如 `（笑着说）`
- API 当前限时免费，后续可能需要付费
