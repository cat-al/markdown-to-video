# 镜头蒙太奇架构 — 全链路重构设计

> 日期：2026-05-05
> 状态：已实施

## 1. 背景与动机

### 当前问题

对比市面优秀短视频（如「Harness Engineering 解读」案例），我们的项目存在以下核心差距：

| 维度 | 优秀案例 | 当前项目 |
|------|---------|----------|
| 最小画面单位 | 镜头（1-5秒） | 场景（15-30秒） |
| 前40秒内容量 | 10个独立画面 | 2-3个场景 |
| 画面切换频率 | 每1-5秒 | 每15-30秒 |
| 视觉元素类型 | 角色、截图、图标、文字特效、概念图混合 | SVG 流程图/表格/列表 |
| 画面关系 | 画布演化 + 场景切换 | step 动画推进同一画面 |
| 互动设计 | 每60-90秒一个互动节点 | 无 |

### 根本问题

> 我们的架构是"PPT 动画幻灯片"模型，而优秀视频是"镜头蒙太奇"模型。

PPT 模型：一页画面通过 step 动画逐步揭示内容，观众在同一视觉框架下停留 15-30 秒。
蒙太奇模型：高频画面切换，每句话对应独立的视觉构图，信息密度高、节奏感强。

## 2. 设计目标

1. 将最小画面单位从"场景"重定义为"镜头"（1-10秒）
2. 支持 7 种画面类型覆盖优秀案例的视觉丰富度
3. 通过 canvas-group 实现"画布演化"效果
4. 支持互动节点
5. 全链路重构，新旧格式不兼容
6. 保留固定品牌色系（纸浆米白 + 陶土棕绿）

## 3. 核心概念

### 3.1 镜头（Shot）

最小调度单位。每个镜头：
- 对应一句话术（5-40字）
- 有独立的画面描述和元素声明
- 时长 1-10 秒，由 TTS 实际音频时长决定
- 天然与 TTS 一一对齐（一镜一句）

### 3.2 画布组（Canvas Group）

逻辑分组单位。一个画布组内的连续镜头**共享画布**：
- 组内镜头渲染时不清空画布，只做增量变化（元素入场/退出/变化）
- 组间切换时做全画面过渡（淡入淡出）
- 一个画布组通常 3-8 个镜头，对应一个完整概念段落
- 画布组是叙事的逻辑单元，类似"段落"

### 3.3 镜头关系

画布组内的镜头标注与前一个镜头的关系：

| 关系 | 含义 | 渲染行为 |
|------|------|----------|
| `延续` | 画布保留，增量变化 | 不清空画布，只执行当前镜头声明的元素变化 |
| `切换` | 全新画面构图 | 清空画布，重新渲染（画布组的第一个镜头必须是切换） |

### 3.4 互动镜头

特殊类型的镜头，用于观众互动引导：
- 关注引导（"看之前你关注了吗"）
- 弹幕互动（"弹幕扣个 0"）
- 点赞提示
- 建议每 60-90 秒放置一个
- 有专门的视觉样式（图标动画 + 文字提示）

## 4. 画面类型系统

每个镜头声明一种主画面类型，决定视觉渲染策略：

| 类型 ID | 名称 | 描述 | 渲染方式 |
|---------|------|------|----------|
| `character` | 角色/IP | 卡通人物、形象 | SVG 简笔角色 + CSS 动画 |
| `screenshot` | 截图引用 | 产品界面、博客文章、代码截图 | SVG 模拟的界面框架 + 占位内容 |
| `icon-combo` | 图标组合 | 多个图标 + 文字标注 + 连线 | SVG 图标阵列 + CSS 动画入场 |
| `concept-map` | 概念图/流程图 | 节点、连线、关系 | SVG 节点图 + drawPath 动画 |
| `code-demo` | 代码演示 | 代码片段、终端输入输出 | 深色终端模拟 + 逐行打字效果 |
| `text-effect` | 文字排版特效 | 大字标题、关键词强调、文字动画 | CSS 文字动画（scale/fade/逐字出现） |
| `comparison` | 对比展示 | 并列对比、A/B 展示 | SVG 分区布局 + 并排条形/色块 |
| `interaction` | 互动引导 | 点赞、关注、弹幕提示 | 图标动画 + CTA 文字 |

### 类型组合

一个镜头可以有一个主类型 + 辅助元素。例如：
- 主类型 `character` + 辅助 `text-effect`（角色旁边出现文字标题）
- 主类型 `concept-map` + 辅助 `icon-combo`（流程图节点用图标表示）

## 5. 新文案格式规范（markdown-scriptwriter 输出）

### 5.1 文件结构

```markdown
---
title: "视频标题"
author: "作者/来源"
topic: "主题分类"
style: "视频风格"
target_audience: "目标受众"
estimated_duration: "预估时长(分钟)"
total_shots: 镜头总数
canvas_groups: 画布组数
---

## 画布组 1：组标题

### 镜头 1（切换）
**话术**: "这句话的口播内容"
**画面类型**: icon-combo
**元素**: 具体的视觉元素描述，包含位置、内容、样式
**动效**: 元素如何入场/变化的描述

### 镜头 2（延续）
**话术**: "下一句口播"
**画面类型**: text-effect
**元素**: 在前一镜头基础上，新增/变化的元素描述
**动效**: 增量变化描述

## 画布组 2：组标题

### 镜头 3（切换）
...

---

### [互动] 镜头 N
**话术**: "互动引导语"
**画面类型**: interaction
**元素**: 互动视觉元素描述
**动效**: 互动动画描述
```

### 5.2 格式规则

| 元素 | 规则 |
|------|------|
| Frontmatter | YAML 格式，包含视频元信息 + 镜头/画布组计数 |
| 画布组标题 | `## 画布组 N：标题`，N 为序号 |
| 镜头标题 | `### 镜头 N（关系）`，关系为 `切换` 或 `延续` |
| 互动镜头 | `### [互动] 镜头 N`，特殊标记 |
| 话术 | `**话术**:` 一句口播，5-40 字 |
| 画面类型 | `**画面类型**:` 类型 ID（见类型系统） |
| 元素 | `**元素**:` 具体视觉元素描述，含位置和内容 |
| 动效 | `**动效**:` 元素入场/变化/退出方式 |

### 5.3 话术要求

- 每镜头一句话，5-40 字
- 口语化表达
- 一镜一个信息点，不堆砌
- 画布组内话术有连贯逻辑
- 画布组间有自然过渡

### 5.4 元素描述要求

- **具体有料**：不是"出现一些图标"，而是"左侧出现 ChatGPT 图标(蓝绿色圆形)，右侧出现 Claude 图标(橙色圆形)"
- **标注位置**：使用"左上/右下/居中/左侧/右侧"等方位词
- **延续镜头只写增量**：不重复前一镜头已有的元素，只描述新增/变化/退出的部分
- **和话术对应**：话术在讲什么，画面就展示什么

### 5.5 动效描述要求

- 描述元素如何出现（淡入/缩放/滑入/逐字出现/绘制路径）
- 描述元素如何变化（高亮/变色/移动/缩放）
- 描述元素如何消失（淡出/缩小/滑出）
- 不写 CSS 实现细节，只写视觉效果

## 6. 架构变化：各 Skill 重构

### 6.1 markdown-scriptwriter

**核心变化**：输出格式从"场景→多段字幕"变为"画布组→镜头列表"。

| 旧 | 新 |
|----|-----|
| `## 场景N：标题` | `## 画布组 N：标题` |
| `**画面描述**` + `**视觉元素**` + `> 字幕段` + `**动画**` | `### 镜头 N（关系）` + `**话术**` + `**画面类型**` + `**元素**` + `**动效**` |
| 每段字幕 30-80 字 | 每镜头话术 5-40 字 |
| 每场景 3-5 段 | 每画布组 3-8 个镜头 |
| 无互动概念 | `[互动]` 镜头标记 |

**Brainstorming 阶段新增确认项**：
- 画布组划分（几个大段落？每段核心概念？）
- 互动节点位置（哪些地方放互动？）
- 整体镜头节奏预期（信息密度偏高还是偏低？）

### 6.2 markdown-to-html

**核心变化**：从"每场景一个复杂 SVG 页面 + step 演化"变为"每镜头一个轻量 section + canvas-group 驱动画布共享"。

#### 新 HTML 结构

```html
<!-- 画布组 1 -->
<section class="slide canvas-group-start" data-canvas-group="1" data-shot="1" data-duration="2500">
  <!-- 第一个镜头：完整画面构图 -->
  <svg viewBox="0 0 1920 1080">...</svg>
</section>

<section class="slide canvas-group-continue" data-canvas-group="1" data-shot="2" data-duration="3200">
  <!-- 第二个镜头：只声明增量变化的元素 -->
  <!-- 渲染时继承上一镜头的画布，叠加本镜头新元素 -->
  <div class="shot-enter" data-el="new-text" style="...">新增文字</div>
  <div class="shot-exit" data-el="old-element">要退出的旧元素标记</div>
  <div class="shot-morph" data-el="existing" data-morph="...">要变化的元素</div>
</section>

<!-- 画布组 2（全新画面） -->
<section class="slide canvas-group-start" data-canvas-group="2" data-shot="3" data-duration="4000">
  <!-- 全新构图 -->
  <svg viewBox="0 0 1920 1080">...</svg>
</section>
```

#### 废弃的概念

| 废弃 | 替代 |
|------|------|
| `stepConfig` | canvas-group + shot 序列 |
| `data-enter-at` 渐进揭示 | 镜头粒度天然控制节奏 |
| `data-step-target` / `data-focus-group` | `shot-enter` / `shot-exit` / `shot-morph` |
| 每场景 3-6 个 step | 每画布组 3-8 个镜头 |

#### 新时间轴引擎

```javascript
window.timelineConfig = {
  shots: [
    { id: 1, canvasGroup: 1, duration: 2500, transition: "none" },
    { id: 2, canvasGroup: 1, duration: 3200, transition: "evolve" },
    { id: 3, canvasGroup: 2, duration: 4000, transition: "fade" },
    // ...
  ],
  shotGap: 300,          // 镜头间呼吸间隔（ms）
  groupTransition: 600,  // 画布组切换过渡时长（ms）
};
```

#### 渲染逻辑

1. `canvas-group-start`：清空画布，完整渲染本镜头
2. `canvas-group-continue`：保留画布，执行增量变化：
   - `.shot-enter` 元素淡入
   - `.shot-exit` 元素淡出
   - `.shot-morph` 元素执行变形/移动
3. 画布组切换时：前组整体淡出 → 新组第一镜头淡入

#### 创作流程变化

| 旧 | 新 |
|----|-----|
| 逐场景循环，每场景创作复杂 SVG + stepConfig | 逐画布组循环，组内逐镜头创作 |
| 单场景可能 200+ 行 HTML | 单镜头通常 30-80 行 HTML |
| step 编排需要精确的 enter/exit/move/morph 配置 | 镜头间关系由 `canvas-group-start/continue` + 元素标记驱动 |
| AI 上下文压力大（一次创作整个场景） | AI 上下文压力小（一次创作一个镜头） |

### 6.3 subtitle-timeline

**核心变化**：大幅简化。一镜一句，天然 1:1 映射。

| 旧 | 新 |
|----|-----|
| 字幕段→step 映射（可能 N:M） | 镜头→字幕 1:1 |
| 需要计算 step.duration | 直接用镜头音频时长作为 shot.duration |
| stepConfig 重写 | timelineConfig.shots[].duration 重写 |
| 复杂的映射逻辑 | 简单的遍历赋值 |

**新逻辑**：

```
对每个镜头 i：
  timelineConfig.shots[i].duration = manifest.shots[i].duration_ms
  SRT条目: start = 累加偏移, end = start + duration_ms
  累加偏移 += duration_ms + shotGap(300ms)

画布组切换处：
  累加偏移 += groupTransition(600ms)
```

### 6.4 tts-voiceover

**核心变化**：最小。原来是逐句 TTS，现在仍然是逐句（只是来源从"字幕段"变为"镜头话术"）。

**manifest 格式调整**：

```json
{
  "source": "script.md",
  "html_path": "presentation.html",
  "shots": [
    {
      "id": 1,
      "canvas_group": 1,
      "text": "Harness Engineering 是什么",
      "audio_path": "audio/shot-001.wav",
      "duration_ms": 2100
    },
    {
      "id": 2,
      "canvas_group": 1,
      "text": "和提示词工程有什么关系",
      "audio_path": "audio/shot-002.wav",
      "duration_ms": 2800
    }
  ]
}
```

音频文件从 `audio/scene-NN/NNN.wav` 扁平化为 `audio/shot-NNN.wav`。

### 6.5 video-render

**核心变化**：最小。录制逻辑不变（Puppeteer 截帧 + FFmpeg pipe），只是 slide 数量从 5-15 增加到 30-80。

需要关注：
- slide 切换更频繁，确保截帧稳定
- 画布组内的"延续"镜头切换可能需要等待 CSS transition 完成后再截帧
- 总时长不变（还是 1-15 分钟），只是画面切换更频繁

### 6.6 html-layout-review

**核心变化**：验收标准调整。

| 旧 | 新 |
|----|-----|
| 检查每个场景的 1920×1080 布局 | 检查每个镜头的 1920×1080 布局 |
| 关注 step 动画过程中的溢出 | 关注画布组内增量渲染的重叠/溢出 |
| 5-15 个场景 | 30-80 个镜头 |

## 7. 产物目录约定变化

```
output/<NNN>-<slug>/
  script.md                    ← markdown-scriptwriter（新格式）
  presentation.html            ← markdown-to-html（镜头级渲染）
  paper-texture-bg.png         ← markdown-to-html
  audio/                       ← tts-voiceover
    shot-001.wav               ← 扁平化命名
    shot-002.wav
    shot-003.wav
    ...
  tts-manifest.json            ← tts-voiceover（新格式）
  subtitles.srt                ← subtitle-timeline
  video/                       ← video-render
    silent.mp4
    full-audio.wav
    final.mp4
```

## 8. 时间轴引擎重写

### 旧引擎核心概念
- Scene（场景）→ Step（步骤）→ Action（动作）
- 自动播放：场景切换 + step 推进

### 新引擎核心概念
- Shot（镜头）→ CanvasGroup（画布组归属）→ Transition（过渡类型）
- 自动播放：按镜头序列推进，画布组内做增量渲染，组间做过渡动画

### 新引擎 API

```javascript
class ShotTimelineEngine {
  constructor(config) {
    this.shots = config.shots;        // 镜头配置数组
    this.shotGap = config.shotGap;    // 镜头间隔 300ms
    this.groupTransition = config.groupTransition; // 组切换 600ms
  }

  // 自动播放
  play() { /* 逐镜头推进 */ }

  // 切到下一镜头
  nextShot() {
    const current = this.shots[this.currentIndex];
    const next = this.shots[this.currentIndex + 1];

    if (next.canvasGroup !== current.canvasGroup) {
      // 画布组切换：淡出当前组 → 淡入新组
      this.transitionGroup(current, next);
    } else {
      // 同组：画布演化（增量渲染）
      this.evolveCanvas(current, next);
    }
  }

  // 画布演化：执行 shot-enter/exit/morph
  evolveCanvas(from, to) { /* ... */ }

  // 画布组切换：整体过渡
  transitionGroup(from, to) { /* ... */ }
}
```

## 9. 品牌色系（不变）

| 名称 | 用途 | 色值 |
|------|------|------|
| 纸浆米白 | 背景 | `#FAF3E9` |
| 陶土棕 | 主色 / 正常状态 | `#7A4F2A` |
| 暖金棕 | 强调 / 过渡 | `#B8802E` |
| 橄榄深绿 | 辅助 / 次要 | `#4A6741` |
| 深棕 | 文字 | `#1a1408` |
| 赤陶红 | 警告 / 错误 | `#8B2515` |

## 10. 完整流程示例

以优秀案例前 6 个镜头为例，展示新格式如何表达：

```markdown
---
title: "Harness Engineering 驾驭工程"
author: "AI 科普"
topic: "AI 工程"
style: "科普讲解"
target_audience: "AI 从业者/爱好者"
estimated_duration: "4分钟"
total_shots: 22
canvas_groups: 7
---

## 画布组 1：开场冲击

### 镜头 1（切换）
**话术**: "Harness Engineering 是什么"
**画面类型**: character + text-effect
**元素**: 画面中央偏右，卡通银发女孩骑灰色机械马奔跑（简笔SVG），背景为暖色夕阳渐变（陶土棕→暖金棕），有战场元素（断矛、烟雾用淡灰SVG线条暗示）。左上角"Harness Engineering"文字，陶土棕色，48px。
**动效**: 角色从右侧滑入，文字从左上角淡入缩放。

### 镜头 2（延续）
**话术**: "和提示词工程有什么关系"
**画面类型**: text-effect
**元素**: 画面保留前一镜头所有元素。右上角新增"Prompt Engineering"文字，橄榄深绿色。背景色调整体偏暗（降低亮度10%）。
**动效**: 新文字从右侧滑入，背景色渐变变暗。

## 画布组 2：信息来源

### 镜头 3（切换）
**话术**: "2026 年 OpenAI 在一篇博客文章提到了 Harness Engineering"
**画面类型**: screenshot
**元素**: 左侧为地球SVG简图（圆形+经纬线），标注"2026年"暖金棕大字（64px）。右侧为博客截图模拟框（圆角矩形+浏览器顶栏三点），内容为标题文字"Harness engineering: leveraging Codex in an agent-first world"。
**动效**: 地球缩放入场，0.5秒后博客框从右侧滑入。

### 镜头 4（延续）
**话术**: "驾驭工程，之后就快速在 AI 圈里火了起来"
**画面类型**: icon-combo + text-effect
**元素**: 博客框下方新增中文翻译"驾驭工程"（暖金棕，56px）。右下角三个火焰图标（SVG，陶土棕→赤陶红渐变）。
**动效**: 中文翻译淡入，火焰图标依次缩放出现（stagger 200ms）。

## 画布组 3：现象描述

### 镜头 5（切换）
**话术**: "很多人根本不知道它到底是什么就开始各种跟风吹爆"
**画面类型**: screenshot + text-effect
**元素**: 模拟浏览器界面，内含"Harness Engineering"的多种中文翻译（牛码工程、驾驭工程、马具工程、驱码工程），每个翻译用不同色块卡片。右侧卡通小人（简笔圆头+身体），周围环绕赤陶红色夸张文字："震惊！""重磅！""天塌了！""好炸裂！""牛爆了"。
**动效**: 浏览器框淡入，翻译卡片依次弹入，夸张文字最后爆炸式散开出现。

### 镜头 6（延续）
**话术**: "这在三天一重磅五天一炸裂的 AI 圈里"
**画面类型**: text-effect
**元素**: 画面保留，夸张文字开始旋转/脉动动画，整体氛围更加混乱。
**动效**: 文字元素添加脉动动画（scale 1→1.1 循环），轻微旋转抖动。
```

## 11. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 镜头数量暴增（30-80个） | AI 创作 HTML 的总工作量大增 | 延续镜头只写增量代码，单镜头代码量小（30-80行） |
| 画布演化的增量渲染复杂 | 元素叠加可能产生布局冲突 | html-layout-review 逐镜头验收 |
| Puppeteer 录制频繁切换 | 切换时可能截到过渡中间态 | 每次切换后等待 transition 完成再截帧 |
| 旧格式不兼容 | 已有项目无法使用 | 已有项目保留在旧目录，新项目用新格式 |
| 单镜头 5-40 字话术可能 TTS 太短 | 音频碎片化 | 允许弹性 1-10 秒，长概念可以 40 字（约 5-8 秒） |

## 12. 实施计划

### 阶段 1：markdown-scriptwriter 重构
- 定义新文案格式规范
- 重写 brainstorming 流程（增加画布组/镜头/互动节点确认）
- 输出新格式 `script.md`

### 阶段 2：markdown-to-html 重构
- 重写解析脚本（解析新格式 Markdown）
- 重写 HTML 骨架（canvas-group + shot 结构）
- 重写时间轴引擎（ShotTimelineEngine）
- 重写增量组装脚本
- 定义每种画面类型的创作指南

### 阶段 3：tts-voiceover 适配
- manifest 格式从 scenes→lines 改为 shots 扁平结构
- 音频文件命名从 `scene-NN/NNN.wav` 改为 `shot-NNN.wav`

### 阶段 4：subtitle-timeline 简化重写
- 1:1 映射逻辑（一镜一句一条 SRT）
- 重写 HTML duration 的逻辑适配新 timelineConfig 格式

### 阶段 5：video-render 适配
- 适配新的 HTML 结构和时间轴引擎
- 确保画布组切换时的截帧稳定性
- 测试大量镜头（50+）的录制性能

### 阶段 6：html-layout-review 适配
- 调整验收标准为逐镜头验收
- 增加画布组内增量渲染的重叠检测

## 13. 成功标准

- [ ] 新格式输出的视频，前 30 秒内有 6+ 个画面变化
- [ ] 镜头切换节奏与优秀案例接近（平均 2-5 秒/镜头）
- [ ] 支持所有 8 种画面类型
- [ ] 画布组内的画布演化流畅无跳变
- [ ] 互动节点正常渲染
- [ ] 完整链路可跑通（script.md → final.mp4）
