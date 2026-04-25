# 视觉叙事层重构设计文档

**日期**: 2026-04-25
**状态**: 已实施（步骤 1-4 完成，待步骤 5 用新 skill 重新生成 demo）
**范围**: `markdown-to-html` 的渲染层从"PPT 面板模板"转向"AI 即时创作 SVG/CSS 动画讲解页"
**前置文档**: `2026-04-24-presentation-planner-design.md`

## 1. 背景

当前链路已经完成阶段 1 + 阶段 2：

- `parse-markdown.js` 可稳定解析标准 Markdown
- `build-presentation-plan.js` 可自动编排 flowchart / timeline / keypoints 的总览→聚焦→细节节奏
- `render-presentation.js` 可消费 scenePlan 输出 HTML
- `slide-base.html` 具备时间轴引擎、step 调度、highlight/dim 聚焦系统

但生成的 HTML 存在一个方向性问题：**页面风格像 PPT / 数据看板，而不是科普视频画面。**

具体表现：

- 满屏圆角面板网格（`.content-surface`、`.plan-card`、`.signal-strip`、`.support-panel`）
- 所有场景共用"左标题-中内容-右辅助"的三栏 grid 骨架
- 信息堆砌在同一视觉层级，观众看不出重点
- SVG / CSS 动画能力完全没有被利用
- 页面更像"展板"，而不是"讲解"

这不是参数调优或增加模板能解决的问题，而是渲染层的根本思路需要改变。

## 2. 本次确认的产品决策

### 2.1 视觉方向

**动画讲解型** — 每页只讲一个概念，用 SVG/CSS 动画可视化那个概念。大量留白，类似 3Blue1Brown / Kurzgesagt 的视觉节奏。

### 2.2 动画来源

**AI 即时创作** — `markdown-to-html` skill 指导 AI 根据场景内容直接手写 SVG + CSS animation 代码。每次生成的动画都是根据内容量身定制的，不依赖预制组件库。

### 2.3 架构策略

**planner 保留，renderer 角色转变** — planner 继续做内容拆解和节奏编排，renderer 从"JS 拼模板"改为"输出结构化上下文供 AI 创作"。

### 2.4 视觉重心

**动画 + 内联标注 + 数据锚点** — 动画是核心，关键标注直接贴在图形元素旁边（不另开面板），底部/顶部用数字对比强化记忆。信息融入图形而非分开展示。

## 3. 设计目标

### 3.1 核心目标

> 把 `markdown-to-html` 从"JS 拼面板模板"转变为"AI 在 skill 指导下逐页创作 SVG/CSS 动画讲解页"。

### 3.2 目标细化

- 每一页有一个明确的 SVG/CSS 动画作为视觉重心
- 标注融入图形，不另开侧栏或面板
- 不同场景的视觉表达各不相同
- 页面大部分是留白 + 动画区，信息密度靠"逐步揭示"而不是"一次堆完"
- 时间轴自动播放仍然正常
- 录屏时，观众能看出"这页在讲什么"

## 4. 非目标

- 不改 planner 逻辑
- 不追求所有元素类型都有完美动画（首版覆盖 cover + timeline + data/keypoints + quote 四种）
- 不追求复杂交互（仍然是自动播放优先）
- 不要求 `render-presentation.js` 能自动生成新风格 HTML — 新风格由 AI 手写

## 5. 新链路

### 5.1 链路对比

**旧链路：**

```
Markdown → parse-markdown.js → build-presentation-plan.js → render-presentation.js(JS拼模板) → HTML
```

**新链路：**

```
Markdown → parse-markdown.js → build-presentation-plan.js → scenePlan[] 作为上下文
                                                                    ↓
                                                         AI 读 SKILL.md 指导
                                                                    ↓
                                                    AI 逐页创作 SVG/CSS 动画 HTML
                                                                    ↓
                                                         嵌入 slide-base.html 骨架
```

### 5.2 核心变化

renderer 从"代码"变成"prompt"。不再是 JS 函数拼 HTML，而是 skill 指导 AI 根据 scenePlan 创作 SVG/CSS 动画。

## 6. 视觉叙事原则

每一页遵循 **"一个概念、一个动画、一句话"** 的节奏。

### 6.1 一个概念

本页只传达一个核心洞察，由 scenePlan 的 focusTarget 决定。不在一页内同时解释多个概念。如果放不下，说明该拆页，不该缩小塞进去。

### 6.2 一个动画

页面视觉重心是一个 SVG/CSS 动画，占据画面 60-80% 的面积。动画是讲解的主体，不是装饰。

### 6.3 内联标注

关键文字标注直接贴在图形元素旁边。用箭头、引线、或紧邻文字关联到对应的图形节点。不另开面板、侧栏或 tooltip。

### 6.4 数据锚点

如果概念涉及数量、对比、变化，用大字号数字作为视觉锚点（如 `3x`、`95%`、`32K`）。数字是观众记忆的钩子。

### 6.5 一句话

顶部或底部最多一句引导文案。不写段落，不写要点列表。一句话点明"这页在讲什么"，其余交给动画。

## 7. SVG/CSS 动画创作指南

按内容类型给出创作方向，但不限死模板。AI 可根据具体内容自由发挥。

### 7.1 flowchart 场景

- 节点用圆形 / 圆角矩形，连线用 `stroke-dasharray` + `stroke-dashoffset` 做路径绘制动画
- 聚焦节点放大 + 发光边框（`box-shadow` 或 SVG `filter`），非聚焦节点压低透明度
- 标注贴在节点旁，用箭头或引线指向
- 色彩梯度表达状态：蓝（正常）→ 橙（警告）→ 红（错误/失控）

### 7.2 timeline 场景

- 主轴用渐变线条（`linearGradient`），阶段节点沿轴排列
- 按时序逐个点亮（`stroke-dashoffset` 动画 + 节点 `opacity` 动画）
- 当前阶段高亮 + 展开子层级
- 缩进层级用 `margin-left` 或 SVG `transform` 表达
- 颜色梯度同 flowchart

### 7.3 keypoints 场景

- 要点围绕中心概念排列（纵向列表或环形布局）
- 逐条浮现（`translateY` + `opacity` 的 stagger 动画）
- 当前讲解项放大居中，其余缩小/弱化
- 每个要点旁贴一句精炼描述

### 7.4 data 场景

- 大字号数字做视觉锚点（`font-size: 72px+`），搭配小字说明
- CSS `counter` 或 JS 做数字滚动计数动画
- 对比用并排条形或分区色块，不用表格
- 数字和图形并存时，数字在上或在左，图形做补充

### 7.5 quote 场景

- 极致留白，文字逐行淡入
- 可用超大引号（`font-size: 200px+`）做装饰
- 字体走 display 风格，`letter-spacing` 适度拉开
- 不加任何面板或卡片

### 7.6 cover 场景

- 标题是绝对主角，超大字号 + 动画入场（`scale` + `opacity` 或逐字出现）
- 背景可用微妙的粒子、网格、光晕等氛围层
- 副标题或引导语在标题之后延迟出现
- 不放任何内容面板

### 7.7 fallback 场景

- 提取场景的核心视觉描述，创作一个极简的概念图
- 配一句话概括场景主旨
- 不堆砌信息，宁可留白也不硬塞

## 8. 反模式清单

以下做法在新方向下明确禁止：

- **禁止圆角面板网格** — 不要 `.card`、`.panel`、`.surface`、`.content-surface` 这类 dashboard 元素
- **禁止信号条 / 标签墙** — 不要 signal strip、meta chip、tag row、planning notes
- **禁止"左-中-右"三栏固定布局** — 不要所有场景共用同一个 grid 骨架
- **禁止字幕渲染成面板** — 字幕只存在于数据层（`window.presentationData`），不上屏
- **禁止堆砌** — 如果一页放不下，拆页而不是缩小
- **禁止纯文字页** — 每页必须有一个视觉元素（SVG 动画、数字锚点、或概念图），纯文字段落不合格
- **禁止通用 AI 美学** — 继续遵循 `frontend-design/SKILL.md` 的反 slop 规则

## 9. AI 创作流程

### 9.1 准备阶段

1. 读取标准格式 Markdown
2. 用 `parse-markdown.js` 解析为 JSON
3. 用 `build-presentation-plan.js` 生成 `presentationPlan`
4. 读取 `slide-base.html` 作为页面骨架

### 9.2 创作阶段

逐个 scenePlan 创作 HTML：

1. **理解本页概念** — 读 `focusTarget`、`layoutIntent`、`subtitleSlice`、`renderData`
2. **决定视觉表达** — 根据 `contentType` 和具体内容，决定用什么 SVG 图形 + 什么 CSS 动画
3. **创作 SVG/CSS** — 直接手写 inline SVG + CSS animation / keyframes
4. **加入内联标注** — 把关键文字贴在图形元素旁
5. **配置时间属性** — 设置 `data-enter-at` 控制逐步揭示，设置 `data-step-target` 和 `data-focus-group` 支持聚焦动作

### 9.3 组装阶段

1. 把所有创作好的 slide 嵌入 `slide-base.html` 的 `__SLIDES__` 占位
2. 构建 `timelineConfig`，把 scenePlan 的 `steps[]` 映射为 `actions[]`
3. 序列化 `presentationData` 供调试和后续消费

## 10. 对现有文件的影响

### 10.1 保留不动

| 文件 | 理由 |
|------|------|
| `scripts/parse-markdown.js` | 解析层不变 |
| `scripts/build-presentation-plan.js` | 编排层不变，planner 决策仍然有效 |
| `markdown-scriptwriter/SKILL.md` | 上游不变 |
| `html-layout-review/SKILL.md` | 验收层不变 |

### 10.2 需要改动

| 文件 | 动作 | 说明 |
|------|------|------|
| `markdown-to-html/SKILL.md` | **重写** | 核心交付物。从"拼版式模板"改为"视觉叙事创作"指导 |
| `markdown-to-html/templates/slide-base.html` | **大幅精简** | 砍掉面板系统 CSS，保留骨架 + 时间轴引擎 |
| `markdown-to-html/scripts/render-presentation.js` | **改为辅助工具** | 不再生成 HTML，改为输出 planner 上下文 JSON |
| `markdown-to-html/frontend-design/SKILL.md` | **补充** | 新增 SVG 动画美学指导段落 |
| `demo/index.html` | **重新生成** | 用新 skill 对现有 demo-script.md 创作一版新风格 demo |

## 11. slide-base.html 精简方案

### 11.1 保留

- `<html>` / `<head>` / `<body>` 骨架
- `:root` CSS 变量（颜色、字体、尺寸）
- `body` 的 16:9 固定视口 + 深色背景
- `.slideshow` / `.slide` / `.slide.active` 切换系统
- `[data-enter-at]` + `.visible` 渐进出现基础
- `.is-highlighted` / `.is-dimmed` 聚焦状态
- `[data-step-target]` / `[data-focus-group]` 标记系统
- `TimelineEngine` 完整保留（自动播放、step 调度、highlight/dim/reveal 动作）
- 页码（`.scene-counter`）、进度条（`.progress-track`）、快捷键提示

### 11.2 砍掉

- `.slide-layout--triad` / `--detail-typed` / `--fallback-summary` / `--fallback-visual` 等所有预制 grid 布局
- `.slide-copy` / `.plan-title` / `.plan-deck` 等标题系统
- `.content-surface` / `.detail-focus` / `.fallback-panel` 等面板样式
- `.plan-card` / `.context-card` / `.timeline-item`（模板版）等卡片样式
- `.support-panel` / `.subtitle-panel` / `.insight-panel` 等辅助面板
- `.signal-strip` / `.signal-chip` 信号展示
- `.meta-chip` / `.tag-chip` / `.eyebrow` 标签系统
- `.flow-grid` / `.card-grid` / `.context-grid` / `.timeline-stack` 等内容网格
- 所有 `min-height`、`align-content: start` 等模板专用布局约束

### 11.3 新增（极少量）

- 基础 SVG 动画工具类（可选）：`@keyframes drawPath`、`@keyframes fadeIn`
- 基础动画延迟工具类（可选）：`[data-delay="1"]` 等

## 12. render-presentation.js 的新角色

从"HTML 渲染器"改为"planner 上下文输出工具"：

```
输入：Markdown 文件
输出：JSON 文件，包含 parsedResult + presentationPlan

用法：node render-presentation.js input.md --plan-output context.json
```

AI 创作时可以参考这个 JSON 来理解 planner 的编排决策，但 HTML 由 AI 直接手写。

保留 `renderPresentation()` 函数签名以兼容可能的旧调用，但标记为 deprecated。

## 13. frontend-design/SKILL.md 补充

在现有美学指南基础上，新增一段 SVG 动画创作美学：

- **路径动画** — 用 `stroke-dasharray` / `stroke-dashoffset` 做绘制效果，比突然出现更有叙事感
- **时序编排** — 元素出现顺序即讲解顺序，用 `animation-delay` 做 stagger，间隔 200-400ms
- **色彩语义** — 颜色不是装饰，是信息：蓝 = 正常/起点、橙 = 警告/过渡、红 = 错误/终点
- **留白即节奏** — 空白区域是"停顿"，和动画一样重要
- **简洁优先** — SVG 元素尽量用基础图形（circle、rect、path、line），避免复杂嵌套

## 14. 验收标准

用现有 `demo/demo-script.md`（4 个场景）重新生成 HTML 后：

1. **每页有一个明确的 SVG/CSS 动画作为视觉重心** — 不是卡片网格，不是面板堆砌
2. **标注融入图形** — 关键文字贴在 SVG 元素旁边，不是另开侧栏
3. **4 个场景的视觉表达各不相同** — cover 是大留白 + 标题动画，timeline 是路径绘制，metric 是数字滚动，quote 是逐行淡入
4. **页面大部分是留白 + 动画区** — 信息密度靠"逐步揭示"而不是"一次堆完"
5. **没有任何 dashboard 元素** — 无 signal strip、无 meta chip、无 support panel、无 card grid
6. **时间轴自动播放仍然正常** — step 调度、highlight/dim、页面切换都能 work
7. **录屏时，观众能看出"这页在讲什么"** — 有明确的视觉焦点和阅读路径

## 15. 实施建议

### 推荐顺序

1. **先精简 `slide-base.html`** — 砍掉面板系统，保留纯骨架 + 时间轴引擎
2. **再重写 `SKILL.md`** — 这是核心交付物，决定 AI 怎么创作
3. **再改 `render-presentation.js`** — 简化为上下文输出工具
4. **再补 `frontend-design/SKILL.md`** — 增加 SVG 动画美学段落
5. **最后用新 skill 重新生成 demo** — 验证新方向是否 work

### 风险

- AI 写 SVG 动画质量可能波动 → 通过 skill 中的示例和反模式清单来约束
- 复杂动画可能有渲染 bug → `html-layout-review` 仍然作为验收兜底
- 首版可能不完美 → 先验证方向对不对，再迭代质量

## 16. 一句话结论

**把 `markdown-to-html` 从"JS 拼面板模板"转变为"AI 在 skill 指导下逐页创作 SVG/CSS 动画讲解页"，planner 继续做编排决策，renderer 退居为上下文输出工具，slide-base 精简为纯骨架。每页只讲一个概念，用动画可视化，用内联标注解释，用数据锚点强化记忆。**
