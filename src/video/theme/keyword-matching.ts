import type {IconName, SlideVariant, SlideStructure, MarkdownSlide} from '../types';
import {stripMarkdownSyntax} from '../utils';

export const matchKeywordIcon = (text: string): IconName | null => {
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

  if (/观点|原话|引用|"|"|quote|结语/.test(normalized)) {
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

export const getVariantIcon = (variant: SlideVariant): IconName => {
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

export const getSlideIcon = (slide: MarkdownSlide, variant: SlideVariant, structure: SlideStructure): IconName => {
  const icon = matchKeywordIcon([
    slide.heading,
    structure.paragraphs[0] ?? '',
    structure.bulletItems[0] ?? '',
    structure.orderedItems[0] ?? '',
  ].join(' '));

  return icon ?? getVariantIcon(variant);
};

export const getItemIcon = (item: string, index: number, variant: SlideVariant): IconName => {
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

export const getIconLabel = (icon: IconName) => {
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

export const matchKeywordColor = (text: string): string | null => {
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
