# TTS 配音 + 字幕时间轴 设计文档

**日期**: 2026-04-25
**状态**: 设计阶段
**范围**: 新增 `tts-voiceover` 和 `subtitle-timeline` 两个 skill，完成链路中"配音/字幕/时间轴"环节
**前置文档**: `2026-04-25-visual-narrative-design.md`, `2026-04-25-canvas-continuous-evolution-design.md`

## 1. 背景

当前链路已完成前三个环节：

```
内容/想法 → markdown-scriptwriter → markdown-to-html → html-layout-review → 【缺失】→ 视频输出
```

缺失的环节是"配音/字幕/时间轴"。需要：
1. 把 Markdown 文案中的字幕文本转为语音音频
2. 生成带时间戳的字幕文件
3. 根据真实配音时长重写 HTML 中的时间轴配置，让画面切换与语音同步

## 2. 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Skill 拆分 | 拆为两个：`tts-voiceover` + `subtitle-timeline` | TTS 调用（外部服务）和时间轴计算（纯计算）性质不同；TTS 适配器需要隔离；粒度与现有 skill 一致 |
| `tts-voiceover` 输入来源 | 直接读 Markdown 文案 | 与 `markdown-to-html` 平行而非串行，更解耦 |
| TTS 调用粒度 | 逐句调用（每行 `>` 引用单独生成音频） | 句级时长精确，字幕时间戳不需要后处理对齐；本地模型调用成本低 |
| TTS 执行方式 | shell 命令调用 CLI 脚本 | Skill 指导 AI 执行 `python tts_cli.py` 命令，仓库内提供脚本 |
| TTS 适配器切换 | 配置文件 + `--provider` 参数 | 当前本地 Qwen3-TTS，未来可切 MiniMax / MiMo-V2 等外部 API |
| 音频输出组织 | 按场景分目录 | `output/audio/scene-01/001.wav, 002.wav, ...` |
| 两个 skill 的契约 | `tts-manifest.json` | 包含每句字幕文本、音频路径、时长，是唯一的中间数据格式 |
| 时间轴含义 | slide/step 级别的播放时间轴 | 根据配音时长重写 `stepConfig` 中的 `step.duration` 和 `timelineConfig` 中的 `scene.duration`，让画面切换和语音同步 |
| 场景 ID 约定 | manifest 使用 `scene_N`（N 为 Markdown 中的场景序号） | 映射到 HTML 中的 `data-scene="N"`、`stepConfig["slide-N"]`、`timelineConfig.scenes[].scene = N` |

## 3. 链路总览

```
Markdown 文案
    ├──→ markdown-to-html → HTML（含 stepConfig，duration 为估算值）
    │
    └──→ tts-voiceover → 音频文件 + tts-manifest.json
                                        │
                                        ↓
                              subtitle-timeline
                                   ├── subtitles.srt（带时间戳的字幕）
                                   └── 原地重写 HTML 中的 stepConfig.duration + timelineConfig.scenes[].duration
```

`tts-voiceover` 和 `markdown-to-html` 是**平行**关系，都以 Markdown 文案为输入。`subtitle-timeline` 在两者之后，消费两者的输出。

## 4. `tts-voiceover` Skill 设计

### 4.1 职责

解析 Markdown 文案，提取每个场景的字幕文本，逐句调用 TTS 生成音频，输出音频文件和时长清单。

### 4.2 输入

Markdown 文案文件（由 `markdown-scriptwriter` 生成），格式遵循 `markdown-scriptwriter/SKILL.md` 定义的标准格式。字幕行以 `>` 引用块标记：

```markdown
## 场景1：场景标题

**画面描述**: ...
**视觉元素**: ...

> 第一句字幕文案
> 第二句字幕文案
> 第三句字幕文案
```

### 4.3 输出

**1) 音频文件（按场景分目录）：**

```
output/audio/
  scene-01/
    001.wav
    002.wav
    003.wav
    ...
  scene-02/
    001.wav
    ...
```

**2) `tts-manifest.json`（核心契约文件）：**

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
        },
        {
          "index": 1,
          "text": "第二句字幕文案",
          "audio_path": "output/audio/scene-01/002.wav",
          "duration_ms": 1870
        }
      ]
    }
  ]
}
```

**ID 映射规则：** `scene_number` 是核心标识，与 Markdown 中 `## 场景N` 的 N 一致。下游 `subtitle-timeline` 用 `scene_number` 映射到：
- HTML `data-scene="N"`
- `stepConfig["slide-N"]`
- `timelineConfig.scenes[].scene === N`

### 4.4 AI 执行流程

Skill 指导 AI 按以下步骤执行：

1. **读取 Markdown 文案**，提取 frontmatter 元信息 + 所有 `>` 引用行（按 `## 场景N` 分组）
2. **创建输出目录**：`output/audio/scene-01/`, `scene-02/`, ...
3. **逐句调用 TTS CLI**：

```bash
python scripts/tts_cli.py \
  --text "第一句字幕文案" \
  --output output/audio/scene-01/001.wav \
  --provider qwen3-local
```

CLI 输出到 stdout 一行 JSON：
```json
{"path": "output/audio/scene-01/001.wav", "duration_ms": 2340}
```

4. **收集所有结果**，生成 `tts-manifest.json`

### 4.5 CLI 脚本 — `scripts/tts_cli.py`

**接口：**

```
python scripts/tts_cli.py --text TEXT --output PATH [--provider PROVIDER]
python scripts/tts_cli.py --text-file FILE --output PATH [--provider PROVIDER]
```

| 参数 | 必需 | 说明 |
|------|------|------|
| `--text` | 二选一 | 要合成的文本（短句，避免 shell 转义问题） |
| `--text-file` | 二选一 | 文本文件路径，读取文件内容作为输入（推荐用于含特殊字符的文本） |
| `--output` | 是 | 输出音频文件路径 |
| `--provider` | 否 | TTS 供应商标识，默认读配置文件中的 `default` |

**行为：**
- 根据 provider 类型（local / api）调用对应的 TTS 后端
- 生成音频文件到 `--output` 路径
- 向 stdout 输出一行 JSON：`{"path": "...", "duration_ms": N}`
- 失败时 exit code 非零，stderr 输出错误信息
- 输出文件已存在时覆盖

**边界情况处理：**
- **空文本**：跳过 TTS 调用，生成 0 字节音频文件，`duration_ms` 返回 0
- **特殊字符**（引号/换行/emoji）：推荐使用 `--text-file` 模式，AI 先将文本写入临时文件再调用 CLI
- **超长文本**：如单句超过 TTS 模型最大输入长度，报错退出并在 stderr 提示

**内部结构：**

```
scripts/
  tts_cli.py              # 入口，解析参数，加载配置，分发到适配器
  tts_adapters/
    __init__.py
    base.py               # TTSAdapter 抽象基类
    qwen3_local.py        # Qwen3-TTS 本地模型适配器
    minimax_api.py        # MiniMax API 适配器（预留）
    mimo_v2_api.py        # MiMo-V2 API 适配器（预留）
```

### 4.6 适配器配置 — `config/tts-providers.yaml`

```yaml
default: qwen3-local

providers:
  qwen3-local:
    type: local
    model_path: ~/models/Qwen3-TTS-12Hz-0.6B-Base
    sample_rate: 24000
    format: wav

  minimax:
    type: api
    endpoint: https://api.minimax.chat/v1/tts
    api_key_env: MINIMAX_API_KEY
    format: mp3

  mimo-v2:
    type: api
    endpoint: https://api.mimo.ai/v2/tts
    api_key_env: MIMO_API_KEY
    format: wav
```

新增供应商只需：
1. 在 `tts_adapters/` 下新建适配器文件，实现 `TTSAdapter` 基类
2. 在配置文件中添加 provider 条目

### 4.7 TTSAdapter 抽象基类

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass

@dataclass
class TTSResult:
    path: str           # 输出音频文件路径
    duration_ms: int    # 音频时长（毫秒）

class TTSAdapter(ABC):
    @abstractmethod
    def synthesize(self, text: str, output_path: str) -> TTSResult:
        """将文本合成为音频文件，返回路径和时长。"""
        ...
```

## 5. `subtitle-timeline` Skill 设计

### 5.1 职责

消费 `tts-manifest.json` 和 HTML 文件，输出带时间戳的字幕文件 + 用真实音频时长重写后的时间轴配置。

### 5.2 输入

- `tts-manifest.json`（来自 `tts-voiceover`，其中 `html_path` 字段指向 HTML 文件）
- HTML 文件（来自 `markdown-to-html`，包含 `window.stepConfig` 和 `window.timelineConfig`）

### 5.3 输出

**1) 字幕文件 — `output/subtitles.srt`：**

根据 manifest 中的 `duration_ms` 逐句累加时间戳，句间留 300ms 呼吸间隔（可配置）：

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

**`line_gap_ms` 的意图：** 这 300ms 是配音的自然呼吸停顿。在此期间上一句字幕已消失、下一句尚未出现。后续视频合成阶段如需字幕常驻，可调整 SRT 的时间范围使前后句衔接。

**2) 直接修改 HTML 文件中的时间轴配置：**

`subtitle-timeline` **原地修改** `tts-manifest.json` 中 `html_path` 指向的 HTML 文件，重写两处配置：

**a) `window.stepConfig` — 重写每个 step 的 `duration`：**

```javascript
// 重写前（估算值）
"slide-1": [
  { "duration": 800, "actions": [...] },
  { "duration": 1200, "actions": [...] }
]

// 重写后（基于配音真实时长）
"slide-1": [
  { "duration": 4510, "actions": [...] },  // line[0] + gap + line[1]
  { "duration": 2100, "actions": [...] }   // line[2]
]
```

**b) `window.timelineConfig.scenes[]` — 重写每个 scene 的 `duration`：**

```javascript
// 每个 scene 的 duration = 所有 step.duration 之和 + step 间隔(stepGap * (N-1))
// 例如 scene 1 有 4 个 step，总时长 = sum(step.duration) + 600 * 3
```

### 5.4 两种 HTML 模式的处理策略

`slide-base.html` 的 TimelineEngine 支持两种模式：

| 模式 | 特征 | `subtitle-timeline` 处理 |
|------|------|--------------------------|
| **Step 模式** | slide 有对应的 `stepConfig["slide-N"]` | 重写 `step.duration`，并计算 `scene.duration = sum(step.duration) + stepGap * (N-1)` |
| **旧模式** | slide 无 stepConfig，靠 `data-duration` / `timelineConfig.scenes[].duration` | 重写 `timelineConfig.scenes[].duration` 为该场景所有字幕行总时长（含间隔），不修改 `data-duration`（HTML 属性留作 fallback） |
| **混合** | 同一 HTML 中部分 slide 有 step、部分没有 | 逐 slide 判断，分别应用上述两种策略 |

### 5.5 字幕行与 Step 的映射

Markdown 文案中一个场景有 6-8 句字幕，HTML 中对应的 slide 可能有 3-5 个 step。它们不是 1:1 的关系。

**映射策略：AI 手动建立映射。**

Skill 指导 AI：
1. 读取某个 scene 的字幕行列表（来自 manifest）
2. 读取对应 slide 的 stepConfig（来自 HTML）
3. 根据字幕内容和 step 的 actions 语义，判断哪几句字幕对应哪个 step
4. 用该组字幕的总时长（含句间间隔）作为 `step.duration`

**映射校验规则（AI 自检）：**
- 所有字幕行必须恰好被映射一次（不遗漏、不重复）
- 每个 step 至少映射一行字幕
- 映射结果的总时长应覆盖该场景的所有字幕

**Fallback 策略：** 如果 AI 无法确定映射（例如字幕行数和 step 数差距过大），按字幕行均匀分配到各 step。

**示例映射：**

```
scene_1 字幕行：
  [0] "今天我们来聊聊 Attention 机制"     → step 0（标题入场）
  [1] "它是 Transformer 的核心组件"       → step 0
  [2] "简单来说，它让模型学会该关注哪里"    → step 1（概念图入场）
  [3] "首先，输入会被转换成三个向量"        → step 2（Q/K/V 节点出现）
  [4] "分别叫做 Query、Key 和 Value"      → step 2
  [5] "Query 和 Key 做点积运算"           → step 3（退场 + 箭头入场）
  [6] "得到的结果就是注意力权重"            → step 3

step 0 duration = line[0].duration + 300 + line[1].duration = 2340 + 300 + 1870 = 4510ms
step 1 duration = line[2].duration = 2100ms
step 2 duration = line[3].duration + 300 + line[4].duration = 1950 + 300 + 2200 = 4450ms
step 3 duration = line[5].duration + 300 + line[6].duration = 1800 + 300 + 2050 = 4150ms

scene_1 总 duration = 4510 + 2100 + 4450 + 4150 + 600*3 = 17010ms
```

### 5.6 AI 执行流程

Skill 指导 AI 按以下步骤执行：

1. **读取 `tts-manifest.json`**，获取所有场景的字幕文本和时长，以及 `html_path`
2. **读取 HTML 文件**，提取 `window.stepConfig` 和 `window.timelineConfig`
3. **逐场景建立映射**：字幕行 → step，确定每个 step 的真实 duration（有 stepConfig 的 slide）；或计算场景总时长（旧模式 slide）
4. **生成 `output/subtitles.srt`**：累加时长，加入句间间隔，输出标准 SRT 格式
5. **原地修改 HTML 文件**：替换 `window.stepConfig` 和 `window.timelineConfig` 中的 duration 值

### 5.7 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `line_gap_ms` | 300 | 字幕行之间的呼吸间隔（毫秒），对应配音的自然停顿 |
| `scene_gap_ms` | 800 | 场景切换之间的静默间隔（毫秒），与 `--transition-duration` CSS 变量对齐 |

## 6. 文件结构

新增文件在仓库中的位置：

```
markdown-to-video/
  .codebuddy/skills/
    tts-voiceover/
      SKILL.md                    # skill 定义
    subtitle-timeline/
      SKILL.md                    # skill 定义
  scripts/
    tts_cli.py                    # TTS CLI 入口
    tts_adapters/
      __init__.py
      base.py                     # TTSAdapter 抽象基类
      qwen3_local.py              # Qwen3-TTS 本地适配器
      minimax_api.py              # MiniMax 适配器（预留空壳）
      mimo_v2_api.py              # MiMo-V2 适配器（预留空壳）
  config/
    tts-providers.yaml            # TTS 供应商配置
```

运行时输出：

```
output/
  audio/
    scene-01/
      001.wav
      002.wav
      ...
    scene-02/
      ...
  tts-manifest.json               # tts-voiceover 输出
  subtitles.srt                   # subtitle-timeline 输出
```

## 7. 对现有文件的影响

| 文件 | 动作 | 说明 |
|------|------|------|
| `markdown-scriptwriter/SKILL.md` | 不变 | 字幕格式（`>` 引用行）已满足需求 |
| `markdown-to-html/SKILL.md` | 不变 | HTML 生成流程不受影响 |
| `html-layout-review/SKILL.md` | 不变 | 视觉验收不受影响 |
| `README.md` | 更新 | 新增两个 skill 的说明，更新链路图 |

## 8. 更新后的完整链路

```
内容/想法
    ↓
markdown-scriptwriter → Markdown 文案
    ├──→ markdown-to-html → HTML（stepConfig duration 为估算值）
    │         ↓
    │    html-layout-review → 视觉验收
    │
    └──→ tts-voiceover → 音频文件 + tts-manifest.json
                                    ↓
                          subtitle-timeline
                              ├── subtitles.srt
                              └── 原地修改 HTML（重写 stepConfig.duration + timelineConfig.scenes[].duration）
                                    ↓
                              【下一步：视频输出】
```

## 9. 验收标准

### `tts-voiceover`

1. **能正确解析 Markdown 文案** — 提取所有场景的 `>` 字幕行，保持场景分组和行顺序
2. **逐句生成音频** — 每行字幕对应一个独立的 .wav 文件
3. **目录结构正确** — `output/audio/scene-NN/NNN.wav`
4. **manifest 完整** — `tts-manifest.json` 包含所有句子的文本、路径、时长
5. **适配器可切换** — 通过 `--provider` 参数或配置文件切换 TTS 后端
6. **错误处理** — TTS 失败时有明确的错误提示，不会静默跳过

### `subtitle-timeline`

1. **SRT 格式正确** — 时间戳累加准确，句间有 300ms 间隔，标准 SRT 播放器能识别
2. **字幕与音频对齐** — SRT 中每句的起止时间与对应音频时长一致
3. **stepConfig duration 重写正确** — 每个 step 的 duration 等于其映射的字幕行总时长（含间隔）
4. **timelineConfig duration 重写正确** — 每个 scene 的 duration 等于 sum(step.duration) + stepGap * (N-1)
5. **场景间隔正确** — 场景切换处有 800ms 静默间隔
6. **映射校验通过** — 所有字幕行恰好覆盖一次，每个 step 至少映射一行
7. **两种模式兼容** — Step 模式和旧模式的 slide 都能正确处理
8. **原地修改 HTML** — 修改后的 HTML 仍能正常打开和自动播放

## 10. Markdown 解析规则

`tts-voiceover` 严格依赖 `markdown-scriptwriter` 的输出格式，不做额外容错：

- 场景标题匹配正则：`/^## 场景(\d+)[：:]\s*(.+)$/`（同时兼容中文冒号 `：` 和半角冒号 `:`）
- 字幕行匹配：以 `>` 开头的行（`/^>\s*(.+)$/`），连续的 `>` 行属于同一场景
- `>` 引用块之间的空行不打断分组 — 同一个 `## 场景N` 下的所有 `>` 行都属于该场景
- 非 `## 场景N` 标题下的 `>` 行忽略（如文档说明中的引用）

## 11. 性能考量

当前版本 TTS 采用串行逐句调用，适合本地 Qwen3 模型（无网络开销）。

未来切换到 API provider 时的扩展方向：
- CLI 增加 `--batch` 模式，接收 JSON 文件批量合成
- 或由 AI 在 skill 执行时并行调用多个 CLI 进程
- 具体方案在切换 provider 时再设计，当前不实现

## 12. 实施顺序

1. **`scripts/tts_adapters/base.py`** — TTSAdapter 抽象基类
2. **`scripts/tts_adapters/qwen3_local.py`** — Qwen3-TTS 本地适配器
3. **`scripts/tts_cli.py`** — CLI 入口
4. **`config/tts-providers.yaml`** — 供应商配置
5. **`tts-voiceover/SKILL.md`** — skill 定义
6. **`subtitle-timeline/SKILL.md`** — skill 定义
7. **用现有 demo 文案端到端测试** — 验证完整链路
8. **更新 `README.md`** — 新增 skill 说明

## 13. 一句话结论

**拆为 `tts-voiceover`（解析文案 → 逐句调 TTS → 输出音频 + manifest）和 `subtitle-timeline`（消费 manifest + HTML → 输出 SRT + 重写时间轴）两个 skill，通过 `tts-manifest.json` 作为契约格式解耦。TTS 后端通过适配器模式支持本地 Qwen3 和未来的外部 API 切换。**
