export type PresentationMeta = {
  title?: string;
  subtitle?: string;
  themeColor?: string;
  ttsVoice?: string;
  ttsRate?: number;
  ttsProvider?: string;
  ttsModel?: string;
  ttsLanguage?: string;
  ttsInstruction?: string;
  ttsApiKey?: string;
  ttsBaseUrl?: string;
  ttsReferenceAudio?: string;
  ttsReferenceText?: string;
  ttsXVectorOnlyMode?: boolean;
  renderer?: 'native' | 'html-ppt';
  theme?: string;
  template?: string;
};

export const slideLayoutNames = [
  'hero',
  'split-list',
  'timeline',
  'grid',
  'mosaic',
  'argument',
  'triptych',
  'manifesto',
  'spotlight',
  'quote',
  'code',
  'panel',
  'centered',
  'waterfall',
  'radar',
  'compare',
  'pyramid',
  'stat-cards',
  'headline',
  'sidebar-note',
  'filmstrip',
  'duo',
  'orbit',
  'kanban',
  'stack',
  'accent-bar',
  'split-quote',
  'checklist',
  'minimal',
  'magazine',
] as const;

export type SlideLayoutName = (typeof slideLayoutNames)[number];

type SlideDirectives = {
  layout?: SlideLayoutName;
  accentColor?: string;
};

export type CaptionCue = {
  id: string;
  text: string;
  startFrame: number;
  endFrame: number;
};

export type MarkdownSlide = {
  id: string;
  heading: string;
  markdown: string;
  narration: string;
  wordCount: number;
  durationInFrames: number;
  captionCues: CaptionCue[];
  layout?: SlideLayoutName;
  accentColor?: string;
  audioSrc?: string;
  audioDurationInFrames?: number;
  htmlVideoSrc?: string;
};

export type MarkdownPresentation = {
  meta: PresentationMeta;
  slides: MarkdownSlide[];
  totalFrames: number;
};

const DEFAULT_THEME = '#7c3aed';
const DEFAULT_FPS = 30;
const MIN_SLIDE_SECONDS = 3;
const MAX_SLIDE_SECONDS = 9;

export const sampleMarkdown = `---
title: Markdown to Video
subtitle: 使用 Markdown 驱动的可编程视频原型
themeColor: #7c3aed
ttsProvider: qwen-local
ttsModel: Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice
ttsVoice: Vivian
ttsLanguage: Chinese
---
# 用 Markdown 生成视频

把文稿写成你熟悉的格式，然后交给 Remotion 渲染。

- 支持标题、段落、列表、代码块
- 自动按内容长度估算每页时长
- 可继续扩展 TTS、字幕、品牌模板

<!-- voiceover
大家好，这一页介绍的是 markdown 转视频的基本思路。你只需要继续写熟悉的文稿内容，系统就可以自动生成画面、配音和字幕。
-->

---

## 为什么选 Remotion

- React 组件化，适合复杂动画
- 可以接入数据、AI、模版系统
- 输出是真实视频，不是屏幕录制

<!-- voiceover
Remotion 的优势在于，它不是录屏工具，而是一个真正的可编程视频引擎。这样后续接入模板、配音和批量生成都会更自然。
-->

---

## 推荐的项目演进方向

1. Frontmatter 定义主题和视频参数
2. 每页支持配音和字幕
3. 批量渲染多个 Markdown 文件

<!-- duration: 7 -->
<!-- voiceover
接下来最值得优先补齐的是两项能力：第一是配音，第二是字幕。这样文稿到成片的体验就能完整闭环。
-->

---

## 一个简单的代码块

\`\`\`ts
export const value = 'markdown-to-video';
console.log(value);
\`\`\`

<!-- voiceover
哪怕页面里有代码块，也可以单独编写适合口播的旁白，而不是让系统逐字念代码。
-->
`;

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
};

const normalize = (markdown: string) => markdown.replace(/\r\n/g, '\n').trim();

const parseNumericValue = (value: string) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseFrontmatter = (markdown: string) => {
  const normalized = normalize(markdown);

  if (!normalized.startsWith('---\n')) {
    return {
      body: normalized,
      meta: {},
    } satisfies {body: string; meta: PresentationMeta};
  }

  const closingIndex = normalized.indexOf('\n---\n', 4);

  if (closingIndex === -1) {
    return {
      body: normalized,
      meta: {},
    } satisfies {body: string; meta: PresentationMeta};
  }

  const rawMeta = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5).trim();
  const meta: PresentationMeta = {};

  rawMeta.split('\n').forEach((line) => {
    const match = line.match(/^([a-zA-Z][\w-]*):\s*(.+)$/);

    if (!match) {
      return;
    }

    const [, key, value] = match;
    const normalizedKey = key.toLowerCase();
    const trimmedValue = value.trim();

    if (normalizedKey === 'title') {
      meta.title = trimmedValue;
    }

    if (normalizedKey === 'subtitle') {
      meta.subtitle = trimmedValue;
    }

    if (normalizedKey === 'themecolor' || normalizedKey === 'theme-color') {
      meta.themeColor = trimmedValue;
    }

    if (normalizedKey === 'ttsvoice' || normalizedKey === 'tts-voice') {
      meta.ttsVoice = trimmedValue;
    }

    if (normalizedKey === 'ttsrate' || normalizedKey === 'tts-rate') {
      meta.ttsRate = parseNumericValue(trimmedValue);
    }

    if (normalizedKey === 'ttsprovider' || normalizedKey === 'tts-provider') {
      meta.ttsProvider = trimmedValue;
    }

    if (normalizedKey === 'ttsmodel' || normalizedKey === 'tts-model') {
      meta.ttsModel = trimmedValue;
    }

    if (normalizedKey === 'ttslanguage' || normalizedKey === 'tts-language') {
      meta.ttsLanguage = trimmedValue;
    }

    if (normalizedKey === 'ttsinstruction' || normalizedKey === 'tts-instruction') {
      meta.ttsInstruction = trimmedValue;
    }

    if (normalizedKey === 'ttsapikey' || normalizedKey === 'tts-api-key') {
      meta.ttsApiKey = trimmedValue;
    }

    if (normalizedKey === 'ttsbaseurl' || normalizedKey === 'tts-base-url') {
      meta.ttsBaseUrl = trimmedValue;
    }

    if (normalizedKey === 'renderer') {
      const val = trimmedValue.toLowerCase();
      if (val === 'html-ppt' || val === 'native') {
        meta.renderer = val;
      }
    }

    if (normalizedKey === 'theme') {
      meta.theme = trimmedValue;
    }

    if (normalizedKey === 'template') {
      meta.template = trimmedValue;
    }
  });

  return {body, meta};
};

const slideLayoutNameSet = new Set<string>(slideLayoutNames);

const extractDurationInFrames = (markdown: string, fps: number) => {
  const match = markdown.match(/<!--\s*duration:\s*(\d+(?:\.\d+)?)\s*-->/i);

  if (!match) {
    return null;
  }

  return Math.max(Math.round(Number(match[1]) * fps), fps);
};

const extractSlideDirectives = (markdown: string): SlideDirectives => {
  const layoutMatch = markdown.match(/<!--\s*(?:layout|variant):\s*([a-z-]+)\s*-->/i);
  const accentMatch = markdown.match(/<!--\s*(?:accent|accent-color|theme-color):\s*([\s\S]*?)\s*-->/i);
  const rawLayout = layoutMatch?.[1]?.trim().toLowerCase();
  const rawAccentColor = accentMatch?.[1]?.trim();

  return {
    layout: rawLayout && slideLayoutNameSet.has(rawLayout) ? (rawLayout as SlideLayoutName) : undefined,
    accentColor: rawAccentColor || undefined,
  };
};

const extractVoiceover = (markdown: string) => {
  const voiceoverParts: string[] = [];

  const withoutBlockVoiceover = markdown.replace(
    /<!--\s*(?:voiceover|narration)\s*\n([\s\S]*?)-->/gi,
    (_match, text: string) => {
      const trimmed = text.trim();

      if (trimmed) {
        voiceoverParts.push(trimmed);
      }

      return '';
    },
  );

  const withoutInlineVoiceover = withoutBlockVoiceover.replace(
    /<!--\s*(?:voiceover|narration):\s*([\s\S]*?)\s*-->/gi,
    (_match, text: string) => {
      const trimmed = text.trim();

      if (trimmed) {
        voiceoverParts.push(trimmed);
      }

      return '';
    },
  );

  return {
    markdownWithoutVoiceover: withoutInlineVoiceover.trim(),
    voiceoverText: voiceoverParts.join('\n\n').trim(),
  };
};

const stripControlComments = (markdown: string) => {
  const {markdownWithoutVoiceover} = extractVoiceover(markdown);

  return markdownWithoutVoiceover
    .replace(/<!--\s*duration:\s*\d+(?:\.\d+)?\s*-->/gi, '')
    .replace(/<!--\s*(?:layout|variant):\s*[a-z-]+\s*-->/gi, '')
    .replace(/<!--\s*(?:accent|accent-color|theme-color):\s*[\s\S]*?\s*-->/gi, '')
    .trim();
};

const getWordCount = (markdown: string) => {
  const latinWords = markdown.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const chineseCharacters = markdown.match(/[\u4E00-\u9FFF]/g)?.length ?? 0;
  return latinWords + Math.ceil(chineseCharacters / 2);
};

const getHeading = (markdown: string, index: number) => {
  const match = markdown.match(/^#{1,3}\s+(.+)$/m);
  return match?.[1]?.trim() ?? `第 ${index + 1} 页`;
};

const markdownToPlainText = (markdown: string) => {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[>*_~|]/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const splitCaptionSegments = (text: string) => {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return [] as string[];
  }

  const sentenceLikeParts = normalized.match(/[^。！？!?；;：:]+[。！？!?；;：:]?/g) ?? [normalized];

  return sentenceLikeParts
    .flatMap((part) => {
      const trimmed = part.trim();

      if (!trimmed) {
        return [] as string[];
      }

      if (trimmed.length <= 26) {
        return [trimmed];
      }

      const commaParts = trimmed
        .split(/(?<=[，,、])/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (commaParts.length > 1) {
        return commaParts;
      }

      const words = trimmed.split(/\s+/).filter(Boolean);

      if (words.length <= 8) {
        return [trimmed];
      }

      const chunks: string[] = [];
      for (let index = 0; index < words.length; index += 8) {
        chunks.push(words.slice(index, index + 8).join(' '));
      }

      return chunks;
    })
    .filter(Boolean);
};

const buildCaptionCues = (text: string, durationInFrames: number, fps: number) => {
  const segments = splitCaptionSegments(text);

  if (segments.length === 0) {
    return [] as CaptionCue[];
  }

  const minimumFrames = Math.max(Math.round(fps * 0.9), 12);
  const weights = segments.map((segment) => Math.max(segment.replace(/\s+/g, '').length, 2));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const cues: CaptionCue[] = [];
  let cursor = 0;

  segments.forEach((segment, index) => {
    const remainingSegments = segments.length - index;
    const remainingFrames = durationInFrames - cursor;
    const remainingMinimum = minimumFrames * (remainingSegments - 1);
    const proportionalFrames = Math.round((durationInFrames * weights[index]) / totalWeight);
    const allocatedFrames =
      index === segments.length - 1
        ? remainingFrames
        : clamp(proportionalFrames, minimumFrames, Math.max(minimumFrames, remainingFrames - remainingMinimum));
    const safeEndFrame = Math.min(durationInFrames, cursor + allocatedFrames);

    cues.push({
      id: `cue-${index + 1}`,
      text: segment,
      startFrame: cursor,
      endFrame: Math.max(cursor + 1, safeEndFrame),
    });

    cursor = safeEndFrame;
  });

  return cues;
};

const estimateDurationInFrames = (markdown: string, narration: string, fps: number) => {
  const explicitDuration = extractDurationInFrames(markdown, fps);

  if (explicitDuration) {
    return explicitDuration;
  }

  const words = getWordCount(narration || markdown);
  const estimatedSeconds = 2.5 + words * 0.2;
  return Math.round(clamp(estimatedSeconds, MIN_SLIDE_SECONDS, MAX_SLIDE_SECONDS) * fps);
};

export const analyzeMarkdownPresentation = (
  markdown: string,
  fps = DEFAULT_FPS,
): MarkdownPresentation => {
  const {body, meta} = parseFrontmatter(markdown || sampleMarkdown);
  const rawSlides = body.split(/\n-{3,}\n/g).filter((slide) => slide.trim().length > 0);
  const slidesSource = rawSlides.length > 0 ? rawSlides : [body || sampleMarkdown];

  const slides = slidesSource.map((slideSource, index) => {
    const cleanedMarkdown = stripControlComments(slideSource);
    const {voiceoverText} = extractVoiceover(slideSource);
    const directives = extractSlideDirectives(slideSource);
    const narration = voiceoverText || markdownToPlainText(cleanedMarkdown);
    const wordCount = getWordCount(cleanedMarkdown);
    const durationInFrames = estimateDurationInFrames(slideSource, narration, fps);

    return {
      id: `slide-${index + 1}`,
      heading: getHeading(cleanedMarkdown, index),
      markdown: cleanedMarkdown,
      narration,
      wordCount,
      durationInFrames,
      captionCues: buildCaptionCues(narration, durationInFrames, fps),
      layout: directives.layout,
      accentColor: directives.accentColor,
    } satisfies MarkdownSlide;
  });

  const totalFrames = slides.reduce((sum, slide) => sum + slide.durationInFrames, 0);

  return {
    meta: {
      ...meta,
      themeColor: meta.themeColor ?? DEFAULT_THEME,
    },
    slides,
    totalFrames,
  };
};
