---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. Implement real working code with exceptional attention to aesthetic details and creative choices.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## SVG 动画创作美学

在视觉叙事讲解页场景下，SVG/CSS 动画不是装饰，而是内容本身。以下原则指导动画创作：

### 路径动画

用 `stroke-dasharray` / `stroke-dashoffset` 做绘制效果，比突然出现更有叙事感。路径沿流程方向绘制，让观众的视线被引导着移动。

```css
.draw-path {
  stroke-dasharray: var(--path-length, 1000);
  stroke-dashoffset: var(--path-length, 1000);
  animation: drawPath 1.2s ease-out forwards;
}
```

### 时序编排

元素出现顺序即讲解顺序。用 `animation-delay` 做 stagger，间隔 200-400ms。不要所有元素同时出现 — 那不是动画，是闪现。

```css
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 250ms; }
.stagger-item:nth-child(3) { animation-delay: 500ms; }
```

### 色彩语义

颜色不是装饰，是信息：

| 色彩 | 语义 | 参考色值 |
|------|------|----------|
| 陶土棕 | 正常 / 起点 / 主要元素 | `var(--color-accent)` `#A8703F` |
| 暖金棕 | 强调 / 过渡 / 需要注意 | `var(--color-accent-warm)` `#C4923C` |
| 赤陶红 | 错误 / 终点 / 失控 | `var(--color-danger)` `#a33020` |
| 橄榄绿 | 辅助 / 聚焦 / 次要元素 | `var(--color-focus)` `#5C614D` |

状态变化时，用颜色过渡（`transition: fill 400ms`）而不是突变，让观众感知到"正在发生变化"。

### 留白即节奏

空白区域是"停顿"，和动画一样重要。一个占据 60% 画面的 SVG 配 40% 留白，比满屏都是图形更有视觉冲击力。留白传达的信息是："这个概念值得你停下来看。"

### 简洁优先

SVG 元素尽量用基础图形（`circle`、`rect`、`path`、`line`、`text`），避免复杂嵌套。一个清晰的概念图，胜过一个精密但看不懂的插画。

### 内联标注的美学

标注不是浮窗，是图形的一部分：
- 用 SVG `<text>` 或绝对定位的 HTML 元素
- 紧贴图形节点，间距 8-16px
- 字号小于主视觉元素，颜色用 `--color-text-muted`
- 可用细线（`stroke-width: 1`）从标注连到节点

### 数字锚点的美学

大字号数字是视觉重心之一：
- `font-size: 72px` 起步，重要数字可到 `120px+`
- 用 `font-family: var(--font-display)` 让数字有辨识度
- 搭配小字说明（`font-size: 18-22px`），形成大小对比
- 数字滚动动画用 CSS `counter` 或简单 JS，不要过度复杂
