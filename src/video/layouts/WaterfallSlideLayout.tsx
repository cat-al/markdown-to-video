import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const WaterfallSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 7);
  const slideIcon = getSlideIcon(slide, 'waterfall', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'waterfall'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="waterfall" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
        <div style={{...styles.labelRow}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '18px 24px', borderRadius: 24, border: `1px solid ${tc}4a`,
                background: `linear-gradient(90deg, ${tc}18, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 16,
                marginLeft: index * 28, maxWidth: `calc(100% - ${index * 28}px)`,
                boxShadow: `0 14px 36px ${tc}14`,
              }}>
                <div style={{minWidth: 36, height: 36, borderRadius: 999, background: `${tc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: tc}}>{index + 1}</div>
                <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
