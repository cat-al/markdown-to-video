---
name: subtitle-timeline
description: "Use when generating SRT subtitles and rewriting HTML timeline durations based on real TTS audio lengths. Consumes tts-manifest.json and the HTML presentation file to produce synchronized subtitles and accurate step/scene durations."
---

# Subtitle Timeline — 字幕生成 + 时间轴同步

消费 `tts-manifest.json`（来自 `tts-voiceover`）和 HTML 文件（来自 `markdown-to-html`），输出带时间戳的 SRT 字幕文件，并用真实配音时长**原地重写** HTML 中的 `stepConfig.duration` 和 `timelineConfig.scenes[].duration`。

## ⚡ 首选：使用脚本执行

本 skill 提供了 `sync_timeline.py` 脚本，**优先使用脚本**而非 AI 手算，避免计算错误。

### 脚本位置

```
.codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py
```

### 用法

```bash
# 标准用法：指定项目目录，自动查找 manifest/html/srt
python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
    --project-dir output/001-xxx

# 仅诊断，不修改文件（检查时长是否对齐）
python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
    --project-dir output/001-xxx --dry-run

# 使用 AI 预生成的自定义 step↔line 映射
python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
    --project-dir output/001-xxx --mapping mapping.json

# 手动指定所有路径
python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
    --manifest output/001-xxx/tts-manifest.json \
    --html output/001-xxx/presentation.html \
    --srt-output output/001-xxx/subtitles.srt
```

### 脚本功能

1. **诊断当前状态** — 对比 manifest / stepConfig / timelineConfig / 实际音频，显示差值
2. **计算新的 step.duration** — 按字幕行→step 映射比例分配，确保 `sum(step.dur) + stepGap*N = audio_scene_duration`
3. **计算新的 scene.duration** — `scene.duration = sum(step.dur) + stepGap * N_steps`
4. **生成 SRT 字幕** — 逐句累加时间戳
5. **原地重写 HTML** — 只改 duration 值，不动 actions 结构
6. **修改后再次诊断** — 验证时长对齐

### 自定义映射文件格式

如果需要 AI 做语义映射（而非脚本的均匀分配），先生成映射 JSON 再传给脚本：

```json
{
  "scene_1": [[0, 1], [2], [3, 4], [5, 6]],
  "scene_2": [[0, 1, 2], [3, 4], [5, 6, 7], [8]],
  ...
}
```

每个 scene 是一个二维数组，外层索引是 step，内层是字幕行 index。

## 核心原则

1. **真实时长驱动** — 所有 duration 值来自 TTS 实际输出，不估算
2. **原地修改 HTML** — 不生成新文件，直接替换 HTML 中的配置值
3. **字幕行 ↔ Step 映射由 AI 判断** — 根据语义对应关系手动建立，不是机械 1:1

## 输入

| 文件 | 来源 | 说明 |
|------|------|------|
| `tts-manifest.json` | `tts-voiceover` | 含每句字幕文本、音频路径、`duration_ms`，以及 `html_path` |
| HTML 文件 | `markdown-to-html` | 含 `window.stepConfig` 和 `window.timelineConfig` |

## 输出

### 1) SRT 字幕文件 — `<项目目录>/subtitles.srt`

逐句累加时间戳，句间留 `line_gap_ms`（默认 300ms）呼吸间隔：

```srt
1
00:00:00,000 --> 00:00:02,340
第一句字幕文案

2
00:00:02,640 --> 00:00:04,510
第二句字幕文案

3
00:00:04,810 --> 00:00:07,200
第三句字幕文案
```

**`line_gap_ms` 的意图：** 300ms 是配音的自然呼吸停顿。在此期间上一句字幕已消失、下一句尚未出现。

### 2) 原地修改 HTML 中的时间轴配置

重写 `tts-manifest.json` 中 `html_path` 指向的 HTML 文件。

## 执行流程

### 步骤 1：读取 manifest 和 HTML

1. 读取 `<项目目录>/tts-manifest.json`（或用户指定的路径）
2. 从 manifest 的 `html_path` 字段获取 HTML 文件相对路径，拼接项目目录得到完整路径
3. 读取 HTML 文件，提取 `window.stepConfig` 和 `window.timelineConfig`

### 步骤 2：生成 SRT 字幕

按场景顺序遍历 manifest 中的所有 `lines`，累加时间戳：

```
全局偏移 = 0

对每个场景：
  对每行字幕：
    start = 全局偏移
    end = start + line.duration_ms
    写入 SRT 条目
    全局偏移 = end + line_gap_ms (300ms)

  场景结束后：
    全局偏移 += scene_gap_ms (800ms)  // 场景间静默
```

输出到 `<项目目录>/subtitles.srt`。

### 步骤 3：确定 HTML 模式并建立映射

对每个场景（`scene_number = N`），检查 HTML 中 `stepConfig["slide-N"]` 是否存在：

| 模式 | 条件 | 处理策略 |
|------|------|----------|
| **Step 模式** | `stepConfig["slide-N"]` 存在且有 step 数组 | 建立字幕行→step 映射，重写每个 `step.duration` |
| **旧模式** | 无 stepConfig 或 `stepConfig["slide-N"]` 不存在 | 计算场景总时长，重写 `timelineConfig.scenes[].duration` |
| **混合** | 同一 HTML 中部分 slide 有 step、部分没有 | 逐 slide 判断，分别处理 |

### 步骤 4：建立字幕行→Step 映射（Step 模式）

<HARD-GATE>
字幕行和 step 不是 1:1 关系。必须根据语义判断哪几句字幕对应哪个 step。
</HARD-GATE>

**映射方法：**

1. 读取场景的字幕行列表（来自 manifest 的 `lines[]`）
2. 读取对应 slide 的 `stepConfig["slide-N"]`（来自 HTML）
3. 读取每个 step 的 `actions[]`，理解每步做了什么（哪些元素 enter/exit/move）
4. 根据字幕内容和 step 动作的语义对应关系，判断哪几句字幕陪伴哪个 step
5. 用该组字幕的总时长（含句间间隔）作为 `step.duration`

**计算公式：**

```
# 原始权重（用于确定比例）
raw_step_weight = sum(lines[i].duration_ms) + line_gap_ms * (line_count - 1)

# 实际 step.duration 需要按比例缩放，使得:
#   sum(step.duration) = audio_scene_duration - stepGap * N_steps
# 脚本会自动处理这个缩放。手算时也必须做比例分配。

其中 lines[i] 是映射到该 step 的字幕行
```

**映射校验规则（自检）：**

- [ ] 所有字幕行必须恰好被映射一次（不遗漏、不重复）
- [ ] 每个 step 至少映射一行字幕
- [ ] 映射结果的总时长应覆盖该场景的所有字幕

**Fallback：** 如果语义映射不明确（字幕行数和 step 数差距过大），按字幕行均匀分配到各 step。

**映射示例：**

```
scene_1 字幕行：
  [0] "今天我们来聊聊 Attention 机制"     → step 0（标题入场）
  [1] "它是 Transformer 的核心组件"       → step 0
  [2] "简单来说，它让模型学会该关注哪里"    → step 1（概念图入场）
  [3] "首先，输入会被转换成三个向量"        → step 2（Q/K/V 节点出现）
  [4] "分别叫做 Query、Key 和 Value"      → step 2
  [5] "Query 和 Key 做点积运算"           → step 3（箭头入场）
  [6] "得到的结果就是注意力权重"            → step 3

step 0 duration = 2340 + 300 + 1870 = 4510ms
step 1 duration = 2100ms
step 2 duration = 1950 + 300 + 2200 = 4450ms
step 3 duration = 1800 + 300 + 2050 = 4150ms
```

### 步骤 5：计算场景总 duration

对每个场景：

```
scene.duration = sum(all step.duration) + stepGap * step_count

其中 stepGap = 600ms（与 TimelineEngine 的 this.stepGap 一致）
注意：是 stepGap * N，不是 stepGap * (N-1)！
因为 TimelineEngine.scheduleAutoSteps 在最后一个 step 后也加了一个 stepGap。
```

旧模式（无 step）：

```
scene.duration = sum(all line.duration_ms) + line_gap_ms * (line_count - 1)
```

### 步骤 6：原地修改 HTML

在 HTML 文件中定位并替换：

**a) `window.stepConfig`：** 替换每个 step 的 `"duration": 旧值` 为新值。只改 duration，不动 actions。

**b) `window.timelineConfig`：** 替换每个 scene 的 `"duration": 旧值` 为新值。

**修改策略：** 读取 HTML 全文，用 JSON 解析提取 `stepConfig` 和 `timelineConfig`，修改 duration 值后序列化回去，替换 HTML 中对应的 `window.stepConfig = ...;` 和 `window.timelineConfig = ...;` 区块。

### 步骤 7：验证

修改完成后：
- 打开 HTML 文件确认能正常加载
- 检查 stepConfig 和 timelineConfig 的 duration 值是否与 manifest 一致
- 输出摘要：每场景的 step 映射表、新旧 duration 对比

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `line_gap_ms` | 300 | 字幕行间呼吸间隔（ms） |
| `scene_gap_ms` | 800 | 场景切换静默间隔（ms），对齐 `--transition-duration` |
| `stepGap` | 600 | Step 间隔（ms），与 TimelineEngine 的 `this.stepGap` 一致 |

## Quick Reference

| 项目 | 值 |
|------|-----|
| **脚本** | `.codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py` |
| 输入 | `<项目目录>/tts-manifest.json` + `<项目目录>/presentation.html` |
| 输出 | `<项目目录>/subtitles.srt` + 原地修改 HTML |
| 上游 | `tts-voiceover` + `markdown-to-html` |
| 下游 | `video-render` |
| 关键计算 | `step.duration = Σ(line.duration_ms) + gap * (n-1)`；`scene.duration = Σ(step.dur) + stepGap * N` |
| 关键判断 | 字幕行→Step 的语义映射 |

## 两种模式处理策略

| 模式 | 特征 | 重写目标 |
|------|------|----------|
| Step 模式 | slide 有 `stepConfig["slide-N"]` | `step.duration` + `scene.duration` |
| 旧模式 | slide 无 stepConfig | `timelineConfig.scenes[].duration` |
| 混合 | 同 HTML 中混用 | 逐 slide 分别处理 |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 把字幕行和 step 做 1:1 映射 | 字幕行通常多于 step，需要语义分组映射 |
| 忘记 `line_gap_ms` 间隔 | 每两句字幕之间有 300ms 呼吸停顿，duration 计算必须包含 |
| 忘记 `stepGap` | 场景总 duration = sum(step.duration) + 600 * N（注意是 N 不是 N-1） |
| 只改了 stepConfig 没改 timelineConfig | 两处都要改，timelineConfig 的 scene.duration 也要更新 |
| 修改 HTML 时破坏了 actions 结构 | 只改 duration 数值，不动 actions 数组 |
| 字幕行遗漏或重复映射 | 自检：所有行恰好映射一次，每个 step 至少一行 |
| 在旧模式 slide 上试图操作 stepConfig | 旧模式没有 step，只改 timelineConfig.scenes[].duration |
| SRT 时间戳场景之间不加间隔 | 场景切换处加 `scene_gap_ms`（800ms）静默 |
| 手算 step.duration 不做比例缩放 | sum(step.dur) 必须 = audio_scene_dur - stepGap*N，需要按比例缩放而非直接用原始值 |
| 不验证视频/音频总时长对齐 | 修改后用 `--dry-run` 检查 record.js total == audio total |
