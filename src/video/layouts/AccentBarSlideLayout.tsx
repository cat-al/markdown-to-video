import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';

export const AccentBarSlideLayout: React.FC<{
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
