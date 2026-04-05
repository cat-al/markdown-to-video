## Qwen3-TTS 音色样例库

这个目录用于集中管理 `Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice` 的全部音色样例。

### 目录说明

- `voices.json`：音色清单，包含音色名、语言、描述、示例文本、风格指令
- `generate-samples.mjs`：批量生成样例音频的脚本
- `raw/`：Qwen 直接生成的原始音频
- `samples/`：统一裁成约 2 秒的最终样例
- `samples-summary.json`：每个样例文件的时长和大小摘要
- `MARKDOWN-使用说明.md`：在本项目 `markdown` 中如何使用这些音色

### 当前音色

根据本地模型 README，这个模型支持 9 个音色：

- `Vivian`
- `Serena`
- `Uncle_Fu`
- `Dylan`
- `Eric`
- `Ryan`
- `Aiden`
- `Ono_Anna`
- `Sohee`

### 生成方式

在项目根目录执行：

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python node qwen3-tts-voice-showcase/generate-samples.mjs
```

### 说明

- 为了更好体现音色特点，这里没有强制所有音色都说完全同一句话
- 中文音色使用中文示例，英文/日文/韩文音色使用更贴近其母语的短句
- 最终样例统一裁成约 2 秒，便于快速试听和横向比较
