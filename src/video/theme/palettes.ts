import type {SlideVariant, SlideStructure, MarkdownSlide} from '../types';
import {matchKeywordColor} from './keyword-matching';

export const slideAccentPalettes: Record<SlideVariant, string[]> = {
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

export const itemTonePalettes: Record<SlideVariant, string[]> = {
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

export const getSlideAccentColor = ({
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

export const getDistinctItemToneColors = ({
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
