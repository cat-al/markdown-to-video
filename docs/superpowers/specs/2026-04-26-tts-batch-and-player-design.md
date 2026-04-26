# TTS 批量合成进度条 & 章节音频播放器

**日期**: 2026-04-26
**状态**: 已实现

> **与早期文档的关系：** `2026-04-25-tts-voiceover-subtitle-timeline-design.md` 第 11 节提到未来 `--batch` 接收 JSON 文件。本文档将该计划改为接收 **Markdown 文件**，更贴合实际使用场景（用户手上有的是 Markdown 文案，而非中间 JSON）。早期文档的 `--batch` 描述已被本设计取代。

## 背景

当前 tts-voiceover skill 的合成流程是 agent 在 shell 中逐句调用 `tts_cli.py`，每句一条命令。存在两个痛点：

1. **缺乏整体进度感知** — 合成数十句时，无法直观看到整体进展、预估剩余时间
2. **难以审听** — 合成后 `output/audio/scene-NN/` 下是零散的 wav 文件，需要逐个打开才能审查

## 功能 1：批量合成模式（--batch）

### 概述

在现有 `tts_cli.py` 中新增 `--batch` 模式，一条命令完成：解析 Markdown → 逐句合成（带进度条）→ 生成 `tts-manifest.json`。

### 使用方式

```bash
python .codebuddy/skills/tts-voiceover/scripts/tts_cli.py \
  --batch script.md \
  --output-dir output/audio \
  --html-path output/presentation.html \
  --provider qwen3-local
```

参数说明：

| 参数 | 必填 | 说明 |
|------|------|------|
| `--batch` | 是 | Markdown 文案文件路径 |
| `--output-dir` | 否 | 音频输出根目录，默认 `output/audio` |
| `--html-path` | 否 | 对应的 HTML 文件路径，写入 manifest |
| `--provider` | 否 | TTS 供应商，默认从配置文件读取 |
| `--config` | 否 | 配置文件路径 |

### argparse 集成

`--batch` 加入现有互斥组，与 `--text`、`--text-file` 互斥：

```python
group = parser.add_mutually_exclusive_group()
group.add_argument("--text", type=str, help="Text to synthesize")
group.add_argument("--text-file", type=str, help="File containing text to synthesize")
group.add_argument("--batch", type=str, help="Markdown file for batch synthesis")
```

`main()` 分发逻辑更新为：

```python
if args.demo:
    run_demo(args)
elif args.batch:
    run_batch(args)
elif args.text or args.text_file:
    if not args.output:
        parser.error("--output is required for synthesis mode")
    run_synthesize(args)
else:
    parser.error("Either --demo, --batch, or (--text/--text-file + --output) is required")
```

**参数冲突规则：** `--batch` 模式下 `--output`（单文件路径）被忽略，使用 `--output-dir`（目录）代替。

### Markdown 解析逻辑

复用 SKILL.md 中已定义的解析规则（直接在 Python 中实现）：

- 场景标题：`/^## 场景(\d+)[：:]\s*(.+)$/`
- 字幕行：`/^>\s*(.+)$/`
- 跳过 ``` 代码块围栏内的所有行
- 同一 `## 场景N` 下的 `>` 行归属该场景
- 非场景标题下的 `>` 行忽略

**边界情况：**
- Markdown 文件不存在：打印错误信息到 stderr，exit code 1
- Markdown 文件无法以 UTF-8 解码：打印编码错误提示，exit code 1
- 解析结果为空（无场景或无字幕行）：打印警告到 stderr，exit code 1

### 进度条显示

输出到 stderr，格式：

```
══════════════════════════════════════════════════
TTS 批量合成 — provider: qwen3-local
源文件: script.md → output/audio/
══════════════════════════════════════════════════

场景1：开篇引入 (3句)
  [1/15] scene-01/001.wav ✓ 音频:2.3s 合成:3.2s
  [2/15] scene-01/002.wav ✓ 音频:1.9s 合成:2.8s
  [3/15] scene-01/003.wav ✓ 音频:3.1s 合成:4.1s

场景2：核心论点 (4句)
  [4/15] scene-02/001.wav ✓ 音频:2.8s 合成:3.5s
  ...

══════════════════════════════════════════════════
完成: 15/15 句 | 5个场景 | 总音频 42.3s | 合成耗时 2m15s
tts-manifest.json 已生成 → output/tts-manifest.json
══════════════════════════════════════════════════
```

每句合成完成后立即打印一行，包含：
- `[当前/总数]` — 全局进度
- 输出文件的相对路径
- ✓/✗ 状态
- `音频:Xs` — 生成的音频时长
- `合成:Xs` — 合成所花的实际耗时

### 自动生成 tts-manifest.json

**manifest 路径规则：** 写入 `--output-dir` 的**父目录**下的 `tts-manifest.json`。例如 `--output-dir output/audio` → manifest 写到 `output/tts-manifest.json`。这与 SKILL.md 和下游（`subtitle-timeline`、`video-render/audio.js`）的约定一致。

格式与 SKILL.md 定义完全一致：

```json
{
  "source": "script.md",
  "html_path": "output/presentation.html",
  "provider": "qwen3-local",
  "created_at": "2026-04-26T19:30:00",
  "scenes": [
    {
      "scene_id": "scene_1",
      "scene_number": 1,
      "title": "场景标题",
      "lines": [
        {
          "index": 0,
          "text": "字幕文本",
          "audio_path": "output/audio/scene-01/001.wav",
          "duration_ms": 2340
        }
      ]
    }
  ]
}
```

**ID 映射规则：** `scene_id` 使用下划线（`scene_1`），音频目录使用连字符（`scene-01`），与 SKILL.md 保持一致。`scene_number` 从 1 开始，对应 Markdown 中 `## 场景N` 的 N。

### stdout 输出

stdout 输出 `--batch` 专用的结构化 JSON，方便脚本消费：

```json
{
  "provider": "qwen3-local",
  "source": "script.md",
  "output_dir": "output/audio",
  "manifest_path": "output/tts-manifest.json",
  "total_scenes": 5,
  "total_lines": 15,
  "success": 14,
  "failed": 1,
  "total_audio_ms": 42300,
  "total_synthesis_s": 135.2
}
```

### 错误处理

- 某句合成失败：打印错误信息到 stderr，标记 ✗，继续下一句（不中断整个批量流程）
- 失败的句子：生成空 WAV 文件（0 采样，复用 `_write_empty_wav` 逻辑），`duration_ms` 为 0。manifest 中**不添加 `error` 字段**，保持契约格式不变。错误详情仅输出到 stderr 供人类查看。
- 最终摘要显示成功/失败数
- 如果有失败项，exit code 仍为 0（部分成功），仅当全部失败或无法启动时 exit code 非零

### 中断与重新运行

当前版本 `--batch` 运行时如被 Ctrl+C 中断：
- 已合成的 wav 文件保留在磁盘上
- manifest 不会生成（因为还没执行到那步）
- 重新运行时**覆盖所有文件**（与现有单句模式行为一致）

### 对 SKILL.md 的影响

在执行流程中新增 `--batch` 作为**推荐方式**，原有逐句调用方式保留作为备选。SKILL.md 的步骤 1（解析）、步骤 4（逐句合成）、步骤 5（生成 manifest）、步骤 6（报告）合并为一条 `--batch` 命令。

## 功能 2：章节音频播放器（play_audio.py）

### 概述

一个极简 Python 脚本，播放指定目录（或当前目录）下所有 `.wav` 文件，按文件名排序顺序播放。

### 使用方式

```bash
# 方式 1：指定目录（推荐）
python .codebuddy/skills/tts-voiceover/scripts/play_audio.py output/audio/scene-01

# 方式 2：不带参数，播放当前目录
cd output/audio/scene-01
python /absolute/path/to/play_audio.py
```

支持一个可选的位置参数指定目标目录，默认为当前工作目录。

### 播放行为

- 扫描目标目录下所有 `.wav` 文件，按文件名自然排序
- 顺序播放，每个文件播放时显示：
  ```
  [1/5] 001.wav ▶ 播放中...
  [2/5] 002.wav ▶ 播放中...
  ```
- 播放完毕显示：`全部播放完成 (5个文件)`
- Ctrl+C 随时停止
- 目录不存在或无 wav 文件时提示并退出

### 实现

- 使用 macOS 自带 `afplay` 命令（`subprocess.run(["afplay", path])`）
- 零额外依赖，仅需 Python 标准库
- 脚本放在 `scripts/play_audio.py`

### 跨平台备注

当前仅支持 macOS（`afplay`）。如未来需要跨平台，可检测系统并降级到 `aplay`（Linux）或 `powershell -c (New-Object Media.SoundPlayer ...).PlaySync()`（Windows）。

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `scripts/tts_cli.py` | 新增 `--batch` 到互斥组，新增 `run_batch()` 和 `parse_markdown()` 函数 |
| `scripts/play_audio.py` | **新增**，极简音频播放脚本 |
| `SKILL.md` | 更新执行流程，新增 `--batch` 推荐用法和播放器说明 |

## 不做的事

- 不改变现有单句合成模式（`--text` / `--text-file`）
- 不改变 `tts-manifest.json` 契约格式（不新增字段）
- 不改变适配器接口
- 播放器不做语音合成，只播放已有文件
- 不实现断点续传（重新运行时覆盖）
