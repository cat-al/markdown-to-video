---
name: markdown-to-html
description: "Use when converting standardized video script Markdown (shot-montage format) into a 16:9 widescreen HTML slideshow with canvas-group based rendering, shot-level sections, and timeline-driven animations."
---

# Markdown to HTML — 镜头蒙太奇视觉创作

将 `markdown-scriptwriter` 输出的标准格式视频文案 Markdown（镜头蒙太奇格式），转化为 **16:9 宽屏动态 HTML 幻灯片页面**。每个镜头一个 `<section>`，AI 逐镜头创作 SVG/CSS 动画。

## 核心架构

> 每个镜头（Shot）= 一个 `<section class="slide">`。画布组（Canvas Group）内的镜头共享视觉画布，通过增量标记（shot-enter/shot-exit/shot-morph）实现画布演化。

| 概念 | HTML 表达 | 行为 |
|------|-----------|------|
| 画布组首镜头 | `<section class="slide canvas-group-start">` | 清空画布，完整渲染 |
| 画布组续镜头 | `<section class="slide canvas-group-continue">` | 继承画布，增量变化 |
| 画布组切换 | 不同 `data-canvas-group` 值 | 前组淡出 → 新组淡入 |
| 镜头推进 | `data-shot` 递增 | 按序列自动推进 |

## 核心原则

1. **一镜一句一画面** — 每个镜头传达一个信息点
2. **SVG/CSS 动画是视觉重心** — 占据画面 60-80% 面积
3. **增量变化不重复** — 延续镜头只创作新增/变化/退出的元素
4. **内联标注** — 关键文字贴在图形元素旁
5. **留白即节奏** — 信息密度靠"镜头切换频率"控制
6. **强制 16:9 宽屏**（1920×1080 视口）
7. **ShotTimelineEngine 驱动时间轴**，支持 TTS 时长回填
8. **遵循 frontend-design 美学规范**，禁止通用 AI 美学

## 产物目录约定

> 完整约定见 `docs/project-output-convention.md`。

本 skill 接收**项目目录路径**作为参数（如 `output/001-harness-engineering/`）。

### 输入路径

| 产物 | 路径 |
|------|------|
| 视频文案 | `<项目目录>/script.md`（镜头蒙太奇格式） |

### 输出路径

| 产物 | 路径 |
|------|------|
| HTML 幻灯片 | `<项目目录>/presentation.html` |
| 背景纹理 | `<项目目录>/paper-texture-bg.png` |

## 输入格式

镜头蒙太奇格式 Markdown，包含：
- YAML frontmatter（`total_shots`、`canvas_groups` 等）
- `## 画布组 N：标题` 画布组划分
- `### 镜头 N（关系）` 镜头定义（关系为`切换`或`延续`）
- `### [互动] 镜头 N` 互动镜头
- `**话术**:` 口播文本
- `**画面类型**:` 类型 ID
- `**元素**:` 视觉元素描述
- `**动效**:` 动画效果描述

## 流程

### 准备阶段

1. 读取 `<项目目录>/script.md`
2. 用 `scripts/parse-markdown.js` 解析为 JSON（镜头列表 + 画布组信息）
3. 运行增量组装初始化：
   ```bash
   node scripts/incremental-assemble.js init --project-dir <项目目录>
   ```
   生成骨架 `presentation.html` 和 `.build/` 构建目录。

### 创作阶段（逐画布组循环）

**对于每个画布组 G：**

1. **读取当前画布组的所有镜头** — 从解析结果中提取 `canvasGroup === G` 的镜头列表
2. **理解本组概念** — 该画布组传达什么核心概念？镜头如何递进？
3. **创作组内首镜头（切换）**：
   a. 决定完整画面构图 — 根据画面类型和元素描述，创作完整的 SVG/CSS
   b. 创作的 HTML 是一个完整的 `<section class="slide canvas-group-start">`
   c. 内部包含完整的 SVG 图形 + 样式
4. **创作后续镜头（延续）**：
   a. **只创作增量内容** — 不重复首镜头的元素
   b. 用 `.shot-enter` 标记新增元素
   c. 用 `.shot-exit` 标记要退出的元素
   d. 用 `.shot-morph` 标记要变化的元素
   e. 创作的 HTML 是 `<section class="slide canvas-group-continue">`
5. **写入镜头片段** — 将该画布组所有 `<section>` 写入 `.build/group-G.html`
6. **追加到 presentation.html**：
   ```bash
   node scripts/incremental-assemble.js append \
     --project-dir <项目目录> \
     --group-id G \
     --shots-html <项目目录>/.build/group-G.html
   ```
7. **继续下一个画布组**

### 组装阶段

全部画布组创作完成后：

```bash
node scripts/incremental-assemble.js finalize --project-dir <项目目录>
```

脚本自动完成：
- 注入 `timelineConfig`、`presentationData`、`presentationTag`、`appTitle`
- 复制 `assets/paper-texture-bg.png` 到项目目录
- 清理 `.build/` 临时目录

### 中断恢复

```bash
node scripts/incremental-assemble.js status --project-dir <项目目录>
```

## HTML 结构

### 画布组首镜头（canvas-group-start）

```html
<section class="slide canvas-group-start" data-canvas-group="1" data-shot="1" data-duration="2500">
  <!-- 完整画面构图 -->
  <svg viewBox="0 0 1920 1080">
    <!-- AI 创作的完整 SVG 内容 -->
  </svg>
</section>
```

### 画布组续镜头（canvas-group-continue）

```html
<section class="slide canvas-group-continue" data-canvas-group="1" data-shot="2" data-duration="3200">
  <!-- 只包含增量变化的元素 -->
  <div class="shot-enter" data-el="new-text" style="position:absolute; left:200px; top:400px;">
    新增文字内容
  </div>
  <div class="shot-exit" data-el="old-element"></div>
  <div class="shot-morph" data-el="existing" data-morph-style="transform: scale(0.8)"></div>
</section>
```

### 时间轴配置

```javascript
window.timelineConfig = {
  autoPlay: true,
  shots: [
    { id: 1, canvasGroup: 1, duration: 2500 },
    { id: 2, canvasGroup: 1, duration: 3200 },
    { id: 3, canvasGroup: 2, duration: 4000 },
    // ...
  ],
  shotGap: 300,          // 镜头间呼吸间隔（ms）
  groupTransition: 600,  // 画布组切换过渡时长（ms）
};
```

## 渲染逻辑

1. **`canvas-group-start`**：清空画布，完整渲染本镜头的所有 SVG/HTML 内容
2. **`canvas-group-continue`**：保留画布，执行增量变化：
   - `.shot-enter` 元素淡入显示
   - `.shot-exit` 元素淡出隐藏
   - `.shot-morph` 元素执行变形/移动
3. **画布组切换时**：前组整体淡出 → 新组第一镜头淡入

## 画面类型创作指南

### character（角色/IP）

- 简笔 SVG 角色，线条清晰，风格统一
- 表情动效（眨眼/点头/摆手）用 CSS animation
- 角色位于画面固定位置（通常偏右或偏左 1/3 处）
- 角色大小占画面 30-50% 高度

### screenshot（截图引用）

- SVG 模拟浏览器窗口：圆角矩形 + 顶栏三点
- 内容用文字/色块模拟，不用真实截图
- 浏览器框占画面 60-80% 面积
- 顶栏颜色用 `--color-bg-strong`

### icon-combo（图标组合）

- SVG 图标阵列，每个图标 80-120px
- 图标间有连线/箭头/标注
- 入场用 stagger 动画（依次出现）
- 图标下方有文字标注（≥28px）

### concept-map（概念图/流程图）

- SVG 节点用圆形/圆角矩形
- 连线用 `drawPath` 动画
- 节点文字 ≥32px
- 高亮节点用 `drop-shadow` + 描边加粗
- 颜色梯度：陶土棕（正常）→ 暖金棕（强调）→ 赤陶红（错误）

### code-demo（代码演示）

- 深色终端模拟（`#1E1E1E` 背景 + 圆角 16px + 三点窗控）
- 代码用 monospace 字体
- 语法高亮：关键字绿色 `#27C93F`，字符串黄色 `#FFBD2E`，注释灰色 `#6A737D`
- 逐行出现动效（stagger delay）
- 字号最小 28px

### text-effect（文字排版特效）

- 大字标题 64-160px
- 文字动画：逐字出现/缩放/淡入/打字机效果
- 留白充分，文字是绝对主角
- 配合品牌色系做强调

### comparison（对比展示）

- 左右分栏或上下对比
- 用色块/面积差异表达对比关系
- 标注对比维度
- 不用 HTML 表格，用 SVG 可视化

### interaction（互动引导）

- 图标居中偏大（120-200px）
- CTA 文字清晰（40-56px）
- 简洁背景（纸浆米白 + 轻微装饰）
- 图标有循环动画（上下浮动/脉冲）

## 手机可读性（强制）

| 元素类型 | 最小字号 | 手机 ~5x 缩放后 |
|---------|---------|----------------|
| 镜头标题/大字 | **64px** | ~13px ✓ |
| 节点/卡片内文字 | **32px** | ~6px 可辨认 |
| 内联标注 | **28px** | ~6px 可辨认 |
| 数字锚点 | **96px+** | ~19px ✓ |
| 连线 stroke-width | **≥3px** | 可见 |

## 品牌色系（固定）

所有视频使用统一的「纸浆米白 + 陶土棕绿」品牌色系，**禁止更换配色方案**。

- 背景：纸浆米白 `#FAF3E9` + `paper-texture-bg.png` 纹理
- 主色：陶土棕 `#7A4F2A`
- 强调：暖金棕 `#B8802E`
- 辅助：橄榄绿 `#4A6741`
- 文字：深棕 `#1a1408`
- 警告：赤陶红 `#8B2515`

## 创作原则

### 一镜一画面

每个镜头只有一个视觉重心。不在一个镜头内同时展示多个独立概念。

### 增量只写增量

延续镜头的 HTML **不重复**首镜头的元素。只包含：
- 新增的元素（`.shot-enter`）
- 要移除的元素标记（`.shot-exit`）
- 要变化的元素标记（`.shot-morph`）

### AI 上下文控制

创作每个画布组时，AI 只需关注：
- 当前画布组的所有镜头描述
- 已完成画布组的**摘要**（2-3 行/组）
- 本 SKILL.md 的创作指南
- `frontend-design/SKILL.md` 美学规范

**不传入已完成画布组的完整 HTML。**

## 反模式清单

| 禁止 | 原因 |
|------|------|
| 面板网格 / card / panel | dashboard 元素，不是视频画面 |
| 所有镜头同一版式 | 利用 8 种画面类型保持视觉丰富度 |
| 延续镜头复制首镜头全部 HTML | 延续镜头只写增量 |
| 字号小于 28px | 手机上不可读 |
| 自创配色方案 | 统一品牌色系 |
| 信息堆砌 | 一镜一个信息点 |
| 连线 stroke-width < 3px | 手机上看不清 |

## 基础模板

生成时以 `templates/slide-base.html` 为骨架。骨架提供：

- 16:9 视口 + 纸浆纹理背景
- `.slideshow` / `.slide` / `.slide.active` 切换系统
- `.canvas-group-start` / `.canvas-group-continue` 画布组标记
- `.shot-enter` / `.shot-exit` / `.shot-morph` 增量渲染标记
- `.is-highlighted` / `.is-dimmed` 聚焦状态
- `[data-el]` 元素定位标记
- `ShotTimelineEngine`（自动播放、镜头推进、画布组切换）
- 页码、进度条、快捷键
- 基础动画工具类
- 占位符：`__SLIDES__`、`__PRESENTATION_DATA__`、`__TIMELINE_CONFIG__`、`__PRESENTATION_TAG__`、`__APP_TITLE__`

## 解析脚本

| 脚本 | 用途 |
|------|------|
| `scripts/parse-markdown.js` | 将镜头蒙太奇格式 Markdown 解析为 JSON（画布组、镜头列表） |
| `scripts/incremental-assemble.js` | 增量画布组组装：`init` → `append` × N → `finalize` |

## 常见错误

| 错误 | 正确做法 |
|------|----------|
| 不是 16:9 视口 | 强制 1920×1080，overflow: hidden |
| 延续镜头复制全部 HTML | 只写增量元素（shot-enter/exit/morph） |
| 所有镜头同一画面类型 | 混合使用 8 种画面类型 |
| 字号小于 28px | 遵守手机可读性最小字号 |
| 使用通用 AI 美学 | 遵循品牌色系和 frontend-design 规范 |
| 画布组首镜头不是 canvas-group-start | 首镜头必须用 `canvas-group-start` 类 |
| timelineConfig 缺少镜头 | 每个 shot 都需要在 timelineConfig.shots 中有条目 |
