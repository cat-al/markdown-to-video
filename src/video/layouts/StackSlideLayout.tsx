import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const StackSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const slideIcon = getSlideIcon(slide, 'stack', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'stack'});
  const intro = structure.paragraphs[0] ?? '';

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="stack" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', gap: 32}}>
        <div style={{flex: '0 0 440px', display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
          <div style={{marginTop: 18, fontSize: 54, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {intro ? <div style={{marginTop: 20, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{intro}</div> : null}
        </div>
        <div style={{flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                position: 'absolute', top: `${10 + index * 15}%`, left: index * 14,
                right: (items.length - 1 - index) * 14,
                padding: '22px 28px', borderRadius: 28, border: `1px solid ${tc}4a`,
                background: `linear-gradient(135deg, ${tc}1a, rgba(15,23,42,0.92))`,
                boxShadow: `0 20px 52px ${tc}18, 0 4px 12px rgba(0,0,0,0.3)`,
                zIndex: items.length - index,
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10}}>
                  <div style={{fontSize: 16, fontWeight: 900, color: tc}}>{String(index + 1).padStart(2, '0')}</div>
                  <IconBadge name={getItemIcon(item, index, 'stack')} color={tc} size={34} tone="soft" />
                </div>
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
