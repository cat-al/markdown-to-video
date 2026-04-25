# Presentation Planner 阶段 2 implementation checklist

**日期**: 2026-04-25
**状态**: 已完成（2026-04-25）
**对应主文档**: `2026-04-24-presentation-planner-design.md`
**目标阶段**: A 的能力补强
**适用范围**: `markdown-to-html`

## 1. 这份文档的作用

主设计稿已经明确了 `阶段 2` 的方向，但目前仍停留在四条高层目标：

- 更细的字幕切片逻辑
- 更稳定的复杂度判断
- 更好的布局意图与页面变体映射
- 对普通场景的回退策略

这份文档的目标，是把这四条拆成**可直接开工的 implementation checklist**，并且明确：

- 先改哪些文件
- 每一块要补什么能力
- 哪些属于必做，哪些属于可选增强
- 做到什么程度算阶段 2 可验收

## 2. 当前代码基线

当前仓库已经具备阶段 1 的最小闭环：

`Markdown -> parse-markdown -> build-presentation-plan -> render-presentation -> slide-base timeline`

当前关键文件职责如下：

- `scripts/parse-markdown.js`
  - 负责解析 Markdown，输出 `meta + scenes + pageConfig + layoutHints`
- `scripts/build-presentation-plan.js`
  - 负责从 `scene[]` 生成 `presentationPlan`
  - 已具备 `flowchart` / `timeline` / `keypoints` 的首版 planner 规则
- `scripts/render-presentation.js`
  - 负责把 `scenePlan[]` 渲染成最终 HTML slide
- `templates/slide-base.html`
  - 负责自动播放、`step[]` 调度、聚焦动作执行

当前主要短板：

- `splitSubtitles()` 仍是偏均分的切片逻辑
- 复杂度判断仍主要依赖节点数 / 层级数 / 字数阈值
- `layoutIntent` 已存在，但 renderer 对其消费还比较浅
- fallback 只是“保底单页”，还不是完整的普通场景策略

## 3. 阶段 2 的总目标

阶段 2 不再解决“有没有 planner”，而是解决：

1. planner 的决策是否**更像人类讲解节奏**
2. planner 输出的结构是否能被 renderer **更准确地映射为页面变体**
3. 非重点场景是否能有**更自然的退化路径**

一句话说，阶段 2 的重点是：

> 在不推翻阶段 1 架构的前提下，把现有 planner 从“能跑”升级为“更稳、更准、更像讲解”。

## 4. 本阶段建议的实施策略

### 4.1 推荐做法

推荐采用：**planner 优先补强，renderer 跟进收口**。

也就是先把：

- 字幕切片
- 复杂度判断
- 策略判定信号

这些逻辑在 `build-presentation-plan.js` 内先整理清楚，再让 `render-presentation.js` 和 `slide-base.html` 去消费更明确的 `layoutIntent`、`renderData` 和 `step[]`。

### 4.2 不推荐做法

本阶段不建议：

- 一上来继续加很多新模板，但不先补 planner 信号
- 把复杂判断继续散落在 `planFlowchartScene()` / `planTimelineScene()` / `planKeypointsScene()` 内部
- 通过硬编码 detail 页数量来“伪装成智能编排”

## 5. 工作流拆分

阶段 2 建议拆成 4 个主工作流，按顺序推进。

---

## 6. 工作流 1：字幕切片补强

### 6.1 目标

把当前偏平均分配的 `splitSubtitles()` 升级为**基于结构和讲解目标的切片逻辑**。

### 6.2 当前问题

当前逻辑的核心问题是：

- overview 默认拿前 1~2 句
- detail 页再均分剩余字幕
- 没有利用场景结构信息
- 没有利用字幕是否在逐点解释某个节点/阶段/要点

这会导致：

- overview 页字幕有时太短，只像开场语
- detail 页字幕可能拿到不属于该 detail 的句子
- `focus-item` 的时间推进与字幕内容不够对齐

### 6.3 必做项

#### A. 引入字幕分析层

在 `scripts/build-presentation-plan.js` 内新增独立辅助函数，建议至少包括：

- `normalizeSubtitleLine(line)`
- `analyzeSubtitleLines(subtitles)`
- `detectSubtitleFocusCandidates(subtitles, items)`
- `buildSubtitlePlan(...)`

建议职责：

- 判断字幕是偏概述还是偏逐项解释
- 判断字幕是否存在“第一句总述，后续逐条展开”的结构
- 判断字幕与节点 / 阶段 / 要点是否存在弱匹配关系

#### B. 用“讲解结构”替换“平均切分”

将当前：

- `splitSubtitles(subtitles, segmentCount)`

升级为更明确的两层：

- 基础切片：概述段 / 展开段 / detail 段
- 页面对齐：为每个 `scenePlan` 分配更合适的字幕片段

建议优先支持以下规则：

- **overview 页**优先拿“总述 + 第一层导语”
- **in-page focus** 的步骤尽量对应逐项解释句
- **detail 页**优先拿与当前 `focusTarget` 更接近的句子
- 若无法识别语义对应，再回退到数量切分

#### C. 让 subtitleSlice 与 step 对齐

至少做到：

- `subtitleSlice.lines.length` 与 `focusItems.length` 不再完全脱钩
- 若一个 overview 页内有 3 个 focus step，则字幕切片应尽量也能覆盖这 3 个推进点

### 6.4 可选增强

- 为字幕句子打标签，例如：`summary` / `item-explainer` / `transition`
- 给 `step` 增加 `subtitleIndexRange` 或同类字段，供未来字幕驱动时间轴使用

### 6.5 涉及文件

- 必改：`scripts/build-presentation-plan.js`
- 可选：`scripts/render-presentation.js`

### 6.6 验收标准

- 同一场景拆成 overview/detail 时，字幕分配明显更合理
- overview 页不再只机械拿前两句
- detail 页字幕大多数情况下能和 `focusTarget` 对上
- 识别失败时仍能平稳退回基础切片

---

## 7. 工作流 2：复杂度判断补强

### 7.1 目标

把当前“单一阈值规则”升级为**多信号打分**，减少误判。

### 7.2 当前问题

现在的判断主要类似：

- `nodeCount >= 6`
- `branchCount >= 2`
- `itemCount >= 5`
- `maxDescLength >= 18`

问题在于：

- 只看结构，不看字幕意图
- 只看数量，不看单页承载质量
- 只看某一个元素，不看场景整体密度

### 7.3 必做项

#### A. 新增统一的 planning signals 层

建议新增一个统一函数，例如：

- `buildPlanningSignals(scene, contentType, analysis)`

至少输出：

- `structureComplexity`
- `subtitleGuidanceStrength`
- `hasClearSequence`
- `singlePagePressure`
- `detailWorthiness`
- `fallbackConfidence`

#### B. 每种元素类型改成“评分 + 规则”而不是“直接阈值”

##### `flowchart`

建议信号：

- 节点数
- 分支数
- 主链长度
- 是否有明显汇聚/发散
- 字幕是否逐节点解释

##### `timeline`

建议信号：

- 阶段数
- 层级深度
- 是否存在多个子树
- 是否有某个 top-level stage 特别重
- 字幕是否按阶段推进

##### `keypoints`

建议信号：

- 要点数
- 平均说明长度
- 最大说明长度
- 头部要点是否显著比其他点更重
- 字幕是否逐条对应要点

#### C. 明确决策中间态

建议不要直接产出：

- 是否 detail
- 是否 focus

而是先产出中间态：

- `overviewOnlyCandidate`
- `focusCandidate`
- `detailCandidate`

再由统一决策函数汇总为：

- `overview-only`
- `overview + in-page focus`
- `overview + detail`
- `overview + in-page focus + detail`

### 7.4 可选增强

- 补一个 `explainPlanningDecision(scene)` 调试输出，用于观察为什么 planner 做出当前决策
- 在 demo 中嵌入这些 signals，帮助调试阈值

### 7.5 涉及文件

- 必改：`scripts/build-presentation-plan.js`
- 可选：`demo/*.html` 生成过程

### 7.6 验收标准

- 相近结构的场景不会因为单一阈值抖动而频繁切换策略
- planner 决策能同时考虑结构复杂度和字幕意图
- 三类核心元素都能输出更稳定的 `overview/focus/detail` 组合

---

## 8. 工作流 3：布局意图与页面变体映射补强

### 8.1 目标

让 `layoutIntent` 不只是标签，而是变成 renderer 真正消费的页面变体入口。

### 8.2 当前问题

当前虽然已有：

- `overview-map-with-focus`
- `timeline-overview-with-focus`
- `keypoints-overview-with-focus`
- `detail-breakdown`
- `timeline-detail-breakdown`
- `fallback-single-slide`

但 renderer 侧仍主要是：

- 3 个 overview 渲染函数
- 1 个通用 detail 渲染函数
- 1 个 fallback 渲染函数

也就是说，`layoutIntent` 和“具体页面结构差异”之间的绑定还不够强。

### 8.3 必做项

#### A. 先整理 layoutIntent 枚举

建议先把当前 intent 收敛成一组稳定的语义枚举，例如：

- `flow-overview`
- `flow-overview-focus`
- `flow-detail-node`
- `timeline-overview`
- `timeline-overview-focus`
- `timeline-detail-stage`
- `keypoints-overview`
- `keypoints-overview-focus`
- `keypoints-detail-item`
- `fallback-summary`
- `fallback-visual-first`

#### B. renderer 按 intent 分派，而不是只按 `contentType + mode`

建议将当前 `renderPlanBody(plan, scene)` 的路由逻辑升级为：

- 先看 `layoutIntent`
- 再看 `contentType`
- 最后回退到 fallback

#### C. 让 detail 页面有类型差异

至少补出以下差异：

- `flowchart detail`：更强调“主节点 + 上下文链路”
- `timeline detail`：更强调“阶段 + 子层级展开”
- `keypoints detail`：更强调“重点项 + 解释文案”

#### D. step 动作表达补一层

虽然本阶段不做复杂动画系统，但建议 planner 至少允许组合输出：

- `highlight`
- `dim-others`
- `focus-item`
- 必要时的 `reveal`

不是所有聚焦都只落成一个 `focus-item`。

### 8.4 可选增强

- 增加 `renderData.variantHints`
- 在 slide 上透出更细粒度 data 属性，方便调试布局分支

### 8.5 涉及文件

- 必改：`scripts/build-presentation-plan.js`
- 必改：`scripts/render-presentation.js`
- 可选：`templates/slide-base.html`

### 8.6 验收标准

- `layoutIntent` 能稳定驱动不同 DOM 结构
- 三类内容的 detail 页视觉结构不再完全共用同一个模板
- `step[]` 不再只产出单一 `focus-item`

---

## 9. 工作流 4：普通场景 fallback 策略补强

### 9.1 目标

把当前“单页保底”升级为“有策略的普通场景回退”。

### 9.2 当前问题

当前 fallback 的语义基本是：

- 未进入 planner 多页编排
- 保留主视觉与简单摘要

这虽然能保底，但不够自然：

- 无法区分“纯叙述场景”和“结构混合但不适合展开的场景”
- 没有利用已有 `pageConfig` / `layoutHints`
- fallback 页面表达力偏弱

### 9.3 必做项

#### A. 区分 fallback 类型

建议至少拆成两种：

- `fallback-summary`
  - 适合纯叙述、结论、低结构场景
- `fallback-visual-first`
  - 适合有明显视觉描述，但结构化元素不足以进入 planner 的场景

#### B. planner 输出 fallback reason

建议在 `scenePlan` 或 `renderData` 中补：

- `fallbackReason`
- `fallbackKind`

方便后续调试与页面差异化。

#### C. fallback 也要继续消费 `pageConfig` / `layoutHints`

至少要做到：

- 标题层级遵守当前 scene 的 pageConfig
- 版式不要完全忽略已有 sceneRole / sceneVariant 倾向

### 9.4 可选增强

- 对 `quote` / `code` / `table` 等非首批 planner 类型做轻量增强回退
- 给 fallback 补一层“结构摘要卡片”而不是只输出文本描述

### 9.5 涉及文件

- 必改：`scripts/build-presentation-plan.js`
- 必改：`scripts/render-presentation.js`

### 9.6 验收标准

- 普通场景回退页面不再显得像“planner 未命中”
- fallback 行为可以被解释、被调试、被区分
- 非 T1/T2/T3 场景的视觉质量相比阶段 1 有明显提升

---

## 10. 建议的开发顺序

建议严格按下面顺序推进：

1. **先收敛 planner 内部信号层**
   - 先整理字幕分析和复杂度 signals
2. **再重写 subtitle slicing 的分配逻辑**
   - 让 `scenePlan.subtitleSlice` 更可信
3. **再改三类 planner 的决策出口**
   - 让 `layoutIntent` / `focusTarget` / `detailCandidates` 更稳定
4. **再补 renderer 的 intent 路由与 detail 差异**
   - 把 planner 输出真正用起来
5. **最后补 fallback 策略与 demo 验收**
   - 收尾整体体验

## 11. 建议的代码改动清单

### 必改文件

- `markdown-to-html/scripts/build-presentation-plan.js`
- `markdown-to-html/scripts/render-presentation.js`

### 可能改动文件

- `markdown-to-html/templates/slide-base.html`
- `markdown-to-html/scripts/parse-markdown.js`
  - 仅在确有必要时补稳定基础信号，不把编排决策塞进去

### 建议新增但非必须

- `demo/` 下新增一个阶段 2 专用 demo 输入或输出样例
- `docs/` 下补一份阶段 2 完成后的策略说明或经验记录

## 12. 建议的里程碑

### M1：planner signals 落地

完成后应看到：

- 存在统一的字幕分析 / 复杂度分析 / 决策信号层
- 三类 planner 不再直接散落硬阈值判断

### M2：subtitle slicing 升级

完成后应看到：

- `subtitleSlice` 与 `focusTarget` / `focusItems` 的对应关系更强
- detail 页字幕更合理

### M3：intent -> variant 映射升级

完成后应看到：

- renderer 能按 `layoutIntent` 区分 overview/detail 细分页面
- detail 页不再基本共用一个模板

### M4：fallback 收口

完成后应看到：

- fallback 具备多种策略
- 非重点场景体验明显更自然

## 13. 阶段 2 的验收标准

阶段 2 完成时，至少应满足：

- 字幕切片不再是机械均分，而是体现讲解结构
- `flowchart` / `timeline` / `keypoints` 的策略判定比阶段 1 更稳定
- `layoutIntent` 不再只是标记，而能真实驱动页面变体
- 普通场景 fallback 不再只是“单页保底”，而是具备最小策略分层
- 不破坏阶段 1 已经打通的 `parse -> plan -> render -> timeline` 闭环

## 14. 开工建议

如果直接进入实现，建议从下面这个顺序开始：

1. 先改 `build-presentation-plan.js`
   - 把字幕分析、复杂度判断抽成独立 helper
2. 先完成 `M1 + M2`
   - 这是阶段 2 最能提升决策质量的部分
3. 再改 `render-presentation.js`
   - 把新的 `layoutIntent` 消费掉
4. 最后收口 fallback 和 demo

也就是说，**第一刀应落在 planner，而不是模板。**
