## Qwen3-TTS Base 语音克隆与派大星方案

这份文档说明如何在本项目中使用 `Qwen/Qwen3-TTS-12Hz-0.6B-Base` 做 **VoiceClone**，以及如何为“海绵宝宝央配里的派大星”准备一段足够稳定的参考样本。

### 已接入的能力

当前仓库已经支持：

- **`ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-Base`**
- **`ttsReferenceAudio`**：参考音频路径，支持相对 Markdown 文件路径
- **`ttsReferenceText`**：参考音频逐字转写
- **`ttsXVectorOnlyMode`**：允许只喂参考音频，但默认仍建议带文本
- **缓存自动失效**：更换参考音频文件或转写后，会重新生成对应音频

### 推荐配置

如果你现在和这次一样，**已经有录音，但还没补逐字转写**，先用这版把链路接通：

```md
---
title: Patrick Clone Demo
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-Base
ttsLanguage: Chinese
ttsReferenceAudio: ../findings.wav
ttsXVectorOnlyMode: true
---
```

等你把参考文本听写完成后，再切到更稳的完整版：

```md
---
title: Patrick Clone Demo
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-Base
ttsLanguage: Chinese
ttsReferenceAudio: ../findings.wav
ttsReferenceText: 请替换为你实际截取的参考音频逐字转写
ttsXVectorOnlyMode: false
---
```

### 字段说明

- **`ttsReferenceAudio`**：建议使用本地 `wav` 文件；相对路径会相对当前 Markdown 文件解析
- **`ttsReferenceText`**：尽量逐字逐停顿匹配参考音频；如果文本和音频偏差很大，克隆稳定性会明显下降
- **`ttsXVectorOnlyMode`**：只有在拿不到准确转写时再考虑打开；通常会牺牲一部分咬字和韵律一致性
- **`ttsVoice`**：Base 模式下不使用预置 speaker，因此这个字段可省略

### 建议命令

```bash
npm run download:qwen:base:modelscope
npm run dev:qwen:base
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run render:md -- examples/demo/qwen-base-clone.md dist/qwen-base-clone.mp4
```

### 派大星参考样本：我建议优先取哪一段

如果目标是复刻 **“央配派大星”最有辨识度的声音感觉**，我建议优先从 **`New Student Starfish`（常见中文译名：`新生派大星`）** 的开场对话里取样。

更具体地说，优先找这段连续对白附近的 22 到 30 秒：

- **“嗨，海绵宝宝，我们去抓水母吧。”**
- **“如果你去上学 / 上班的话，我今天该干点什么？”**
- **“等你回来。”**

### 为什么推荐这段

这段非常适合做派大星克隆基准，因为它同时包含了：

- **天然呆的慢拍感**：派大星说话的核心辨识度之一
- **拖尾和犹豫停顿**：比纯大喊大叫的桥段更适合建模
- **情绪转折**：从开心邀请，到发问，再到委屈收尾
- **台词密度适中**：通常容易截出 20 秒以上、而且背景音乐不算太重的片段
- **角色纯度高**：这段里派大星的音色主导性比较强，利于模型锁定 timbre

### 可行的取样方案

#### 方案 A：优先方案

- **片段类型**：`新生派大星` 开场对话
- **目标时长**：22 到 30 秒
- **保留内容**：派大星的完整邀请、提问、收尾三段
- **处理建议**：尽量保留原始停顿，不要把句间空白剪得太干

#### 方案 B：备选方案

如果你手头拿到的版本背景音乐太重、或者海绵宝宝插话过多，就改为筛选下面这种片段：

- 派大星单人台词占比高
- 语速偏慢
- 不是纯尖叫、不是纯夸张喊叫
- 最少 20 秒，最好 24 秒以上
- 背景音效稳定，没有频繁角色打断

### 正版片源获取建议

为了避免音轨版本混乱，建议只从 **正版中文配音片源** 里截样，不要混用二创剪辑或二次压制资源。

可优先从这些入口找：

- **腾讯视频** 的 `海绵宝宝合集 / 中文版`
- **爱奇艺** 搜索 `海绵宝宝 中文版`
- **优酷** 的中文配音版本

社区检索结果里，前 120 集央配通常能在这些平台找到；实际片名或集序可能随平台有差异，所以建议你直接搜索：

- **`海绵宝宝 中文版 新生派大星`**
- **`海绵宝宝 央配 派大星 等你回来`**

### 实操步骤

#### 1. 先截一段干净样本

建议标准：

- **时长**：22 到 30 秒
- **格式**：`wav` 优先
- **声道**：单声道更稳
- **采样率**：`16000` 或 `24000` 都可以
- **噪声**：尽量避开大段 BGM、笑声、环境特效

#### 2. 手动转写参考文本

`ttsReferenceText` 最好按“听写稿”来写，而不是按网上流传的金句版本来写。原因很简单：

- 央配版本可能和网络流传文本有细微差异
- 停顿词、语气词、重复词对韵律影响很大
- Base 模式里，**参考文本越准，复刻越稳**

#### 3. 先做单页试听

可以先拿 `examples/demo/qwen-base-clone.md` 改成你的实际参考配置，然后只预览一页：

```bash
QWEN_PYTHON=$(pwd)/.venv-qwen/bin/python npm run preview:slide -- examples/demo/qwen-base-clone.md 1
```

如果像，再去整篇渲染。

#### 4. 不满意时怎么调

如果第一次听起来“不够像派大星”，按这个顺序排查：

- **先换参考片段**：比改文案更有效
- **再修正 `ttsReferenceText`**：尤其是停顿词和重复词
- **再缩短样本**：有时候 24 秒比 35 秒更稳
- **最后才尝试 `ttsXVectorOnlyMode: true`**：这通常是兜底，不是首选

### 我对这次需求的结论

如果你的目标是“尽量接近大家熟悉的央配派大星”，**最可行的首选方案**就是：

- 用 `Qwen3-TTS-12Hz-0.6B-Base`
- 从 **`新生派大星 / New Student Starfish`** 的开场对话中，截取 **22 到 30 秒** 的央配片段
- 手动做逐字转写
- 先单页试听，再决定是否整篇生成

这个方案的优点是 **角色辨识度高、样本容易拿到、情绪稳定、适合长篇继续复用**。

### 版权提醒

建议只把截出的参考音频用于你本地的模型测试、音色对齐和项目内生成，不要把原始片段再分发到公开仓库或公开素材包中。
