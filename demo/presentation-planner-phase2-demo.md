---
title: "Presentation Planner 阶段 2 能力演示"
author: "markdown-to-html / phase 2 demo"
topic: "presentation planner / layout intent / fallback"
style: "产品演示"
target_audience: "正在迭代 Markdown -> HTML 编排链路的开发者"
estimated_duration: "5"
scenes_count: 5
---

## 场景1：时间线场景现在会先总览，再展开关键阶段

**画面描述**: 左侧是解说文案区，右侧是一条从上到下推进的阶段时间线。前三个顶层阶段依次点亮，随后“规划判断”被单独拉出，展示其子层级。

**视觉元素**:

- → 输入整理 ✅ 建立场景、元素、字幕三层基础
  - → 识别页面配置 ✅ 保留 sceneRole、titleSize、subtitlePlacement
  - → 识别结构元素 ✅ 抽出 timeline、flowchart、keypoints 等类型
- → 规划判断 ✅ 根据字幕与结构信号决定策略
  - → 计算 signals ✅ 评估 complexity、subtitle guidance、detail worthiness
  - → 推导 strategy ✅ 判断 overview-only / overview+focus / overview+detail
- → 页面分发 ✅ 根据 layoutIntent 走不同页面变体
  - → overview 页面 ✅ 保留全局视图并做 in-page focus
  - → detail 页面 ✅ 把关键阶段单独拆出来讲

> 先看这条时间线的三段主链路：输入整理、规划判断、页面分发。
> 首先输入整理负责把场景结构和页面配置都读出来，给后面的 planner 打基础。
> 然后规划判断会综合 complexity、字幕 guidance 和 detail worthiness，决定当前场景到底要不要拆页。
> 最后页面分发阶段根据 layoutIntent 选择 overview、detail 或 fallback 的具体变体。
> 接下来我们单独展开“规划判断”这一段，看它内部的 signals 和 strategy 是怎么工作的。

## 场景2：流程图场景会把总述字幕和 detail 字幕拆开

**画面描述**: 整体是一张从左到右流动的流程图。主链路保持完整，支路节点用发光标记突出。第二页切到“规划 signals”节点，强调它与字幕切片、布局意图、fallback 回退的关系。

**视觉元素**:

~~~flowchart
Markdown 输入 --> 解析结构 --> 规划 signals --> layoutIntent 分发 --> HTML 页面
                               --> 字幕切片
                               --> detail 决策
                               --> fallback 分类
~~~

> 这张流程图先交代主链路：Markdown 输入，先被解析成结构化 scene，再进入规划 signals 层。
> 规划 signals 不是单一阈值，而是把结构复杂度、字幕 guidance 和单页压力放到一起看。
> 当 signals 判断当前页值得展开时，planner 会继续推导 detail 决策，而不是机械均分字幕。
> 同时 layoutIntent 会决定 renderer 最终走 flow overview、flow detail 还是 fallback 路径。
> 如果语义匹配不够稳定，系统也会回退到更保守的字幕切片与普通场景策略。

## 场景3：要点场景会挑出最值得细讲的重点项

**画面描述**: 左侧是标题和一句总结，右侧是四张要点卡片。总览页先全量铺开，随后把“detail worthiness”和“fallback confidence”两张卡单独拉出做重点讲解。

**视觉元素**:

- **structure complexity**: 不再只看数量，还看层级、分支、文本密度，减少因为单一阈值导致的策略抖动
- **subtitle guidance strength**: 通过字幕和结构项的弱匹配，判断解说是不是在逐条解释当前内容
- **detail worthiness**: 结合 complexity、guidance、single-page pressure，决定是否值得单独拆 detail 页面
- **fallback confidence**: 当结构信号不强或字幕对应关系弱时，优先回退到更稳的 summary / visual-first 页面

> 这页先把四个核心 signals 放到一张总览页里，让观众知道 planner 在看什么。
> 其中 structure complexity 和 subtitle guidance strength 决定了当前场景是不是值得继续做 focus。
> 如果 detail worthiness 足够高，像这一页里的 detail worthiness 和 fallback confidence，就会被单独拆开讲。
> 这样 detail 页拿到的字幕，会更贴近当前 focus target，而不是简单均分剩余句子。

## 场景4：普通表格场景不再只会保底，而会走 visual-first fallback

**画面描述**: 左侧保留一个大的视觉锚点区，右侧是 fallback 结构卡片。画面强调“这不是 planner 未命中，而是主动选择更适合的回退表达”。

**视觉元素**:

| fallback 类型 | 更适合的场景 | 页面重点 |
|------|-------------|-------------|
| fallback-summary | 纯叙述、结论、引用类页面 | 用单页总结承接核心结论 |
| fallback-visual-first | 表格、数据、代码等不适合拆成 planner detail 的页面 | 保留主视觉锚点与结构卡片 |
| planner detail | flowchart / timeline / keypoints 中值得单独展开的重点项 | 让 detail 字幕和 focus target 更贴近 |

> 这一页虽然没有进入多页 planner，但也不是简单保底。
> 因为表格场景本身更适合保留主视觉和结构卡片，所以这里会主动走 visual-first fallback。
> 重点不是把它硬拆成 detail，而是让回退结果看起来依然像一个被设计过的页面。

## 场景5：引用场景会落到 summary fallback，而不是假装结构化

**画面描述**: 深色背景中央只保留一句强调性的结论，底部放一小块字幕摘要。整体克制留白，像一个收束性的结论页。

**视觉元素**:

:::quote
layoutIntent 不是注释，而是 renderer 真正消费的页面入口。
:::

> 最后一页是一个引用场景，它并不需要被强行包装成流程图或多卡片结构。
> 这类页面更适合直接走 summary fallback，用一句强结论把整段讲解收住。
> 阶段 2 的目标不是把所有场景都做成 planner detail，而是让每一类场景都落到合适的页面策略。
