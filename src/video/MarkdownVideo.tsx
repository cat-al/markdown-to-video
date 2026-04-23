import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

import {analyzeMarkdownPresentation} from '../markdown';
import type {MarkdownVideoProps, MarkdownPresentation, MarkdownSlide, CaptionCue} from './types';
import {getSlideOffsets} from './utils';
import {getSlideAccentColor} from './theme/palettes';
import {parseSlideStructure} from './logic/slide-structure';
import {getSlideVariant} from './logic/slide-variant';
import {styles} from './styles';
import {HtmlSlideBackground} from './components/HtmlSlideBackground';
import {
  AccentBarSlideLayout,
  ArgumentSlideLayout,
  CenteredSlideLayout,
  ChecklistSlideLayout,
  CodeSlideLayout,
  CompareSlideLayout,
  DuoSlideLayout,
  FilmstripSlideLayout,
  GridSlideLayout,
  HeadlineSlideLayout,
  HeroSlideLayout,
  KanbanSlideLayout,
  MagazineSlideLayout,
  ManifestoSlideLayout,
  MinimalSlideLayout,
  MosaicSlideLayout,
  OrbitSlideLayout,
  PanelSlideLayout,
  PyramidSlideLayout,
  QuoteSlideLayout,
  RadarSlideLayout,
  SidebarNoteSlideLayout,
  SpotlightSlideLayout,
  SplitListSlideLayout,
  SplitQuoteSlideLayout,
  StackSlideLayout,
  StatCardsSlideLayout,
  TableSlideLayout,
  TimelineSlideLayout,
  TriptychSlideLayout,
  WaterfallSlideLayout,
} from './layouts';

export type {MarkdownVideoProps};

/* ─── html-ppt mode: video background + caption overlay + audio ─── */
const HtmlPptSlide: React.FC<{
  slide: MarkdownSlide;
}> = ({slide}) => {
  const frame = useCurrentFrame();
  const activeCue = slide.captionCues.find(
    (cue: CaptionCue) => frame >= cue.startFrame && frame < cue.endFrame,
  );

  return (
    <AbsoluteFill>
      {slide.htmlVideoSrc && <HtmlSlideBackground videoSrc={slide.htmlVideoSrc} />}
      {activeCue && (
        <div style={styles.captionShell}>
          <div style={styles.captionText}>{activeCue.text}</div>
        </div>
      )}
      {slide.audioSrc && <Audio src={staticFile(slide.audioSrc)} />}
    </AbsoluteFill>
  );
};

const SlideCard: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
}> = ({accentColor, presentation, slide, slideIndex}) => {
  // html-ppt renderer: use pre-recorded video background
  if (presentation.meta.renderer === 'html-ppt' && slide.htmlVideoSrc) {
    return <HtmlPptSlide slide={slide} />;
  }

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
    return <HeroSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'split-list') {
    return <SplitListSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'grid') {
    return <GridSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'mosaic') {
    return <MosaicSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'argument') {
    return <ArgumentSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'triptych') {
    return <TriptychSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'manifesto') {
    return <ManifestoSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'timeline') {
    return <TimelineSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'spotlight') {
    return <SpotlightSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'quote') {
    return <QuoteSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
  }

  if (variant === 'code') {
    return <CodeSlideLayout accentColor={resolvedAccentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} structure={structure} />;
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
