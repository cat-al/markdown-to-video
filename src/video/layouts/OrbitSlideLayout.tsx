import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const OrbitSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'orbit', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'orbit'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="orbit" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 32}}>
        <div style={{flex: '0 0 480px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
          <div style={{marginTop: 20, fontSize: 56, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '18px 22px', borderRadius: 22, border: `1px solid ${tc}40`,
                background: `linear-gradient(135deg, ${tc}15, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 14,
                borderLeft: `5px solid ${tc}`, boxShadow: `0 12px 32px ${tc}12`,
              }}>
                <IconBadge name={getItemIcon(item, index, 'orbit')} color={tc} size={38} tone={index === 0 ? 'solid' : 'soft'} />
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
