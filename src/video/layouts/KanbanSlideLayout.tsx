import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const KanbanSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const cols = 3;
  const slideIcon = getSlideIcon(slide, 'kanban', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'kanban'});
  const colLabels = ['Insight', 'Action', 'Outcome'];

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="kanban" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 22}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{fontSize: 48, fontWeight: 850, color: '#f8fafc'}}>{slide.heading}</div>
        </div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 18}}>
          {Array.from({length: cols}, (_, colIndex) => {
            const colItems = items.filter((_, i) => i % cols === colIndex);
            const colColor = itemColors[colIndex] ?? accentColor;
            return (
              <div key={colIndex} style={{borderRadius: 28, border: `1px solid ${colColor}33`, background: `linear-gradient(180deg, ${colColor}0d, rgba(15,23,42,0.75))`, padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14}}>
                <div style={{fontSize: 18, fontWeight: 800, color: colColor, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center', padding: '10px 0', borderBottom: `2px solid ${colColor}33`}}>{colLabels[colIndex] ?? `Col ${colIndex + 1}`}</div>
                {colItems.map((item, i) => {
                  const tc = itemColors[colIndex * 2 + i] ?? colColor;
                  return (
                    <div key={`${item}-${i}`} style={{padding: '16px 18px', borderRadius: 20, border: `1px solid ${tc}40`, background: `linear-gradient(135deg, ${tc}16, rgba(15,23,42,0.88))`, fontSize: 25, fontWeight: 700, color: '#f8fafc', lineHeight: 1.42, boxShadow: `0 10px 28px ${tc}12`}}>{item}</div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
