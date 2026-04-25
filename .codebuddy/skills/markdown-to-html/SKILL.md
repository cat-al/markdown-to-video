---
name: markdown-to-html
description: "Use when converting standardized video script Markdown into a 16:9 widescreen HTML slideshow with scene-differentiated layouts, page-level overrides, and timeline-driven animations. Enforces frontend-design aesthetics and progressive disclosure effects."
---

# Markdown to HTML

将 `markdown-scriptwriter` 输出的标准格式视频文案 Markdown，转化为 **16:9 宽屏动态 HTML 幻灯片页面**，并强制产出具有**场景差异化构图**、**页面级可覆写配置**、**时间轴驱动动效**的结果。

## 核心原则

1. **强制 16:9 宽屏**（1920x1080 视口）
2. **JS 驱动的可配置时间轴**，支持后续 TTS 时间回填
3. **遵循 frontend-design 美学规范**，禁止通用 AI 美学
4. **渐进式披露动效**，每个场景内的元素按时间轴逐步出现
5. **同一篇视频内必须形成明显不同的场景构图**，禁止整篇只换文案不换版式
6. **支持页面级覆写配置**，允许对单页标题层级、字幕位置、构图变体进行精调

## 流程

1. 读取标准格式 Markdown（由 `markdown-scriptwriter` 生成）
2. 用 `scripts/parse-markdown.js` 解析为 JSON 场景数据、页面覆写配置与布局提示
3. 确认风格模式：用户提供参考页面 → 分析模仿；无参考 → AI 自动决定
4. 基于 `pageConfigOverrides`、`pageConfig`、`layoutHints` 选择每个场景的构图、标题层级、字幕位置与信息密度
5. 应用 frontend-design 美学约束生成 HTML
6. HTML 生成完成后，**明确提醒用户运行 `html-layout-review`**，检查页面是否存在错位、文字越界、裁切或溢出问题
7. 用户结合审查结果继续迭代，直到页面可交付

## 输入格式

标准格式 Markdown，包含：
- YAML frontmatter（元信息）
- `## 场景N：标题` 场景划分
- 可选的 `**页面配置**` YAML 代码块（页面级覆写接口）
- `**画面描述**` 视觉参考
- `>` 引用块逐行字幕
- 结构化视觉元素（如 `timeline` / `table` / `flowchart` / `data` / `quote` / `keypoints` / `code`）

### 页面级覆写配置格式（可选）

将以下区块放在场景标题之后、`**画面描述**` 之前：

~~~~markdown
## 场景2：核心观点一

**页面配置**
```yaml
sceneRole: content
sceneVariant: split-left-focus
titleSize: md
titleMaxWidth: 10ch
bodyColumns: 2
subtitlePlacement: right-rail
headlineLayout: stacked
```

**画面描述**: 左侧图示，右侧逐条展开要点
~~~~

支持字段：

- `sceneRole`: 页面角色。常见值：`cover`、`content`、`conclusion`、`comparison`、`explanation`
- `sceneVariant`: 页面构图变体。用于指定具体版式方向，如 `cover-immersive`、`comparison-board`、`timeline-track`
- `titleSize`: 标题层级。常见值：`hero`、`xl`、`lg`、`md`、`sm`
- `titleMaxWidth`: 标题最大宽度，可写数值或带单位值，如 `10ch`、`920px`
- `bodyColumns`: 主体列数。常见值：`1`、`2`、`3`
- `subtitlePlacement`: 字幕区位置。常见值：`bottom-band`、`right-rail`、`left-rail`、`split-inline`、`inset`
- `headlineLayout`: 标题布局。常见值：`hero-stack`、`stacked`、`inline-kicker`

未提供配置时，生成阶段必须使用解析器输出的 `pageConfig` 与 `layoutHints` 自动推断。

## 当前实现约定

- `HTML` 阶段**不渲染任何字幕区**，页面中不应出现内嵌字幕、底栏字幕、侧栏字幕或字幕标签
- Markdown 中解析出的 `subtitles` 仍然保留在结构化数据中，供后续视频生成阶段直接烧录使用
- `subtitlePlacement` 等字段目前仅作为数据层保留信息，不参与 HTML 展示输出

## 输出要求

### 16:9 强制宽屏

```css
:root {
  --slide-width: 1920px;
  --slide-height: 1080px;
}
body {
  width: var(--slide-width);
  height: var(--slide-height);
  overflow: hidden;
  margin: 0;
}
```

### HTML 结构

单个 HTML 文件，所有场景在一个页面中，幻灯片式切换：

```html
<div class="slideshow" id="slideshow">
  <section class="slide" data-scene="1" data-duration="15000" data-scene-role="cover" data-scene-variant="cover-immersive">
    <div class="slide-content">
      <!-- 场景视觉内容，元素带 data-enter-at 控制出现时机 -->
      <h1 data-enter-at="0">场景标题</h1>
      <p data-enter-at="1000">要点一</p>
      <p data-enter-at="3000">要点二</p>
    </div>
  </section>
  <section class="slide" data-scene="2" data-duration="12000" data-scene-role="content" data-scene-variant="comparison-board">
    <!-- ... -->
  </section>
</div>
```

### 时间轴引擎

HTML 中必须内置 JS 时间轴引擎，核心能力：

- **`data-duration`**: 每个场景的持续时间（毫秒），可配置
- **`data-enter-at`**: 场景内元素的出现时机（毫秒），实现渐进式披露
- **自动播放模式**: 场景按顺序自动推进，用于录屏
- **配置接口**: 暴露 `window.timelineConfig` 对象，后续 TTS 可回填真实时长

```javascript
// 时间轴配置接口示例
window.timelineConfig = {
  scenes: [
    { scene: 1, duration: 15000, elements: [
      { selector: '[data-scene="1"] h1', enterAt: 0 },
      { selector: '[data-scene="1"] p:nth-child(2)', enterAt: 1000 }
    ]},
    // ... TTS 生成后可回填真实时长
  ],
  autoPlay: true,
  transitionDuration: 800
};
```

### 动效要求

- **场景切换**: 淡入淡出、滑动、或缩放过渡（800ms 左右）
- **渐进式披露**: 场景内元素按 `data-enter-at` 时间逐步出现
- **入场动画**: 淡入、滑入、缩放入场等，匹配内容调性
- **画面描述指导**: 根据 Markdown 中的 `**画面描述**` 决定具体动效方式

## 多场景差异化版式规则（硬性要求）

### 必须满足的硬规则

- 同一篇视频文稿中，**至少要有 3 种以上明确不同的场景构图**
- **第一页默认按封面页处理**，后续页默认按内容页处理；若场景通过 `sceneRole` 显式声明，则以显式配置为准
- **封面页标题层级必须高于内容页**，不能把封面级大标题复制到所有页面
- 不同元素类型必须触发不同版式，不允许统一套壳承载全部内容
- 字幕区位置不能在整篇中固定不变，必须参与整体构图设计
- 当标题长度、字幕数量、内容模块数量发生变化时，必须自动调整字号、宽度、栏数与主次关系

### 元素类型到版式的默认映射

| 元素类型 / 结构特征 | 默认页面角色或变体 | 默认构图方向 |
|------|------|------|
| `timeline` | `explanation` / `timeline-track` | 轨道式、纵向推进式、时间轴展开 |
| `table` | `comparison` / `comparison-board` | 对比矩阵、双栏、信息面板 |
| `flowchart` | `explanation` / `process-diagram` | 链路拆解、流程演进、节点连接 |
| `data` | `content` / `metric-wall` | 数据卡片墙、指标高亮、重点数值聚焦 |
| `quote` | `conclusion` / `quote-focus` | 留白强化、结论页、宣言页 |
| `keypoints` | `content` / `stacked-points` | 要点清单、分栏摘要、序列信息块 |
| `code` | `explanation` / `code-spotlight` | 代码聚焦、双栏讲解、局部放大 |
| 无结构化元素，仅字幕与视觉描述 | `cover` 或 `content` | 根据场景角色选择封面叙事或正文叙事 |

### 自适应排版规则

生成 HTML 时必须综合以下因素自动调节布局：

- **标题长度**：长标题自动缩小字号、收窄行宽、优先使用 `stacked` 标题布局
- **字幕数量**：字幕多时，避免继续挤压主内容区，应切换到侧栏、底栏或嵌入式字幕布局
- **内容模块数量**：模块多时自动切换分栏或板块式构图，不能继续使用单中心布局
- **模块类型组合**：例如 `table + data` 应偏信息面板，`flowchart + keypoints` 应偏流程解读
- **场景角色**：封面页、结论页、对比页、解释页必须采用不同的标题层级与信息密度

### 字幕区规则

- 字幕区不应固定在所有页面的同一位置
- 不同场景可采用 `bottom-band`、`right-rail`、`left-rail`、`split-inline`、`inset` 等不同处理方式
- 字幕区与主内容区的关系应参与整体构图，而不是固定附属模块

## 页面级配置接口与解析契约

`scripts/parse-markdown.js` 必须输出以下三层信息：

1. **`pageConfigOverrides`**：用户在 Markdown 中显式提供的页面级覆写字段
2. **`pageConfig`**：解析器根据覆写 + 默认规则 + 内容结构综合得出的已解析配置
3. **`layoutHints`**：供 HTML 生成阶段参考的布局提示，如元素类型、信息密度、标题长度、字幕数量

解析输出示例：

```json
{
  "meta": { "title": "...", "scenes_count": 5 },
  "scenes": [
    {
      "id": 1,
      "title": "开场引入",
      "visual": "深色背景，书籍封面缓缓浮现...",
      "elements": [],
      "subtitles": [
        "你有没有想过...",
        "今天我们来精读..."
      ],
      "pageConfigOverrides": {
        "sceneRole": "cover",
        "titleSize": "hero"
      },
      "pageConfig": {
        "sceneRole": "cover",
        "sceneVariant": "cover-immersive",
        "titleSize": "hero",
        "titleMaxWidth": "10ch",
        "bodyColumns": 1,
        "subtitlePlacement": "bottom-band",
        "headlineLayout": "hero-stack"
      },
      "layoutHints": {
        "primaryElementType": "none",
        "elementTypes": [],
        "subtitleCount": 2,
        "elementCount": 0,
        "density": "low",
        "titleLength": 4,
        "manualOverrideKeys": ["sceneRole", "titleSize"]
      }
    }
  ]
}
```

HTML 生成阶段必须优先使用 `pageConfig`，并在必要时参考 `layoutHints` 做进一步版式微调。

## Frontend-Design 美学规范（强制）

本 skill 自带完整的 frontend-design 美学约束，位于 `frontend-design/SKILL.md`（源自 [anthropics/claude-code frontend-design](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design/skills/frontend-design)）。

**生成 HTML 前必须先阅读 `frontend-design/SKILL.md`，并严格遵循其中的所有美学规范。** 核心要求包括：

- 大胆的美学方向（Design Thinking 流程）
- 独特的字体、配色、空间构成、动效、背景细节
- **禁止**通用 AI 美学（Inter/Roboto/Arial、紫色渐变白底、千篇一律的设计）

### 风格控制模式

**参考模式**（用户提供参考 HTML）：
1. 分析参考页面的：字体、配色、布局、动效风格
2. 提取其设计语言核心特征
3. 在此基础上生成新页面，保持风格一致但不照搬

**自动模式**（无参考页面）：
1. 根据视频内容主题选择美学方向
2. 每次生成都选择不同的风格，**禁止收敛到同一种设计**
3. 向用户说明选择的风格方向及理由

## 基础模板

生成时参考 `templates/slide-base.html` 作为结构基础，在此之上进行风格定制。

## 解析脚本

使用 `scripts/parse-markdown.js` 将标准 Markdown 解析为 JSON。解析器需要同时完成三件事：

- 解析标准结构（frontmatter、场景、画面描述、字幕、视觉元素）
- 解析页面级覆写配置 `**页面配置**`
- 输出已解析的 `pageConfig` 与 `layoutHints`，为后续 HTML 生成提供稳定契约

## 常见错误

| 错误 | 正确做法 |
|------|----------|
| 不是 16:9 视口 | 强制 1920x1080，overflow: hidden |
| 用 CSS 动画硬编码时间 | 用 JS 时间轴 + data 属性，保证可配置 |
| 使用 Inter/Roboto 等通用字体 | 选择有辨识度的字体 |
| 所有场景沿用同一骨架，只换标题和正文 | 至少使用 3 种以上明确不同的场景构图 |
| 第一页和后续内容页都使用同级大标题 | 第一页默认封面级标题，后续页自动降级为内容页层级 |
| 不区分 `timeline` / `table` / `flowchart` / `data` / `quote` | 按元素结构切换默认版式与字幕位置 |
| 字幕区整篇固定在同一位置 | 按场景角色和信息密度切换 `subtitlePlacement` |
| 没有渐进式披露 | 场景内元素必须按时间轴逐步出现 |
| 缺少自动播放模式 | 必须支持自动推进，用于录屏 |
