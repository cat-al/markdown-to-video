# 画布连续演化引擎设计文档

**日期**: 2026-04-25
**状态**: 设计阶段
**范围**: 将 `markdown-to-html` 的渲染模型从"幻灯片切换"升级为"单画布 + Step 连续演化"
**前置文档**: `2026-04-25-visual-narrative-design.md`

## 1. 背景

### 1.1 当前问题

视觉叙事层重构（前置文档）解决了"从 PPT 面板转向 SVG/CSS 动画讲解页"的方向问题，但保留了一个根本局限：**场景之间仍然是幻灯片式的硬切换。**

参考视频（小白debug《Transformer是什么》）展示了一种完全不同的叙事方式：

- 001：完整的 QKV 概念图（输入词 → Q/K/V → 词块）
- 002：左侧流程框**退场**，右侧 QKV 矩阵保留并重排
- 003：V 行**退场**，Q→K 虚线箭头**入场**
- 004：同一批元素从行视图**重排**成矩阵视图
- 005：矩阵**退场**，坐标系**入场**，Q1/K2 色块**移动**到新位置

全程没有"翻页"，只有元素在同一个画布上不断进出、移动、变形。观众感受到的是"概念在生长"，而不是"PPT 在切换"。

### 1.2 核心洞察

| 当前系统 | 目标效果 |
|---------|--------|
| 每个 scene 是独立的 `<section>` | 所有元素在同一个画布上 |
| 场景切换 = opacity 0→1 | 场景切换 = 旧元素退场 + 新元素入场 |
| 元素只在自己的场景内存在 | 元素可以跨步骤存活（Q/K 色块从 001 延续到 005） |
| 翻页感 | 动画纪录片感 |

## 2. 已确认的设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 架构方案 | 方案 A：单画布 + Step 演化 | 完全复现"画布连续演化"效果，无翻页感 |
| 动画编排来源 | AI 在 skill 指导下自行决定元素生命周期 | 动画编排的"好坏"很难用规则表达，AI 即时创作更灵活 |
| TimelineEngine | 在现有基础上扩展，兼容两种模式 | 保留"章节"概念用于大概念跳转和快速导航，向后兼容 |
| 动作类型 | enter / exit / move / morph / highlight / dim | 覆盖截图中观察到的所有过渡类型 |
| 视觉风格 | 引擎确定，风格由 AI 每次即时创作 | 不收敛到固定模板，每个内容有独特的视觉表达 |

## 3. 设计目标

> 在 `slide-base.html` 的 TimelineEngine 基础上，引入 Step 子系统，使每个章节（slide）内部的元素能够通过 enter/exit/move/morph 动作连续演化，而非一次性全部出现。

### 3.1 目标细化

- 同一个画布上的元素可以跨步骤存活
- 旧元素退场和新元素入场可以在同一步中同时发生
- 元素可以在步骤之间移动位置、改变形态
- 章节之间仍可切换（用于大概念跳转），但章节内部完全是连续演化
- 单章节模式也能工作（整个视频就一个 slide，全靠 steps 推进）
- 自动播放和手动控制（空格/→）都正常工作
- 录屏时观众看到的是"概念在生长"而非"PPT 在切换"

### 3.2 非目标

- 不要求 planner 脚本自动生成步骤编排 — 由 AI 创作时决定
- 不追求物理模拟级别的动画（弹簧、惯性等）— CSS transition/animation 足够
- 不做 3D 变换
- 不改 `parse-markdown.js` 和 `build-presentation-plan.js`

## 4. Step 系统设计

### 4.1 核心概念

```
章节 (slide)
  └── 步骤 (step) × N
        └── 动作 (action) × M
              ├── 目标元素 (target)
              ├── 动作类型 (type: enter/exit/move/morph/highlight/dim)
              └── 参数 (params: 位置/透明度/缩放/颜色/duration等)
```

一个**章节**包含多个**步骤**，每个步骤包含一组**同时执行**的动作。空格/→ 触发"下一步"，步骤用完了才切"下一章节"。

### 4.2 动作类型

| 动作 | 作用 | CSS 实现 | 参数 |
|------|------|---------|------|
| `enter` | 元素入场 | opacity 0→1 + transform 动画 | `animation`: fadeIn / scaleIn / slideLeft / slideRight / slideUp / drawPath |
| `exit` | 元素退场 | opacity 1→0 + transform 动画 | `animation`: fadeOut / scaleOut / slideLeft / slideRight |
| `move` | 元素移动到新位置 | CSS `transform` 过渡 | `x`, `y` 或 `transform` 目标值 |
| `morph` | 元素改变形态 | CSS transition（大小/颜色/圆角等） | 任意 CSS 属性目标值 |
| `highlight` | 元素高亮聚焦 | 添加 `.is-highlighted` 类 | `group`: 可选，dim 同组其他元素 |
| `dim` | 元素弱化 | 添加 `.is-dimmed` 类 | — |

### 4.3 元素标记规范

AI 创作 HTML 时，给需要参与步骤演化的元素添加以下 data 属性：

```html
<!-- 元素唯一 ID，用于步骤动作定位 -->
<g data-el="query-node" class="step-hidden">
  <rect .../>
  <text ...>Query</text>
</g>

<!-- 初始隐藏，等待 enter 动作 -->
<div data-el="annotation-1" class="step-hidden">
  语义和位置的向量
</div>
```

- `data-el="唯一ID"` — 步骤动作通过此 ID 定位元素
- `class="step-hidden"` — 初始不可见，由 StepEngine 的 `enter` 动作控制出现
- 不需要 `step-hidden` 的元素（如背景网格）正常可见，不参与步骤编排

### 4.4 步骤配置格式

AI 创作 HTML 时，在 `<script>` 中定义步骤配置：

```javascript
window.stepConfig = {
  // 章节 1 的步骤
  "slide-1": [
    {
      // 步骤 1：输入词出现
      // step.duration = 本步的"观看时间"，自动播放时用于决定何时触发下一步
      // action.duration = 单个动作的动画时长（可选，默认 enter:600ms exit:400ms move:600ms）
      duration: 800,
      actions: [
        { target: "input-word", type: "enter", animation: "scaleIn" }
      ]
    },
    {
      // 步骤 2：三条连线绘制 + Q/K/V 节点出现
      duration: 1200,
      actions: [
        { target: "line-to-q", type: "enter", animation: "drawPath" },
        { target: "line-to-k", type: "enter", animation: "drawPath", delay: 200 },
        { target: "line-to-v", type: "enter", animation: "drawPath", delay: 400 },
        { target: "query-node", type: "enter", animation: "scaleIn", delay: 600 },
        { target: "key-node", type: "enter", animation: "scaleIn", delay: 800 },
        { target: "value-node", type: "enter", animation: "scaleIn", delay: 1000 }
      ]
    },
    {
      // 步骤 3：左侧流程框退场，Q→K 箭头入场
      duration: 1000,
      actions: [
        { target: "input-word", type: "exit", animation: "fadeOut" },
        { target: "line-to-q", type: "exit", animation: "fadeOut" },
        { target: "line-to-k", type: "exit", animation: "fadeOut" },
        { target: "line-to-v", type: "exit", animation: "fadeOut" },
        { target: "value-node", type: "exit", animation: "fadeOut" },
        { target: "q-to-k-arrows", type: "enter", animation: "drawPath", delay: 400 }
      ]
    },
    {
      // 步骤 4：元素重排成矩阵视图
      duration: 1000,
      actions: [
        { target: "query-node", type: "move", x: 100, y: 300 },
        { target: "key-node", type: "move", x: 500, y: 80 },
        { target: "matrix-grid", type: "enter", animation: "fadeIn", delay: 600 }
      ]
    }
  ]
};
```

**关键语义区分：**
- `step.duration` — **观看时间**。自动播放时，引擎等待 `step.duration + stepGap(600ms)` 后触发下一步。与 action 的动画时长无关。
- `action.duration` — **动画时长**（可选）。单个 action 的 CSS animation/transition 持续时间。省略时使用默认值（enter: 600ms, exit: 400ms, move: 600ms, morph: 600ms）。
- `action.delay` — **动作延迟**（可选）。该 action 在 step 开始后延迟多久执行，用于 step 内部的 stagger 编排。

### 4.5 drawPath 动画前提

使用 `drawPath` 动画时，AI 创作的 SVG path 元素必须预设：

```html
<path data-el="line-to-q" class="step-hidden"
  d="M 200 360 Q 340 200 420 100"
  stroke="var(--cyan)" stroke-width="3" fill="none"
  stroke-dasharray="400" stroke-dashoffset="400"
  style="--path-length: 400"/>
```

`stroke-dasharray` 和 `stroke-dashoffset` 初始值设为路径总长度，`--path-length` CSS 变量也要设置。`drawPath` keyframe 会将 `stroke-dashoffset` 从 `var(--path-length)` 过渡到 `0`。

### 4.6 自动播放模式

自动播放时，step 之间按 `step.duration` + 固定间隔（默认 600ms）自动推进。一个章节的所有 step 播完后，等待 `transitionDuration` 再切下一个章节。

```
step1 (800ms) → 间隔 (600ms) → step2 (1200ms) → 间隔 (600ms) → step3 ...
                                                                     ↓ 章节完
                                                               过渡 (800ms)
                                                                     ↓
                                                              章节2 step1 ...
```

手动模式下，空格/→ 触发下一步，← 回退一步。

## 5. StepEngine 设计

### 5.1 扩展现有 TimelineEngine

不替换 TimelineEngine，而是在其基础上增加 Step 子系统：

```javascript
class TimelineEngine {
  // ... 现有代码保留 ...

  // 新增：Step 子系统
  currentStep = -1;
  stepConfig = window.stepConfig || {};

  getSlideSteps(slide) {
    const sceneId = slide.dataset.scene;
    return this.stepConfig[`slide-${sceneId}`] || [];
  }

  // 执行一个 step 的所有 actions
  executeStep(slide, stepIndex) {
    const steps = this.getSlideSteps(slide);
    if (stepIndex >= steps.length) return false; // 没有更多步骤

    const step = steps[stepIndex];
    for (const action of step.actions) {
      const el = slide.querySelector(`[data-el="${action.target}"]`);
      if (!el) continue;
      const delay = action.delay || 0;
      setTimeout(() => this.applyStepAction(el, action), delay);
    }
    return true;
  }

  applyStepAction(el, action) {
    switch (action.type) {
      case 'enter':
        el.classList.remove('step-hidden');
        el.classList.add('step-entering');
        if (action.animation) el.style.animation = `${action.animation} ${action.duration || 600}ms ease forwards`;
        break;
      case 'exit':
        el.classList.add('step-exiting');
        el.addEventListener('animationend', () => el.classList.add('step-hidden'), { once: true });
        if (action.animation) el.style.animation = `${action.animation} ${action.duration || 400}ms ease forwards`;
        break;
      case 'move':
        el.style.transition = `transform ${action.duration || 600}ms ease`;
        el.style.transform = `translate(${action.x || 0}px, ${action.y || 0}px)`;
        break;
      case 'morph':
        el.style.transition = `all ${action.duration || 600}ms ease`;
        Object.assign(el.style, action.style || {});
        break;
      case 'highlight':
        el.classList.add('is-highlighted');
        el.classList.remove('is-dimmed');
        // 如果指定了 group，dim 同组其他元素
        if (action.group) {
          const slide = el.closest('.slide');
          slide.querySelectorAll(`[data-focus-group="${action.group}"]`).forEach(peer => {
            if (peer !== el) peer.classList.add('is-dimmed');
          });
        }
        break;
      case 'dim':
        el.classList.add('is-dimmed');
        el.classList.remove('is-highlighted');
        break;
    }
  }

  // prev() 回退策略：重置当前 slide 所有 step 元素，然后重放 step 0 ~ stepN-1
  prev() {
    const slide = this.slides[this.currentIndex];
    const steps = this.getSlideSteps(slide);

    if (this.currentStep > 0) {
      // 还在当前章节内，回退到上一步
      this.currentStep--;
      this.resetSlideStepState(slide); // 所有 step 元素回到 step-hidden
      // 重放 step 0 到 currentStep
      for (let i = 0; i <= this.currentStep; i++) {
        this.executeStep(slide, i);
      }
    } else {
      // 已经在第一步，回退到上一个章节的最后一步
      this.currentStep = -1;
      const prevIndex = Math.max(this.currentIndex - 1, 0);
      // ... 切换到上一章节，并重放该章节所有 steps ...
    }
  }

  // 重置某个 slide 内所有 step 元素到初始状态
  resetSlideStepState(slide) {
    slide.querySelectorAll('[data-el]').forEach(el => {
      el.classList.add('step-hidden');
      el.classList.remove('step-entering', 'step-exiting', 'is-highlighted', 'is-dimmed');
      el.style.animation = '';
      el.style.transform = '';
      el.style.transition = '';
    });
  }

  // 重写 next：优先推进 step，step 用完再切章节
  next() {
    const slide = this.slides[this.currentIndex];
    const steps = this.getSlideSteps(slide);

    this.currentStep++;
    if (this.currentStep < steps.length) {
      this.executeStep(slide, this.currentStep);
    } else {
      // step 用完，切下一章节
      this.currentStep = -1;
      // ... 原有的章节切换逻辑 ...
    }
  }

  // showSlide 时重置 step 计数器，执行第一步
  showSlide(index) {
    // ... 原有逻辑 ...
    this.currentStep = -1;
    // 如果有 steps，自动执行第一步
    const steps = this.getSlideSteps(this.slides[index]);
    if (steps.length > 0) {
      this.currentStep = 0;
      this.executeStep(this.slides[index], 0);
    }
  }
}
```

### 5.2 CSS 基础

`slide-base.html` 新增的 CSS：

```css
/* Step 系统基础 */
.step-hidden {
  opacity: 0;
  pointer-events: none;
}

.step-entering {
  pointer-events: auto;
}

.step-exiting {
  pointer-events: none;
}

/* 入场动画 */
@keyframes fadeIn    { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeOut   { from { opacity: 1; } to { opacity: 0; } }
@keyframes scaleIn   { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }
@keyframes scaleOut  { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.7); } }
@keyframes slideUp   { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideDown { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideLeft { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideRight{ from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes drawPath  { from { stroke-dashoffset: var(--path-length, 1000); } to { stroke-dashoffset: 0; } }
```

### 5.3 向后兼容

- 没有 `window.stepConfig` 的 HTML 文件 → 行为和现在完全一样（纯章节切换 + data-enter-at 渐进揭示）
- 有 `stepConfig` 但某个 slide 没有定义 steps → 该 slide 按旧模式运行
- `data-enter-at` 机制保留，可以和 step 系统共存（step 控制大节奏，data-enter-at 控制 step 内部的微时序）

## 6. SKILL.md 变更

### 6.1 新增"步骤编排"创作指导

在 SKILL.md 的"创作阶段"中新增步骤编排环节：

```
创作阶段（每个章节）：
1. 理解本章概念
2. 规划步骤序列 — 这个概念需要几步展开？每步揭示什么？
3. 为每步设计元素的入场/退场/移动/变形
4. 创作 SVG/CSS — 所有元素写在同一个容器内，用 step-hidden 控制初始可见性
5. 编写 stepConfig — 定义每步的 actions
6. 配置时间属性 — duration 和 delay
```

### 6.2 新增"步骤编排原则"

```
步骤编排原则：
- 每步只做一件事：要么揭示新信息，要么聚焦某个部分，要么转换视角
- 入场和退场可以同时发生（旧元素淡出的同时新元素淡入）
- 跨步骤存活的元素不要退场再入场 — 保持在画布上，只做 move/morph
- 一个概念通常 3-6 步展开，不要超过 8 步（太碎）
- 每步之间留足呼吸时间（600ms+ 间隔）
```

### 6.3 新增"视觉拆解方法论"

```
概念类型         → 步骤编排范式
─────────────────────────────────────
因果/流程关系    → step1: 起点节点入场 → step2: 连线绘制+下一节点 → step3: 继续... → stepN: 全链路高亮
并列/对比       → step1: A 入场 → step2: B 入场(A 保留) → step3: 对比标注入场
层级/包含       → step1: 外层入场 → step2: 内层展开 → step3: 标注
时序/阶段       → step1: 轴线绘制 → step2: 节点1点亮 → step3: 节点2点亮 → ...
数量/规模       → step1: 数字入场 → step2: 对比条生长 → step3: 标注
转化/映射       → step1: 左侧入场 → step2: 连线绘制 → step3: 右侧浮现
视角切换        → step1: 当前视图保留 → step2: 元素 move 到新位置 → step3: 新标注入场
```

## 7. 对现有文件的影响

| 文件 | 动作 | 说明 |
|------|------|------|
| `templates/slide-base.html` | **扩展** | 新增 step CSS + 扩展 TimelineEngine |
| `markdown-to-html/SKILL.md` | **扩展** | 新增步骤编排指导和视觉拆解方法论 |
| `frontend-design/SKILL.md` | **不变** | 美学指南不受影响 |
| `scripts/parse-markdown.js` | **不变** | 解析层不变 |
| `scripts/build-presentation-plan.js` | **不变** | 编排层不变 |
| `scripts/render-presentation.js` | **不变** | 上下文输出工具不变 |

## 8. slide-base.html 变更清单

### 8.1 CSS 新增

- `.step-hidden` / `.step-entering` / `.step-exiting` 状态类
- `@keyframes fadeOut / scaleOut / slideDown / slideLeft / slideRight` 退场动画（入场动画已有）

### 8.2 JS 变更

TimelineEngine 扩展：
- 新增 `currentStep` 状态
- 新增 `stepConfig` 读取
- 新增 `getSlideSteps()` / `executeStep()` / `applyStepAction()`
- 重写 `next()` — 优先推进 step，step 用完再切章节
- 重写 `prev()` — 回退策略：`resetSlideStepState()` 重置所有 step 元素到 `step-hidden`，然后重放 step 0 到 stepN-1（即"重置+重放"模式，避免逐个 undo 的复杂性）
- 扩展 `showSlide()` — 重置 step 计数器，自动执行第一步
- 扩展自动播放 — step 之间按 duration + 间隔自动推进

### 8.3 新增占位

- `__STEP_CONFIG__` 占位符，嵌入方式与现有占位符一致：

```javascript
// slide-base.html 中
window.stepConfig = __STEP_CONFIG__;
```

AI 创作时将 stepConfig JSON 填入此占位符。无 step 配置时填 `{}`，引擎自动降级为纯章节切换模式。

## 9. 验收标准

用"Attention QKV 拆解"内容重新生成一个 demo：

1. **全程无翻页感** — 从 QKV 概念出现到点积计算，观众看到的是连续的画布演化
2. **元素跨步骤存活** — Q/K 的色块从概念介绍一直存在到矩阵运算
3. **退场和入场同时发生** — 旧元素淡出的同时新元素入场，不是"清空→重画"
4. **move 动作可见** — 元素从一个位置平滑移动到另一个位置
5. **空格/→ 逐步推进** — 每次按键只展开一小步，不是一次全部出现
6. **自动播放正常** — 按时间自动逐步推进
7. **向后兼容** — 现有的 demo（无 stepConfig）仍然正常工作

## 10. 实施顺序

1. **扩展 `slide-base.html`** — 新增 step CSS + 扩展 TimelineEngine
2. **扩展 `SKILL.md`** — 新增步骤编排指导和视觉拆解方法论
3. **创作 QKV demo** — 用新的 step 系统重新生成 Attention 讲解页
4. **验证向后兼容** — 确认现有 demo 不受影响

## 11. 一句话结论

**在 TimelineEngine 基础上引入 Step 子系统，让章节内部的元素通过 enter/exit/move/morph 连续演化，实现"画布在生长"而非"PPT 在翻页"的叙事效果。引擎是确定性的，视觉风格由 AI 每次即时创作。**
