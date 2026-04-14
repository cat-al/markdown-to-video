import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const PyramidSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'pyramid', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'pyramid'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="pyramid" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div><div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div></div>
        </div>
        {intro ? <div style={{fontSize: 28, color: '#cbd5e1', lineHeight: 1.55, maxWidth: 900}}>{intro}</div> : null}
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center', alignItems: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const widthPercent = 45 + index * 12;
            return (
              <div key={`${item}-${index}`} style={{
                width: `${widthPercent}%`, padding: '16px 24px', borderRadius: 20,
                border: `1px solid ${tc}4a`, background: `linear-gradient(135deg, ${tc}1a, rgba(15,23,42,0.88))`,
                display: 'flex', alignItems: 'center', gap: 14, boxShadow: `0 12px 32px ${tc}14`,
              }}>
                <div style={{minWidth: 32, height: 32, borderRadius: 999, background: `${tc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: tc}}>{index + 1}</div>
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
