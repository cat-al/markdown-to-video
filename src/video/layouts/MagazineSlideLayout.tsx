import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const MagazineSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'magazine', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'magazine'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="magazine" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center'}}>
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
              <IconBadge name={slideIcon} color={accentColor} size={44} tone="solid" />
              <div style={{fontSize: 18, fontWeight: 800, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>In Depth</div>
            </div>
            <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          </div>
          {intro ? <div style={{maxWidth: 420, fontSize: 24, color: '#94a3b8', lineHeight: 1.55, textAlign: 'right'}}>{intro}</div> : null}
        </div>
        <div style={{width: '100%', height: 2, background: `linear-gradient(90deg, ${accentColor}, transparent)`}} />
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: items.length > 4 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 16}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '22px 22px', borderRadius: 24, border: `1px solid ${tc}3a`,
                background: `linear-gradient(180deg, ${tc}12, rgba(15,23,42,0.85))`,
                display: 'flex', flexDirection: 'column', gap: 12, boxShadow: `0 14px 36px ${tc}10`,
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 14, fontWeight: 900, color: tc, letterSpacing: 1}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'magazine')} color={tc} size={32} tone="soft" />
                </div>
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
