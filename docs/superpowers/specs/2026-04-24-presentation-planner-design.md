# Markdown-to-Video 演讲编排层设计文档

**日期**: 2026-04-24
**状态**: 已批准（设计阶段）
**范围**: `markdown-scriptwriter` 与 `markdown-to-html` 的上下游协作设计，当前实现阶段优先解决 A（信息密度不足）

## 1. 背景

当前仓库已经具备一条基础链路：

1. `markdown-scriptwriter` 负责把内容构思转成标准格式 Markdown
2. `markdown-to-html` 负责把标准格式 Markdown 解析成 16:9 HTML 幻灯片

现状的问题不是“页面不好看”，而是**内容的表达层级还不够丰富**。虽然上游已经可以输出 `flowchart`、`timeline`、`keypoints` 等结构化元素，但下游仍然更接近“一个场景对应一页”的静态映射，因此会出现：

- 单页信息密度低
- 复杂结构只能平铺展示，缺少“总览 → 聚焦 → 细节”的讲解节奏
- 页面更像说明页，而不是适合录屏的演讲页

与此同时，后续还明确有两类重要能力需要纳入整体设计：

- **B：截图/页面素材接入**
- **C：矢量动画接入**

因此，这次设计的目标不是只做一个小优化，而是先为整条链路补上一个**演讲编排层（presentation planner）**，优先解决 A，并给 B/C 留出扩展接口。

## 2. 本次确认的产品决策

本轮 brainstorming 已确认以下方向：

### 2.1 总目标

先写设计文档沉淀目标和路线，后续再按阶段实现，避免上下文丢失和返工。

### 2.2 当前优先级

- **本轮优先解决 A：信息密度不足**
- B（截图）和 C（矢量动画）本轮不实现，但必须在设计上预留扩展位

### 2.3 A 的目标形态

用户选择的是：

- **A4**：总览页 + 局部展开 + 细节页并存
- **P1**：录屏 / 自动播放优先
- **E4**：按内容类型自动决定是同页聚焦还是切细节页
- **S2**：尽量由 `markdown-to-html` 自动推断，不增加上游显式写作负担

### 2.4 优先支持的内容类型

首批最值得触发“总览 + 展开/细节”能力的元素类型：

- **T1**：`flowchart`
- **T2**：`timeline`
- **T3**：`keypoints`

## 3. 设计目标

### 3.1 本轮核心目标

让同一份标准 Markdown，在**不要求大幅改写上游格式**的前提下，能够在下游自动编排成更适合录屏和讲解的视频页面结构。

换句话说，本轮希望达成的是：

> 同一份内容材料，不再只生成“静态单页”，而是能自动生成“总览态、聚焦态、细节态”组成的讲解节奏。

### 3.2 设计目标细化

本轮设计需要满足：

- 尽量不增加 `markdown-scriptwriter` 的写作负担
- 不破坏现有标准 Markdown 契约
- 把复杂内容从“堆在一页”升级为“按播放节奏展开”
- 与现有 `pageConfig` / `layoutHints` 兼容，而不是推翻重来
- 为截图素材和矢量动画的后续接入预留资源扩展位

## 4. 非目标

以下内容明确不属于本轮 A 的首批实现范围：

- 让所有元素类型都具备完整展开能力
- 本轮正式接入截图资源、图片裁切、截图高亮
- 本轮正式接入 SVG / Lottie / 参数化动画
- 为上游增加大量新的强制标注语法
- 追求复杂人工覆写配置来替代自动推断

## 5. 现有链路与问题定位

### 5.1 现有链路

当前链路本质上是：

`Markdown -> scene JSON -> HTML slide`

其中：

- `markdown-scriptwriter` 已定义了标准场景格式
- `markdown-to-html/scripts/parse-markdown.js` 已可输出：
  - `meta`
  - `scenes`
  - `pageConfigOverrides`
  - `pageConfig`
  - `layoutHints`
- `markdown-to-html/templates/slide-base.html` 已具备：
  - 16:9 幻灯片骨架
  - `data-duration`
  - `data-enter-at`
  - `window.timelineConfig`
  - 自动播放逻辑

### 5.2 当前问题

当前解析器和模板已经有“结构”和“时间轴”的基础，但仍缺少一层真正负责“讲解编排”的中间模型。因此：

- 一个场景通常只对应一页
- 复杂流程图、层级图、概念拆解无法被自然拆开讲
- 页面虽然能渐进 reveal，但 reveal 仍然偏“元素出现”，而不是“叙事结构推进”

因此，本轮问题的根本不是单纯的视觉样式问题，而是：

> 缺少从内容结构到演讲结构的自动编排层。

## 6. 总体方案

本轮采用的主方案为：

**方案 2：下游自动推断 + 轻量中间模型**

即在 `markdown-to-html` 中把当前的“解析后直接渲染”升级为三层架构：

1. **解析层**：把标准 Markdown 解析为 `scene`
2. **编排层**：根据元素类型、结构复杂度、字幕节奏，自动生成 `presentationPlan`
3. **渲染层**：基于 `presentationPlan` 输出 HTML 页面和时间轴配置

### 6.1 为什么不直接改上游

本轮明确选择 `S2`，因此应优先通过下游推断解决问题，而不是要求上游显式写出“这是一页总览、这是一页细节”。

这样做的好处：

- 保持 `markdown-scriptwriter` 的职责单纯
- 已有文稿可以直接受益
- 后续若确有必要，再增加少量可选覆写，而不是一开始就把契约复杂化

### 6.2 为什么不只靠更多版式

如果只新增 HTML 版式，而不新增中间层，那么页面只是“看起来更满”，但无法真正做到：

- 自动切出总览页
- 自动高亮某个节点
- 自动进入对应细节页

因此，本轮最关键的升级不是视觉模板，而是**从 `scene` 到 `scenePlan` 的结构升级**。

## 7. 新增的中间模型

### 7.1 核心思想

当前的 `scene` 更像“内容材料”，但不是“播放计划”。

为了解决 A，需要引入新的中间层：

- **`presentationPlan`**：整篇视频的编排计划
- **`scenePlan`**：某个原始场景被拆分后的播放单元
- **`step`**：某个播放单元内部的时间推进步骤

### 7.2 建议的数据职责

#### `presentationPlan`

负责整篇视频的播放编排结果，包含：

- 视频元信息
- 所有 `scenePlan`
- 页面总顺序
- 全局默认时间配置
- 后续可扩展的资源注册表

#### `scenePlan`

`scenePlan` 在本设计中**统一定义为页级对象**，也就是“最终会变成一个 HTML slide 的页面计划单元”。

它可能是：

- 原始场景的总览页
- 某个模块的细节页
- 某个模块的补充说明页

这里特别约定：

- **“同页聚焦”不默认生成新的 `scenePlan` 页面**
- **同页聚焦属于当前页内部的 `step[]` 行为**，例如高亮某个节点、弱化其余节点、镜头聚焦某个区域
- 只有当内容复杂度超过单页可承载范围时，编排器才额外生成新的 `detail` 页级 `scenePlan`

因此，A4 / E4 中的“局部展开”在模型里分成两种：

- **页内局部展开**：落在 `scenePlan.step[]`
- **跨页细节展开**：落在新的 `scenePlan(mode=detail)`

建议至少包含：

- `baseSceneId`：来自哪个原始场景
- `planId`：当前页面计划单元的唯一标识
- `mode`：`overview` / `detail`
- `derivedFrom`：来自哪个上级计划单元或哪个模块
- `focusTarget`：当前页主要聚焦的节点、模块或要点；若为纯总览页则可为空
- `layoutIntent`：页面的布局意图，例如 `overview-map`、`node-focus`、`detail-breakdown`
- `subtitleSlice`：当前页面使用哪几句字幕
- `step[]`：当前页面内部的自动播放步骤
- `assetSlots`：未来用于截图、动画等资源挂载的扩展位
- `pageOrder`：当前页面在最终播放序列中的顺序
- `pageDuration`：当前页面的总时长

#### `step`

代表一个自动播放步骤，供时间轴执行。它不是“用户交互步骤”，而是自动播放中的视觉状态变化。

建议包含：

- `enterAt`
- `duration`
- `actionType`：例如 `reveal`、`highlight`、`dim-others`、`zoom-to-node`、`switch-detail`
- `target`
- `payload`

## 8. 自动推断规则

本轮设计要求默认自动推断，而不是依赖上游显式标注。推断规则应分三层。

### 8.1 第一层：内容识别

从 `scene` 中识别：

- 主元素类型是什么
- 是否存在多个元素组合
- 字幕数量和信息密度
- 是否存在天然层级结构或讲解顺序
- 当前内容是否超出单页舒适承载范围

### 8.2 第二层：讲解意图推断

根据内容结构判断当前场景更像：

- 需要先给整体地图
- 需要逐节点解释
- 需要拆出独立细节页
- 只适合停留在单页内逐步 reveal

### 8.3 第三层：展开策略决定

最终给每个场景决定一种展开策略：

- 仅总览
- 总览 + 同页聚焦
- 总览 + 细节页
- 总览 + 同页聚焦 + 细节页

这里明确约定：

- **同页聚焦**：不新增页面，而是在当前 `scenePlan` 内通过 `step[]` 完成高亮、弱化、缩放或镜头聚焦
- **细节页**：新增一个或多个 `scenePlan(mode=detail)`，用于承载单页放不下或需要单独讲解的内容

因此，E4 的“按内容类型自动决定是同页聚焦还是切细节页”，在实现上就是：

- 先决定该场景是否只需要总览
- 若需要展开，再决定是优先使用页内 `step` 聚焦，还是额外生成 `detail` 页
- 在复杂度更高时，两者可以同时存在，但顺序固定为“总览页 -> 同页聚焦 -> 细节页”

## 9. 首批元素类型的默认编排策略

### 9.1 `flowchart`

适合表达流程、因果链、路径推进。

建议默认策略：

- 先生成一个**总览页**，展示整体流程图
- 若节点数量不多、主链清晰、分支较少，则优先在总览页内做逐节点**同页聚焦**
- 若分支复杂、节点过多，或单页聚焦后仍然难以读清，则在同页聚焦之后再自动切出**细节页**

最小可执行规则：

- **仅总览**：节点少，字幕也不是逐节点解释
- **总览 + 同页聚焦**：节点存在讲解顺序，但单页仍能清晰承载
- **总览 + 同页聚焦 + 细节页**：分支复杂、字幕明显在拆解某个节点或某条支路，且单页承载开始吃紧

### 9.2 `timeline`

适合表达阶段递进、步骤树、树状讲解。

建议默认策略：

- 先生成一个**全局阶段图**作为总览页
- 若层级较浅，则按阶段或层级在同一页内做逐步**聚焦**
- 若某一阶段下有明显子层级，或树状结构已经超出单页舒适区，则自动切出对应**细节页**

这是本轮最接近“树形展开讲解”的优先载体。

最小可执行规则：

- **仅总览**：阶段少、层级浅、字幕偏概述
- **总览 + 同页聚焦**：阶段有顺序，字幕在逐步解释阶段，但层级仍不深
- **总览 + 同页聚焦 + 细节页**：存在明显子树或二级/三级结构，字幕需要对某一阶段继续下钻说明

### 9.3 `keypoints`

适合概念拆解、模块讲解、观点分层。

建议默认策略：

- 先生成一个**概念总览页**
- 若只有少量短点，则在同页中逐条高亮即可
- 若要点数量多，或每个点本身又有较强解释密度，则自动生成**每点一页**或部分细节页

最小可执行规则：

- **仅总览**：要点数量少，且每点只有一句短说明
- **总览 + 同页聚焦**：要点数量适中，字幕是在逐条解释这些要点
- **总览 + 细节页**：某个要点本身承载了较多解释内容，或该要点需要单独形成一页讲解

## 10. 触发“自动展开”的判断条件

为了避免所有场景都被拆碎，本轮建议只在满足以下条件时触发展开：

- **结构复杂度高**
  - 如 `flowchart` 节点较多、`timeline` 层级较深、`keypoints` 项数较多
- **字幕与结构存在明确一一对应关系**
  - 字幕是在解释节点、阶段或模块，而不是纯情绪化旁白
- **信息密度超出单页舒适区**
  - 单页展示会压缩主内容或降低录屏可读性
- **存在天然讲解顺序**
  - 如从左到右、从上到下、从总到分

## 11. 渲染与时间轴协作方式

### 11.1 渲染入口改变

未来渲染层不再直接从 `scene[]` 输出 HTML，而应改为：

`scene[] -> presentationPlan -> HTML slides`

这意味着一个原始场景，后续可能被渲染成多个最终页面：

- 1 个总览页
- 0~N 个带页内聚焦步骤的总览页
- 0~N 个细节页

这里再次明确边界：

- `scenePlan` = 页级对象
- `step` = 页内时间推进对象
- “同页聚焦”发生在 `step` 层，不单独记为默认新页
- 只有“需要切出独立讲解页”的情况，才会新增 `scenePlan(mode=detail)`

### 11.2 时间轴职责

时间轴引擎只负责一件事：**按编排器已经决定好的步骤自动推进**。

也就是说：

- **编排器**决定“播什么”
- **时间轴**决定“什么时候播”

这样可以保持职责清晰，也方便未来把截图、SVG 动画等资源纳入统一时间轴。

### 11.3 自动播放优先

本轮已经确认以 `P1` 为主，因此渲染结果应优先服务：

- 自动录屏
- 自动推进
- 连续观看

而不是优先服务现场点击交互。

交互可以保留为辅助能力，但不能成为结构成立的前提。

## 12. 对现有上下游职责的影响

### 12.1 `markdown-scriptwriter`

本轮不要求其大幅改动。

它继续负责：

- 内容主旨
- 场景结构
- 视觉元素内容
- 字幕节奏

本轮原则是：

> 尽量不要求上游增加额外显式标注，优先让下游自动读懂现有结构。

### 12.2 `markdown-to-html`

将从“解析器 + 模板”升级为：

- 解析器
- 演讲编排器
- HTML 渲染器
- 时间轴执行器

这也是本轮 A 的真正落点。

## 13. 与现有 `pageConfig` / `layoutHints` 的关系

本轮不建议推翻当前已经存在的：

- `pageConfigOverrides`
- `pageConfig`
- `layoutHints`

而应把它们继续作为**渲染层输入的一部分**使用。

更合适的关系是：

- `scene` 表达内容材料
- `layoutHints` 表达布局倾向
- `scenePlan` 表达讲解编排结果
- 最终 HTML 同时综合 `scenePlan + pageConfig + layoutHints`

这样可以最大程度复用现有规则，而不是把现有工作全部作废。

## 14. 为 B / C 预留的扩展位

虽然本轮只正式做 A，但演讲编排层必须留出后续扩展空间。

### 14.1 B：截图素材接入

后续需要支持：

- 截图占位
- 实际截图资源
- 局部截图 / 裁切图
- 截图说明与聚焦区域

因此建议在 `scenePlan` 中预留 `assetSlots` 或同类字段，用于挂载：

- 图片来源
- 展示方式
- 聚焦目标
- 与时间轴的同步关系

### 14.2 C：矢量动画接入

后续需要支持：

- SVG
- Lottie
- 参数化矢量图形
- 时间轴驱动的播放、暂停、切换

因此本轮设计中的 `step` 与 `assetSlots` 不应只面向文本和普通 DOM，还要允许未来挂接动画资源。

## 15. 分阶段实施建议

### 阶段 0：设计沉淀（本次）

- 写出本设计文档
- 明确 A/B/C 的总路线
- 明确本轮只实现 A

### 阶段 1：A 的最小落地

仅针对以下元素：

- `flowchart`
- `timeline`
- `keypoints`

实现：

- 总览页生成
- 同页聚焦步骤生成
- 必要时细节页生成
- 自动播放时间轴对接
- 对 T1/T2/T3 至少具备一版可执行的自动决策逻辑，而不是固定模板扩页

### 阶段 2：A 的能力补强

继续补：

- 更细的字幕切片逻辑
- 更稳定的复杂度判断
- 更好的布局意图与页面变体映射
- 对普通场景的回退策略

阶段 2 的更具体实施清单，见：`2026-04-25-presentation-planner-phase2-implementation-checklist.md`

### 阶段 3：B 接入

新增截图元素与资源能力。

### 阶段 4：C 接入

新增 SVG / Lottie / 参数化动画接入。

## 16. 本轮 A 的成功标准

如果阶段 1 完成后，能够满足以下条件，就算本轮设计目标达成：

- 同一份 Markdown，不改上游写法，也能自动生成更多讲解阶段
- `flowchart` / `timeline` / `keypoints` 不再只是静态单页展示
- 页面会自然经历“总览 -> 同页聚焦 -> 细节页”的播放节奏（并允许按规则退化为“仅总览”或“总览 + 同页聚焦”）
- 对 T1/T2/T3 已存在最小自动决策规则，而不是无条件扩成固定多页模板
- 不会破坏现有普通场景的基础渲染能力
- 架构上已经为截图和矢量动画预留扩展位

## 17. 一句话结论

本轮最值得做的，不是继续往单页里塞更多信息，而是：

**在 `markdown-to-html` 内新增一个“演讲编排层”，让 `flowchart`、`timeline`、`keypoints` 自动从静态场景升级为适合录屏的多阶段讲解结构。**

## 18. 阶段 1：A 的 implementation checklist

这一阶段不要追求“大而全”，而是先做出一条**最小但闭环**的链路：

`Markdown -> scene[] -> presentationPlan -> HTML slides -> auto-play timeline`

### 18.1 本阶段的最小交付物

完成后，系统至少应具备以下能力：

- 输入仍然是现有标准 Markdown，不要求上游改写
- 对 `flowchart` / `timeline` / `keypoints` 生成一版可执行的 `presentationPlan`
- 每个可编排场景至少支持以下三种结果之一：
  - `overview-only`
  - `overview + in-page focus`
  - `overview + in-page focus + detail page`
- 渲染层从“直接消费 `scene[]`”升级为“优先消费 `scenePlan[]`”
- 自动播放时间轴能够消费 `step[]`，而不是只靠静态 `data-enter-at`
- 对非 T1/T2/T3 场景保留现有单页回退能力，不破坏基础渲染

### 18.2 文件级实施拆分

建议按下面的文件边界推进，而不是把所有逻辑继续堆进解析器。

#### A. 保持 `scripts/parse-markdown.js` 为“解析层”

本阶段对它的要求是：

- 保持现有 `meta + scenes + pageConfig + layoutHints` 契约稳定
- 不把“讲解编排决策”直接塞进解析器
- 如确有需要，只补充**稳定的、与编排无关的基础信息**，例如更清晰的元素统计或结构提示

也就是说：

- `parse-markdown.js` 负责“读懂 Markdown”
- 但不负责“决定要拆成几页、先讲什么后讲什么”

#### B. 新增 `scripts/build-presentation-plan.js`

这是阶段 1 的核心新增文件，建议职责如下：

- 输入：`parse-markdown.js` 的输出结果
- 输出：`presentationPlan`
- 对每个场景决定：
  - 是否进入编排层
  - 生成几个 `scenePlan`
  - 每个 `scenePlan` 的 `mode`
  - 每个页面内部有哪些 `step[]`

建议先导出如下能力：

- `buildPresentationPlan(parsedResult)`
- `planScene(scene)`
- `planFlowchartScene(scene)`
- `planTimelineScene(scene)`
- `planKeypointsScene(scene)`
- `buildFallbackScenePlan(scene)`

建议该文件输出的最小结构至少包括：

- `presentationPlan.meta`
- `presentationPlan.scenePlans[]`
- `scenePlan.planId`
- `scenePlan.baseSceneId`
- `scenePlan.mode`
- `scenePlan.layoutIntent`
- `scenePlan.focusTarget`
- `scenePlan.subtitleSlice`
- `scenePlan.steps[]`
- `scenePlan.pageDuration`
- `scenePlan.pageOrder`
- `scenePlan.assetSlots`（本轮先为空数组或空对象即可）

#### C. 新增 `scripts/render-presentation.js`

当前仓库里还没有一个明确的“从结构化数据产出最终 HTML”的渲染入口，因此阶段 1 建议补一个独立渲染脚本。

建议职责：

- 输入：`presentationPlan + scenes + pageConfig + layoutHints`
- 输出：最终 HTML 字符串
- 负责把：
  - `scenePlan` 映射为最终 slide
  - `step[]` 映射为时间轴配置
  - `overview/detail` 页映射为不同的 DOM 结构与 data 属性

建议先不要把模板拼装、策略判断、HTML 细节全部糊在一个文件里；至少保持：

- planner 决定讲解结构
- renderer 决定页面结构

#### D. 修改 `templates/slide-base.html`

阶段 1 对模板的最小修改目标：

- 支持渲染多个由同一 `baseSceneId` 派生出来的 slide
- slide 上增加对编排层友好的标记，例如：
  - `data-plan-id`
  - `data-base-scene`
  - `data-mode="overview|detail"`
  - `data-layout-intent`
- 时间轴不再只理解“元素出现”，还要能承载最小的“聚焦动作”结果

本阶段不要求做成复杂动画系统，但至少要支持：

- `reveal`
- `highlight`
- `dim-others`
- 必要时的 `switch-detail` 页面切换语义

### 18.3 首版自动决策逻辑（v0）

阶段 1 不需要追求非常聪明，但必须有一版**规则驱动的自动决策**，不能是“遇到某个元素类型就固定扩三页”。

#### `flowchart`

建议先基于以下信号判断：

- 流程节点数量
- 是否存在明显分支
- 字幕是否呈现逐节点讲解顺序
- 单页是否仍可读

建议 v0 规则：

- 节点少、字幕偏概述 -> `overview-only`
- 节点有顺序、字幕在逐步解释 -> `overview + in-page focus`
- 分支明显或单页承载吃紧 -> `overview + in-page focus + detail`

#### `timeline`

建议先基于以下信号判断：

- 阶段数量
- 层级深度（缩进）
- 是否存在子树结构
- 字幕是否在逐阶段下钻

建议 v0 规则：

- 阶段少、层级浅 -> `overview-only`
- 阶段顺序明确、可在单页聚焦 -> `overview + in-page focus`
- 存在明显二级/三级结构 -> `overview + in-page focus + detail`

#### `keypoints`

建议先基于以下信号判断：

- 要点数量
- 每个要点的说明长度
- 字幕是否逐条对应要点
- 是否有某个要点明显需要单独讲

建议 v0 规则：

- 点少且短 -> `overview-only`
- 点适中且字幕逐条解释 -> `overview + in-page focus`
- 某些点解释密度明显更高 -> `overview + detail` 或 `overview + in-page focus + detail`

### 18.4 `step[]` 的最小设计

阶段 1 的 `step` 不要一开始就做得很重，先够渲染和自动播放即可。

建议最小字段：

- `enterAt`
- `duration`
- `actionType`
- `target`
- `payload`

建议首批动作类型只实现以下几种：

- `reveal`
- `highlight`
- `dim-others`
- `focus-item`

如果 detail 页是通过单独新 slide 承载，那么“切到 detail”本身不一定要作为复杂动画动作实现，也可以先由页面顺序解决。

### 18.5 推荐的开发顺序

为了尽快形成闭环，建议实现顺序如下：

1. **先定义 planner 数据结构**
   - 先把 `presentationPlan`、`scenePlan`、`step` 的 JSON 结构跑通
2. **再做 3 类元素的 planner 规则**
   - 先保证能稳定输出 `overview/focus/detail` 决策
3. **再补 renderer**
   - 让渲染入口从 `scene` 切换到 `scenePlan`
4. **最后改模板时间轴**
   - 让自动播放真正消费 `step[]`
5. **最后补回退与示例**
   - 确保普通场景不坏
   - 确保 T1/T2/T3 至少各有一个示例能跑通

### 18.6 阶段 1 的工程验收标准

从工程角度看，阶段 1 完成时，至少要满足：

- 可以从现有标准 Markdown 生成 `presentationPlan`
- `flowchart` / `timeline` / `keypoints` 三类场景都能触发至少一版自动编排
- 最终 HTML 中，来自同一原始场景的多个派生页可以连续播放
- 页内聚焦不再只是“多几个元素淡入”，而是能表达明确的讲解推进
- detail 页只在必要时生成，不是固定模板扩页
- 非目标场景仍能走原有单页逻辑正常渲染
- `assetSlots` 与 `step` 结构已经为 B / C 留出接口，但本轮不真正接资源

### 18.7 建议的最小新增文件清单

若按最小闭环实现，建议至少出现以下改动：

- 修改：`markdown-to-html/scripts/parse-markdown.js`
- 新增：`markdown-to-html/scripts/build-presentation-plan.js`
- 新增：`markdown-to-html/scripts/render-presentation.js`
- 修改：`markdown-to-html/templates/slide-base.html`

如果要补演示样例，再加：

- 可选新增：`demo/` 下的阶段 1 示例 HTML 或示例 Markdown

## 19. 对实现范围的最后约束

阶段 1 的关键不是“做很多版式”，而是**先把 planner 这一层作为独立职责真正立起来**。

只要先把 T1 / T2 / T3 的自动决策、页级拆分、页内步骤、自动播放闭环做通，这一阶段就已经是成功的最小落地。
