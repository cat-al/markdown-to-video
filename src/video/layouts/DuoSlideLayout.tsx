import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const DuoSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 2);
  const slideIcon = getSlideIcon(slide, 'duo', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'duo'});
  const topItem = items[0] ?? structure.paragraphs[0] ?? '';
  const bottomItem = items[1] ?? structure.paragraphs[1] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="duo" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={50} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        {[topItem, bottomItem].filter(Boolean).map((item, index) => {
          const tc = itemColors[index] ?? accentColor;
          return (
            <div key={`duo-${index}`} style={{
              flex: 1, borderRadius: 34, padding: '32px 38px', border: `1px solid ${tc}4a`,
              background: `linear-gradient(${index === 0 ? '135deg' : '225deg'}, ${tc}18, rgba(15,23,42,0.88))`,
              display: 'flex', alignItems: 'center', gap: 20, boxShadow: `0 20px 52px ${tc}16`,
            }}>
              <div style={{minWidth: 64, height: 64, borderRadius: 20, background: `${tc}22`, border: `1px solid ${tc}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: tc}}>{index === 0 ? 'A' : 'B'}</div>
              <div style={{fontSize: 32, fontWeight: 700, color: '#f8fafc', lineHeight: 1.45}}>{item}</div>
            </div>
          );
        })}
      </div>
    </SceneChrome>
  );
};
