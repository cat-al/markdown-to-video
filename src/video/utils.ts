import type {MarkdownPresentation, CaptionCue} from './types';

export const getSlideOffsets = (presentation: MarkdownPresentation) => {
  let current = 0;
  return presentation.slides.map((slide) => {
    const start = current;
    current += slide.durationInFrames;
    return start;
  });
};

export const getActiveCaption = (cues: CaptionCue[], frame: number) => {
  return cues.find((cue) => frame >= cue.startFrame && frame < cue.endFrame) ?? null;
};

export const stripMarkdownSyntax = (value: string) => {
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

export const getNarrationSentences = (text: string) => {
  return (text.match(/[^。！？!?；;]+[。！？!?；;]?/g) ?? [])
    .map((part) => part.trim())
    .filter(Boolean);
};
