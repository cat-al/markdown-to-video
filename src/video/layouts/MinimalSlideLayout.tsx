import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';

export const MinimalSlideLayout: React.FC<{
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
