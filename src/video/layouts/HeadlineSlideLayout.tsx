import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';

export const HeadlineSlideLayout: React.FC<{
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
