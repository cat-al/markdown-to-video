---
name: tts-voiceover
description: "Use when generating voice-over audio from a video script Markdown file. Parses subtitle lines from scenes, calls TTS engine per sentence, and outputs audio files plus a tts-manifest.json for downstream subtitle-timeline consumption."
---

# TTS Voiceover — 文案配音生成

解析 `markdown-scriptwriter` 输出的标准格式 Markdown 文案，提取每个场景的字幕文本，逐句调用 TTS 生成音频，输出音频文件和 `tts-manifest.json` 时长清单。

## 核心原则

1. **逐句合成** — 每行 `>` 字幕独立生成一个音频文件，确保句级时长精确
2. **Manifest 是唯一契约** — 下游 `subtitle-timeline` 只消费 `tts-manifest.json`，不直接读 Markdown
3. **适配器可切换** — 通过 `--provider` 参数或 skill 内 `config/tts-providers.yaml` 切换 TTS 后端

## 文件结构

本 skill 自带 TTS CLI 脚本和适配器，位于 skill 目录内：

```
tts-voiceover/
  SKILL.md                          # 本文件
  config/
    tts-providers.yaml              # TTS 供应商配置
  scripts/
    tts_cli.py                      # CLI 入口
    tts_adapters/
      __init__.py
      base.py                       # TTSAdapter 抽象基类
      qwen3_local.py                # Qwen3-TTS 本地模型适配器
      minimax_api.py                # MiniMax API 适配器（预留）
      mimo_v2_api.py                # MiMo-V2 API 适配器（预留）
```

## 输入

Markdown 文案文件（由 `markdown-scriptwriter` 生成），字幕行以 `>` 引用块标记：

```markdown
## 场景1：场景标题

**画面描述**: ...
**视觉元素**: ...

> 第一句字幕文案
> 第二句字幕文案
> 第三句字幕文案
```

## 输出

### 1) 音频文件（按场景分目录）

```
output/audio/
  scene-01/
    001.wav
    002.wav
    003.wav
  scene-02/
    001.wav
    ...
```

### 2) `tts-manifest.json`

```json
{
  "source": "my-video-script.md",
  "html_path": "output/presentation.html",
  "provider": "qwen3-local",
  "created_at": "2026-04-25T19:40:00",
  "scenes": [
    {
      "scene_id": "scene_1",
      "scene_number": 1,
      "title": "场景标题",
      "lines": [
        {
          "index": 0,
          "text": "第一句字幕文案",
          "audio_path": "output/audio/scene-01/001.wav",
          "duration_ms": 2340
        }
      ]
    }
  ]
}
```

**ID 映射规则：** `scene_number` 是核心标识，与 Markdown 中 `## 场景N` 的 N 一致。下游 `subtitle-timeline` 用 `scene_number` 映射到 HTML 中的 `data-scene="N"`、`stepConfig["slide-N"]`、`timelineConfig.scenes[].scene === N`。

## 前置条件：参考音频

Qwen3-TTS Base 模型通过**声音克隆**生成语音，必须提供一段参考音频作为音色模板。

**执行 TTS 之前，必须检查参考音频是否存在：**

```bash
ls assets/ref-voice/speaker.wav
```

如果文件不存在，**停止执行并提示用户**：

> 请将一段 3~10 秒的清晰语音（wav/mp3）放到 `assets/ref-voice/` 目录下。
> 建议使用你希望视频配音听起来像的声音，录音环境尽量安静。
> 放好后在 `config/tts-providers.yaml` 中确认 `ref_audio` 路径正确。
> `ref_text` 为必填字段，填入参考音频的文字内容用于声音克隆对齐。

参考音频配置在 `config/tts-providers.yaml`：

```yaml
providers:
  qwen3-local:
    ref_audio: assets/ref-voice/speaker.wav   # 必填
    ref_text: "参考音频中说的文字内容"           # 必填，用于声音克隆对齐
```

## 执行流程

### 步骤 1：解析 Markdown

读取 Markdown 文案，提取所有场景及其字幕行：

- 场景标题匹配：`/^## 场景(\d+)[：:]\s*(.+)$/`（兼容中英文冒号）
- 字幕行匹配：以 `>` 开头的行 `/^>\s*(.+)$/`
- 同一个 `## 场景N` 下的所有 `>` 行都属于该场景（空行不打断分组）
- 非 `## 场景N` 标题下的 `>` 行忽略

### 步骤 2：确认输出路径和 HTML 路径

- 默认音频输出到 `output/audio/`
- 询问用户或从上下文推断对应的 HTML 文件路径（填入 manifest 的 `html_path` 字段）
- 如果 `output/` 目录已有内容，提醒用户将被覆盖

### 步骤 3：创建输出目录

```bash
mkdir -p output/audio/scene-01 output/audio/scene-02 ...
```

### 步骤 4：逐句调用 TTS CLI

对每个场景的每行字幕，执行（路径相对于项目根目录）：

```bash
python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --text "字幕文案" \
  --output output/audio/scene-01/001.wav \
  --provider qwen3-local
```

**特殊字符处理：** 如果字幕文本包含引号、换行、emoji 等特殊字符，改用 `--text-file` 模式：

```bash
# 先将文本写入临时文件
echo '含特殊字符的文本' > /tmp/tts-line.txt
python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --text-file /tmp/tts-line.txt \
  --output output/audio/scene-01/001.wav
```

CLI 输出到 stdout 一行 JSON：`{"path": "...", "duration_ms": N}`

**收集每句的 `duration_ms`。**

### 步骤 5：生成 tts-manifest.json

将所有结果汇总，写入 `output/tts-manifest.json`：

```json
{
  "source": "<markdown文件名>",
  "html_path": "<对应的HTML文件路径>",
  "provider": "<使用的TTS供应商>",
  "created_at": "<ISO 8601时间戳>",
  "scenes": [ ... ]
}
```

### 步骤 6：报告结果

输出摘要：总场景数、总字幕行数、总音频时长、每场景时长汇总。

## Markdown 解析规则

严格依赖 `markdown-scriptwriter` 的输出格式，不做额外容错：

| 规则 | 正则 / 说明 |
|------|-------------|
| 场景标题 | `/^## 场景(\d+)[：:]\s*(.+)$/` |
| 字幕行 | `/^>\s*(.+)$/` |
| 分组 | 同一 `## 场景N` 下的所有 `>` 行属于该场景 |
| 忽略 | 非 `## 场景N` 标题下的 `>` 行 |

## 错误处理

| 场景 | 处理 |
|------|------|
| 参考音频不存在 | 停止执行，提示用户将音频放到 `assets/ref-voice/` 并配置 `ref_audio` |
| TTS CLI 返回非零 exit code | 报告错误详情（stderr），停止当前场景，询问用户是否跳过 |
| 空文本 `>` 行 | 跳过 TTS 调用，生成 0 字节音频，`duration_ms` = 0 |
| 超长文本 | CLI 会报错退出，提示用户拆句 |
| 配置文件缺失 | 提示用户检查 skill 目录下的 `config/tts-providers.yaml` |

## 适配器切换

当前默认使用 `qwen3-local`（本地 Qwen3-TTS 模型）。切换方法：

1. 修改 skill 目录下 `config/tts-providers.yaml` 的 `default` 字段
2. 或在 CLI 调用时指定 `--provider minimax`

新增供应商：
1. 在 skill 目录下 `scripts/tts_adapters/` 新建适配器，实现 `TTSAdapter` 基类
2. 在 `scripts/tts_cli.py` 的 `ADAPTER_MAP` 中注册
3. 在 `config/tts-providers.yaml` 中添加 provider 条目

## Quick Reference

| 项目 | 值 |
|------|-----|
| 输入 | `markdown-scriptwriter` 输出的标准 Markdown |
| 输出 | `output/audio/scene-NN/NNN.wav` + `output/tts-manifest.json` |
| CLI 合成 | `python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py --text TEXT --output PATH` |
| CLI 验证 | `python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py --demo` |
| 配置 | `tts-voiceover/config/tts-providers.yaml` |
| 契约 | `tts-manifest.json` — 下游唯一消费格式 |
| 下游 | `subtitle-timeline` skill |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 跳过参考音频检查直接调 TTS | 必须先确认 `assets/ref-voice/speaker.wav` 存在，否则停下来提示用户 |
| 一次性把整个场景文本送 TTS | 逐行 `>` 字幕单独调用，确保句级时长精确 |
| 手动计算或估算 `duration_ms` | 必须从 TTS CLI 的 stdout JSON 中读取真实时长 |
| 忘记填 `html_path` | manifest 必须包含 HTML 文件路径，否则 `subtitle-timeline` 无法定位 |
| 把非字幕的 `>` 引用也纳入 | 只处理 `## 场景N` 标题下方的 `>` 行 |
| 场景编号用 0 开始 | `scene_number` 从 1 开始，与 Markdown 中 `## 场景1` 一致 |
