---
name: markdown-to-html
description: "Use when converting standardized video script Markdown into a 16:9 widescreen HTML slideshow with scene-differentiated layouts, page-level overrides, and timeline-driven animations. Enforces frontend-design aesthetics and progressive disclosure effects."
---

# Markdown to HTML — 视觉叙事创作

将 `markdown-scriptwriter` 输出的标准格式视频文案 Markdown，转化为 **16:9 宽屏动态 HTML 幻灯片页面**。每一页由 AI 根据内容逐页创作 SVG/CSS 动画讲解页，而非拼接预制模板。

## 核心原则

1. **一个概念、一个动画、一句话** — 每页只传达一个核心洞察
2. **SVG/CSS 动画是视觉重心** — 占据画面 60-80% 面积，不是装饰
3. **内联标注** — 关键文字贴在图形元素旁，不另开面板或侧栏
4. **数据锚点** — 涉及数量对比时，用大字号数字作为记忆钩子
5. **留白即节奏** — 信息密度靠"逐步揭示"而不是"一次堆完"
6. **强制 16:9 宽屏**（1920×1080 视口）
7. **JS 驱动的可配置时间轴**，支持后续 TTS 时间回填
8. **遵循 frontend-design 美学规范**，禁止通用 AI 美学

## 产物目录约定

> 完整约定见 `docs/project-output-convention.md`。

本 skill 接收**项目目录路径**作为参数（如 `output/001-cognitive-awakening/`）。

### 输入路径

| 产物 | 路径 |
|------|------|
| 视频文案 | `<项目目录>/script.md` |

### 输出路径

| 产物 | 路径 |
|------|------|
| HTML 幻灯片 | `<项目目录>/presentation.html` |
| 背景纹理 | `<项目目录>/paper-texture-bg.png` |

## 流程

> **强制增量模式**：所有项目一律使用增量场景组装流程。AI 每次只创作一个原始场景（`## 场景N`）对应的所有 slide，通过 `incremental-assemble.js` 逐步组装到 `presentation.html`。

### 准备阶段

1. 读取 `<项目目录>/script.md`（由 `markdown-scriptwriter` 生成）
2. 用 `scripts/parse-markdown.js` 解析为 JSON 场景数据
3. 用 `scripts/render-presentation.js` 输出 planner 上下文：
   ```bash
   node scripts/render-presentation.js <项目目录>/script.md --plan-output <项目目录>/.build/context.json
   ```
4. 运行增量组装初始化：
   ```bash
   node scripts/incremental-assemble.js init --project-dir <项目目录> --context <项目目录>/.build/context.json
   ```
   这会生成骨架 `presentation.html` 和 `.build/` 构建目录。

### 创作阶段（逐场景循环）

将 scenePlan 按 `baseSceneId` 分组。**每次循环处理一个原始场景**（可能包含 1~3 个 slide：overview + detail）。

**对于每个场景 N：**

1. **读取当前场景的 scenePlan** — 从 `.build/context.json` 中提取 `baseSceneId === N` 的所有 scenePlan
2. **理解本组概念** — 读每个 scenePlan 的 `focusTarget`、`layoutIntent`、`subtitleSlice`、`renderData`
3. **逐 slide 创作 HTML**：
   a. **决定视觉表达** — 根据 `contentType` 和具体内容，决定用什么 SVG 图形 + 什么 CSS 动画
   b. **规划步骤序列** — 这个概念需要几步展开？每步揭示什么？（详见 Step 编排）
   c. **创作 SVG/CSS** — 直接手写 inline SVG + CSS animation / keyframes。所有元素写在同一个容器内，用 `step-hidden` 控制初始可见性
   d. **加入内联标注** — 把关键文字贴在图形元素旁
   e. **配置时间属性** — 设置 `data-enter-at` 控制渐进揭示，设置 `data-step-target` 和 `data-focus-group` 支持聚焦动作
4. **编写 stepConfig** — 定义该场景所有 slide 的步骤序列，写入 `.build/scene-N-step-config.json`
5. **写入 slide 片段** — 将该场景所有 `<section class="slide">` HTML 写入 `.build/scene-N.html`
6. **追加到 presentation.html**：
   ```bash
   node scripts/incremental-assemble.js append \
     --project-dir <项目目录> \
     --scene-id N \
     --slides-html <项目目录>/.build/scene-N.html \
     --step-config <项目目录>/.build/scene-N-step-config.json
   ```
7. **继续下一个场景**

**AI 上下文控制**：创作每个场景时，AI 只需关注：
- 当前场景组的完整 scenePlan JSON
- 已完成场景的**摘要**（标题 + contentType + 主视觉元素，2~3 行/场景）
- `frontend-design/SKILL.md` 美学规范
- 本 SKILL.md 的创作指南

**不传入已完成场景的完整 HTML**，只传摘要以维持视觉连贯性。

### 组装阶段

全部场景创作完成后：

1. 运行 finalize：
   ```bash
   node scripts/incremental-assemble.js finalize --project-dir <项目目录>
   ```
   脚本自动完成：
   - 注入 `timelineConfig`、`stepConfig`、`presentationData`、`presentationTag`、`appTitle`
   - 复制 `assets/paper-texture-bg.png` 到项目目录
   - 清理 `.build/` 临时目录
2. HTML 生成完成后，**明确提醒用户运行 `html-layout-review`**

### 中断恢复

如果创作过程中断，可查看进度并从断点继续：

```bash
node scripts/incremental-assemble.js status --project-dir <项目目录>
```

输出示例：
```json
{
  "status": "in-progress",
  "total": 14,
  "completed": [1, 2, 3],
  "remaining": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  "progress": "3/14"
}
```

从下一个未完成场景继续创作即可。

### 上下文输出工具

可以用 `render-presentation.js` 快速获取 planner 上下文：

```bash
node scripts/render-presentation.js input.md --plan-output context.json
```

输出 JSON 包含 `parsedResult` + `presentationPlan`，AI 创作时参考这个 JSON 理解 planner 编排决策。

## 视觉叙事原则

### 一个概念

本页只传达一个核心洞察，由 scenePlan 的 `focusTarget` 决定。不在一页内同时解释多个概念。如果放不下，说明该拆页，不该缩小塞进去。

### 一个动画

页面视觉重心是一个 SVG/CSS 动画，占据画面 60-80% 的面积。动画是讲解的主体，不是装饰。

### 内联标注

关键文字标注直接贴在图形元素旁边。用箭头、引线、或紧邻文字关联到对应的图形节点。不另开面板、侧栏或 tooltip。

### 数据锚点

如果概念涉及数量、对比、变化，用大字号数字作为视觉锚点（如 `3x`、`95%`、`32K`）。数字是观众记忆的钩子。字号 **96px 起步，重要数字 160px+**。

### 一句话

顶部或底部最多一句引导文案。不写段落，不写要点列表。一句话点明"这页在讲什么"，其余交给动画。

### 手机可读性（强制）

视频最终在手机上以 16:9 横屏窗口播放，画面被 ~5 倍缩放。**所有文字必须满足以下最小字号基线**，否则手机上不可读：

| 元素类型 | 最小字号 | 手机 ~5x 缩放后 |
|---------|---------|----------------|
| 页面标题 | **64px** | ~13px ✓ |
| 节点/卡片内文字 | **32px** | ~6px 可辨认 |
| 内联标注（SVG `<text>` / HTML） | **28px** | ~6px 可辨认 |
| 引导文案（顶部/底部一句话） | **40px** | ~8px ✓ |
| 数字锚点 | **96px 起步，重要数字 160px+** | ~19-32px ✓ |
| 辅助说明文字 | **28px** | ~6px 可辨认 |
| 序号/编号（圆圈内） | **36px** | ~7px ✓ |

配套要求：
- **节点/卡片尺寸相应放大**，给更大字号留空间
- **连线 stroke-width ≥ 3px**，描边 ≥ 2px
- 信息放不下时**拆页**，不缩小字号

## SVG/CSS 动画创作指南

按内容类型给出创作方向，但不限死模板。AI 可根据具体内容自由发挥。

### cover 场景

- 标题是绝对主角，超大字号 + 动画入场（`scale` + `opacity` 或逐字出现）
- 背景可用微妙的粒子、网格、光晕等氛围层
- 副标题或引导语在标题之后延迟出现
- 不放任何内容面板

### flowchart 场景

- 节点用圆形 / 圆角矩形，连线用 `stroke-dasharray` + `stroke-dashoffset` 做路径绘制动画
- 聚焦节点放大 + 发光边框（`box-shadow` 或 SVG `filter`），非聚焦节点压低透明度
- 标注贴在节点旁，用箭头或引线指向
- 色彩梯度表达状态：陶土棕（正常）→ 暖金棕（警告）→ 赤陶红（错误/失控）

### timeline 场景

- 主轴用渐变线条（`linearGradient`），阶段节点沿轴排列
- 按时序逐个点亮（`stroke-dashoffset` 动画 + 节点 `opacity` 动画）
- 当前阶段高亮 + 展开子层级
- 缩进层级用 `margin-left` 或 SVG `transform` 表达
- 颜色梯度同 flowchart（陶土棕 → 暖金棕 → 赤陶红）

### keypoints 场景

- 要点围绕中心概念排列（纵向列表或环形布局）
- 逐条浮现（`translateY` + `opacity` 的 stagger 动画）
- 当前讲解项放大居中，其余缩小/弱化
- 每个要点旁贴一句精炼描述

### data 场景

- 大字号数字做视觉锚点（`font-size: 96px+`，重要数字 `160px+`），搭配小字说明
- CSS `counter` 或 JS 做数字滚动计数动画
- 对比用并排条形或分区色块，不用表格
- 数字和图形并存时，数字在上或在左，图形做补充

### quote 场景

- 极致留白，文字逐行淡入
- 可用超大引号（`font-size: 200px+`）做装饰
- 字体走 display 风格，`letter-spacing` 适度拉开
- 不加任何面板或卡片

### code / terminal 场景

- **必须使用深色背景模拟终端**：背景色 `#1E1E1E`，圆角 `16px`，顶部添加三个小圆点（红 `#FF5F56`、黄 `#FFBD2E`、绿 `#27C93F`）模拟窗口控件
- 代码文字用 `monospace` 字体，颜色使用亮色方案：关键字/命令 `#27C93F`（绿），注释 `#6A737D`（灰），字符串/路径 `#FFBD2E`（黄），普通文字 `#E1E4E8`（白）
- 输出/结果文字用 `#E1E4E8`，成功标记用 `#27C93F`，错误标记用 `#FF5F56`
- 终端块占据画面主体（60-80% 面积），周围保持纸浆米白背景的留白
- 逐行出现动效（`slideRight` + stagger delay），模拟终端输入的打字感
- **字号最小 28px**（手机可读性），推荐命令行 32px、注释 28px

### fallback 场景

- 提取场景的核心视觉描述，创作一个极简的概念图
- 配一句话概括场景主旨
- 不堆砌信息，宁可留白也不硬塞

## 输入格式

标准格式 Markdown，包含：
- YAML frontmatter（元信息）
- `## 场景N：标题` 场景划分
- 可选的 `**页面配置**` YAML 代码块（页面级覆写接口）
- `**画面描述**` 视觉参考
- `>` 引用块逐行字幕
- 结构化视觉元素（如 `timeline` / `table` / `flowchart` / `data` / `quote` / `keypoints` / `code`）

## 输出要求

### HTML 结构

单个 HTML 文件，基于 `slide-base.html` 骨架。所有场景在一个页面中，幻灯片式切换：

```html
<section class="slide" data-scene="1" data-duration="15000">
  <!-- AI 创作的 SVG/CSS 动画内容 -->
  <svg viewBox="0 0 1920 1080" ...>
    <!-- inline SVG 动画 -->
  </svg>
  <div class="annotation" data-enter-at="2000" style="position:absolute; ...">
    标注文字
  </div>
</section>
```

### 时间轴引擎

骨架自带 `TimelineEngine`，核心能力：

- **`data-duration`**: 每个场景的持续时间（毫秒）
- **`data-enter-at`**: 场景内元素的出现时机（毫秒），实现渐进式披露
- **`data-step-target`** / **`data-focus-group`**: 支持 highlight/dim 聚焦动作
- **`data-el`** + **`step-hidden`**: Step 系统元素标记，控制连续演化
- **`window.stepConfig`**: Step 编排配置，定义章节内步骤序列（enter/exit/move/morph/highlight/dim）
- **自动播放模式**: 场景和步骤按顺序自动推进，用于录屏
- **配置接口**: `window.timelineConfig` 对象，后续 TTS 可回填真实时长

### 当前实现约定

- HTML 阶段**不渲染任何字幕区**，页面中不应出现内嵌字幕
- Markdown 中解析出的 `subtitles` 保留在 `window.presentationData` 中，供后续视频生成阶段消费

## Step 编排系统（画布连续演化）

### 核心概念

Step 系统让章节内部的元素通过 enter/exit/move/morph 连续演化，实现"画布在生长"而非"PPT 在翻页"的叙事效果。

```
章节 (slide)
  └── 步骤 (step) × N
        └── 动作 (action) × M
              ├── 目标元素 (target)
              ├── 动作类型 (type: enter/exit/move/morph/highlight/dim)
              └── 参数 (animation/x/y/style/duration/delay)
```

一个**章节**包含多个**步骤**，每个步骤包含一组**同时执行**的动作。空格/→ 触发"下一步"，步骤用完了才切"下一章节"。

### 步骤编排原则

- **每步只做一件事**：要么揭示新信息，要么聚焦某个部分，要么转换视角
- **入场和退场可以同时发生**（旧元素淡出的同时新元素淡入）
- **跨步骤存活的元素不要退场再入场** — 保持在画布上，只做 move/morph
- **一个概念通常 3-6 步展开**，不要超过 8 步（太碎）
- **每步之间留足呼吸时间**（600ms+ 间隔）

### 动作类型

| 动作 | 作用 | 实现 | 参数 |
|------|------|------|------|
| `enter` | 元素入场 | CSS animation + visibility | `animation`: fadeIn / scaleIn / slideLeft / slideRight / slideUp / slideDown / drawPath / growBar / growBarX |
| `exit` | 元素退场 | CSS animation → hidden | `animation`: fadeOut / scaleOut / slideOutLeft / slideOutRight / slideOutUp / slideOutDown / erasePath |
| `move` | 元素移动 | CSS `transform` 过渡 | `x`, `y`（px）或 `transform` 字符串 |
| `morph` | 元素变形 | CSS transition + SVG attr | `style`: CSS 属性对象；`attrs`: SVG 属性对象（fill/stroke/r/width 等） |
| `highlight` | 高亮聚焦 | `.is-highlighted` + SVG drop-shadow | `group`: 可选，dim 同组其他元素；`noGlow`: 禁用 SVG 发光 |
| `dim` | 弱化 | `.is-dimmed` | — |

**SVG 特殊说明：**
- 所有 `[data-el]` 元素自动设置 `transform-box: fill-box; transform-origin: center center`，确保 `scale`/`rotate` 基于元素自身中心
- `drawPath` 自动计算 `<path>` 的 `getTotalLength()` 并设置 `stroke-dasharray/stroke-dashoffset`，AI 不需要手动预设
- `morph` 的 `attrs` 用于修改 SVG 属性（如 `{ "fill": "#ff0", "r": "40" }`），引擎自动保存/还原原始值
- `highlight` 在 SVG 元素上自动添加 `drop-shadow` 发光效果

### 元素标记规范

给需要参与步骤演化的元素添加 `data-el` 属性和 `step-hidden` 类：

```html
<!-- SVG 组合元素（节点 = rect + text） -->
<g data-el="query-node" class="step-hidden">
  <rect x="100" y="200" width="120" height="50" rx="8" fill="var(--color-accent)"/>
  <text x="160" y="230" text-anchor="middle" fill="#fff">Query</text>
</g>

<!-- SVG 路径（drawPath 自动计算长度，无需手动设置 stroke-dasharray） -->
<path data-el="line-to-q" class="step-hidden"
  d="M 200 360 Q 340 200 420 100"
  stroke="var(--color-accent)" stroke-width="3" fill="none"/>

<!-- SVG 条形（growBar 需要 transform-origin 在底部） -->
<rect data-el="bar-1" class="step-hidden"
  x="100" y="400" width="60" height="200" fill="var(--color-accent)"
  style="transform-origin: center bottom"/>

<!-- HTML 标注 -->
<div data-el="annotation-1" class="step-hidden"
  style="position:absolute; left:500px; top:300px">
  语义和位置的向量
</div>
```

- `data-el="唯一ID"` — 步骤动作通过此 ID 定位元素
- `class="step-hidden"` — 初始不可见（opacity:0 + visibility:hidden），由 enter 动作控制出现
- 不需要 `step-hidden` 的元素（如背景网格、坐标轴底板）正常可见
- SVG `<path>` 用 `drawPath` 入场时，引擎自动调用 `getTotalLength()` 计算长度并设置 `stroke-dasharray`/`stroke-dashoffset`
- SVG 条形用 `growBar` 入场时，需手动设置 `transform-origin: center bottom`（垂直）或 `transform-origin: left center`（水平）

### stepConfig 配置格式

在 `__STEP_CONFIG__` 占位符中嵌入 JSON。**key 使用 slide 的全局顺序编号**（`slide-1` ~ `slide-N`），而非 `data-scene` 值。例如场景1拆为3个 slide（overview + 2 detail），则 key 为 `slide-1`、`slide-2`、`slide-3`；场景2的第一个 slide key 为 `slide-4`，以此类推。

```javascript
{
  "slide-1": [
    {
      // step.duration = 本步的"观看时间"（ms），自动播放时用于决定何时触发下一步
      "duration": 800,
      "actions": [
        { "target": "input-word", "type": "enter", "animation": "scaleIn" }
      ]
    },
    {
      "duration": 1200,
      "actions": [
        { "target": "line-to-q", "type": "enter", "animation": "drawPath" },
        { "target": "line-to-k", "type": "enter", "animation": "drawPath", "delay": 200 },
        { "target": "query-node", "type": "enter", "animation": "scaleIn", "delay": 600 }
      ]
    },
    {
      "duration": 1000,
      "actions": [
        { "target": "input-word", "type": "exit", "animation": "fadeOut" },
        { "target": "q-to-k-arrows", "type": "enter", "animation": "drawPath", "delay": 400 }
      ]
    },
    {
      "duration": 1000,
      "actions": [
        { "target": "query-node", "type": "move", "x": 100, "y": 300 },
        { "target": "matrix-grid", "type": "enter", "animation": "fadeIn", "delay": 600 }
      ]
    },
    {
      "duration": 800,
      "actions": [
        { "target": "query-node", "type": "morph", "attrs": { "fill": "#ff9f72", "rx": "20" }, "style": { "filter": "drop-shadow(0 0 6px #ff9f72)" } },
        { "target": "key-node", "type": "highlight", "group": "qkv-nodes" }
      ]
    }
  ]
}
```

**关键语义区分：**
- `step.duration` — **观看时间**。自动播放时，引擎等待 `step.duration + stepGap(600ms)` 后触发下一步
- `action.duration` — **动画时长**（可选）。省略时使用默认值（enter: 600ms, exit: 400ms, move: 600ms, morph: 600ms）
- `action.delay` — **动作延迟**（可选）。该 action 在 step 开始后延迟多久执行，用于 step 内部的 stagger 编排

### drawPath 动画

`drawPath` 用于 SVG 路径绘制动画。引擎会自动调用 `getTotalLength()` 计算路径长度并设置 `stroke-dasharray`/`stroke-dashoffset`，**AI 不需要手动预设这些属性**。

只需写干净的 path 元素：

```html
<path data-el="line-to-q" class="step-hidden"
  d="M 200 360 Q 340 200 420 100"
  stroke="var(--color-accent)" stroke-width="3" fill="none"/>
```

如果是 `<g>` 容器内包含多个 path，引擎会自动处理所有子 path 元素。

`erasePath` 是 `drawPath` 的反向动画，用于路径退场。

### 视觉拆解方法论

根据概念类型选择步骤编排范式：

| 概念类型 | 步骤编排范式 |
|---------|------------|
| **因果/流程关系** | step1: 起点节点入场 → step2: 连线绘制+下一节点 → step3: 继续... → stepN: 全链路高亮 |
| **并列/对比** | step1: A 入场 → step2: B 入场(A 保留) → step3: 对比标注入场 |
| **层级/包含** | step1: 外层入场 → step2: 内层展开 → step3: 标注 |
| **时序/阶段** | step1: 轴线绘制 → step2: 节点1点亮 → step3: 节点2点亮 → ... |
| **数量/规模** | step1: 数字入场 → step2: 对比条生长 → step3: 标注 |
| **转化/映射** | step1: 左侧入场 → step2: 连线绘制 → step3: 右侧浮现 |
| **视角切换** | step1: 当前视图保留 → step2: 元素 move 到新位置 → step3: 新标注入场 |

### 向后兼容

- 没有 `stepConfig` 或 `stepConfig` 为 `{}` 的 HTML → 行为和旧版完全一样（纯章节切换 + data-enter-at 渐进揭示）
- 有 `stepConfig` 但某个 slide 没有定义 steps → 该 slide 按旧模式运行
- `data-enter-at` 机制保留，可以和 step 系统共存

## 反模式清单

以下做法**明确禁止**：

| 禁止 | 原因 |
|------|------|
| 圆角面板网格（`.card`、`.panel`、`.surface`） | dashboard 元素，不是讲解画面 |
| 信号条 / 标签墙（signal strip、meta chip、tag row） | 数据看板元素 |
| "左-中-右"三栏固定布局 | 所有场景共用同一骨架 |
| 字幕渲染成面板 | 字幕只在数据层，不上屏 |
| 信息堆砌 | 放不下就拆页，不缩小塞进去 |
| 纯文字页 | 每页必须有一个视觉元素（SVG 动画、数字锚点、概念图） |
| 通用 AI 美学 | 遵循 `frontend-design/SKILL.md` 的反 slop 规则 |
| 更换配色方案 | 所有视频必须使用固定的纸浆米白 + 陶土棕绿品牌色系 |

## Frontend-Design 美学规范（强制）

**生成 HTML 前必须先阅读 `frontend-design/SKILL.md`，并严格遵循其中的所有美学规范。**

### 风格控制模式

**品牌色系（固定）**：
所有视频使用统一的「纸浆米白 + 陶土棕绿」品牌色系，**禁止更换配色方案**。色系定义在 `slide-base.html` 的 CSS 变量中：
- 背景：纸浆米白 `#FAF3E9` + `assets/paper-texture-bg.png` 纹理
- 主色：陶土棕 `#7A4F2A`
- 强调：暖金棕 `#B8802E`
- 辅助：橄榄绿 `#4A6741`
- 文字：深棕 `#1a1408`
- 警告：赤陶红 `#8B2515`

**参考模式**（用户提供参考 HTML）：
1. 分析参考页面的：布局、动效风格
2. 在品牌色系基础上适配参考页面的布局和动效特征
3. **配色不变**，只借鉴结构和动效

## 基础模板

生成时以 `templates/slide-base.html` 为骨架。骨架提供：

- 16:9 视口 + 纸浆纹理背景（`#FAF3E9` + `paper-texture-bg.png`）
- `.slideshow` / `.slide` / `.slide.active` 切换系统
- `[data-enter-at]` + `.visible` 渐进出现
- `.step-hidden` / `.step-entering` / `.step-exiting` Step 演化状态
- `.is-highlighted` / `.is-dimmed` 聚焦状态
- `[data-el]` Step 系统元素定位标记
- `[data-step-target]` / `[data-focus-group]` 聚焦标记系统
- `TimelineEngine`（自动播放、step 调度、highlight/dim/reveal 动作、Step 连续演化）
- 页码、进度条、快捷键
- 基础动画工具类（`@keyframes drawPath / erasePath / fadeIn / fadeOut / fadeInUp / scaleIn / scaleOut / slideUp / slideDown / slideLeft / slideRight / slideOutLeft / slideOutRight / slideOutUp / slideOutDown / growBar / growBarX / pulseGlow / countUp`）
- 动画延迟工具类（`[data-delay="1"]` ~ `[data-delay="8"]`）
- 占位符：`__SLIDES__`、`__PRESENTATION_DATA__`、`__TIMELINE_CONFIG__`、`__STEP_CONFIG__`、`__PRESENTATION_TAG__`、`__APP_TITLE__`

**AI 创作的内容直接写在每个 `<section class="slide">` 内部。** 骨架不提供任何面板、卡片、网格等预制组件 — 所有视觉表达由 AI 根据内容量身定制。

## 解析与编排脚本

| 脚本 | 用途 |
|------|------|
| `scripts/parse-markdown.js` | 将标准 Markdown 解析为 JSON（场景、元素、字幕、配置） |
| `scripts/build-presentation-plan.js` | 根据解析结果编排 scenePlan（总览→聚焦→细节节奏） |
| `scripts/render-presentation.js` | 输出 planner 上下文 JSON（`--plan-output`），不再生成 HTML |
| `scripts/incremental-assemble.js` | 增量场景组装：`init` → `append` × N → `finalize`，逐场景构建 presentation.html |

## 常见错误

| 错误 | 正确做法 |
|------|----------|
| 不是 16:9 视口 | 强制 1920×1080，overflow: hidden |
| 使用面板/卡片网格 | 用 SVG/CSS 动画作为视觉重心 |
| 所有场景同一版式 | 每个场景的视觉表达必须不同 |
| 信息堆砌在一页 | 拆页，而不是缩小 |
| 标注另开侧栏 | 标注贴在图形元素旁边 |
| 纯文字无视觉元素 | 每页至少一个 SVG 动画或数字锚点 |
| 使用 Inter/Roboto | 选择有辨识度的字体 |
| 没有渐进式披露 | 元素必须按 `data-enter-at` 逐步出现 |
| 标注/节点文字小于 28px | 手机上不可读，严格遵守字号基线（见"手机可读性"段落） |
| 连线 stroke-width < 3px | 手机上看不清路径，最小 3px |
| stepConfig key 用 `slide-${data-scene}` | **必须用全局 slide 索引**（`slide-1` ~ `slide-N`），因为同一场景可能拆分为多个 slide（overview + detail），它们共享相同的 `data-scene` 值。引擎的 `getSlideSteps()` 已改为用 `this.slides.indexOf(slide) + 1` 查找。AI 创作时 stepConfig key 按 slide 全局顺序编号（如场景1有3个slide → `slide-1`、`slide-2`、`slide-3`，场景2的slide → `slide-4`），而非按 `data-scene` 值。 |
