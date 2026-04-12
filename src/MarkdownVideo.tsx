import ReactMarkdown, {type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import {
  analyzeMarkdownPresentation,
  type CaptionCue,
  type MarkdownPresentation,
  type MarkdownSlide,
  type SlideLayoutName,
} from './markdown';

export type MarkdownVideoProps = {
  markdown: string;
  themeColor?: string;
  presentation?: MarkdownPresentation;
};

type SlideVariant = SlideLayoutName;

type SlideStructure = {
  bulletItems: string[];
  orderedItems: string[];
  paragraphs: string[];
  codeBlock?: string;
  codeLanguage?: string;
  strongPhrases: string[];
  hasTable?: boolean;
};

const markdownComponents: Components = {
  h1: ({children}) => <h1 style={styles.h1}>{children}</h1>,
  h2: ({children}) => <h2 style={styles.h2}>{children}</h2>,
  h3: ({children}) => <h3 style={styles.h3}>{children}</h3>,
  p: ({children}) => <p style={styles.paragraph}>{children}</p>,
  ul: ({children}) => <ul style={styles.list}>{children}</ul>,
  ol: ({children}) => <ol style={styles.list}>{children}</ol>,
  li: ({children}) => <li style={styles.listItem}>{children}</li>,
  blockquote: ({children}) => <blockquote style={styles.blockquote}>{children}</blockquote>,
  code: ({children, className}) => {
    const isInline = !className;
    return isInline ? (
      <code style={styles.inlineCode}>{children}</code>
    ) : (
      <pre style={styles.preformatted}>
        <code>{children}</code>
      </pre>
    );
  },
  strong: ({children}) => <strong style={styles.strong}>{children}</strong>,
  table: ({children}) => (
    <div style={styles.tableWrapper}>
      <table style={styles.table}>{children}</table>
    </div>
  ),
  thead: ({children}) => <thead style={styles.thead}>{children}</thead>,
  tbody: ({children}) => <tbody>{children}</tbody>,
  tr: ({children}) => <tr style={styles.tr}>{children}</tr>,
  th: ({children}) => <th style={styles.th}>{children}</th>,
  td: ({children}) => <td style={styles.td}>{children}</td>,
};

const getSlideOffsets = (presentation: MarkdownPresentation) => {
  let current = 0;
  return presentation.slides.map((slide) => {
    const start = current;
    current += slide.durationInFrames;
    return start;
  });
};

const getActiveCaption = (cues: CaptionCue[], frame: number) => {
  return cues.find((cue) => frame >= cue.startFrame && frame < cue.endFrame) ?? null;
};

const stripMarkdownSyntax = (value: string) => {
  return value
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[>*_~]/g, '')
    .trim();
};

type IconName = 'spark' | 'layers' | 'switch' | 'alert' | 'focus' | 'clock' | 'check' | 'code' | 'trend' | 'quote' | 'list';

const AppIcon: React.FC<{
  color?: string;
  name: IconName;
  size?: number;
}> = ({color = 'currentColor', name, size = 20}) => {
  const commonProps = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2.35,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'spark' ? (
        <>
          <path {...commonProps} d="M12 3.5 13.8 8.2 18.5 10 13.8 11.8 12 16.5 10.2 11.8 5.5 10 10.2 8.2 12 3.5Z" />
          <path {...commonProps} d="M18 4.5v3" />
          <path {...commonProps} d="M19.5 6h-3" />
        </>
      ) : null}
      {name === 'layers' ? (
        <>
          <path {...commonProps} d="m12 4.5 7.5 4.2L12 13 4.5 8.7 12 4.5Z" />
          <path {...commonProps} d="m5.7 11.6 6.3 3.5 6.3-3.5" />
          <path {...commonProps} d="m5.7 15.3 6.3 3.7 6.3-3.7" />
        </>
      ) : null}
      {name === 'switch' ? (
        <>
          <path {...commonProps} d="M7 7h10" />
          <path {...commonProps} d="m13.8 3.8 3.2 3.2-3.2 3.2" />
          <path {...commonProps} d="M17 17H7" />
          <path {...commonProps} d="m10.2 20.2-3.2-3.2 3.2-3.2" />
        </>
      ) : null}
      {name === 'alert' ? (
        <>
          <path {...commonProps} d="M12 4.5 20 18.5H4L12 4.5Z" />
          <path {...commonProps} d="M12 9.5v4.2" />
          <path {...commonProps} d="M12 16.8h.01" />
        </>
      ) : null}
      {name === 'focus' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="6.2" />
          <circle {...commonProps} cx="12" cy="12" r="2.2" />
          <path {...commonProps} d="M12 2.8v2.4" />
          <path {...commonProps} d="M12 18.8v2.4" />
          <path {...commonProps} d="M2.8 12h2.4" />
          <path {...commonProps} d="M18.8 12h2.4" />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8.2" />
          <path {...commonProps} d="M12 7.8v4.7l3.3 2" />
        </>
      ) : null}
      {name === 'check' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8.2" />
          <path {...commonProps} d="m8.4 12.2 2.4 2.5 4.9-5" />
        </>
      ) : null}
      {name === 'code' ? (
        <>
          <path {...commonProps} d="m9.2 8.2-4 3.8 4 3.8" />
          <path {...commonProps} d="m14.8 8.2 4 3.8-4 3.8" />
          <path {...commonProps} d="m13.1 5.6-2.2 12.8" />
        </>
      ) : null}
      {name === 'trend' ? (
        <>
          <path {...commonProps} d="M5 17.5h14" />
          <path {...commonProps} d="m6.2 14.8 3.8-4 3.2 2.7 4.6-5.3" />
          <path {...commonProps} d="M15.2 8.2h2.6v2.6" />
        </>
      ) : null}
      {name === 'quote' ? (
        <>
          <path {...commonProps} d="M9.8 8.5H7.6A2.6 2.6 0 0 0 5 11.1V13a2.5 2.5 0 0 0 2.5 2.5H10V13H8.2" />
          <path {...commonProps} d="M18.8 8.5h-2.2a2.6 2.6 0 0 0-2.6 2.6V13a2.5 2.5 0 0 0 2.5 2.5H19V13h-1.8" />
        </>
      ) : null}
      {name === 'list' ? (
        <>
          <path {...commonProps} d="M9 7h10" />
          <path {...commonProps} d="M9 12h10" />
          <path {...commonProps} d="M9 17h10" />
          <circle {...commonProps} cx="5.5" cy="7" r="1" />
          <circle {...commonProps} cx="5.5" cy="12" r="1" />
          <circle {...commonProps} cx="5.5" cy="17" r="1" />
        </>
      ) : null}
    </svg>
  );
};

const IconBadge: React.FC<{
  color: string;
  name: IconName;
  size?: number;
  tone?: 'soft' | 'solid';
}> = ({color, name, size = 52, tone = 'soft'}) => {
  return (
    <div
      style={{
        ...styles.iconBadgeBase,
        width: size,
        height: size,
        color: '#eff6ff',
        background:
          tone === 'solid'
            ? `linear-gradient(135deg, ${color}, ${color}bb)`
            : `linear-gradient(135deg, ${color}70, ${color}20)`,
        borderColor: tone === 'solid' ? `${color}88` : `${color}55`,
        boxShadow:
          tone === 'solid'
            ? `0 16px 40px ${color}35, inset 0 1px 0 rgba(255,255,255,0.18)`
            : `0 12px 30px ${color}20, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <AppIcon name={name} size={Math.max(20, Math.round(size * 0.54))} color="currentColor" />
    </div>
  );
};

const matchKeywordIcon = (text: string): IconName | null => {
  const normalized = stripMarkdownSyntax(text).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (/切换|上下文|切回|切来切去|并行|agent|switch|context/.test(normalized)) {
    return 'switch';
  }

  if (/负荷|焦虑|风险|错误|疲惫|透支|压力|brain fry|warning|warn|告警/.test(normalized)) {
    return 'alert';
  }

  if (/评估|判断|决策|注意力|聚焦|认知|focus|evaluate/.test(normalized)) {
    return 'focus';
  }

  if (/时间|小时|分钟|秒|恢复|时长|持续|duration|time/.test(normalized)) {
    return 'clock';
  }

  if (/数据|研究|统计|错误率|生产力|效率|提升|下降|study|metric|rate|data/.test(normalized)) {
    return 'trend';
  }

  if (/结论|总结|应对|建议|方案|takeaway|最后|行动/.test(normalized)) {
    return 'check';
  }

  if (/代码|脚本|函数|实现|render|preview|code/.test(normalized)) {
    return 'code';
  }

  if (/三种|三层|层|结构|框架|模型|上限|stack|layer/.test(normalized)) {
    return 'layers';
  }

  if (/观点|原话|引用|“|”|quote|结语/.test(normalized)) {
    return 'quote';
  }

  if (/步骤|清单|列表|环节|事项|流程|list|todo/.test(normalized)) {
    return 'list';
  }

  if (/ai|大脑|脑力|主题|核心|智能|brain|idea/.test(normalized)) {
    return 'spark';
  }

  return null;
};

const getVariantIcon = (variant: SlideVariant): IconName => {
  const mapping: Record<SlideVariant, IconName> = {
    hero: 'spark',
    'split-list': 'layers',
    timeline: 'clock',
    grid: 'trend',
    mosaic: 'layers',
    argument: 'quote',
    triptych: 'focus',
    manifesto: 'check',
    spotlight: 'quote',
    quote: 'quote',
    code: 'code',
    panel: 'list',
    centered: 'focus',
    waterfall: 'layers',
    radar: 'spark',
    compare: 'switch',
    pyramid: 'trend',
    'stat-cards': 'trend',
    headline: 'spark',
    'sidebar-note': 'list',
    filmstrip: 'clock',
    duo: 'switch',
    orbit: 'spark',
    kanban: 'layers',
    stack: 'layers',
    'accent-bar': 'alert',
    'split-quote': 'quote',
    checklist: 'check',
    minimal: 'focus',
    magazine: 'list',
  };

  return mapping[variant];
};

const getSlideIcon = (slide: MarkdownSlide, variant: SlideVariant, structure: SlideStructure): IconName => {
  const icon = matchKeywordIcon([
    slide.heading,
    structure.paragraphs[0] ?? '',
    structure.bulletItems[0] ?? '',
    structure.orderedItems[0] ?? '',
  ].join(' '));

  return icon ?? getVariantIcon(variant);
};

const getItemIcon = (item: string, index: number, variant: SlideVariant): IconName => {
  const icon = matchKeywordIcon(item);

  if (icon) {
    return icon;
  }

  if (variant === 'grid') {
    return index % 2 === 0 ? 'layers' : 'focus';
  }

  if (variant === 'timeline') {
    if (index === 0) {
      return 'spark';
    }

    if (index === 1) {
      return 'switch';
    }

    if (index === 2) {
      return 'focus';
    }

    return 'check';
  }

  if (variant === 'spotlight') {
    return index === 0 ? 'check' : 'list';
  }

  if (variant === 'quote') {
    return index === 0 ? 'quote' : 'focus';
  }

  if (variant === 'manifesto') {
    return index === 0 ? 'check' : 'layers';
  }

  if (variant === 'split-list') {
    return index === 0 ? 'spark' : 'list';
  }

  return getVariantIcon(variant);
};

const getIconLabel = (icon: IconName) => {
  const mapping: Record<IconName, string> = {
    spark: '核心主题',
    layers: '结构层级',
    switch: '上下文切换',
    alert: '风险提醒',
    focus: '评估判断',
    clock: '时间成本',
    check: '行动建议',
    code: '代码片段',
    trend: '数据信号',
    quote: '核心观点',
    list: '信息清单',
  };

  return mapping[icon];
};

const matchKeywordColor = (text: string): string | null => {
  const normalized = stripMarkdownSyntax(text).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (/切换|上下文|并行|agent|context|switch/.test(normalized)) {
    return '#60a5fa';
  }

  if (/评估|判断|决策|认知|注意力|上限|focus|evaluate/.test(normalized)) {
    return '#a78bfa';
  }

  if (/焦虑|风险|错误|疲惫|透支|压力|warn|alert|brain fry/.test(normalized)) {
    return '#fb923c';
  }

  if (/执行|应对|建议|行动|稳定|边界|check|todo/.test(normalized)) {
    return '#34d399';
  }

  if (/数据|研究|统计|效率|生产力|下降|study|metric|rate|data/.test(normalized)) {
    return '#f472b6';
  }

  if (/代码|脚本|函数|实现|render|preview|code/.test(normalized)) {
    return '#22d3ee';
  }

  if (/结论|最后|takeaway|总结|quote/.test(normalized)) {
    return '#f87171';
  }

  return null;
};

const slideAccentPalettes: Record<SlideVariant, string[]> = {
  hero: ['#8b5cf6', '#22d3ee', '#60a5fa', '#a78bfa'],
  'split-list': ['#60a5fa', '#a78bfa', '#fb923c', '#34d399'],
  timeline: ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24'],
  grid: ['#a78bfa', '#60a5fa', '#f472b6', '#22d3ee'],
  mosaic: ['#38bdf8', '#a78bfa', '#2dd4bf', '#f59e0b'],
  argument: ['#fb923c', '#f87171', '#a78bfa', '#60a5fa'],
  triptych: ['#8b5cf6', '#38bdf8', '#34d399', '#f472b6'],
  manifesto: ['#34d399', '#22d3ee', '#60a5fa', '#a78bfa'],
  spotlight: ['#fb923c', '#f87171', '#a78bfa', '#60a5fa'],
  quote: ['#f87171', '#fb923c', '#a78bfa', '#60a5fa'],
  code: ['#22d3ee', '#60a5fa', '#34d399', '#a78bfa'],
  panel: ['#60a5fa', '#34d399', '#f59e0b', '#a78bfa'],
  centered: ['#c084fc', '#fb7185', '#22d3ee', '#fbbf24'],
  waterfall: ['#2dd4bf', '#60a5fa', '#f472b6', '#a78bfa'],
  radar: ['#f59e0b', '#a78bfa', '#34d399', '#60a5fa'],
  compare: ['#60a5fa', '#fb923c', '#a78bfa', '#34d399'],
  pyramid: ['#fbbf24', '#f87171', '#60a5fa', '#34d399'],
  'stat-cards': ['#22d3ee', '#f472b6', '#fbbf24', '#a78bfa'],
  headline: ['#8b5cf6', '#f87171', '#22d3ee', '#34d399'],
  'sidebar-note': ['#a78bfa', '#60a5fa', '#34d399', '#fb923c'],
  filmstrip: ['#38bdf8', '#fbbf24', '#f472b6', '#34d399'],
  duo: ['#fb923c', '#60a5fa', '#34d399', '#a78bfa'],
  orbit: ['#c084fc', '#22d3ee', '#fbbf24', '#f472b6'],
  kanban: ['#34d399', '#60a5fa', '#fb923c', '#a78bfa'],
  stack: ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24'],
  'accent-bar': ['#f87171', '#fbbf24', '#60a5fa', '#34d399'],
  'split-quote': ['#f472b6', '#a78bfa', '#22d3ee', '#34d399'],
  checklist: ['#34d399', '#60a5fa', '#fbbf24', '#a78bfa'],
  minimal: ['#94a3b8', '#60a5fa', '#a78bfa', '#22d3ee'],
  magazine: ['#60a5fa', '#f472b6', '#fbbf24', '#2dd4bf'],
};

const itemTonePalettes: Record<SlideVariant, string[]> = {
  hero: ['#60a5fa', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#22d3ee'],
  'split-list': ['#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#22d3ee', '#f87171'],
  timeline: ['#22d3ee', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#f472b6'],
  grid: ['#60a5fa', '#a78bfa', '#fb923c', '#34d399', '#f472b6', '#22d3ee', '#f87171', '#fbbf24'],
  mosaic: ['#38bdf8', '#a78bfa', '#2dd4bf', '#f59e0b', '#f472b6', '#60a5fa', '#34d399'],
  argument: ['#fb923c', '#f87171', '#a78bfa', '#60a5fa', '#fbbf24', '#22d3ee'],
  triptych: ['#8b5cf6', '#38bdf8', '#34d399', '#f472b6', '#f59e0b', '#60a5fa'],
  manifesto: ['#34d399', '#22d3ee', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6'],
  spotlight: ['#fb923c', '#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#f87171'],
  quote: ['#f87171', '#fb923c', '#a78bfa', '#60a5fa', '#fbbf24', '#22d3ee'],
  code: ['#22d3ee', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c'],
  panel: ['#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#22d3ee'],
  centered: ['#c084fc', '#fb7185', '#22d3ee', '#fbbf24', '#34d399', '#60a5fa'],
  waterfall: ['#2dd4bf', '#60a5fa', '#f472b6', '#a78bfa', '#fbbf24', '#fb923c', '#22d3ee'],
  radar: ['#f59e0b', '#a78bfa', '#34d399', '#60a5fa', '#f472b6', '#22d3ee'],
  compare: ['#60a5fa', '#fb923c', '#a78bfa', '#34d399', '#f472b6', '#fbbf24'],
  pyramid: ['#fbbf24', '#f87171', '#60a5fa', '#34d399', '#a78bfa', '#22d3ee'],
  'stat-cards': ['#22d3ee', '#f472b6', '#fbbf24', '#a78bfa', '#34d399', '#60a5fa', '#fb923c'],
  headline: ['#8b5cf6', '#f87171', '#22d3ee', '#34d399', '#fbbf24', '#60a5fa'],
  'sidebar-note': ['#a78bfa', '#60a5fa', '#34d399', '#fb923c', '#f472b6', '#fbbf24'],
  filmstrip: ['#38bdf8', '#fbbf24', '#f472b6', '#34d399', '#a78bfa', '#60a5fa', '#fb923c'],
  duo: ['#fb923c', '#60a5fa', '#34d399', '#a78bfa', '#22d3ee', '#f472b6'],
  orbit: ['#c084fc', '#22d3ee', '#fbbf24', '#f472b6', '#34d399', '#60a5fa'],
  kanban: ['#34d399', '#60a5fa', '#fb923c', '#a78bfa', '#f472b6', '#fbbf24', '#22d3ee'],
  stack: ['#a78bfa', '#22d3ee', '#f472b6', '#fbbf24', '#34d399', '#60a5fa'],
  'accent-bar': ['#f87171', '#fbbf24', '#60a5fa', '#34d399', '#a78bfa', '#22d3ee'],
  'split-quote': ['#f472b6', '#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#60a5fa'],
  checklist: ['#34d399', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c'],
  minimal: ['#94a3b8', '#60a5fa', '#a78bfa', '#22d3ee', '#34d399', '#f472b6'],
  magazine: ['#60a5fa', '#f472b6', '#fbbf24', '#2dd4bf', '#a78bfa', '#fb923c', '#22d3ee'],
};

const getSlideAccentColor = ({
  baseAccentColor,
  slide,
  slideIndex,
  structure,
  variant,
}: {
  baseAccentColor: string;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
  variant: SlideVariant;
}) => {
  if (slide.accentColor) {
    return slide.accentColor;
  }

  const keywordColor = matchKeywordColor([
    slide.heading,
    structure.paragraphs[0] ?? '',
    structure.bulletItems[0] ?? '',
    structure.orderedItems[0] ?? '',
  ].join(' '));

  if (keywordColor) {
    return keywordColor;
  }

  const palette = slideAccentPalettes[variant];
  return palette[slideIndex % palette.length] ?? baseAccentColor;
};

const getDistinctItemToneColors = ({
  accentColor,
  items,
  variant,
}: {
  accentColor: string;
  items: string[];
  variant: SlideVariant;
}) => {
  const palette = itemTonePalettes[variant];
  const used = new Set([accentColor.toLowerCase()]);
  const fallbackPool = [...palette, '#38bdf8', '#c084fc', '#fb7185', '#2dd4bf', '#facc15'];

  return items.map((item, index) => {
    const keywordColor = matchKeywordColor(item);

    if (keywordColor && !used.has(keywordColor.toLowerCase())) {
      used.add(keywordColor.toLowerCase());
      return keywordColor;
    }

    const nextAvailable = fallbackPool.find((color) => !used.has(color.toLowerCase()));
    const resolvedColor = nextAvailable ?? palette[index % palette.length] ?? accentColor;
    used.add(resolvedColor.toLowerCase());
    return resolvedColor;
  });
};

const getNarrationSentences = (text: string) => {
  return (text.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);
};

const parseSlideStructure = (markdown: string): SlideStructure => {
  const lines = markdown.split('\n');
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];
  const paragraphs: string[] = [];
  const strongPhrases = Array.from(markdown.matchAll(/\*\*([^*]+)\*\*/g), (match) => stripMarkdownSyntax(match[1]));

  let inCodeBlock = false;
  let codeLanguage = '';
  const codeLines: string[] = [];

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = line.replace(/```/, '').trim();
        return;
      }

      inCodeBlock = false;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      return;
    }

    if (!line || line.startsWith('<!--')) {
      return;
    }

    if (/^#{1,6}\s+/.test(line)) {
      return;
    }

    if (/^\|/.test(line)) {
      return;
    }

    if (/^[-*+]\s+/.test(line)) {
      bulletItems.push(stripMarkdownSyntax(line));
      return;
    }

    if (/^\d+\.\s+/.test(line)) {
      orderedItems.push(stripMarkdownSyntax(line));
      return;
    }

    paragraphs.push(stripMarkdownSyntax(line));
  });

  return {
    bulletItems,
    orderedItems,
    paragraphs,
    codeBlock: codeLines.join('\n').trim() || undefined,
    codeLanguage: codeLanguage || undefined,
    strongPhrases,
    hasTable: /^\|.+\|/m.test(markdown),
  };
};

const getSlideVariant = ({
  slide,
  slideIndex,
  totalSlides,
  structure,
}: {
  slide: MarkdownSlide;
  slideIndex: number;
  totalSlides: number;
  structure: SlideStructure;
}): SlideVariant => {
  if (slide.layout) {
    return slide.layout;
  }

  const listItems = [...structure.orderedItems, ...structure.bulletItems];
  const totalListItems = listItems.length;
  const heading = stripMarkdownSyntax(slide.heading).toLowerCase();
  const narrative = stripMarkdownSyntax([structure.paragraphs[0] ?? '', slide.narration].join(' ')).toLowerCase();
  const hasBlockquote = /^>\s+/m.test(slide.markdown);
  const isWhySlide = /为什么|为何|why|适合交给/.test(heading);
  const isSceneSlide = /场景|应用|场合|用例|适合很多场景|use case|scenario/.test(heading)
    || (/团队|研究|课程|竞品|旅行|读书|规划/.test(narrative) && totalListItems >= 4);
  const isFrameworkSlide = /提醒|模式|框架|最后的提醒|工作框架/.test(heading)
    || (/不是一套固定产品方案|不是固定产品方案|工作框架|持续增值/.test(narrative) && totalListItems >= 3);
  const isSummarySlide = /一句话总结|总结|结论|closing|takeaway/.test(heading)
    || hasBlockquote
    || (slideIndex >= totalSlides - 1 && (/更像|核心洞见|运行中产物/.test(narrative) || structure.strongPhrases.length > 0));
  const isCompareSlide = /对比|比较|区别|不同|vs|versus|差异/.test(heading);
  const isDataSlide = /数据|数字|统计|百分|percent|data|stat|指标|研究/.test(heading);
  const isStepSlide = /步骤|流程|方法|做法|step|how to|怎么做/.test(heading);
  const isListSlide = /清单|规则|原则|事项|准则|注意|checklist|rule/.test(heading);
  const isQuoteSlide = /引用|原话|说过|曾说|quote|金句/.test(heading);
  const paragraphCount = structure.paragraphs.length;
  const narrationLen = slide.narration.length;

  if (structure.codeBlock) {
    return 'code';
  }

  if (slideIndex === 0) {
    return 'hero';
  }

  if (isSummarySlide) {
    return slideIndex % 2 === 0 ? 'quote' : 'centered';
  }

  if (isCompareSlide && totalListItems >= 2) {
    return totalListItems === 2 ? 'duo' : 'compare';
  }

  if (isDataSlide && totalListItems >= 2) {
    return totalListItems >= 4 ? 'stat-cards' : 'stat-cards';
  }

  if (isListSlide && totalListItems >= 3) {
    return 'checklist';
  }

  if (isQuoteSlide) {
    return 'split-quote';
  }

  if (isFrameworkSlide && totalListItems >= 3) {
    return slideIndex % 2 === 0 ? 'manifesto' : 'kanban';
  }

  if (isWhySlide && totalListItems >= 4) {
    return slideIndex % 2 === 0 ? 'argument' : 'radar';
  }

  if (isSceneSlide && structure.bulletItems.length >= 4) {
    return slideIndex % 2 === 0 ? 'mosaic' : 'waterfall';
  }

  if (isStepSlide && structure.orderedItems.length >= 3) {
    return slideIndex % 2 === 0 ? 'timeline' : 'filmstrip';
  }

  if (structure.orderedItems.length >= 3) {
    return slideIndex % 3 === 0 ? 'timeline' : slideIndex % 3 === 1 ? 'filmstrip' : 'stack';
  }

  if (totalListItems === 3) {
    return slideIndex % 3 === 0 ? 'triptych' : slideIndex % 3 === 1 ? 'kanban' : 'orbit';
  }

  if (slideIndex === totalSlides - 1) {
    if (totalListItems >= 3) {
      return 'triptych';
    }

    return structure.strongPhrases.length > 0 ? 'accent-bar' : 'minimal';
  }

  if (structure.bulletItems.length >= 5) {
    return slideIndex % 2 === 0 ? 'mosaic' : 'waterfall';
  }

  if (structure.orderedItems.length >= 3 || structure.bulletItems.length >= 4) {
    return slideIndex % 3 === 0 ? 'grid' : slideIndex % 3 === 1 ? 'magazine' : 'stat-cards';
  }

  if (structure.bulletItems.length === 2) {
    return slideIndex % 3 === 0 ? 'split-list' : slideIndex % 3 === 1 ? 'duo' : 'compare';
  }

  if (structure.bulletItems.length >= 2) {
    return slideIndex % 2 === 0 ? 'split-list' : 'sidebar-note';
  }

  if (structure.strongPhrases.length > 0) {
    return slideIndex % 3 === 0 ? 'spotlight' : slideIndex % 3 === 1 ? 'accent-bar' : 'centered';
  }

  if (narrationLen <= 60) {
    return slideIndex % 2 === 0 ? 'minimal' : 'headline';
  }

  if (paragraphCount >= 2 && totalListItems === 0) {
    return slideIndex % 3 === 0 ? 'spotlight' : slideIndex % 3 === 1 ? 'split-quote' : 'sidebar-note';
  }

  const fallbackVariants: SlideVariant[] = ['panel', 'centered', 'headline', 'minimal', 'accent-bar', 'sidebar-note'];
  return fallbackVariants[slideIndex % fallbackVariants.length];
};

const getLayoutTheme = (accentColor: string, variant: SlideVariant) => {
  const backgroundByVariant: Record<SlideVariant, string> = {
    hero: 'linear-gradient(145deg, #020617 0%, #0f172a 45%, #111827 100%)',
    'split-list': 'linear-gradient(145deg, #020617 0%, #0b1220 40%, #111827 100%)',
    timeline: 'linear-gradient(155deg, #02131f 0%, #0a1629 42%, #111827 100%)',
    grid: 'linear-gradient(145deg, #03111f 0%, #0f172a 48%, #111827 100%)',
    mosaic: 'radial-gradient(circle at top left, rgba(8, 47, 73, 0.95), #020617 55%, #07131f 100%)',
    argument: 'linear-gradient(145deg, #070b1a 0%, #111827 38%, #1f1127 100%)',
    triptych: 'linear-gradient(145deg, #050816 0%, #0f172a 42%, #0b1d2f 100%)',
    manifesto: 'linear-gradient(145deg, #04131a 0%, #0f172a 42%, #062b22 100%)',
    spotlight: 'radial-gradient(circle at top, rgba(15, 23, 42, 0.98), #020617 72%)',
    quote: 'radial-gradient(circle at top left, rgba(69, 26, 58, 0.88), #020617 58%, #111827 100%)',
    code: 'linear-gradient(145deg, #020617 0%, #111827 52%, #0f172a 100%)',
    panel: 'linear-gradient(145deg, #020617 0%, #111827 45%, #0f172a 100%)',
    centered: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.96), #020617 68%)',
    waterfall: 'linear-gradient(170deg, #020617 0%, #0a1628 35%, #0f172a 65%, #111827 100%)',
    radar: 'radial-gradient(circle at 40% 40%, rgba(30, 20, 50, 0.92), #020617 62%)',
    compare: 'linear-gradient(90deg, #020617 0%, #0b1628 50%, #020617 100%)',
    pyramid: 'linear-gradient(180deg, #020617 0%, #1a0f0a 42%, #0f172a 100%)',
    'stat-cards': 'linear-gradient(145deg, #020617 0%, #071a28 48%, #111827 100%)',
    headline: 'radial-gradient(ellipse at top left, rgba(20, 10, 45, 0.9), #020617 55%)',
    'sidebar-note': 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #0b1a2e 100%)',
    filmstrip: 'linear-gradient(180deg, #020617 0%, #0c1524 38%, #111827 100%)',
    duo: 'linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)',
    orbit: 'radial-gradient(circle at center, rgba(20, 15, 40, 0.94), #020617 60%)',
    kanban: 'linear-gradient(145deg, #020617 0%, #0d1a2a 42%, #0f172a 100%)',
    stack: 'linear-gradient(160deg, #020617 0%, #0f172a 48%, #131b2e 100%)',
    'accent-bar': 'linear-gradient(145deg, #120a08 0%, #0f172a 40%, #020617 100%)',
    'split-quote': 'linear-gradient(135deg, #020617 0%, #1a0f2a 42%, #0f172a 100%)',
    checklist: 'linear-gradient(145deg, #020617 0%, #061a14 38%, #0f172a 100%)',
    minimal: 'linear-gradient(145deg, #020617 0%, #0a0f1a 50%, #020617 100%)',
    magazine: 'linear-gradient(155deg, #020617 0%, #0f172a 42%, #0d1220 100%)',
  };

  const orbScaleByVariant: Record<SlideVariant, number> = {
    hero: 1.18,
    'split-list': 1,
    timeline: 1.04,
    grid: 0.92,
    mosaic: 1.08,
    argument: 0.98,
    triptych: 1.02,
    manifesto: 1.06,
    spotlight: 1.26,
    quote: 1.14,
    code: 0.88,
    panel: 1,
    centered: 1.32,
    waterfall: 0.94,
    radar: 1.2,
    compare: 0.96,
    pyramid: 1.1,
    'stat-cards': 0.9,
    headline: 1.28,
    'sidebar-note': 0.92,
    filmstrip: 0.96,
    duo: 1.02,
    orbit: 1.22,
    kanban: 0.88,
    stack: 1.06,
    'accent-bar': 1.14,
    'split-quote': 1.08,
    checklist: 0.9,
    minimal: 0.76,
    magazine: 0.86,
  };

  return {
    background: backgroundByVariant[variant],
    orbScale: orbScaleByVariant[variant],
    accentSoft: `${accentColor}22`,
    accentMid: `${accentColor}55`,
  };
};

const SceneChrome: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  variant: SlideVariant;
  sceneIcon: IconName;
  children?: React.ReactNode;
}> = ({accentColor, presentation, slide, slideIndex, variant, sceneIcon, children}) => {
  void sceneIcon;

  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeCaption = getActiveCaption(slide.captionCues, frame);

  const entrance = spring({
    fps,
    frame,
    config: {
      damping: 18,
      stiffness: 120,
      mass: 0.9,
    },
    durationInFrames: 24,
  });

  const y = interpolate(entrance, [0, 1], [52, 0]);
  const contentOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const captionOpacity = interpolate(frame, [2, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glow = interpolate(frame, [0, slide.durationInFrames], [0.32, 0.88], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const layoutTheme = getLayoutTheme(accentColor, variant);

  return (
    <AbsoluteFill style={{...styles.scene, background: layoutTheme.background}}>
      {slide.audioSrc ? <Html5Audio src={staticFile(slide.audioSrc)} /> : null}

      <div
        style={{
          ...styles.backgroundOrb,
          width: 620 * layoutTheme.orbScale,
          height: 620 * layoutTheme.orbScale,
          background: `radial-gradient(circle, ${accentColor} 0%, rgba(124, 58, 237, 0) 72%)`,
          left: -180,
          top: -170,
          opacity: glow,
        }}
      />
      <div
        style={{
          ...styles.backgroundOrb,
          width: 520 * layoutTheme.orbScale,
          height: 520 * layoutTheme.orbScale,
          background: `radial-gradient(circle, ${layoutTheme.accentMid} 0%, rgba(56, 189, 248, 0) 72%)`,
          right: -140,
          bottom: -180,
          opacity: glow * 0.78,
        }}
      />
      <div style={{...styles.gridOverlay, opacity: 0.16 + glow * 0.06}} />

      <div style={styles.topBar}>
        <div style={styles.metaGroup}>
          <div style={styles.metaText}>
            {presentation.meta.title ?? 'Untitled deck'} · {slideIndex + 1}/{presentation.slides.length}
          </div>
        </div>
      </div>

      <div
        style={{
          ...styles.contentStage,
          opacity: contentOpacity,
          transform: `translateY(${y}px) scale(${0.965 + entrance * 0.035})`,
        }}
      >
        {children}
      </div>


      {activeCaption ? (
        <div style={{...styles.captionShell, opacity: captionOpacity}}>
          <div style={styles.captionText}>{activeCaption.text}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const HeroSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const highlightItems = structure.bulletItems.slice(0, 3);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const supportText = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const heroIcon = getSlideIcon(slide, 'hero', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: highlightItems, variant: 'hero'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="hero"
      sceneIcon={heroIcon}
    >
      <div style={styles.heroShell}>
        <div style={styles.labelRow}>
          <IconBadge name={heroIcon} color={accentColor} size={56} tone="solid" />
          <div style={{...styles.heroKicker, color: accentColor, marginBottom: 0}}>Featured Topic</div>
        </div>
        <div style={styles.heroHeading}>{slide.heading}</div>
        {lead ? <div style={styles.heroLead}>{lead}</div> : null}
        {supportText ? <div style={styles.heroSupport}>{supportText}</div> : null}
        {highlightItems.length > 0 ? (
          <div style={styles.heroChipRow}>
            {highlightItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'hero');

              return (
                <div
                  key={item}
                  style={{
                    ...styles.heroChip,
                    borderColor: `${toneColor}4d`,
                    background: `linear-gradient(135deg, ${toneColor}18, rgba(15, 23, 42, 0.82))`,
                    boxShadow: `0 18px 40px ${toneColor}14`,
                  }}
                >
                  <IconBadge name={itemIcon} color={toneColor} size={38} tone="soft" />
                  <span style={styles.heroChipText}>{item}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};

const SplitListSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = (structure.bulletItems.length > 0 ? structure.bulletItems : structure.orderedItems).slice(0, 5);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const detail = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'split-list', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'split-list'});
  const isReversed = slideIndex % 2 === 1;

  const infoCard = (
    <div
      style={{
        ...styles.infoCard,
        boxShadow: `0 24px 80px ${accentColor}1a`,
        borderColor: `${accentColor}40`,
        background: `linear-gradient(180deg, ${accentColor}16, rgba(15, 23, 42, 0.76))`,
      }}
    >
      <div style={styles.labelRow}>
        <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
        <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Core Idea</div>
      </div>
      <div style={styles.primaryTitle}>{slide.heading}</div>
      {lead ? <div style={styles.largeBody}>{lead}</div> : null}
      {detail ? <div style={styles.secondaryBody}>{detail}</div> : null}
    </div>
  );

  const featureList = (
    <div style={styles.cardStackColumn}>
      {items.map((item, index) => {
        const toneColor = itemColors[index] ?? accentColor;
        const itemIcon = getItemIcon(item, index, 'split-list');

        return (
          <div
            key={`${item}-${index}`}
            style={{
              ...styles.listFeatureCard,
              borderColor: `${toneColor}52`,
              background: `linear-gradient(135deg, ${toneColor}${index === 0 ? '1f' : '14'}, rgba(15, 23, 42, 0.9))`,
              boxShadow: `0 18px 48px ${toneColor}18`,
            }}
          >
            <div style={styles.featureMetaColumn}>
              <IconBadge name={itemIcon} color={toneColor} size={46} tone={index === 0 ? 'solid' : 'soft'} />
              <div
                style={{
                  ...styles.featureIndexPill,
                  color: toneColor,
                  borderColor: `${toneColor}33`,
                  background: `${toneColor}16`,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
            </div>
            <div style={styles.featureContent}>
              <div style={styles.featureText}>{item}</div>
              <div style={styles.cardTagRow}>
                <div
                  style={{
                    ...styles.cardTag,
                    color: toneColor,
                    borderColor: `${toneColor}33`,
                    background: `${toneColor}14`,
                  }}
                >
                  {getIconLabel(itemIcon)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="split-list"
      sceneIcon={slideIcon}
    >
      <div style={styles.splitShell}>
        {isReversed ? featureList : infoCard}
        {isReversed ? infoCard : featureList}
      </div>
    </SceneChrome>
  );
};

const GridSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 6);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'grid', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'grid'});
  const isDenseGrid = items.length >= 5;

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="grid"
      sceneIcon={slideIcon}
    >
      <div style={styles.gridShell}>
        <div
          style={{
            ...styles.gridHeaderCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.78))`,
            boxShadow: `0 20px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Key Points</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.secondaryBody}>{intro}</div> : null}
        </div>

        <div
          style={{
            ...styles.metricsGrid,
            gridTemplateColumns: isDenseGrid ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
          }}
        >
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'grid');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.metricCard,
                  minHeight: isDenseGrid ? 156 : styles.metricCard.minHeight,
                  boxShadow: `0 18px 48px ${toneColor}14`,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.76))`,
                }}
              >
                <div style={styles.metricTopRow}>
                  <IconBadge name={itemIcon} color={toneColor} size={44} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.metricIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={{...styles.metricText, fontSize: isDenseGrid ? 26 : styles.metricText.fontSize}}>{item}</div>
                <div style={styles.cardTagRow}>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {getIconLabel(itemIcon)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const MosaicSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'mosaic', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'mosaic'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="mosaic"
      sceneIcon={slideIcon}
    >
      <div style={styles.mosaicShell}>
        <div
          style={{
            ...styles.mosaicLeadCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}16, rgba(15, 23, 42, 0.82))`,
            boxShadow: `0 26px 80px ${accentColor}18`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Scene Map</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {support ? (
            <div
              style={{
                ...styles.mosaicStatement,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.78))`,
              }}
            >
              {support}
            </div>
          ) : null}
        </div>

        <div style={styles.mosaicBoard}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'mosaic');
            const isWide = items.length >= 5 && index === 0;
            const isTall = items.length >= 6 && index === 3;

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.mosaicCard,
                  gridColumn: isWide ? 'span 2' : undefined,
                  gridRow: isTall ? 'span 2' : undefined,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(160deg, ${toneColor}${isWide ? '1b' : '15'}, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 20px 48px ${toneColor}16`,
                }}
              >
                <div style={styles.mosaicCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={40} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.mosaicIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={{...styles.mosaicCardText, fontSize: isWide ? 34 : isTall ? 30 : styles.mosaicCardText.fontSize}}>{item}</div>
                <div style={styles.cardTagRow}>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {getIconLabel(itemIcon)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const ArgumentSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 4);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const thesis = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'argument', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'argument'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="argument"
      sceneIcon={slideIcon}
    >
      <div style={styles.argumentShell}>
        <div
          style={{
            ...styles.argumentHeaderCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}15, rgba(15, 23, 42, 0.82))`,
            boxShadow: `0 24px 72px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Why It Works</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {thesis ? (
            <div
              style={{
                ...styles.argumentThesis,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}18, rgba(15, 23, 42, 0.76))`,
              }}
            >
              {thesis}
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...styles.argumentBoard,
            gridTemplateColumns: items.length >= 4 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'argument');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.argumentCard,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(160deg, ${toneColor}17, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 18px 44px ${toneColor}16`,
                }}
              >
                <div style={styles.argumentCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.argumentIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={styles.argumentCardText}>{item}</div>
                <div style={styles.cardTagRow}>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {getIconLabel(itemIcon)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const TriptychSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 3);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'triptych', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'triptych'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="triptych"
      sceneIcon={slideIcon}
    >
      <div style={styles.triptychShell}>
        <div
          style={{
            ...styles.triptychHeaderCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.8))`,
            boxShadow: `0 22px 64px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Three Angles</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.secondaryBody}>{intro}</div> : null}
        </div>

        <div style={styles.triptychColumns}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'triptych');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.triptychCard,
                  borderColor: `${toneColor}4a`,
                  borderTop: `6px solid ${toneColor}`,
                  background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.9))`,
                  boxShadow: `0 22px 48px ${toneColor}16`,
                }}
              >
                <div style={styles.triptychCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={44} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.triptychIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={styles.triptychCardText}>{item}</div>
                <div style={styles.cardTagRow}>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {getIconLabel(itemIcon)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {support ? (
          <div
            style={{
              ...styles.triptychSupportPill,
              borderColor: `${accentColor}3a`,
              background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.78))`,
            }}
          >
            {support}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};

const ManifestoSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const thesis = structure.strongPhrases[0] ?? structure.paragraphs.at(-1) ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'manifesto', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'manifesto'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="manifesto"
      sceneIcon={slideIcon}
    >
      <div style={styles.manifestoShell}>
        <div
          style={{
            ...styles.manifestoLeadCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.84))`,
            boxShadow: `0 24px 72px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Framework Note</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {thesis ? (
            <div
              style={{
                ...styles.manifestoThesis,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.76))`,
              }}
            >
              {thesis}
            </div>
          ) : null}
        </div>

        <div style={styles.manifestoStack}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'manifesto');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.manifestoRuleCard,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(135deg, ${toneColor}17, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 18px 42px ${toneColor}16`,
                }}
              >
                <div style={styles.manifestoRuleTop}>
                  <div
                    style={{
                      ...styles.manifestoRuleIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    Principle
                  </div>
                </div>

                <div style={styles.manifestoRuleMain}>
                  <IconBadge name={itemIcon} color={toneColor} size={40} tone={index === 0 ? 'solid' : 'soft'} />
                  <div style={styles.manifestoRuleText}>{item}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const TimelineSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'timeline', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'timeline'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="timeline"
      sceneIcon={slideIcon}
    >
      <div style={styles.timelineShell}>
        <div
          style={{
            ...styles.timelineHeroCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.78))`,
            boxShadow: `0 20px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Flow View</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {support ? <div style={styles.secondaryBody}>{support}</div> : null}
        </div>

        <div style={styles.timelineTrack}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'timeline');

            return (
              <div key={`${item}-${index}`} style={styles.timelineStep}>
                {index < items.length - 1 ? (
                  <div
                    style={{
                      ...styles.timelineConnector,
                      background: `linear-gradient(90deg, ${toneColor}, ${accentColor}55)`,
                    }}
                  />
                ) : null}

                <div style={styles.timelineMarkerRow}>
                  <div
                    style={{
                      ...styles.timelineDot,
                      background: `radial-gradient(circle, ${toneColor} 0%, ${toneColor}aa 55%, rgba(15, 23, 42, 0) 72%)`,
                      boxShadow: `0 0 0 8px ${toneColor}1f, 0 0 36px ${toneColor}22`,
                    }}
                  />
                  <div
                    style={{
                      ...styles.timelineStepNumber,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <div
                  style={{
                    ...styles.timelineCard,
                    borderColor: `${toneColor}4a`,
                    background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.82))`,
                    boxShadow: `0 18px 42px ${toneColor}16`,
                  }}
                >
                  <div style={styles.timelineCardTop}>
                    <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
                    <div
                      style={{
                        ...styles.cardTag,
                        color: toneColor,
                        borderColor: `${toneColor}33`,
                        background: `${toneColor}14`,
                      }}
                    >
                      {getIconLabel(itemIcon)}
                    </div>
                  </div>
                  <div style={styles.timelineText}>{item}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const SpotlightSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const sentences = getNarrationSentences(slide.narration);
  const spotlight = structure.strongPhrases[0] ?? sentences.at(-1) ?? slide.heading;
  const support = structure.paragraphs[0] ?? sentences[0] ?? presentation.meta.subtitle ?? '';
  const railItems = [...structure.bulletItems, ...structure.orderedItems].slice(0, 3);
  const slideIcon = getSlideIcon(slide, 'spotlight', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: railItems, variant: 'spotlight'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="spotlight"
      sceneIcon={slideIcon}
    >
      <div style={styles.spotlightShell}>
        <div
          style={{
            ...styles.spotlightMainCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}15, rgba(2, 6, 23, 0.82))`,
            boxShadow: `0 24px 72px ${accentColor}18`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Takeaway</div>
          </div>
          <div style={styles.spotlightHeading}>{slide.heading}</div>
          <div style={styles.spotlightQuote}>“{spotlight}”</div>
          {support ? <div style={styles.spotlightSupport}>{support}</div> : null}
        </div>

        {railItems.length > 0 ? (
          <div style={styles.sideRail}>
            {railItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'spotlight');

              return (
                <div
                  key={item}
                  style={{
                    ...styles.sideRailItem,
                    borderColor: `${toneColor}3a`,
                    background: `linear-gradient(135deg, ${toneColor}16, rgba(15, 23, 42, 0.78))`,
                    boxShadow: `0 16px 36px ${toneColor}14`,
                  }}
                >
                  <div style={styles.sideRailItemInner}>
                    <IconBadge name={itemIcon} color={toneColor} size={36} tone="soft" />
                    <div style={styles.sideRailTextGroup}>
                      <div style={styles.sideRailText}>{item}</div>
                      <div
                        style={{
                          ...styles.cardTag,
                          color: toneColor,
                          borderColor: `${toneColor}33`,
                          background: `${toneColor}14`,
                        }}
                      >
                        {getIconLabel(itemIcon)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};

const QuoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const sentences = getNarrationSentences(slide.narration);
  const statement = stripMarkdownSyntax(
    structure.strongPhrases[0]
      ?? structure.paragraphs.find((paragraph) => /[；;]|更像|不是/.test(paragraph))
      ?? sentences.at(-1)
      ?? slide.heading,
  );
  const support = structure.paragraphs[0] ?? sentences[0] ?? presentation.meta.subtitle ?? '';
  const compareItems = statement
    .split(/[；;]/)
    .map((item) => stripMarkdownSyntax(item).trim())
    .filter(Boolean)
    .slice(0, 2);
  const note = structure.paragraphs.find((paragraph) => paragraph !== support && paragraph !== statement)
    ?? presentation.meta.subtitle
    ?? '';
  const slideIcon = getSlideIcon(slide, 'quote', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: compareItems, variant: 'quote'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="quote"
      sceneIcon={slideIcon}
    >
      <div style={styles.quoteShell}>
        <div
          style={{
            ...styles.quoteHeroCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}16, rgba(2, 6, 23, 0.84))`,
            boxShadow: `0 28px 84px ${accentColor}1a`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Closing Note</div>
          </div>
          <div style={styles.quoteHeading}>{slide.heading}</div>
          <div style={styles.quoteStatement}>“{statement}”</div>
          {support ? <div style={styles.quoteSupport}>{support}</div> : null}
        </div>

        {compareItems.length > 0 ? (
          <div
            style={{
              ...styles.quoteCompareRow,
              gridTemplateColumns: `repeat(${Math.max(compareItems.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {compareItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'quote');

              return (
                <div
                  key={`${item}-${index}`}
                  style={{
                    ...styles.quoteCompareCard,
                    borderColor: `${toneColor}4a`,
                    background: `linear-gradient(160deg, ${toneColor}18, rgba(15, 23, 42, 0.88))`,
                    boxShadow: `0 18px 44px ${toneColor}16`,
                  }}
                >
                  <div style={styles.quoteCompareTop}>
                    <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
                    <div
                      style={{
                        ...styles.cardTag,
                        color: toneColor,
                        borderColor: `${toneColor}33`,
                        background: `${toneColor}14`,
                      }}
                    >
                      {index === 0 ? 'Perspective A' : 'Perspective B'}
                    </div>
                  </div>
                  <div style={styles.quoteCompareText}>{item}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {note && note !== support && note !== statement ? (
          <div
            style={{
              ...styles.quoteNote,
              borderColor: `${accentColor}33`,
              background: `linear-gradient(135deg, ${accentColor}12, rgba(15, 23, 42, 0.74))`,
            }}
          >
            {note}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};

const CodeSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const codeLines = (structure.codeBlock ?? '').split('\n');
  const slideIcon = getSlideIcon(slide, 'code', structure);

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="code"
      sceneIcon={slideIcon}
    >
      <div style={styles.codeShell}>
        <div
          style={{
            ...styles.codeInfoCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.76))`,
            boxShadow: `0 22px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Code Walkthrough</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {lead ? <div style={styles.largeBody}>{lead}</div> : null}
          {presentation.meta.subtitle ? <div style={styles.secondaryBody}>{presentation.meta.subtitle}</div> : null}
        </div>

        <div style={{...styles.codeCard, borderColor: `${accentColor}2a`, boxShadow: `0 32px 80px ${accentColor}14`}}>
          <div style={styles.codeCardTopBar}>
            <div style={styles.codeDots}>
              <span style={{...styles.codeDot, background: '#fb7185'}} />
              <span style={{...styles.codeDot, background: '#fbbf24'}} />
              <span style={{...styles.codeDot, background: '#34d399'}} />
            </div>
            <div style={styles.codeLanguage}>
              <AppIcon name="code" size={20} color="#93c5fd" />
              <span style={styles.codeLanguageText}>{structure.codeLanguage ?? 'code'}</span>
            </div>
          </div>

          <div style={styles.codeBody}>
            {codeLines.map((line, index) => (
              <div key={`${line}-${index}`} style={styles.codeRow}>
                <div style={styles.codeLineNumber}>{index + 1}</div>
                <div style={styles.codeLineText}>{line || ' '}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneChrome>
  );
};

const PanelSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
}> = ({accentColor, presentation, slide, slideIndex}) => {
  const structure = parseSlideStructure(slide.markdown);
  const slideIcon = getSlideIcon(slide, 'panel', structure);

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="panel"
      sceneIcon={slideIcon}
    >
      <div
        style={{
          ...styles.card,
          borderTop: `8px solid ${accentColor}`,
          borderColor: `${accentColor}3a`,
          background: `linear-gradient(180deg, ${accentColor}12, rgba(15, 23, 42, 0.76))`,
          boxShadow: `0 30px 80px ${accentColor}22`,
        }}
      >
        <div style={styles.cardHeader}>
          <div style={styles.panelTitleGroup}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div>
              <div style={{...styles.kicker, color: accentColor}}>Slide {slideIndex + 1}</div>
              <div style={styles.heading}>{slide.heading}</div>
            </div>
          </div>
        </div>

        {presentation.meta.subtitle ? <div style={styles.subtitle}>{presentation.meta.subtitle}</div> : null}

        <div style={styles.markdownBody}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {slide.markdown}
          </ReactMarkdown>
        </div>
      </div>
    </SceneChrome>
  );
};

const tablePageComponents: Components = {
  ...markdownComponents,
  h1: () => null,
  h2: () => null,
  h3: () => null,
  p: ({children}) => <p style={{...styles.paragraph, fontSize: 22, margin: '0 0 8px'}}>{children}</p>,
  table: ({children}) => (
    <div style={{margin: '0', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(71, 85, 105, 0.45)', backgroundColor: 'rgba(15, 23, 42, 0.55)'}}>
      <table style={{width: '100%', borderCollapse: 'collapse' as const, fontSize: 21, lineHeight: 1.35}}>{children}</table>
    </div>
  ),
  thead: ({children}) => <thead style={{backgroundColor: 'rgba(51, 65, 85, 0.6)'}}>{children}</thead>,
  tbody: ({children}) => <tbody>{children}</tbody>,
  tr: ({children}) => <tr style={{borderBottom: '1px solid rgba(71, 85, 105, 0.3)'}}>{children}</tr>,
  th: ({children}) => <th style={{padding: '9px 14px', fontWeight: 700, color: '#f1f5f9', textAlign: 'left' as const, fontSize: 19}}>{children}</th>,
  td: ({children}) => <td style={{padding: '7px 14px', color: '#cbd5e1', textAlign: 'left' as const, fontSize: 20}}>{children}</td>,
};

const TableSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const slideIcon = getSlideIcon(slide, 'panel', structure);

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="panel"
      sceneIcon={slideIcon}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 28,
          padding: '28px 36px',
          background: `linear-gradient(180deg, ${accentColor}10, rgba(15, 23, 42, 0.76))`,
          border: `1px solid ${accentColor}3a`,
          borderTop: `5px solid ${accentColor}`,
          backdropFilter: 'blur(18px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0}}>
          <IconBadge name={slideIcon} color={accentColor} size={40} tone="solid" />
          <div style={{fontSize: 30, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2}}>{slide.heading}</div>
        </div>

        <div style={{flex: 1, overflow: 'hidden'}}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={tablePageComponents}>
            {slide.markdown}
          </ReactMarkdown>
        </div>
      </div>
    </SceneChrome>
  );
};

/* ===== 18 NEW LAYOUT COMPONENTS ===== */

const CenteredSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const spotlight = structure.strongPhrases[0] ?? structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? slide.heading;
  const support = structure.paragraphs[1] ?? getNarrationSentences(slide.narration)[1] ?? '';
  const slideIcon = getSlideIcon(slide, 'centered', structure);

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="centered" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 80px'}}>
        <div style={{fontSize: 120, lineHeight: 0.9, fontWeight: 900, color: `${accentColor}30`, marginBottom: -20}}>"</div>
        <IconBadge name={slideIcon} color={accentColor} size={58} tone="solid" />
        <div style={{marginTop: 24, fontSize: 52, fontWeight: 850, color: '#e2e8f0', lineHeight: 1.1}}>{slide.heading}</div>
        <div style={{marginTop: 32, fontSize: 48, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3, maxWidth: 1100}}>{spotlight}</div>
        {support ? <div style={{marginTop: 28, fontSize: 28, color: '#94a3b8', lineHeight: 1.55, maxWidth: 900}}>{support}</div> : null}
        <div style={{marginTop: 36, width: 80, height: 5, borderRadius: 999, background: accentColor, opacity: 0.7}} />
      </div>
    </SceneChrome>
  );
};

const WaterfallSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 7);
  const slideIcon = getSlideIcon(slide, 'waterfall', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'waterfall'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="waterfall" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
        <div style={{...styles.labelRow}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '18px 24px', borderRadius: 24, border: `1px solid ${tc}4a`,
                background: `linear-gradient(90deg, ${tc}18, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 16,
                marginLeft: index * 28, maxWidth: `calc(100% - ${index * 28}px)`,
                boxShadow: `0 14px 36px ${tc}14`,
              }}>
                <div style={{minWidth: 36, height: 36, borderRadius: 999, background: `${tc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: tc}}>{index + 1}</div>
                <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const RadarSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'radar', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'radar'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="radar" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 28}}>
        <div style={{flex: '0 0 420px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
          <div style={{marginTop: 20, fontSize: 56, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: 16, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const size = index === 0 ? 220 : 180;
            return (
              <div key={`${item}-${index}`} style={{
                width: size, height: size, borderRadius: '50%', border: `2px solid ${tc}55`,
                background: `radial-gradient(circle, ${tc}20, rgba(15,23,42,0.9))`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 18, textAlign: 'center', boxShadow: `0 0 40px ${tc}18`,
              }}>
                <div style={{fontSize: 18, fontWeight: 900, color: tc, marginBottom: 8}}>{String(index + 1).padStart(2, '0')}</div>
                <div style={{fontSize: index === 0 ? 22 : 20, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const CompareSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems];
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);
  const slideIcon = getSlideIcon(slide, 'compare', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'compare'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="compare" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 4px 1fr', gap: 24, alignItems: 'stretch'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center'}}>
            {leftItems.map((item, index) => {
              const tc = itemColors[index] ?? accentColor;
              return (
                <div key={`l-${index}`} style={{padding: '20px 24px', borderRadius: 24, border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}18, rgba(15,23,42,0.88))`, boxShadow: `0 14px 36px ${tc}14`}}>
                  <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
                </div>
              );
            })}
          </div>
          <div style={{background: `linear-gradient(180deg, ${accentColor}55, ${accentColor}11)`, borderRadius: 999}} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center'}}>
            {rightItems.map((item, index) => {
              const tc = itemColors[half + index] ?? accentColor;
              return (
                <div key={`r-${index}`} style={{padding: '20px 24px', borderRadius: 24, border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}18, rgba(15,23,42,0.88))`, boxShadow: `0 14px 36px ${tc}14`}}>
                  <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SceneChrome>
  );
};

const PyramidSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'pyramid', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'pyramid'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="pyramid" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div><div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div></div>
        </div>
        {intro ? <div style={{fontSize: 28, color: '#cbd5e1', lineHeight: 1.55, maxWidth: 900}}>{intro}</div> : null}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', alignItems: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const widthPercent = 45 + index * 12;
            return (
              <div key={`${item}-${index}`} style={{
                width: `${widthPercent}%`, padding: '16px 24px', borderRadius: 20,
                border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}1a, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 14, boxShadow: `0 12px 32px ${tc}14`,
              }}>
                <div style={{minWidth: 32, height: 32, borderRadius: 999, background: `${tc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: tc}}>{index + 1}</div>
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const StatCardsSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'stat-cards', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'stat-cards'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="stat-cards" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Data Insights</div>
        </div>
        <div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const numMatch = item.match(/[\d.]+%?/);
            const num = numMatch ? numMatch[0] : String(index + 1).padStart(2, '0');
            const label = numMatch ? item.replace(numMatch[0], '').trim() : item;
            return (
              <div key={`${item}-${index}`} style={{
                borderRadius: 30, padding: '28px 24px', border: `1px solid ${tc}4a`,
                background: `linear-gradient(180deg, ${tc}18, rgba(15,23,42,0.85))`,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                textAlign: 'center', boxShadow: `0 18px 44px ${tc}16`,
              }}>
                <div style={{fontSize: 52, fontWeight: 900, color: tc, lineHeight: 1}}>{num}</div>
                <div style={{marginTop: 14, fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4}}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const HeadlineSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const support = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'headline', structure);

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="headline" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 1300}}>
        <div style={{width: 72, height: 6, borderRadius: 999, background: accentColor, marginBottom: 32}} />
        <div style={{fontSize: 96, lineHeight: 1, fontWeight: 900, color: '#f8fafc'}}>{slide.heading}</div>
        {support ? <div style={{marginTop: 36, fontSize: 34, lineHeight: 1.55, color: '#94a3b8', maxWidth: 1000}}>{support}</div> : null}
        <div style={{marginTop: 40, display: 'flex', alignItems: 'center', gap: 12}}>
          <IconBadge name={slideIcon} color={accentColor} size={44} tone="soft" />
          <div style={{fontSize: 22, fontWeight: 700, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>Chapter Focus</div>
        </div>
      </div>
    </SceneChrome>
  );
};

const SidebarNoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'sidebar-note', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'sidebar-note'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="sidebar-note" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28}}>
        <div style={{borderRadius: 30, padding: '32px 24px', border: `1px solid ${accentColor}3a`, background: `linear-gradient(180deg, ${accentColor}18, rgba(15,23,42,0.82))`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16}}>
          <IconBadge name={slideIcon} color={accentColor} size={48} tone="solid" />
          <div style={{fontSize: 18, fontWeight: 800, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>Side Note</div>
          <div style={{fontSize: 22, color: '#cbd5e1', lineHeight: 1.55}}>{lead || presentation.meta.subtitle || ''}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18}}>
          <div style={{fontSize: 54, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{padding: '18px 24px', borderRadius: 24, border: `1px solid ${tc}40`, background: `linear-gradient(90deg, ${tc}14, rgba(15,23,42,0.88))`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: `0 12px 30px ${tc}12`}}>
                <IconBadge name={getItemIcon(item, index, 'sidebar-note')} color={tc} size={38} tone="soft" />
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const FilmstripSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'filmstrip', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'filmstrip'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="filmstrip" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', gap: 14, alignItems: 'stretch'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                flex: 1, borderRadius: 28, padding: '24px 20px', border: `1px solid ${tc}4a`,
                background: `linear-gradient(180deg, ${tc}16, rgba(15,23,42,0.88))`,
                borderTop: `5px solid ${tc}`, display: 'flex', flexDirection: 'column', gap: 14,
                boxShadow: `0 18px 44px ${tc}14`,
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 40, fontWeight: 900, color: `${tc}55`}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'filmstrip')} color={tc} size={36} tone="soft" />
                </div>
                <div style={{flex: 1, fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const DuoSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 2);
  const slideIcon = getSlideIcon(slide, 'duo', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'duo'});
  const topItem = items[0] ?? structure.paragraphs[0] ?? '';
  const bottomItem = items[1] ?? structure.paragraphs[1] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="duo" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={50} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        {[topItem, bottomItem].filter(Boolean).map((item, index) => {
          const tc = itemColors[index] ?? accentColor;
          return (
            <div key={`duo-${index}`} style={{
              flex: 1, borderRadius: 34, padding: '32px 38px', border: `1px solid ${tc}4a`,
              background: `linear-gradient(${index === 0 ? '135deg' : '225deg'}, ${tc}18, rgba(15,23,42,0.88))`,
              display: 'flex', alignItems: 'center', gap: 20, boxShadow: `0 20px 52px ${tc}16`,
            }}>
              <div style={{minWidth: 64, height: 64, borderRadius: 20, background: `${tc}22`, border: `1px solid ${tc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: tc}}>{index === 0 ? 'A' : 'B'}</div>
              <div style={{fontSize: 32, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
            </div>
          );
        })}
      </div>
    </SceneChrome>
  );
};

const OrbitSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'orbit', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'orbit'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="orbit" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 32}}>
        <div style={{flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
          <div style={{marginTop: 20, fontSize: 56, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '18px 22px', borderRadius: 22, border: `1px solid ${tc}40`,
                background: `linear-gradient(135deg, ${tc}15, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 14,
                borderLeft: `5px solid ${tc}`, boxShadow: `0 12px 32px ${tc}12`,
              }}>
                <IconBadge name={getItemIcon(item, index, 'orbit')} color={tc} size={38} tone={index === 0 ? 'solid' : 'soft'} />
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const KanbanSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const cols = 3;
  const slideIcon = getSlideIcon(slide, 'kanban', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'kanban'});
  const colLabels = ['Insight', 'Action', 'Outcome'];

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="kanban" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 22}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18}}>
          {Array.from({length: cols}, (_, colIndex) => {
            const colItems = items.filter((_, i) => i % cols === colIndex);
            const colColor = itemColors[colIndex] ?? accentColor;
            return (
              <div key={colIndex} style={{borderRadius: 28, border: `1px solid ${colColor}33`, background: `linear-gradient(180deg, ${colColor}0d, rgba(15,23,42,0.75))`, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14}}>
                <div style={{fontSize: 18, fontWeight: 800, color: colColor, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', padding: '10px 0', borderBottom: `2px solid ${colColor}33`}}>{colLabels[colIndex] ?? `Col ${colIndex + 1}`}</div>
                {colItems.map((item, i) => {
                  const tc = itemColors[colIndex * 2 + i] ?? colColor;
                  return (
                    <div key={`${item}-${i}`} style={{padding: '16px 18px', borderRadius: 20, border: `1px solid ${tc}40`, background: `linear-gradient(135deg, ${tc}16, rgba(15,23,42,0.88))`, fontSize: 25, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42, boxShadow: `0 10px 28px ${tc}12`}}>{item}</div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const StackSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'stack', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'stack'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="stack" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 32}}>
        <div style={{flex: '0 0 440px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
          <div style={{marginTop: 18, fontSize: 54, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                position: 'absolute', top: `${10 + index * 15}%`, left: index * 14,
                right: (items.length - 1 - index) * 14,
                padding: '22px 28px', borderRadius: 28, border: `1px solid ${tc}4a`,
                background: `linear-gradient(135deg, ${tc}1a, rgba(15,23,42,0.92))`,
                boxShadow: `0 20px 52px ${tc}18, 0 4px 12px rgba(0,0,0,0.3)`,
                zIndex: items.length - index,
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
                  <div style={{fontSize: 16, fontWeight: 900, color: tc}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'stack')} color={tc} size={34} tone="soft" />
                </div>
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const AccentBarSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const statement = structure.strongPhrases[0] ?? structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'accent-bar', structure);

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="accent-bar" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{width: '100%', padding: '48px 56px', borderRadius: 36, background: `linear-gradient(135deg, ${accentColor}28, ${accentColor}0a)`, borderLeft: `8px solid ${accentColor}`, boxShadow: `0 28px 72px ${accentColor}1a`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24}}>
            <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
            <div style={{fontSize: 22, fontWeight: 800, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>Key Statement</div>
          </div>
          <div style={{fontSize: 58, lineHeight: 1.15, fontWeight: 850, color: '#f8fafc', marginBottom: 24}}>{slide.heading}</div>
          {statement ? <div style={{fontSize: 36, lineHeight: 1.45, color: '#e2e8f0', fontWeight: 700, maxWidth: 1100}}>{statement}</div> : null}
        </div>
      </div>
    </SceneChrome>
  );
};

const SplitQuoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const quoteText = structure.strongPhrases[0] ?? structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const explanation = structure.paragraphs[1] ?? getNarrationSentences(slide.narration)[1] ?? '';
  const slideIcon = getSlideIcon(slide, 'split-quote', structure);
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 3);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'split-quote'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="split-quote" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 28}}>
        <div style={{borderRadius: 38, padding: '42px 40px', border: `1px solid ${accentColor}3f`, background: `linear-gradient(180deg, ${accentColor}16, rgba(2,6,23,0.84))`, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: `0 24px 64px ${accentColor}18`}}>
          <div style={{fontSize: 80, lineHeight: 0.8, fontWeight: 900, color: `${accentColor}35`}}>"</div>
          <div style={{fontSize: 44, fontWeight: 850, color: '#f8fafc', lineHeight: 1.2, marginTop: 8}}>{slide.heading}</div>
          <div style={{marginTop: 24, fontSize: 36, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4}}>{quoteText}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18}}>
          {explanation ? <div style={{padding: '24px 28px', borderRadius: 28, border: `1px solid ${accentColor}30`, background: `linear-gradient(135deg, ${accentColor}0d, rgba(15,23,42,0.82))`, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{explanation}</div> : null}
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{padding: '18px 22px', borderRadius: 24, border: `1px solid ${tc}40`, background: `linear-gradient(135deg, ${tc}14, rgba(15,23,42,0.88))`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 12px 30px ${tc}12`}}>
                <IconBadge name={getItemIcon(item, index, 'split-quote')} color={tc} size={36} tone="soft" />
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const ChecklistSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 7);
  const slideIcon = getSlideIcon(slide, 'checklist', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'checklist'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="checklist" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 50, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '16px 22px', borderRadius: 20, border: `1px solid ${tc}35`,
                background: `linear-gradient(90deg, ${tc}10, rgba(15,23,42,0.85))`,
                display: 'flex', alignItems: 'center', gap: 16, boxShadow: `0 8px 24px ${tc}0d`,
              }}>
                <div style={{minWidth: 38, height: 38, borderRadius: 10, border: `2px solid ${tc}`, background: `${tc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <AppIcon name="check" size={20} color={tc} />
                </div>
                <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const MinimalSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const support = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'minimal', structure);

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="minimal" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 120px'}}>
        <div style={{fontSize: 72, lineHeight: 1.08, fontWeight: 900, color: '#f8fafc', maxWidth: 1100}}>{slide.heading}</div>
        {support ? <div style={{marginTop: 32, fontSize: 30, lineHeight: 1.55, color: '#64748b', maxWidth: 900}}>{support}</div> : null}
      </div>
    </SceneChrome>
  );
};

const MagazineSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'magazine', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'magazine'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="magazine" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
              <IconBadge name={slideIcon} color={accentColor} size={44} tone="solid" />
              <div style={{fontSize: 18, fontWeight: 800, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>In Depth</div>
            </div>
            <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          </div>
          {intro ? <div style={{maxWidth: 420, fontSize: 24, color: '#94a3b8', lineHeight: 1.55, textAlign: 'right'}}>{intro}</div> : null}
        </div>
        <div style={{width: '100%', height: 2, background: `linear-gradient(90deg, ${accentColor}, transparent)`}} />
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: items.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 16}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '22px 22px', borderRadius: 24, border: `1px solid ${tc}3a`,
                background: `linear-gradient(180deg, ${tc}12, rgba(15,23,42,0.85))`,
                display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 14px 36px ${tc}10`,
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 14, fontWeight: 900, color: tc, letterSpacing: 1}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'magazine')} color={tc} size={32} tone="soft" />
                </div>
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};

const SlideCard: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
}> = ({accentColor, presentation, slide, slideIndex}) => {
  const structure = parseSlideStructure(slide.markdown);
  const variant = getSlideVariant({
    slide,
    slideIndex,
    totalSlides: presentation.slides.length,
    structure,
  });
  const resolvedAccentColor = getSlideAccentColor({
    baseAccentColor: accentColor,
    slide,
    slideIndex,
    structure,
    variant,
  });

  if (structure.hasTable) {
    return <TableSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'hero') {
    return (
      <HeroSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'split-list') {
    return (
      <SplitListSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'grid') {
    return (
      <GridSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'mosaic') {
    return (
      <MosaicSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'argument') {
    return (
      <ArgumentSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'triptych') {
    return (
      <TriptychSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'manifesto') {
    return (
      <ManifestoSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'timeline') {
    return (
      <TimelineSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'spotlight') {
    return (
      <SpotlightSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'quote') {
    return (
      <QuoteSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'code') {
    return (
      <CodeSlideLayout
        accentColor={resolvedAccentColor}
        presentation={presentation}
        slide={slide}
        slideIndex={slideIndex}
        structure={structure}
      />
    );
  }

  if (variant === 'centered') {
    return <CenteredSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'waterfall') {
    return <WaterfallSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'radar') {
    return <RadarSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'compare') {
    return <CompareSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'pyramid') {
    return <PyramidSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'stat-cards') {
    return <StatCardsSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'headline') {
    return <HeadlineSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'sidebar-note') {
    return <SidebarNoteSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'filmstrip') {
    return <FilmstripSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'duo') {
    return <DuoSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'orbit') {
    return <OrbitSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'kanban') {
    return <KanbanSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'stack') {
    return <StackSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'accent-bar') {
    return <AccentBarSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'split-quote') {
    return <SplitQuoteSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'checklist') {
    return <ChecklistSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'minimal') {
    return <MinimalSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'magazine') {
    return <MagazineSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  return <PanelSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} />;
};

export const MarkdownVideo: React.FC<MarkdownVideoProps> = ({
  markdown,
  themeColor,
  presentation,
}) => {
  const {fps} = useVideoConfig();
  const resolvedPresentation = presentation ?? analyzeMarkdownPresentation(markdown, fps);
  const accentColor = themeColor ?? resolvedPresentation.meta.themeColor ?? '#7c3aed';
  const offsets = getSlideOffsets(resolvedPresentation);

  return (
    <AbsoluteFill style={styles.container}>
      {resolvedPresentation.slides.map((slide, index) => (
        <Sequence
          key={slide.id}
          from={offsets[index]}
          durationInFrames={slide.durationInFrames}
        >
          <SlideCard
            accentColor={accentColor}
            presentation={resolvedPresentation}
            slide={slide}
            slideIndex={index}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    color: '#e2e8f0',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    backgroundColor: '#020617',
  },
  scene: {
    padding: 64,
    overflow: 'hidden',
  },
  gridOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
    backgroundSize: '72px 72px',
    maskImage: 'radial-gradient(circle at center, black 35%, transparent 95%)',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
    zIndex: 10,
  },
  iconBadgeBase: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    backdropFilter: 'blur(14px)',
    flexShrink: 0,
  },
  badge: {
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 999,
    padding: '10px 18px 10px 10px',
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: 0.5,
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  badgeText: {
    lineHeight: 1,
  },
  metaGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  metaText: {
    fontSize: 24,
    color: '#cbd5e1',
  },
  layoutPill: {
    border: '1px solid rgba(148,163,184,0.22)',
    borderRadius: 999,
    padding: '10px 16px',
    fontSize: 18,
    fontWeight: 700,
    backgroundColor: 'rgba(15, 23, 42, 0.62)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  layoutPillText: {
    lineHeight: 1,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  contentStage: {
    position: 'absolute',
    left: 64,
    right: 64,
    top: 136,
    bottom: 168,
    zIndex: 5,
  },
  heroShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    maxWidth: 1240,
  },
  heroKicker: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  heroHeading: {
    fontSize: 104,
    lineHeight: 1,
    fontWeight: 900,
    color: '#f8fafc',
    maxWidth: 1260,
  },
  heroLead: {
    marginTop: 28,
    fontSize: 36,
    lineHeight: 1.5,
    color: '#dbeafe',
    maxWidth: 1000,
  },
  heroSupport: {
    marginTop: 18,
    fontSize: 28,
    lineHeight: 1.5,
    color: '#94a3b8',
    maxWidth: 920,
  },
  heroChipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 34,
    maxWidth: 1080,
  },
  heroChip: {
    padding: '14px 18px',
    borderRadius: 22,
    fontSize: 24,
    fontWeight: 700,
    color: '#f8fafc',
    background: 'rgba(15, 23, 42, 0.68)',
    border: '1px solid rgba(148,163,184,0.18)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  heroChipText: {
    lineHeight: 1.35,
  },
  splitShell: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1.05fr 0.95fr',
    gap: 28,
  },
  infoCard: {
    height: '100%',
    borderRadius: 40,
    padding: '46px 46px 42px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.72))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  primaryTitle: {
    fontSize: 66,
    lineHeight: 1.05,
    fontWeight: 850,
    color: '#f8fafc',
    maxWidth: 920,
  },
  largeBody: {
    marginTop: 24,
    fontSize: 34,
    lineHeight: 1.55,
    color: '#e2e8f0',
    maxWidth: 820,
  },
  secondaryBody: {
    marginTop: 18,
    fontSize: 26,
    lineHeight: 1.55,
    color: '#94a3b8',
    maxWidth: 760,
  },
  cardStackColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  listFeatureCard: {
    flex: 1,
    borderRadius: 32,
    padding: '24px 26px',
    background: 'rgba(15, 23, 42, 0.78)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    display: 'flex',
    gap: 18,
    alignItems: 'flex-start',
    backdropFilter: 'blur(14px)',
  },
  featureIndex: {
    minWidth: 56,
    fontSize: 24,
    lineHeight: '42px',
    fontWeight: 900,
    textAlign: 'center',
    borderRadius: 18,
    background: 'rgba(2, 6, 23, 0.78)',
  },
  featureMetaColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    minWidth: 52,
  },
  featureIndexPill: {
    minWidth: 42,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 16,
    lineHeight: 1.1,
    fontWeight: 900,
    textAlign: 'center',
    background: 'rgba(2, 6, 23, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
  },
  featureContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 14,
  },
  featureText: {
    flex: 1,
    fontSize: 30,
    lineHeight: 1.45,
    color: '#f8fafc',
    fontWeight: 700,
  },
  cardTagRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  cardTag: {
    alignSelf: 'flex-start',
    padding: '8px 14px',
    borderRadius: 999,
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 800,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.68)',
  },
  gridShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  gridHeaderCard: {
    borderRadius: 34,
    padding: '34px 40px',
    background: 'rgba(15, 23, 42, 0.78)',
    border: '1px solid rgba(148,163,184,0.16)',
    backdropFilter: 'blur(16px)',
  },
  metricsGrid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 20,
  },
  metricCard: {
    borderRadius: 30,
    padding: '26px 28px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.7))',
    border: '1px solid rgba(148,163,184,0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 180,
  },
  metricBadge: {
    alignSelf: 'flex-start',
    padding: '10px 14px',
    borderRadius: 18,
    fontSize: 18,
    fontWeight: 900,
    marginBottom: 20,
  },
  metricTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  metricIndex: {
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.86)',
    border: '1px solid rgba(148,163,184,0.18)',
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1,
  },
  metricText: {
    fontSize: 30,
    lineHeight: 1.42,
    fontWeight: 700,
    color: '#f8fafc',
  },
  mosaicShell: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '0.92fr 1.08fr',
    gap: 24,
  },
  mosaicLeadCard: {
    borderRadius: 38,
    padding: '42px 42px 38px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.76))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  mosaicStatement: {
    marginTop: 24,
    padding: '18px 20px',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    fontSize: 24,
    lineHeight: 1.55,
    color: '#dbeafe',
    fontWeight: 700,
  },
  mosaicBoard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(148px, 1fr)',
    gap: 18,
  },
  mosaicCard: {
    minHeight: 148,
    borderRadius: 30,
    padding: '22px 22px 20px',
    background: 'rgba(15, 23, 42, 0.84)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  mosaicCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  mosaicIndex: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.84)',
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 900,
  },
  mosaicCardText: {
    fontSize: 28,
    lineHeight: 1.42,
    fontWeight: 800,
    color: '#f8fafc',
  },
  argumentShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  argumentHeaderCard: {
    borderRadius: 38,
    padding: '40px 42px 36px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.76))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
  },
  argumentThesis: {
    marginTop: 26,
    padding: '18px 20px',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.74)',
    fontSize: 28,
    lineHeight: 1.5,
    color: '#f8fafc',
    fontWeight: 800,
    maxWidth: 1080,
  },
  argumentBoard: {
    flex: 1,
    display: 'grid',
    gap: 18,
  },
  argumentCard: {
    minHeight: 172,
    borderRadius: 30,
    padding: '24px 24px 22px',
    background: 'rgba(15, 23, 42, 0.86)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  argumentCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  argumentIndex: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.84)',
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 900,
  },
  argumentCardText: {
    flex: 1,
    fontSize: 30,
    lineHeight: 1.45,
    fontWeight: 800,
    color: '#f8fafc',
  },
  triptychShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  triptychHeaderCard: {
    borderRadius: 34,
    padding: '34px 40px',
    background: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
  },
  triptychColumns: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 18,
  },
  triptychCard: {
    borderRadius: 30,
    padding: '24px 24px 22px',
    background: 'rgba(15, 23, 42, 0.88)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  triptychCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  triptychIndex: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.84)',
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 900,
  },
  triptychCardText: {
    flex: 1,
    fontSize: 30,
    lineHeight: 1.45,
    fontWeight: 800,
    color: '#f8fafc',
  },
  triptychSupportPill: {
    padding: '16px 20px',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    fontSize: 24,
    lineHeight: 1.5,
    color: '#e2e8f0',
    fontWeight: 700,
  },
  manifestoShell: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '0.9fr 1.1fr',
    gap: 24,
    alignItems: 'stretch',
  },
  manifestoLeadCard: {
    borderRadius: 38,
    padding: '42px 42px 38px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.78))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  manifestoThesis: {
    marginTop: 24,
    padding: '18px 20px',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    fontSize: 26,
    lineHeight: 1.55,
    color: '#dcfce7',
    fontWeight: 800,
  },
  manifestoStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    justifyContent: 'center',
  },
  manifestoRuleCard: {
    borderRadius: 28,
    padding: '22px 22px 20px',
    background: 'rgba(15, 23, 42, 0.86)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
  },
  manifestoRuleTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  manifestoRuleIndex: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.84)',
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 900,
  },
  manifestoRuleMain: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
  },
  manifestoRuleText: {
    flex: 1,
    fontSize: 29,
    lineHeight: 1.48,
    fontWeight: 800,
    color: '#f8fafc',
  },
  timelineShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  timelineHeroCard: {
    borderRadius: 34,
    padding: '34px 40px',
    background: 'rgba(15, 23, 42, 0.78)',
    border: '1px solid rgba(148,163,184,0.16)',
    backdropFilter: 'blur(16px)',
  },
  timelineTrack: {
    flex: 1,
    display: 'flex',
    gap: 18,
    alignItems: 'stretch',
  },
  timelineStep: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: '54%',
    right: -14,
    top: 19,
    height: 4,
    borderRadius: 999,
    opacity: 0.9,
  },
  timelineMarkerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 40,
  },
  timelineDot: {
    width: 38,
    height: 38,
    borderRadius: 999,
    flexShrink: 0,
  },
  timelineStepNumber: {
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 16,
    lineHeight: 1,
    fontWeight: 900,
    border: '1px solid rgba(148,163,184,0.18)',
    background: 'rgba(15, 23, 42, 0.82)',
  },
  timelineCard: {
    flex: 1,
    borderRadius: 30,
    padding: '24px 24px 22px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.74))',
    border: '1px solid rgba(148,163,184,0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
  },
  timelineCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  timelineText: {
    flex: 1,
    fontSize: 28,
    lineHeight: 1.48,
    fontWeight: 700,
    color: '#f8fafc',
  },
  spotlightShell: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.6fr',
    gap: 24,
    alignItems: 'stretch',
  },
  spotlightMainCard: {
    borderRadius: 42,
    padding: '46px 48px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(2, 6, 23, 0.8))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  spotlightHeading: {
    fontSize: 58,
    lineHeight: 1.08,
    fontWeight: 850,
    color: '#e2e8f0',
  },
  spotlightQuote: {
    marginTop: 26,
    fontSize: 74,
    lineHeight: 1.12,
    fontWeight: 900,
    color: '#f8fafc',
    maxWidth: 920,
  },
  spotlightSupport: {
    marginTop: 24,
    fontSize: 30,
    lineHeight: 1.55,
    color: '#cbd5e1',
    maxWidth: 840,
  },
  sideRail: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    justifyContent: 'center',
  },
  sideRailItem: {
    padding: '18px 20px',
    borderRadius: 24,
    background: 'rgba(15, 23, 42, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    fontSize: 24,
    lineHeight: 1.45,
    color: '#f8fafc',
    fontWeight: 700,
  },
  sideRailItemInner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
  },
  sideRailTextGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  sideRailText: {
    flex: 1,
    lineHeight: 1.45,
  },
  quoteShell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 22,
    justifyContent: 'center',
  },
  quoteHeroCard: {
    borderRadius: 42,
    padding: '46px 48px 42px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.82))',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  quoteHeading: {
    fontSize: 52,
    lineHeight: 1.08,
    fontWeight: 850,
    color: '#e2e8f0',
  },
  quoteStatement: {
    marginTop: 24,
    fontSize: 68,
    lineHeight: 1.12,
    fontWeight: 900,
    color: '#f8fafc',
    maxWidth: 1160,
  },
  quoteSupport: {
    marginTop: 22,
    fontSize: 28,
    lineHeight: 1.55,
    color: '#cbd5e1',
    maxWidth: 980,
  },
  quoteCompareRow: {
    display: 'grid',
    gap: 18,
  },
  quoteCompareCard: {
    minHeight: 210,
    borderRadius: 30,
    padding: '24px 24px 22px',
    background: 'rgba(15, 23, 42, 0.86)',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  quoteCompareTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  quoteCompareText: {
    flex: 1,
    fontSize: 30,
    lineHeight: 1.45,
    fontWeight: 800,
    color: '#f8fafc',
  },
  quoteNote: {
    padding: '16px 20px',
    borderRadius: 24,
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(15, 23, 42, 0.72)',
    fontSize: 24,
    lineHeight: 1.55,
    color: '#e2e8f0',
    fontWeight: 700,
  },
  codeShell: {
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '0.86fr 1.14fr',
    gap: 24,
  },
  codeInfoCard: {
    borderRadius: 38,
    padding: '42px 42px 38px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.74))',
    border: '1px solid rgba(148,163,184,0.16)',
    backdropFilter: 'blur(16px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  codeCard: {
    borderRadius: 34,
    background: '#020617',
    border: '1px solid rgba(71, 85, 105, 0.45)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 32px 80px rgba(2, 6, 23, 0.45)',
  },
  codeCardTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 22px',
    borderBottom: '1px solid rgba(71, 85, 105, 0.45)',
    background: 'rgba(15, 23, 42, 0.96)',
  },
  codeDots: {
    display: 'flex',
    gap: 8,
  },
  codeDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    display: 'inline-block',
  },
  codeLanguage: {
    fontSize: 18,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  codeLanguageText: {
    lineHeight: 1,
  },
  codeBody: {
    flex: 1,
    padding: '20px 24px 24px',
    overflow: 'hidden',
  },
  codeRow: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr',
    gap: 18,
    alignItems: 'start',
    padding: '4px 0',
  },
  codeLineNumber: {
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 20,
    lineHeight: 1.6,
    color: '#475569',
    textAlign: 'right',
    userSelect: 'none',
  },
  codeLineText: {
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 24,
    lineHeight: 1.6,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap',
  },
  card: {
    height: '100%',
    borderRadius: 40,
    padding: '52px 56px',
    background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.74))',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 0,
    zIndex: 5,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
  },
  panelTitleGroup: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 16,
    maxWidth: 1180,
  },
  kicker: {
    fontSize: 24,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  heading: {
    fontSize: 64,
    lineHeight: 1.06,
    fontWeight: 800,
    color: '#f8fafc',
    maxWidth: 1180,
  },
  subtitle: {
    marginTop: 20,
    fontSize: 30,
    lineHeight: 1.5,
    color: '#94a3b8',
    maxWidth: 1080,
  },
  markdownBody: {
    marginTop: 28,
    fontSize: 30,
    lineHeight: 1.6,
    overflow: 'hidden',
  },
  h1: {
    fontSize: 48,
    fontWeight: 800,
    lineHeight: 1.15,
    margin: '0 0 20px',
    color: '#f8fafc',
  },
  h2: {
    fontSize: 40,
    fontWeight: 800,
    lineHeight: 1.2,
    margin: '0 0 18px',
    color: '#f8fafc',
  },
  h3: {
    fontSize: 34,
    fontWeight: 700,
    lineHeight: 1.2,
    margin: '0 0 14px',
    color: '#f8fafc',
  },
  paragraph: {
    margin: '0 0 18px',
    color: '#e2e8f0',
  },
  list: {
    margin: '0 0 22px 20px',
    padding: 0,
  },
  listItem: {
    marginBottom: 12,
    paddingLeft: 8,
  },
  blockquote: {
    margin: '18px 0',
    padding: '16px 20px',
    borderLeft: '6px solid rgba(56, 189, 248, 0.9)',
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    color: '#bfdbfe',
  },
  strong: {
    color: '#f8fafc',
  },
  inlineCode: {
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 12,
    padding: '4px 8px',
    fontSize: '0.85em',
  },
  preformatted: {
    margin: '18px 0 24px',
    padding: '22px 24px',
    borderRadius: 24,
    backgroundColor: '#020617',
    border: '1px solid rgba(71, 85, 105, 0.45)',
    color: '#cbd5e1',
    fontFamily: 'SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 22,
    lineHeight: 1.55,
    overflow: 'hidden',
  },
  tableWrapper: {
    margin: '18px 0 24px',
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(71, 85, 105, 0.45)',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 24,
    lineHeight: 1.5,
  },
  thead: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
  },
  tr: {
    borderBottom: '1px solid rgba(71, 85, 105, 0.35)',
  },
  th: {
    padding: '14px 18px',
    fontWeight: 700,
    color: '#f1f5f9',
    textAlign: 'left' as const,
    fontSize: 22,
    letterSpacing: 0.3,
  },
  td: {
    padding: '12px 18px',
    color: '#cbd5e1',
    textAlign: 'left' as const,
  },
  backgroundOrb: {
    position: 'absolute',
    borderRadius: 9999,
    filter: 'blur(28px)',
    zIndex: 1,
  },
  captionShell: {
    position: 'absolute',
    left: 96,
    right: 96,
    bottom: 36,
    zIndex: 12,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionText: {
    maxWidth: 1080,
    fontSize: 34,
    lineHeight: 1.45,
    fontWeight: 800,
    color: '#f8fafc',
    textAlign: 'center',
    textShadow: '0 3px 18px rgba(2, 6, 23, 0.88), 0 1px 2px rgba(2, 6, 23, 0.92)',
  },
};
