## 音频与语音合成指南

本文档说明项目支持的三种 TTS 后端（Qwen3-TTS / MiMo-V2-TTS / 系统 TTS）的配置和使用方式，以及单页音频重新生成的操作方法。

### 默认 Qwen3-TTS 配置

项目默认使用以下策略：

- **默认 provider**：`qwen-local`
- **默认模型**：`Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice`
- **默认音色**：`Vivian`
- **macOS 默认推理策略**：`CPU + float32`
- **自动 Python 探测**：若存在 `.venv-qwen/bin/python`，脚本会优先使用它
- **自动本地模型探测**：若 `.models/<repoName>` 存在，会优先走本地路径

### 使用 Qwen3-TTS 本地模型

如果你想显式写在 Markdown 中，可以这样配置：

```md
---
title: Qwen Demo
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
ttsInstruction: 自然、清晰、专业的中文视频讲解音色，节奏稳定，适合技术教程和产品介绍。
---
```

#### 下载本地模型镜像

```bash
npm run download:qwen:modelscope
```

#### 直接查看 Qwen 预览效果

```bash
npm run dev:qwen
```

#### 使用 Qwen 渲染视频

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run render:md -- examples/demo/qwen-local.md dist/qwen-local.mp4
```

#### 检查 Qwen 环境

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run qwen:doctor
```

### 使用 MiMo-V2-TTS 云端语音（Xiaomi）

MiMo-V2-TTS 是小米推出的云端语音合成模型，**无需本地 GPU**，通过 API 调用即可获得高质量语音。目前 API 限时免费。

#### 1. 获取 API Key

前往 [Xiaomi MiMo 开放平台](https://platform.xiaomimimo.com/) 注册并创建 API Key。

#### 2. 配置 API Key

在项目根目录创建或编辑 `.env` 文件：

```bash
MIMO_API_KEY=your_api_key_here
```

#### 3. 在 Markdown 中使用 MiMo

```md
---
title: MiMo 演示
ttsProvider: mimo
ttsVoice: default_zh
ttsLanguage: Chinese
ttsInstruction: 自然、清晰
---
```

支持的音色：

- **`mimo_default`**：默认音色
- **`default_zh`**：中文女声
- **`default_en`**：英文女声

支持的风格控制（通过 `ttsInstruction`）：

- 情绪：开心、悲伤、生气
- 语速：变快、变慢
- 方言：东北话、四川话、粤语
- 特殊：悄悄话、角色扮演（如孙悟空、林黛玉）

#### 4. 预览与渲染

```bash
# 预览
npm run dev:mimo

# 渲染
MIMO_API_KEY=your_key npm run render:md -- examples/demo/mimo-tts.md dist/mimo-demo.mp4
```

也可以通过环境变量覆盖 Markdown 中的设置：

```bash
TTS_PROVIDER=mimo MIMO_API_KEY=your_key npm run render:md -- your-file.md
```

### 系统 TTS 说明

代码里仍保留了 `system` provider 兼容分支，但它已经**不再是默认方案**。常规预览和渲染流程现在都默认使用 `Qwen3-TTS`。

### 单页音频重新生成（TTS 质量修复）

云端 TTS（如 MiMo）和本地 TTS（如 Qwen）都可能出现某一页配音质量不稳定的情况（语调异常、吞字、节奏不自然等）。这时不需要重新渲染整篇视频，只需要重新生成有问题的那一页音频即可。

#### 基本用法

```bash
# 重新生成第 3 页的音频（只生成音频，不渲染视频）
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3

# 重新生成第 3、5、7 页
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3,5,7

# 重新生成第 3 到 7 页
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3-7
```

#### 试听后渲染

不加 `--render` 时，脚本只会重新生成音频文件，并打印 wav 路径供你试听：

```bash
# 1. 先重新生成音频
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3

# 2. 试听（macOS）
open public/generated/004-hermes-agent-vs-openclaw-zh/slide-03.wav

# 3. 满意后再渲染视频
npm run render:md -- examples/published/004-hermes-agent-vs-openclaw-zh.md
```

#### 一步到位

如果不需要试听，加 `--render` 可以重新生成音频后立即渲染视频：

```bash
npm run tts:redo -- examples/published/004-hermes-agent-vs-openclaw-zh.md 3 --render
```

#### 工作原理

- 删除指定页的音频缓存记录（`tts-manifest.json`）和 wav 文件
- 重跑管线时，其他页通过 SHA1 缓存**自动复用**，只有被失效的页会重新调用 TTS
- 即使没有修改文案，也能**强制重新生成**（用于解决 TTS 随机质量问题）
- 页码从 1 开始，对应 Markdown 中用 `---` 分隔的第几页
