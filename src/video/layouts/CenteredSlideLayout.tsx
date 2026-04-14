import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';

export const CenteredSlideLayout: React.FC<{
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
