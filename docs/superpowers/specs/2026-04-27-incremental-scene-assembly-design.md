# 增量场景组装（Incremental Scene Assembly）

**日期**: 2026-04-27
**状态**: 设计已确认

## 问题

当上游 Markdown 文件较大（如 14 个场景、641 行），`markdown-to-html` skill 要求 AI 一次性创作所有 slide 的 SVG/CSS 动画 HTML。这导致：

1. **上下文溢出** — 大量 scenePlan + 大量 HTML 输出撑爆 AI 上下文窗口
2. **质量退化** — 后面场景的创作质量明显下降
3. **失败代价高** — 中间某页出错需全部重来

## 方案

保持最终产物 `presentation.html` 格式不变，将创作过程改为**按原始场景（`## 场景N`）逐个增量组装**。

### 流程对比

```
原流程：
  解析 MD → 全部 scenePlan → AI 一次性创作所有 slide → 组装 presentation.html

新流程：
  解析 MD → 全部 scenePlan → 按 baseSceneId 分组
    → init（生成骨架 HTML）
    → 循环 {
        取场景 N 的 scenePlan 组（1~3 个 slide）
        AI 创作该组 HTML 片段 + stepConfig
        append 到 presentation.html
      }
    → finalize（注入 config、清理占位符）
```

## 新增脚本：`scripts/incremental-assemble.js`

### 命令

| 子命令 | 参数 | 作用 |
|--------|------|------|
| `init` | `--project-dir <path>` `--context <json>` | 从 `slide-base.html` 生成骨架 HTML，写入 `presentation.html`；创建 `.build/` 目录和 `build-state.json` |
| `append` | `--project-dir <path>` `--scene-id <N>` `--slides-html <file>` `--step-config <json-file>` | 将 slide HTML 片段插入骨架的 `<!-- __INCREMENTAL_INSERT__ -->` 标记处；合并 stepConfig |
| `finalize` | `--project-dir <path>` | 替换所有占位符（`__TIMELINE_CONFIG__`、`__STEP_CONFIG__`、`__PRESENTATION_DATA__`、`__PRESENTATION_TAG__`、`__APP_TITLE__`）；移除临时标记；删除 `.build/` 目录 |
| `status` | `--project-dir <path>` | 输出 JSON：已完成场景列表、未完成场景列表、总进度 |

### init 行为

1. 读取 `slide-base.html` 模板
2. 将 `__SLIDES__` 替换为 `<!-- __INCREMENTAL_INSERT__ -->`（追加锚点）
3. 将其他占位符保留原样（finalize 时统一替换）
4. 写入 `<project-dir>/presentation.html`
5. 创建 `<project-dir>/.build/` 目录
6. 将 planner 上下文写入 `.build/context.json`
7. 初始化 `.build/build-state.json`：

```json
{
  "totalScenes": 14,
  "completedScenes": [],
  "stepConfig": {},
  "startedAt": "2026-04-27T12:00:00Z"
}
```

### append 行为

1. 读取 `presentation.html`
2. 读取 `--slides-html` 文件内容（AI 创作的 slide section HTML 片段）
3. 在 `<!-- __INCREMENTAL_INSERT__ -->` 标记**之前**插入片段
4. 读取 `--step-config` JSON，合并到 `build-state.json` 的 `stepConfig` 中
5. 将场景 ID 加入 `completedScenes`
6. 备份 slide 片段到 `.build/scene-N.html`（支持恢复）
7. 更新 `build-state.json`

### finalize 行为

1. 读取 `presentation.html`
2. 移除 `<!-- __INCREMENTAL_INSERT__ -->` 标记
3. 从 `build-state.json` 读取累积的 `stepConfig`，替换 `__STEP_CONFIG__`
4. 从 `.build/context.json` 读取 planner 数据，构建并替换：
   - `__TIMELINE_CONFIG__`（调用 `buildTimelineConfig`）
   - `__PRESENTATION_DATA__`
   - `__PRESENTATION_TAG__`
   - `__APP_TITLE__`
5. 复制 `assets/paper-texture-bg.png` 到项目目录
6. 删除 `.build/` 目录
7. 输出完成信息

### status 行为

1. 读取 `.build/build-state.json`
2. 对比 `.build/context.json` 中的 scenePlan 列表
3. 输出：

```json
{
  "total": 14,
  "completed": [1, 2, 3],
  "remaining": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  "progress": "3/14"
}
```

## 临时文件结构

```
<项目目录>/
  script.md                     ← 输入（不变）
  presentation.html             ← 最终产物（增量构建中）
  paper-texture-bg.png          ← 背景纹理（finalize 时复制）
  .build/                       ← 构建临时目录（finalize 后删除）
    context.json                ← planner 上下文
    build-state.json            ← 构建状态
    scene-1.html                ← 场景 1 slide 片段备份
    scene-2.html                ← 场景 2 slide 片段备份
    scene-1-step-config.json    ← 场景 1 stepConfig
    scene-2-step-config.json    ← 场景 2 stepConfig
    ...
```

## SKILL.md 流程改造

### 准备阶段（不变）

1. 读取 `<项目目录>/script.md`
2. 用 `scripts/parse-markdown.js` 解析
3. 用 `scripts/build-presentation-plan.js` 生成 presentationPlan
4. 读取 `templates/slide-base.html`

### 创作阶段（改造）

1. 运行 `incremental-assemble.js init`，生成骨架 HTML
2. 将 scenePlan 按 `baseSceneId` 分组，得到**场景组列表**
3. **逐组循环**（每组 = 一个原始场景的所有 slide）：
   a. 从 context.json 读取当前场景组的 scenePlan
   b. AI 创作该组所有 slide 的 HTML（写入 `.build/scene-N.html`）
   c. AI 创作该组的 stepConfig（写入 `.build/scene-N-step-config.json`）
   d. 运行 `incremental-assemble.js append --scene-id N`
   e. **可选**：对当前已组装的 HTML 运行 `html-layout-review` 检查

### 组装阶段（改造）

1. 全部场景创作完成后，运行 `incremental-assemble.js finalize`
2. 复制背景图（finalize 自动完成）
3. 提醒用户运行 `html-layout-review`

### AI 上下文控制

每次创作单个场景时，AI 收到的信息：

| 内容 | 大小估算 | 说明 |
|------|----------|------|
| 当前场景组 scenePlan JSON | ~2-5KB | 完整详情 |
| 已完成场景摘要 | ~100B/场景 | 标题 + contentType + 主色觉元素（维持视觉连贯性） |
| `frontend-design/SKILL.md` | 常驻 | 美学规范 |
| `SKILL.md` 创作指南 | 常驻 | 动画/布局规范 |

**不传入已完成场景的完整 HTML**，只传摘要。

### 中断恢复

运行 `incremental-assemble.js status` 查看进度。如果场景 N 出错：
1. 重新创作场景 N 的 HTML
2. 手动将 `.build/scene-N.html` 中的内容从 `presentation.html` 中移除（或重新从上一步恢复）
3. 重新 `append`

## 对下游的影响

**零影响**。最终 `presentation.html` 格式与现有完全一致：
- `tts-voiceover` — 不受影响
- `subtitle-timeline` — 不受影响
- `video-render` — 不受影响
- `html-layout-review` — 可在中途或完成后运行

## 对产物目录约定的影响

`.build/` 是临时目录，finalize 后删除，不出现在最终产物中。无需修改 `project-output-convention.md`。
