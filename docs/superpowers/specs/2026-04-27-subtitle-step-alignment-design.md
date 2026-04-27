# 字幕分段从"逐句"改为"逐 step"对齐

**日期**: 2026-04-27
**状态**: ✅ 已实施
**范围**: `markdown-scriptwriter` 字幕格式规范变更 + 全链路解析器适配
**前置文档**: `2026-04-25-tts-voiceover-subtitle-timeline-design.md`

## 1. 背景

当前 `markdown-scriptwriter` 要求字幕按句拆分：每行 `>` 是一句话（15-25 字），每场景 6-8 行。下游 TTS 逐句合成一个音频文件，`subtitle-timeline` 再把多句映射到一个 step。

这个设计导致三个问题：

1. **口播碎片化** — TTS 逐句合成后用 300ms 静音拼接，语气不连贯
2. **映射复杂度高** — `subtitle-timeline` 需要把 6-8 句字幕映射到 3-5 个 step，依赖 AI 语义判断或均匀分配算法，容易出错
3. **SRT 碎片化** — 每句独立一条 SRT 字幕，闪烁频繁，观感差

根本原因：字幕的分段粒度（句子）和画面的节奏粒度（step/动画步骤）不一致。

## 2. 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 字幕分段粒度 | 以 step（页面动画变化）为单位 | 字幕和画面节奏天然对齐，消除映射环节 |
| 格式表达 | 连续 `>` 行合并为一段，空行分隔段落 | 最小格式变更，符合 Markdown 段落语义 |
| TTS 合成粒度 | 每段一个音频文件 | 段内语气连贯，无需拼接 |
| step 映射策略 | 默认 1:1（段 N → step N） | 消除语义映射和均匀分配的复杂度 |

## 3. 新格式规范

### 3.1 格式定义

每个 `>` 段落对应一个 step（页面上的一次动画变化）。段间用**空行**分隔。

```markdown
## 场景1：场景标题

**画面描述**: ...

**视觉元素**:
...

> 你应该见过这种情况。Agent 一开始跑得很顺，计划像样，执行也快。前几步甚至让你觉得，这次可以完全放手了。

> 但跑到第五步、第八步，事情开始变味。它修 bug 修错方向，而且越修越偏。

> 最后交出来的结果，已经不是你最初要的东西。你只能回滚，然后从头再来。
```

3 段 `>` = 3 个 step = 3 个 TTS 音频 = 3 条 SRT 字幕。

### 3.2 段内多行写法

为了 Markdown 源文件的可读性，一段内可以用多行 `>` 书写，只要行间没有空行就合并为同一段：

```markdown
> 你应该见过这种情况。
> Agent 一开始跑得很顺，计划像样，执行也快。
> 前几步甚至让你觉得，这次可以完全放手了。

> 但跑到第五步、第八步，事情开始变味。
> 它修 bug 修错方向，而且越修越偏。
```

以上等价于两段：
- 段 1："你应该见过这种情况。Agent 一开始跑得很顺，计划像样，执行也快。前几步甚至让你觉得，这次可以完全放手了。"
- 段 2："但跑到第五步、第八步，事情开始变味。它修 bug 修错方向，而且越修越偏。"

### 3.3 字幕文案要求

| 项目 | 旧规则 | 新规则 |
|------|--------|--------|
| 分段依据 | 句子（15-25 字/句） | step（页面动画变化） |
| 每段字数 | 15-25 字 | 30-80 字 |
| 每场景段数 | 6-8 句 | 3-5 段（与 step 数对齐） |
| 口语化 | ✓ | ✓（不变） |
| 段间过渡 | 场景间有过渡 | 段间有自然衔接（不变） |

### 3.4 解析规则

| 规则 | 说明 |
|------|------|
| 字幕段 | 连续 `>` 行（中间无空行）合并为一段，文本用空格拼接 |
| 段分隔 | 空行（包括不以 `>` 开头的行）切断当前段 |
| 场景分组 | 同一 `## 场景N` 下的所有 `>` 段属于该场景 |
| 代码块 | `` ``` `` / `~~~` 围栏内的 `>` 行忽略（不变） |
| 非场景 `>` 行 | 忽略（不变） |

## 4. 对完整链路的影响

```
markdown-scriptwriter → script.md（字幕按 step 分段）
    ├──→ markdown-to-html
    │      parse-markdown.js：连续 > 行合并为一段 → subtitles[]
    │
    └──→ tts-voiceover
           tts_cli.py：连续 > 行合并为一段 → 每段一个 WAV
                                    ↓
                          subtitle-timeline
                              sync_timeline.py：默认 1:1 映射（段 N → step N）
                              ├── subtitles.srt（每段一条字幕）
                              └── HTML 时间轴重写
                                    ↓
                          video-render（不变）
```

## 5. 文件变更清单

### 5.1 需要改动

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `markdown-scriptwriter/SKILL.md` | 规范更新 | 字幕分段规则、字数要求、常见错误表 |
| `markdown-scriptwriter/templates/standard-format.md` | 范例更新 | 所有场景字幕改为逐段格式 |
| `markdown-to-html/scripts/parse-markdown.js` | 解析逻辑 | 连续 `>` 行合并为一段 |
| `tts-voiceover/SKILL.md` | 说明更新 | 解析规则和合成粒度说明 |
| `tts-voiceover/scripts/tts_cli.py` | 解析逻辑 | `parse_markdown()` 连续 `>` 行合并 |
| `subtitle-timeline/SKILL.md` | 策略更新 | 映射策略简化为默认 1:1 |
| `subtitle-timeline/scripts/sync_timeline.py` | 逻辑简化 | 默认 1:1，fallback 保留均匀分配 |

### 5.2 不需要改动

| 文件 | 原因 |
|------|------|
| `video-render/` 全部脚本 | 消费 manifest 和 SRT，契约格式不变 |
| `markdown-to-html/SKILL.md` | 消费 `parse-markdown.js` 的 `subtitles[]`，接口不变 |
| `html-layout-review/SKILL.md` | 不涉及字幕 |
| `tts-manifest.json` 契约格式 | 字段结构不变，只是 `lines[]` 条目数减少（从 6-8 → 3-5） |

## 6. 各文件详细改动

### 6.1 `parse-markdown.js`

当前逻辑（第 464-469 行）：

```javascript
const subtitleMatch = line.match(/^>\s*(.+)/);
if (subtitleMatch) {
  scene.subtitles.push(subtitleMatch[1].trim());
  idx++;
  continue;
}
```

改为段落合并逻辑：

```javascript
const subtitleMatch = line.match(/^>\s*(.+)/);
if (subtitleMatch) {
  // 收集连续 > 行，合并为一段
  let paragraphParts = [subtitleMatch[1].trim()];
  idx++;
  while (idx < lines.length) {
    const nextMatch = lines[idx].match(/^>\s*(.+)/);
    if (nextMatch) {
      paragraphParts.push(nextMatch[1].trim());
      idx++;
    } else {
      break;
    }
  }
  scene.subtitles.push(paragraphParts.join(' '));
  continue;
}
```

### 6.2 `tts_cli.py` 的 `parse_markdown()`

当前逻辑（第 248-252 行）：

```python
if current_scene is not None:
    m = subtitle_re.match(line)
    if m:
        current_scene["lines"].append(m.group(1).strip())
```

改为段落合并逻辑：

```python
if current_scene is not None:
    m = subtitle_re.match(line)
    if m:
        # 开始收集一个段落
        paragraph_parts = [m.group(1).strip()]
        # 继续往后读，注意：这里需要改为索引遍历
        # （具体实现见下方完整函数）
```

由于当前 `parse_markdown()` 使用 `for line in f` 逐行迭代，改为索引遍历以支持前瞻：

```python
def parse_markdown(filepath: str) -> List[Dict[str, Any]]:
    scene_title_re = re.compile(r'^## 场景(\d+)[：:]\s*(.+)$')
    subtitle_re = re.compile(r'^>\s*(.+)$')

    scenes: List[Dict[str, Any]] = []
    current_scene: Optional[Dict[str, Any]] = None
    in_code_block = False

    with open(filepath, 'r', encoding='utf-8') as f:
        all_lines = [line.rstrip('\n') for line in f]

    idx = 0
    while idx < len(all_lines):
        line = all_lines[idx]

        # 代码块围栏切换
        if line.startswith('```'):
            in_code_block = not in_code_block
            idx += 1
            continue

        if in_code_block:
            idx += 1
            continue

        # 场景标题
        m = scene_title_re.match(line)
        if m:
            current_scene = {
                "scene_number": int(m.group(1)),
                "title": m.group(2).strip(),
                "lines": [],
            }
            scenes.append(current_scene)
            idx += 1
            continue

        # 字幕段落：连续 > 行合并为一段
        if current_scene is not None:
            m = subtitle_re.match(line)
            if m:
                paragraph_parts = [m.group(1).strip()]
                idx += 1
                while idx < len(all_lines):
                    next_m = subtitle_re.match(all_lines[idx])
                    if next_m:
                        paragraph_parts.append(next_m.group(1).strip())
                        idx += 1
                    else:
                        break
                current_scene["lines"].append(' '.join(paragraph_parts))
                continue

        idx += 1

    return scenes
```

### 6.3 `sync_timeline.py` 映射策略

当前逻辑：默认调用 `distribute_lines_to_steps()` 均匀分配。

改为：

```python
# 确定映射
if custom_mapping and scene_id in custom_mapping:
    step_line_map = custom_mapping[scene_id]
elif n_lines == n_steps:
    # 新默认：1:1 映射
    step_line_map = [[i] for i in range(n_lines)]
else:
    # fallback：均匀分配（兼容旧格式或段数不匹配的情况）
    step_line_map = distribute_lines_to_steps(n_lines, n_steps)
```

### 6.4 `markdown-scriptwriter/SKILL.md` 格式规则

**字幕段落要求**（替换原"字幕文案要求"段落）：

```markdown
### 字幕文案要求

- 每段对应一个 step（页面上的一次动画变化）
- 每段 **30-80 字**，包含该 step 期间的完整口播
- 每场景 **3-5 段**（与该场景的视觉元素动画步骤数对齐）
- 段间用**空行**分隔
- 段内可多行 `>` 书写（提升可读性），连续 `>` 行自动合并为一段
- 口语化表达，像在和朋友聊天
- 场景间有自然的过渡衔接
- 开场必须有吸引力（hook）
- 结尾有总结或行动号召
```

**格式规则表**更新：

```markdown
| 元素 | 规则 |
|------|------|
| 字幕段 | `>` 引用块，每段对应一个 step，段间空行分隔，连续 `>` 行合并为一段 |
| 时间戳 | **不包含**，由后续 TTS 阶段自动生成 |
```

**常见错误表**更新：

```markdown
| 错误 | 正确做法 |
|------|----------|
| 每段字幕只有一句短话（<20字） | 一段对应一个 step 的完整口播，30-80 字 |
| 字幕段数和视觉元素的动画步骤不对应 | 每段 `>` 对应一次页面动画变化，段数 = step 数 |
| 书面语风格 | 用口语化表达，像在和朋友聊天 |
| 没有 frontmatter | YAML frontmatter 是必需的元信息 |
| 场景之间缺少过渡 | 确保场景间有自然的逻辑衔接 |
```

### 6.5 `tts-voiceover/SKILL.md` 解析规则

更新 Markdown 解析规则表：

```markdown
| 规则 | 正则 / 说明 |
|------|-------------|
| 场景标题 | `/^## 场景(\d+)[：:]\s*(.+)$/` |
| 字幕段 | 连续 `/^>\s*(.+)$/` 行合并为一段，空行分隔段落 |
| 代码块 | 遇到 ``` 行进入代码块，再次遇到退出，内部全部忽略 |
| 分组 | 同一 `## 场景N` 下的所有 `>` 段属于该场景 |
| 合成粒度 | 每段一个音频文件 |
```

核心原则更新：

```markdown
1. **逐段合成** — 每个 `>` 段落（对应一个 step）独立生成一个音频文件
```

### 6.6 `subtitle-timeline/SKILL.md` 映射策略

映射策略简化：

```markdown
### 字幕段与 Step 的映射

新格式下，每段 `>` 对应一个 step，默认 **1:1 映射**：

- 字幕段数 == step 数 → 段 N → step N（无需额外映射）
- 字幕段数 ≠ step 数 → 回退到均匀分配（`distribute_lines_to_steps()`）
- 自定义映射文件仍然支持（`--mapping`）

1:1 映射下的计算公式简化为：
  step.duration = line.duration_ms
  scene.duration = sum(step.duration) + stepGap * N_steps
```

## 7. 向后兼容

| 场景 | 行为 |
|------|------|
| 旧格式文件（每行一句 `>`，行间无空行） | 所有连续 `>` 行合并为一段 → 场景只有一段字幕。功能正确但不理想 |
| 旧格式文件（每行一句 `>`，行间有空行） | 每行独立成段 → 行为等同新格式，step 数可能偏多 |
| 新格式文件传入旧解析器 | 旧解析器仍逐行拆分，只是部分行文字更长。功能正确但 step 映射会回退到均匀分配 |

不做自动迁移工具。旧文件需要手动调整格式。

## 8. 验收标准

1. **`parse-markdown.js`** — 连续 `>` 行合并为一个 `subtitles[]` 条目，空行正确切断段落
2. **`tts_cli.py --batch`** — 每段生成一个 WAV，manifest `lines[]` 长度等于段数
3. **`sync_timeline.py`** — 当段数 == step 数时，自动 1:1 映射，无需 mapping.json
4. **端到端** — 新格式 script.md 走完全链路（scriptwriter → html → tts → timeline → render），口播和动画切换同步
5. **`standard-format.md`** — 模板文件已更新为新格式，可作为参考

## 9. 实施顺序

1. **`parse-markdown.js`** — 解析器改为段落合并
2. **`tts_cli.py`** — `parse_markdown()` 改为段落合并
3. **`sync_timeline.py`** — 映射策略加入 1:1 默认路径
4. **`markdown-scriptwriter/SKILL.md`** — 格式规范更新
5. **`standard-format.md`** — 模板范例更新
6. **`tts-voiceover/SKILL.md`** — 解析规则说明更新
7. **`subtitle-timeline/SKILL.md`** — 映射策略说明更新

## 10. 一句话结论

**字幕分段粒度从"句子"改为"step"，连续 `>` 行合并为一段，空行分隔段落。每段 = 一个 TTS 音频 = 一个 step = 一条 SRT 字幕，消除 subtitle-timeline 的映射复杂度，让口播和画面节奏天然对齐。**
