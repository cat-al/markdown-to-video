---
name: tts-voiceover
description: "Use when generating voice-over audio from a video script Markdown file (shot-montage format). Parses shot narration lines, calls TTS engine per shot, and outputs audio files plus a tts-manifest.json for downstream subtitle-timeline consumption."
---

# TTS Voiceover — 镜头配音生成

解析 `markdown-scriptwriter` 输出的标准格式 Markdown 文案（镜头蒙太奇格式），提取每个镜头的话术文本，逐句调用 TTS 生成音频，输出音频文件和 `tts-manifest.json` 时长清单。

## Python 运行环境

本项目的 TTS 依赖（`qwen-tts`、`torch`、`soundfile` 等）安装在项目根目录的虚拟环境中：

```
.venv/bin/python    # 必须使用此解释器运行 TTS 脚本
```

**所有 TTS CLI 调用必须使用 `.venv/bin/python`**，不要使用系统 `python3`（系统环境未安装 `qwen-tts`）。

示例：

```bash
cd /Users/bierchen/project-person/markdown-to-video
.venv/bin/python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py --text "..." --output ...
```

## 核心原则

1. **一镜一句一音频** — 每个镜头的话术生成一个独立音频文件
2. **Manifest 是唯一契约** — 下游 `subtitle-timeline` 只消费 `tts-manifest.json`，不直接读 Markdown
3. **适配器可切换** — 通过 `--provider` 参数或 skill 内 `config/tts-providers.yaml` 切换 TTS 后端
4. **扁平化命名** — 音频文件扁平存放为 `audio/shot-NNN.wav`（不再按场景分目录）

## 文件结构

```
tts-voiceover/
  SKILL.md                          # 本文件
  config/
    tts-providers.yaml              # TTS 供应商配置
  scripts/
    tts_cli.py                      # CLI 入口（含 --batch 批量合成）
    play_audio.py                   # 音频播放器
    tts_adapters/
      __init__.py
      base.py                       # TTSAdapter 抽象基类
      qwen3_local.py                # Qwen3-TTS 本地模型适配器
      minimax_api.py                # MiniMax API 适配器（预留）
      mimo_v2_api.py                # MiMo-V2 API 适配器（预留）
```

## 输入

镜头蒙太奇格式 Markdown 文案（由 `markdown-scriptwriter` 生成），话术以 `**话术**:` 标记：

```markdown
## 画布组 1：开场冲击

### 镜头 1（切换）
**话术**: "Harness Engineering 是什么"
**画面类型**: character + text-effect
**元素**: ...
**动效**: ...

### 镜头 2（延续）
**话术**: "和提示词工程有什么关系"
**画面类型**: text-effect
**元素**: ...
**动效**: ...
```

## 输出

### 1) 音频文件（扁平化命名）

```
<项目目录>/audio/
  shot-001.wav
  shot-002.wav
  shot-003.wav
  ...
```

### 2) `tts-manifest.json`

```json
{
  "source": "script.md",
  "html_path": "presentation.html",
  "provider": "qwen3-local",
  "created_at": "2026-05-05T12:00:00",
  "shots": [
    {
      "id": 1,
      "canvas_group": 1,
      "text": "Harness Engineering 是什么",
      "audio_path": "audio/shot-001.wav",
      "duration_ms": 2100
    },
    {
      "id": 2,
      "canvas_group": 1,
      "text": "和提示词工程有什么关系",
      "audio_path": "audio/shot-002.wav",
      "duration_ms": 2800
    }
  ]
}
```

**ID 映射规则：** `id` 是核心标识，与 Markdown 中 `### 镜头 N` 的 N 一致。下游 `subtitle-timeline` 用 `id` 映射到 HTML 中的 `data-shot="N"`、`timelineConfig.shots[].id === N`。

## 前置条件：参考音频

Qwen3-TTS Base 模型通过**声音克隆**生成语音，必须提供一段参考音频作为音色模板。

### 参考音频要求

| 项目 | 要求 |
|------|------|
| **时长** | **约 5 秒**（3~10 秒可用，5 秒最佳） |
| **选段** | 语气**平稳**、语速正常的片段 |
| **环境** | 安静无背景噪音，清晰人声 |
| **格式** | wav 或 mp3 |
| **ref_text** | **必填**。填写参考音频对应的文字内容 |

**执行 TTS 之前，必须检查参考音频是否存在：**

```bash
ls assets/ref-voice/speaker.wav
```

如果文件不存在，**停止执行并提示用户**。

参考音频配置在 `config/tts-providers.yaml`：

```yaml
providers:
  qwen3-local:
    ref_audio: assets/ref-voice/speaker.wav   # 必填
    ref_text: "参考音频中说的文字内容"           # 必填
```

## 执行流程

### 推荐方式：`--batch` 一条命令完成

```bash
.venv/bin/python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --batch <项目目录>/script.md \
  --output-dir <项目目录>/audio \
  --html-path <项目目录>/presentation.html \
  --provider qwen3-local
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `--batch` | 是 | Markdown 文案文件路径 |
| `--output-dir` | 否 | 音频输出根目录，默认 `<项目目录>/audio` |
| `--html-path` | 否 | HTML 文件路径，写入 manifest |
| `--provider` | 否 | TTS 供应商，默认从配置文件读取 |

**行为说明：**
- 解析所有 `**话术**:` 行，按镜头序号逐句合成
- 音频输出为 `audio/shot-001.wav`、`audio/shot-002.wav`...（三位数零填充）
- manifest 写入 `<项目目录>/tts-manifest.json`
- 新格式 manifest 使用 `shots` 数组（扁平结构），不再使用 `scenes[].lines[]`

### 备选方式：逐句调用

```bash
.venv/bin/python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --text "话术文本" \
  --output <项目目录>/audio/shot-001.wav \
  --provider qwen3-local
```

## Markdown 解析规则

| 规则 | 正则 / 说明 |
|------|-------------|
| 画布组标题 | `/^## 画布组\s*(\d+)[：:]\s*(.+)$/` |
| 镜头标题 | `/^### (?:\[互动\]\s*)?镜头\s*(\d+)(?:（(切换\|延续)）)?/` |
| 话术行 | `/^\*\*话术\*\*[：:]\s*"?(.+?)"?\s*$/` |
| 互动镜头 | 标题含 `[互动]` 标记 |
| 合成粒度 | 每个镜头的话术一个音频文件 |

## 错误处理

| 场景 | 处理 |
|------|------|
| 参考音频不存在 | 停止执行，提示用户 |
| 参考音频过长（>10s） | 警告建议裁剪 |
| TTS CLI 返回非零 exit code | 报告错误，生成空 WAV 占位 |
| 空话术 | 跳过 TTS 调用，`duration_ms` = 0 |
| 单句时长异常 | 自动重试最多 2 次 |

## 适配器切换

当前默认使用 `qwen3-local`。切换方法：
1. 修改 `config/tts-providers.yaml` 的 `default` 字段
2. 或传 `--provider minimax`

## Quick Reference

| 项目 | 值 |
|------|-----| 
| 输入 | `<项目目录>/script.md`（镜头蒙太奇格式） |
| 输出 | `<项目目录>/audio/shot-NNN.wav` + `<项目目录>/tts-manifest.json` |
| CLI 批量合成 | `.venv/bin/python tts_cli.py --batch <script.md> --output-dir <audio>` |
| CLI 单句合成 | `.venv/bin/python tts_cli.py --text TEXT --output PATH` |
| 配置 | `tts-voiceover/config/tts-providers.yaml` |
| 契约 | `tts-manifest.json`（shots 扁平结构） |
| 下游 | `subtitle-timeline` skill |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 使用旧格式 `scenes[].lines[]` | 新格式使用 `shots[]` 扁平结构 |
| 音频按场景分目录 | 扁平化：`audio/shot-NNN.wav` |
| 跳过参考音频检查 | 必须先确认参考音频存在 |
| 解析旧格式的 `>` 字幕行 | 新格式解析 `**话术**:` 行 |
| 手动计算 duration_ms | 必须从 TTS CLI 输出读取真实时长 |
