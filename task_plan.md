# 方案 B 执行计划：HTML 视频录制注入 Remotion

## 目标

将 `html-ppt-skill` 的高质量 HTML 模板效果（含动态 Canvas 特效和 CSS 动画）融入 `markdown-to-video` 系统，通过 **Playwright 对每页 HTML 幻灯片录制短视频**，再作为背景层注入 Remotion 渲染管线，最终叠加字幕和音频输出 .mp4。

## 关键路径

| 项目 | 本地路径 |
|------|---------|
| markdown-to-video（本项目） | `/Users/bierchen/project-person/markdown-to-video` |
| html-ppt-skill（模板源） | `/Users/bierchen/project-person/html-ppt-skill` |
| html-ppt-skill GitHub | `https://github.com/lewislulu/html-ppt-skill` |

## 核心设计决策

### 关于"动态效果丢失"问题的解决方案

**问题**：HTML 页面包含 Canvas 特效（粒子爆炸、矩阵雨、知识图谱等）和 CSS 动画（fade-up、glitch-in 等），如果只截图就永远是静态帧。

**解决方案**：**用 Playwright 按帧录制视频片段，而不是截图**

```
每页 HTML slide → Playwright 启动 → 等待动画开始 → 按帧截图序列 → ffmpeg 编码为短视频 → 注入 Remotion <Video> 组件
```

具体技术路径：
1. Playwright 打开 HTML slide（`?preview=N` 模式只显示单页）
2. 等待 `fx-runtime.js` 初始化 Canvas 特效（约 500ms）
3. 以 30fps 速率，通过 `page.screenshot()` 连续截取 N 帧
4. 用 ffmpeg 将帧序列编码为 `.mp4` 片段（或直接用 Playwright 的 video recording 功能）
5. Remotion 中用 `<OffthreadVideo>` 加载该片段作为背景

**录制时长** = 该页的 `durationInFrames / fps`（与音频对齐）

### 关键架构：双轨渲染模式

```
Markdown frontmatter 中新增:
  renderer: html-ppt          ← 使用 html-ppt 模板渲染（新）
  renderer: native             ← 使用现有 React 布局渲染（默认/当前）
  theme: tokyo-night           ← html-ppt 主题选择
  template: tech-sharing       ← 使用哪个 full-deck 模板
```

---

## Phase 1: 基础设施搭建 [status: done]

### 1.1 安装依赖
- [x] 安装 `playwright`（用于 Headless Chrome 录制）
- [x] 确认 `ffmpeg` 可用（已有，用于 ffprobe）

### 1.2 将 html-ppt-skill 资产集成到项目
- [x] 在项目中创建 `vendor/html-ppt/` 目录
- [x] 拷贝核心文件：
  - `assets/base.css`
  - `assets/fonts.css`
  - `assets/runtime.js`
  - `assets/themes/*.css`（36 个主题）
  - `assets/animations/animations.css`
  - `assets/animations/fx-runtime.js`
  - `assets/animations/fx/*.js`（20 个 Canvas 特效）
  - `templates/single-page/*.html`（31 种布局参考）
  - `templates/full-decks/`（15 个完整模板）

### 1.3 创建本地 HTTP 静态服务
- [x] 创建 `scripts/lib/html-server.mjs`
- [x] 功能：启动一个轻量 HTTP 服务器，供 Playwright 加载 HTML 文件
- [x] 原因：Playwright 加载 `file://` URL 时字体和 Canvas FX 可能受限

**文件清单**：
- `vendor/html-ppt/`（资产目录）
- `scripts/lib/html-server.mjs`

---

## Phase 2: Markdown → HTML 生成器 [status: done]

### 2.1 创建 HTML 生成脚本
- [x] 创建 `scripts/lib/html-slide-generator.mjs`
- [x] 输入：解析后的 MarkdownPresentation（slides 数组）
- [x] 输出：为每页 slide 生成一个完整的 `.html` 文件

### 2.2 生成逻辑

```
对于 presentation 中的每一页 slide:

1. 选择模板:
   - 若 frontmatter 指定 template → 使用对应 full-deck 模板的 HTML 结构
   - 若未指定 → 根据 slide-variant.ts 同样的规则选择 single-page 布局

2. 选择主题:
   - 若 frontmatter 指定 theme → 使用对应 themes/*.css
   - 默认 → tokyo-night（暗色技术风，与现有风格最接近）

3. 填充内容:
   - heading → <h1 class="h1"> 或 <h2 class="h2">
   - bulletItems → <ul> 或 .grid 中的 .card 组件
   - orderedItems → 带编号的 .card 或 .agenda-row
   - codeBlock → .terminal 组件
   - paragraphs → <p class="lede">

4. 添加动画:
   - 根据 slide 位置自动分配 data-anim（fade-up, rise-in, stagger-list 等）
   - 若 frontmatter 指定 fx（如 <!-- fx: matrix-rain -->）→ 添加 data-fx 属性

5. 生成独立 HTML 文件:
   <html>
     <link href="base.css">
     <link href="themes/{theme}.css">
     <link href="animations.css">
     <body class="single">
       <div class="deck">
         <section class="slide is-active">
           ...内容...
           <div data-fx="particle-burst"></div>  <!-- 可选 Canvas 特效 -->
         </section>
       </div>
     </body>
     <script src="runtime.js">
     <script src="fx-runtime.js">  <!-- 如果有 data-fx -->
   </html>
```

### 2.3 内容到 HTML 布局的映射规则

| 现有 variant | html-ppt 对应布局 | 说明 |
|-------------|------------------|------|
| hero | cover / title-center | 封面大标题 |
| split-list | two-col-cards | 左信息右列表 |
| timeline | timeline-vertical | 垂直时间轴 |
| grid | kpi-grid | 2×2 指标卡片 |
| code | code-terminal | 终端代码窗口 |
| quote | big-quote | 大字引用 |
| triptych | three-col-cards | 三列卡片 |
| stat-cards | stat-counter | 数字统计 |
| centered | title-center | 居中大字 |
| minimal | minimal-closing | 极简结尾 |
| ... | 其余做合理映射 | ... |

**文件清单**：
- `scripts/lib/html-slide-generator.mjs`

---

## Phase 3: HTML → 视频片段录制器 [status: done]

### 3.1 创建录制脚本
- [x] 创建 `scripts/lib/html-video-recorder.mjs`
- [x] 核心功能：对每个 HTML slide 文件录制指定时长的视频片段

### 3.2 录制实现（Playwright Video Recording）

```javascript
const context = await browser.newContext({
  recordVideo: {
    dir: outputDir,
    size: { width: 1920, height: 1080 }
  }
});
const page = await context.newPage();
await page.goto(slideUrl);
await page.waitForTimeout(durationMs); // 等待动画播放完整时长
await context.close(); // 关闭时自动保存 .webm
// ffmpeg -i slide.webm -c:v libx264 -pix_fmt yuv420p slide.mp4
```

Canvas 特效和 CSS 动画由 Headless Chromium 原生执行，录制的视频完整保留所有动态效果。输出 .webm 后用 ffmpeg 转为 Remotion 兼容的 H.264 .mp4。

### 3.3 录制流程

```
输入: slides[], durationPerSlide[], theme, fx 配置
输出: slide-01.mp4, slide-02.mp4, ...

1. 启动 HTTP 静态服务 → http://localhost:{port}/
2. 启动 Playwright (Chromium, 1920×1080)
3. 对于每一页:
   a. page.goto(`http://localhost:{port}/generated-slides/slide-{N}.html`)
   b. 等待字体加载完成（document.fonts.ready）
   c. 等待 Canvas FX 初始化（若有 data-fx，等待 500ms）
   d. 开始录制 / 截帧
   e. 录制 durationInFrames / fps 秒
   f. 停止，保存为 slide-{N}.mp4
4. 关闭 Playwright 和 HTTP 服务
```

### 3.4 性能优化
- [ ] 可复用同一个 browser 实例，只切换页面
- [ ] 对无 Canvas FX 的页面，可降低等待时间
- [ ] 生成的视频缓存机制：按内容 hash 缓存，未改动的页面不重新录制

**文件清单**：
- `scripts/lib/html-video-recorder.mjs`

---

## Phase 4: Remotion 渲染层适配 [status: done]

### 4.1 新增 HTML 背景视频组件
- [x] 创建 `src/video/components/HtmlSlideBackground.tsx`
- [x] 使用 Remotion 的 `<OffthreadVideo>` 加载录制好的视频片段
- [x] 作为 `SceneChrome` 的替代背景层

```tsx
// HtmlSlideBackground.tsx
import { OffthreadVideo, staticFile } from 'remotion';

export const HtmlSlideBackground: React.FC<{
  videoSrc: string;  // e.g. "generated/html-slides/slide-01.mp4"
}> = ({ videoSrc }) => (
  <OffthreadVideo
    src={staticFile(videoSrc)}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
  />
);
```

### 4.2 修改 MarkdownVideo.tsx 支持双轨渲染
- [x] 检测 `presentation.meta.renderer === 'html-ppt'`
- [x] 若为 html-ppt 模式：
  - 不再使用 React 布局组件（HeroSlideLayout 等）
  - 改为渲染 `<HtmlSlideBackground>` + 字幕层 + 音频层
- [x] 若为 native 模式（默认）：保持现有逻辑不变

```tsx
// MarkdownVideo.tsx 中的 SlideCard 修改
if (presentation.meta.renderer === 'html-ppt' && slide.htmlVideoSrc) {
  return (
    <AbsoluteFill>
      <HtmlSlideBackground videoSrc={slide.htmlVideoSrc} />
      {/* 字幕层 - 复用现有 captionShell */}
      {activeCaption && (
        <div style={styles.captionShell}>
          <div style={styles.captionText}>{activeCaption.text}</div>
        </div>
      )}
      {/* 音频层 */}
      {slide.audioSrc && <Html5Audio src={staticFile(slide.audioSrc)} />}
    </AbsoluteFill>
  );
}
```

### 4.3 类型扩展
- [x] 在 `MarkdownSlide` 中新增 `htmlVideoSrc?: string`
- [x] 在 `PresentationMeta` 中新增 `renderer?: 'native' | 'html-ppt'`、`theme?: string`、`template?: string`

**文件清单**：
- `src/video/components/HtmlSlideBackground.tsx`（新建）
- `src/video/MarkdownVideo.tsx`（修改）
- `src/video/types.ts`（修改）
- `src/markdown.ts`（修改，新增 frontmatter 字段）

---

## Phase 5: Pipeline 集成 [status: done]

### 5.1 修改构建管线
- [x] 修改 `scripts/lib/markdown-video-pipeline.mjs`
- [x] 在 `createPresentationAssets()` 中新增：
  1. 检测 `renderer === 'html-ppt'`
  2. 调用 HTML 生成器：Markdown → HTML slides
  3. 调用视频录制器：HTML slides → .mp4 片段
  4. 将视频路径写入 slide.htmlVideoSrc

### 5.2 完整管线流程（html-ppt 模式）

```
Markdown 文件
    │
    ├── parseFrontmatter()      → meta (含 renderer, theme, template)
    ├── split slides             → slide[]
    ├── extractVoiceover()       → narration
    │
    ├── generateHtmlSlides()     → vendor/html-ppt/generated/{key}/slide-{N}.html  [新增]
    ├── recordHtmlVideos()       → public/generated/{key}/html-slide-{N}.mp4      [新增]
    │
    ├── generateSpeech()         → public/generated/{key}/slide-{N}.wav（TTS 不变）
    ├── getAudioDuration()       → durationInFrames（不变）
    ├── buildCaptionCues()       → captionCues（不变）
    │
    └── 输出 MarkdownPresentation JSON（含 htmlVideoSrc 字段）
```

### 5.3 新增 Markdown frontmatter 字段

```yaml
---
title: 我的技术分享
renderer: html-ppt           # 使用 html-ppt 渲染模式
theme: tokyo-night            # html-ppt 主题（36 个可选）
template: tech-sharing        # html-ppt 全 deck 模板（15 个可选）
ttsProvider: qwen-local
---
```

### 5.4 增量渲染支持
- [x] 修改 `scripts/render-incremental.mjs`
- [x] HTML 视频也纳入缓存：按 slide 内容 + theme + template 的 hash 判断是否需要重新录制

**文件清单**：
- `scripts/lib/markdown-video-pipeline.mjs`（修改）
- `scripts/render-incremental.mjs`（修改）

---

## Phase 6: 预览与开发体验 [status: done]

### 6.1 预览流程适配
- [x] 修改 `scripts/prepare-preview.mjs`
- [x] 当 renderer=html-ppt 时，先生成 HTML → 录制视频 → 写入 preview-presentation.ts
- [x] Remotion Studio 中可实时预览

### 6.2 单页预览支持
- [ ] 修改 `scripts/preview-still.mjs` / `scripts/preview-slide.mjs`
- [ ] 支持 html-ppt 模式的单页预览

### 6.3 开发时热重载
- [ ] HTML slide 修改后可快速重录单页
- [ ] 不需要重录未改动的页

**文件清单**：
- `scripts/prepare-preview.mjs`（修改）
- `scripts/preview-still.mjs`（修改）
- `scripts/preview-slide.mjs`（修改）

---

## Phase 7: 文档与示例 [status: done]

### 7.1 更新文档
- [x] 创建 `docs/html-ppt-guide.md`：html-ppt 渲染模式专用文档

### 7.2 创建示例文件
- [x] 创建 `examples/demo/html-ppt-demo.md`：使用 html-ppt 模式的示例 Markdown
- [x] 展示主题切换、Canvas 特效指定等功能

**文件清单**：
- `docs/html-ppt-guide.md`（新建）
- `docs/markdown-guide.md`（修改）
- `examples/demo/html-ppt-demo.md`（新建）
- `README.md`（修改）

---

## 依赖关系图

```
Phase 1 (基础设施) ──┬──→ Phase 2 (HTML 生成器) ──→ Phase 3 (视频录制器)
                     │                                      │
                     │                                      ▼
                     └──────────────────────────────→ Phase 4 (Remotion 适配)
                                                           │
                                                           ▼
                                                    Phase 5 (Pipeline 集成)
                                                           │
                                                           ▼
                                                    Phase 6 (预览体验)
                                                           │
                                                           ▼
                                                    Phase 7 (文档示例)
```

## 预估工作量

| Phase | 预估时间 | 复杂度 |
|-------|---------|--------|
| Phase 1: 基础设施 | 0.5 天 | 低（拷贝+配置） |
| Phase 2: HTML 生成器 | 1.5 天 | 高（30 种布局映射） |
| Phase 3: 视频录制器 | 1 天 | 中（Playwright API 调用） |
| Phase 4: Remotion 适配 | 0.5 天 | 低（组件简单） |
| Phase 5: Pipeline 集成 | 1 天 | 中（管线对接+缓存） |
| Phase 6: 预览体验 | 0.5 天 | 低 |
| Phase 7: 文档示例 | 0.5 天 | 低 |
| **总计** | **~5 天** | |

## 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Playwright 录制的视频帧率不稳 | 动画抖动 | 调整 `--disable-frame-rate-limit` 启动参数，或增加录制时长后裁剪 |
| Canvas FX 在 Headless Chrome 中表现不同 | 特效缺失 | 使用 `--enable-features=Vulkan` 或 `--use-gl=angle` |
| 字体加载超时 | 显示 fallback 字体 | 预加载 woff2 + 增加 waitForTimeout |
| 录制时间过长（多页×长时长） | 渲染慢 | 并行录制 + 缓存未改动页 |
| Remotion `<OffthreadVideo>` 不支持某些编码 | 播放失败 | 统一用 H.264 + AAC 编码 |

## 新增 Markdown 语法示例

```markdown
---
title: AI 如何改变开发工作流
renderer: html-ppt
theme: tokyo-night
template: tech-sharing
ttsProvider: qwen-local
ttsVoice: Vivian
---
# AI 如何改变开发工作流

<!-- fx: particle-burst -->

关键词驱动的新范式正在颠覆传统编程。

- 代码生成从 prompt 开始
- 测试用例自动覆盖
- 文档随代码同步更新

<!-- voiceover
大家好，这一页我们来看 AI 如何改变整个开发工作流。
-->

---

## 三大核心变化

<!-- fx: knowledge-graph -->

1. **Prompt Engineering 取代部分编码**
2. **AI Review 提升代码质量**
3. **自动化测试覆盖率翻倍**

<!-- voiceover
AI 带来的三大核心变化分别是……
-->
```

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| (尚无) | | |
