import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const RadarSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'radar', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'radar'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="radar" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 28}}>
        <div style={{flex: '0 0 420px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
          <div style={{marginTop: 20, fontSize: 56, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, display: 'flex', flexWrap: 'wrap', alignContent: 'center', gap: 16, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const size = index === 0 ? 220 : 180;
            return (
              <div key={`${item}-${index}`} style={{
                width: size, height: size, borderRadius: '50%', border: `2px solid ${tc}55`,
                background: `radial-gradient(circle, ${tc}20, rgba(15,23,42,0.9))`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 18, textAlign: 'center', boxShadow: `0 0 40px ${tc}18`,
              }}>
                <div style={{fontSize: 18, fontWeight: 900, color: tc, marginBottom: 8}}>{String(index + 1).padStart(2, '0')}</div>
                <div style={{fontSize: index === 0 ? 22 : 20, fontWeight: 700, color: '#f8fafc', lineHeight: 1.35}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
