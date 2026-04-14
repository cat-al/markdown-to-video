import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {AppIcon, IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const ChecklistSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 7);
  const slideIcon = getSlideIcon(slide, 'checklist', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'checklist'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="checklist" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 20}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 50, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center'}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{
                padding: '16px 22px', borderRadius: 20, border: `1px solid ${tc}35`,
                background: `linear-gradient(90deg, ${tc}10, rgba(15,23,42,0.85))`,
                display: 'flex', alignItems: 'center', gap: 16, boxShadow: `0 8px 24px ${tc}0d`,
              }}>
                <div style={{minWidth: 38, height: 38, borderRadius: 10, border: `2px solid ${tc}`, background: `${tc}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                  <AppIcon name="check" size={20} color={tc} />
                </div>
                <div style={{fontSize: 28, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
