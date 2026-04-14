# Markdown-to-Video 项目重构计划

## 目标

对 markdown-to-video 项目进行两项重构：
1. **README 拆分** — 将 589 行的巨型 README 拆分为精简主文档 + 专题子文档
2. **视频架构拆分** — 将 4087 行的 `MarkdownVideo.tsx` 拆分为模块化的文件结构

## 约束

- 不能破坏现有功能（所有 npm scripts 必须正常工作）
- 视频渲染的视觉效果必须完全一致
- TypeScript 类型检查 (`npm run check`) 必须通过
- 保持 `src/markdown.ts` 不变（纯数据层，已经很好）

---

## Phase 1: README 拆分 [status: pending]

### 1.1 创建 `docs/markdown-guide.md` [status: pending]
从 README 中抽出：
- Markdown 写法约定（frontmatter、分页、voiceover）
- 支持的控制字段列表
- 30 种布局列表及推荐策略
- 输出产物说明

### 1.2 创建 `docs/audio-guide.md` [status: pending]
从 README 中抽出：
- 默认 Qwen3-TTS 配置说明
- 使用 Qwen3-TTS 本地模型（下载、配置、渲染）
- 使用 MiMo-V2-TTS 云端语音（API Key、音色、渲染）
- 系统 TTS 说明
- 单页音频重新生成（tts:redo 用法、工作原理）

### 1.3 创建 `docs/video-guide.md` [status: complete]
从 README 中抽出：
- 视频制作流程（四步法：截图预览 → 试听音频 → 修复问题 → 生成视频）
- 增量渲染（render:fast）详细说明（性能对比、用法、工作原理、何时 --force）
- 样式调试工作流（避免重复跑 TTS）

### 1.4 精简 README.md [status: pending]
README 只保留：
- 项目一句话介绍 + "项目能做什么"
- 目录说明
- 环境要求
- 快速开始（macOS/Linux + Windows）
- 常用命令表（精简版，每条带一句话说明）
- 各专题文档链接（指向 docs/ 下的子文档）
- 示例文件 + 使用场景 + 后续可扩展

目标：README 控制在 **200 行以内**。

---

## Phase 2: 视频架构拆分 [status: complete]

### 2.1 创建新目录结构 [status: pending]
```
src/
├── video/
│   ├── components/
│   │   ├── MarkdownRenderer.tsx    # markdownComponents + tablePageComponents
│   │   ├── SceneChrome.tsx         # 场景底板组件
│   │   └── icons/
│   │       ├── AppIcon.tsx         # SVG 图标组件
│   │       └── IconBadge.tsx       # 图标徽章组件
│   ├── layouts/                    # 每种布局一个文件
│   │   ├── index.ts               # 统一导出
│   │   ├── HeroSlideLayout.tsx
│   │   ├── SplitListSlideLayout.tsx
│   │   ├── GridSlideLayout.tsx
│   │   ├── MosaicSlideLayout.tsx
│   │   ├── ArgumentSlideLayout.tsx
│   │   ├── TriptychSlideLayout.tsx
│   │   ├── ManifestoSlideLayout.tsx
│   │   ├── TimelineSlideLayout.tsx
│   │   ├── SpotlightSlideLayout.tsx
│   │   ├── QuoteSlideLayout.tsx
│   │   ├── CodeSlideLayout.tsx
│   │   ├── PanelSlideLayout.tsx
│   │   ├── TableSlideLayout.tsx
│   │   ├── CenteredSlideLayout.tsx
│   │   ├── WaterfallSlideLayout.tsx
│   │   ├── RadarSlideLayout.tsx
│   │   ├── CompareSlideLayout.tsx
│   │   ├── PyramidSlideLayout.tsx
│   │   ├── StatCardsSlideLayout.tsx
│   │   ├── HeadlineSlideLayout.tsx
│   │   ├── SidebarNoteSlideLayout.tsx
│   │   ├── FilmstripSlideLayout.tsx
│   │   ├── DuoSlideLayout.tsx
│   │   ├── OrbitSlideLayout.tsx
│   │   ├── KanbanSlideLayout.tsx
│   │   ├── StackSlideLayout.tsx
│   │   ├── AccentBarSlideLayout.tsx
│   │   ├── SplitQuoteSlideLayout.tsx
│   │   ├── ChecklistSlideLayout.tsx
│   │   ├── MinimalSlideLayout.tsx
│   │   └── MagazineSlideLayout.tsx
│   ├── theme/
│   │   ├── palettes.ts            # slideAccentPalettes + itemTonePalettes
│   │   ├── layout-theme.ts        # getLayoutTheme (背景/orbScale)
│   │   └── keyword-matching.ts    # matchKeywordIcon + matchKeywordColor + 相关函数
│   ├── logic/
│   │   ├── slide-structure.ts     # parseSlideStructure
│   │   └── slide-variant.ts       # getSlideVariant
│   ├── styles.ts                  # 全部 CSS-in-JS 样式（styles 对象）
│   ├── types.ts                   # SlideVariant, SlideStructure, MarkdownVideoProps 等类型
│   ├── utils.ts                   # getSlideOffsets, getActiveCaption, stripMarkdownSyntax, getNarrationSentences
│   ├── SlideCard.tsx              # 布局路由分发组件
│   └── MarkdownVideo.tsx          # 主组件（精简后 ~30 行）
├── markdown.ts                    # 不变
├── Root.tsx                       # 更新 import 路径
├── index.ts                       # 不变
└── generated/
    └── preview-presentation.ts    # 不变
```

### 2.2 抽取类型定义 `src/video/types.ts` [status: pending]
- `MarkdownVideoProps`
- `SlideVariant`
- `SlideStructure`
- `IconName`
- 布局组件通用 Props 类型

### 2.3 抽取工具函数 `src/video/utils.ts` [status: pending]
- `getSlideOffsets`
- `getActiveCaption`
- `stripMarkdownSyntax`
- `getNarrationSentences`

### 2.4 抽取主题系统 `src/video/theme/` [status: pending]
- `palettes.ts`: `slideAccentPalettes` + `itemTonePalettes` + `getSlideAccentColor` + `getDistinctItemToneColors`
- `layout-theme.ts`: `getLayoutTheme` (backgroundByVariant + orbScaleByVariant)
- `keyword-matching.ts`: `matchKeywordIcon` + `matchKeywordColor` + `getVariantIcon` + `getSlideIcon` + `getItemIcon` + `getIconLabel`

### 2.5 抽取图标组件 `src/video/components/icons/` [status: pending]
- `AppIcon.tsx`: SVG 图标组件
- `IconBadge.tsx`: 图标徽章组件

### 2.6 抽取 Markdown 渲染组件 `src/video/components/MarkdownRenderer.tsx` [status: pending]
- `markdownComponents`
- `tablePageComponents`

### 2.7 抽取场景底板 `src/video/components/SceneChrome.tsx` [status: pending]
- `SceneChrome` 组件

### 2.8 抽取布局逻辑 `src/video/logic/` [status: pending]
- `slide-structure.ts`: `parseSlideStructure`
- `slide-variant.ts`: `getSlideVariant`

### 2.9 抽取样式 `src/video/styles.ts` [status: pending]
- 整个 `styles` 对象（~1060 行）

### 2.10 拆分 30 种布局到 `src/video/layouts/` [status: pending]
每种布局一个文件，共 30+ 个文件，每个 40-100 行。
统一通过 `layouts/index.ts` 导出。

### 2.11 重写 `src/video/SlideCard.tsx` [status: pending]
- 从 `layouts/index.ts` 导入所有布局
- 根据 variant 分发到对应布局组件

### 2.12 重写主组件 `src/video/MarkdownVideo.tsx` [status: pending]
- 精简到 ~30 行
- 只做 Sequence 编排

### 2.13 更新 `src/Root.tsx` 导入路径 [status: pending]
- `./MarkdownVideo` → `./video/MarkdownVideo`

### 2.14 删除旧的 `src/MarkdownVideo.tsx` [status: pending]

### 2.15 验证 [status: pending]
- `npm run check` 通过 TypeScript 类型检查
- `npm run preview:still -- examples/demo/demo.md all` 截图对比
- 确认视觉效果一致

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |

---

## Decision Log

| Decision | Rationale |
|----------|-----------|
| README 和视频架构一起做 | 用户明确要求 |
| 布局每种一个文件 | 44% 代码量在布局，拆开后改单个布局不影响其他 |
| 保留 `src/markdown.ts` 不动 | 数据层干净，不需要改 |
| 新视频代码放 `src/video/` | 避免 src 根目录文件太多，形成清晰的子模块 |
| styles 单独一个文件 | 占 26% 行数，内联在组件里不利于维护 |
