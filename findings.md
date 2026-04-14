# 重构发现与研究记录

## 项目现状分析

### MarkdownVideo.tsx 结构拆解 (4087 行)

| 行号范围 | 模块 | 行数 | 说明 |
|---------|------|------|------|
| 1-21 | imports + 类型 | 21 | react-markdown, remotion, markdown.ts |
| 23-39 | MarkdownVideoProps, SlideVariant, SlideStructure | 17 | 类型定义 |
| 41-71 | markdownComponents | 31 | ReactMarkdown 自定义组件 |
| 73-96 | 工具函数 | 24 | getSlideOffsets, getActiveCaption, stripMarkdownSyntax |
| 98-198 | AppIcon 组件 | 101 | 11 种 SVG 手绘图标 |
| 200-227 | IconBadge 组件 | 28 | 图标徽章封装 |
| 229-393 | 关键词匹配 | 165 | matchKeywordIcon, getVariantIcon, getSlideIcon, getItemIcon, getIconLabel, matchKeywordColor |
| 394-557 | 色彩系统 | 164 | slideAccentPalettes, itemTonePalettes, getSlideAccentColor, getDistinctItemToneColors |
| 559-629 | 内容结构解析 | 71 | getNarrationSentences, parseSlideStructure |
| 631-757 | 布局选择算法 | 127 | getSlideVariant |
| 759-832 | 布局主题 | 74 | getLayoutTheme (背景/orbScale) |
| 834-931 | SceneChrome | 98 | 场景底板组件 |
| 933-989 | HeroSlideLayout | 57 | |
| 991-1089 | SplitListSlideLayout | 99 | |
| 1091-1184 | GridSlideLayout | 94 | |
| 1186-1288 | MosaicSlideLayout | 103 | |
| 1290-1393 | ArgumentSlideLayout | 104 | |
| 1395-1495 | TriptychSlideLayout | 101 | |
| 1497-1596 | ManifestoSlideLayout | 100 | |
| 1598-1704 | TimelineSlideLayout | 107 | |
| 1706-1787 | SpotlightSlideLayout | 82 | |
| 1789-1897 | QuoteSlideLayout | 109 | |
| 1899-1962 | CodeSlideLayout | 64 | |
| 1964-2011 | PanelSlideLayout | 48 | |
| 2013-2076 | TableSlideLayout | 64 | |
| 2078-2103 | CenteredSlideLayout | 26 | |
| 2105-2143 | WaterfallSlideLayout | 39 | |
| 2145-2185 | RadarSlideLayout | 41 | |
| 2187-2234 | CompareSlideLayout | 48 | |
| 2236-2275 | PyramidSlideLayout | 40 | |
| 2277-2318 | StatCardsSlideLayout | 42 | |
| 2320-2343 | HeadlineSlideLayout | 24 | |
| 2345-2380 | SidebarNoteSlideLayout | 36 | |
| 2382-2422 | FilmstripSlideLayout | 41 | |
| 2424-2460 | DuoSlideLayout | 37 | |
| 2462-2501 | OrbitSlideLayout | 40 | |
| 2503-2543 | KanbanSlideLayout | 41 | |
| 2545-2589 | StackSlideLayout | 45 | |
| 2591-2615 | AccentBarSlideLayout | 25 | |
| 2617-2653 | SplitQuoteSlideLayout | 37 | |
| 2655-2693 | ChecklistSlideLayout | 39 | |
| 2695-2713 | MinimalSlideLayout | 19 | |
| 2715-2762 | MagazineSlideLayout | 48 | |
| 2764-2993 | SlideCard 路由 | 230 | |
| 2996-3024 | MarkdownVideo 主组件 | 29 | |
| 3026-4087 | styles 对象 | 1062 | CSS-in-JS |

### README 内容段落分析 (589 行)

| 行号范围 | 内容 | 行数 | 去向 |
|---------|------|------|------|
| 1-22 | 项目介绍 + 目录说明 | 22 | 保留在 README |
| 24-29 | 环境要求 | 6 | 保留在 README |
| 31-53 | Windows 安装 | 23 | 保留在 README |
| 55-118 | 快速开始 (macOS/Linux) | 64 | 保留在 README |
| 120-138 | 常用命令 | 19 | 保留在 README（精简） |
| 140-197 | 视频制作流程 | 58 | → docs/video-guide.md |
| 199-255 | 增量渲染 | 57 | → docs/video-guide.md |
| 257-303 | 单页音频重新生成 | 47 | → docs/audio-guide.md |
| 304-343 | 样式调试工作流 | 40 | → docs/video-guide.md |
| 345-432 | Markdown 写法 + 控制字段 + 布局列表 | 88 | → docs/markdown-guide.md |
| 434-443 | 输出产物 | 10 | → docs/markdown-guide.md |
| 444-487 | Qwen3-TTS 配置 | 44 | → docs/audio-guide.md |
| 488-543 | MiMo-V2-TTS | 56 | → docs/audio-guide.md |
| 545-561 | 系统 TTS + 日志 | 17 | → docs/audio-guide.md + README |
| 563-589 | 示例 + 使用场景 + 后续扩展 | 27 | 保留在 README |

### 导入依赖关系

MarkdownVideo.tsx 内部模块间的依赖：

```
styles ← 所有布局组件, markdownComponents, SceneChrome
AppIcon ← IconBadge
IconBadge ← 所有布局组件, SceneChrome
matchKeywordIcon ← getSlideIcon, getItemIcon
matchKeywordColor ← getSlideAccentColor, getDistinctItemToneColors
slideAccentPalettes ← getSlideAccentColor
itemTonePalettes ← getDistinctItemToneColors
parseSlideStructure ← SlideCard
getSlideVariant ← SlideCard
getSlideAccentColor ← SlideCard
SceneChrome ← 所有布局组件
布局组件 ← SlideCard
SlideCard ← MarkdownVideo
```

### 所有布局组件的共同 Props

```typescript
type LayoutProps = {
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
};
```

唯一例外: `PanelSlideLayout` 没有 `structure` prop（它自己内部调用 parseSlideStructure）

### Root.tsx 的导入需要更新

```typescript
// 当前
import {MarkdownVideo, type MarkdownVideoProps} from './MarkdownVideo';

// 改后
import {MarkdownVideo, type MarkdownVideoProps} from './video/MarkdownVideo';
```
