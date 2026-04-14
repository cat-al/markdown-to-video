import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const FilmstripSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'filmstrip', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'filmstrip'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="filmstrip" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', gap: 14, alignItems: 'stretch'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                flex: 1, borderRadius: 28, padding: '24px 20px', border: `1px solid ${tc}4a`,
                background: `linear-gradient(180deg, ${tc}16, rgba(15,23,42,0.88))`,
                borderTop: `5px solid ${tc}`, display: 'flex', flexDirection: 'column', gap: 14,
                boxShadow: `0 18px 44px ${tc}14`,
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: 40, fontWeight: 900, color: `${tc}55`}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'filmstrip')} color={tc} size={36} tone="soft" />
                </div>
                <div style={{flex: 1, fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
