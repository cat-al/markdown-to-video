import type {SlideLayoutName, MarkdownPresentation, MarkdownSlide, CaptionCue} from '../markdown';

export type {MarkdownPresentation, MarkdownSlide, CaptionCue, SlideLayoutName};

export type MarkdownVideoProps = {
  markdown: string;
  themeColor?: string;
  presentation?: MarkdownPresentation;
};

export type SlideVariant = SlideLayoutName;

export type SlideStructure = {
  bulletItems: string[];
  orderedItems: string[];
  paragraphs: string[];
  codeBlock?: string;
  codeLanguage?: string;
  strongPhrases: string[];
  hasTable?: boolean;
};

export type IconName = 'spark' | 'layers' | 'switch' | 'alert' | 'focus' | 'clock' | 'check' | 'code' | 'trend' | 'quote' | 'list';

export type LayoutProps = {
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
};
