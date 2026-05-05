---
name: subtitle-timeline
description: "Use when generating SRT subtitles and rewriting HTML timeline durations based on real TTS audio lengths. Consumes tts-manifest.json (shots format) and the HTML presentation file to produce synchronized subtitles and accurate shot durations."
---

# Subtitle Timeline — 字幕 + 时间轴同步

消费 `tts-manifest.json`（shots 扁平格式）和 `presentation.html`，生成 SRT 字幕文件并原地重写 HTML 中 `timelineConfig.shots[].duration`，实现音画同步。

## 核心架构：一镜一句一条 SRT

> 镜头蒙太奇模型下，时间轴同步大幅简化：每个镜头对应一句话术，一个音频，一条 SRT 条目。天然 1:1 映射，无需复杂的 N:M 对齐算法。

| 概念 | 旧模型 | 新模型 |
|------|--------|--------|
| 映射关系 | 字幕段→step（可能 N:M） | 镜头→字幕 1:1 |
| 时长来源 | 需要计算 step.duration | 直接用 shot.duration_ms |
| HTML 重写目标 | stepConfig + timelineConfig.scenes | timelineConfig.shots[].duration |
| 复杂度 | 高（需要对齐算法） | 低（简单遍历赋值） |

## 产物目录约定

> 完整约定见 `docs/project-output-convention.md`。

本 skill 接收**项目目录路径**作为参数。

### 输入路径

| 产物 | 路径 |
|------|------|
| TTS 清单 | `<项目目录>/tts-manifest.json`（shots 格式） |
| HTML 幻灯片 | `<项目目录>/presentation.html` |

### 输出路径

| 产物 | 路径 |
|------|------|
| SRT 字幕 | `<项目目录>/subtitles.srt` |
| HTML（原地修改） | `<项目目录>/presentation.html`（duration 回填） |

## 执行流程

### 首选方式：sync_timeline.py

```bash
.venv/bin/python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py \
  <项目目录>
```

支持 `--dry-run` 诊断模式（只输出计算结果不写入文件）。

### 核心逻辑

```
对每个镜头 i（从 manifest.shots 遍历）：
  1. timelineConfig.shots[i].duration = manifest.shots[i].duration_ms
  2. SRT 条目:
     - index = i + 1
     - start = 累加偏移
     - end = start + duration_ms
     - text = manifest.shots[i].text
  3. 累加偏移 += duration_ms + shotGap(300ms)

画布组切换处（shots[i].canvas_group !== shots[i-1].canvas_group）：
  累加偏移 += groupTransition(600ms)
```

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `shotGap` | 300ms | 同组镜头间的呼吸间隔 |
| `groupTransition` | 600ms | 画布组切换的过渡时长 |

### 输出格式

#### SRT 字幕

```srt
1
00:00:00,000 --> 00:00:02,100
Harness Engineering 是什么

2
00:00:02,400 --> 00:00:05,200
和提示词工程有什么关系

3
00:00:06,100 --> 00:00:10,100
2026 年 OpenAI 在一篇博客文章提到了 Harness Engineering
```

#### HTML duration 回填

在 `presentation.html` 中找到 `window.timelineConfig = {...}` 并重写 `shots` 数组中每个条目的 `duration` 值：

```javascript
window.timelineConfig = {
  autoPlay: true,
  shots: [
    { id: 1, canvasGroup: 1, duration: 2100 },  // ← 从 manifest 回填
    { id: 2, canvasGroup: 1, duration: 2800 },  // ← 从 manifest 回填
    { id: 3, canvasGroup: 2, duration: 4200 },  // ← 从 manifest 回填
  ],
  shotGap: 300,
  groupTransition: 600,
};
```

## 验证规则

| 检查项 | 要求 |
|--------|------|
| manifest.shots 数量 | 必须等于 HTML 中 `.slide` 数量 |
| 每个 shot.id | 必须能在 timelineConfig.shots 中找到对应条目 |
| duration_ms | 必须 > 0（0 表示 TTS 失败，应该警告） |

## 错误处理

| 场景 | 处理 |
|------|------|
| manifest.shots 数量 ≠ HTML slide 数量 | 报错并停止 |
| 某个 shot 的 duration_ms = 0 | 使用默认值 3000ms 并输出警告 |
| manifest 不存在 | 报错并提示先运行 tts-voiceover |
| HTML 中找不到 timelineConfig | 报错并提示先运行 markdown-to-html |

## Quick Reference

| 项目 | 值 |
|------|-----|
| 输入 | `tts-manifest.json`（shots 格式）+ `presentation.html` |
| 输出 | `subtitles.srt` + 修改后的 `presentation.html` |
| 脚本 | `.venv/bin/python .codebuddy/skills/subtitle-timeline/scripts/sync_timeline.py <项目目录>` |
| 映射 | 1:1（一镜一句一条 SRT） |
| shotGap | 300ms |
| groupTransition | 600ms |
| 上游 | `tts-voiceover`（manifest）+ `markdown-to-html`（HTML） |
| 下游 | `video-render` |

## Common Mistakes

| 错误 | 正确做法 |
|------|----------|
| 使用旧格式 `scenes[].lines[]` 解析 manifest | 新格式使用 `shots[]` 扁平数组 |
| 重写 stepConfig | 新格式只重写 `timelineConfig.shots[].duration` |
| 复杂的 N:M 映射算法 | 1:1 映射，简单遍历 |
| 忘记计算画布组切换间隔 | 组切换处额外加 groupTransition(600ms) |
| 用旧的 scene_gap_ms / line_gap_ms | 新参数为 shotGap(300ms) 和 groupTransition(600ms) |
