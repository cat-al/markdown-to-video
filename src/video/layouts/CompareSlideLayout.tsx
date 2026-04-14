import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const CompareSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems];
  const half = Math.ceil(items.length / 2);
  const leftItems = items.slice(0, half);
  const rightItems = items.slice(half);
  const slideIcon = getSlideIcon(slide, 'compare', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'compare'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="compare" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: '1fr 4px 1fr', gap: 24, alignItems: 'stretch'}}>
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center'}}>
            {leftItems.map((item, index) => {
              const tc = itemColors[index] ?? accentColor;
              return (
                <div key={`l-${index}`} style={{padding: '20px 24px', borderRadius: 24, border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}18, rgba(15,23,42,0.88))`, boxShadow: `0 14px 36px ${tc}14`}}>
                  <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
                </div>
              );
            })}
          </div>
          <div style={{background: `linear-gradient(180deg, ${accentColor}55, ${accentColor}11)`, borderRadius: 999}} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center'}}>
            {rightItems.map((item, index) => {
              const tc = itemColors[half + index] ?? accentColor;
              return (
                <div key={`r-${index}`} style={{padding: '20px 24px', borderRadius: 24, border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}18, rgba(15,23,42,0.88))`, boxShadow: `0 14px 36px ${tc}14`}}>
                  <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SceneChrome>
  );
};
