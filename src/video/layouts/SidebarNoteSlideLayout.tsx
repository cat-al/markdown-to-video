import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const SidebarNoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'sidebar-note', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'sidebar-note'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="sidebar-note" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28}}>
        <div style={{borderRadius: 30, padding: '32px 24px', border: `1px solid ${accentColor}3a`, background: `linear-gradient(180deg, ${accentColor}18, rgba(15,23,42,0.82))`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16}}>
          <IconBadge name={slideIcon} color={accentColor} size={48} tone="solid" />
          <div style={{fontSize: 18, fontWeight: 800, color: accentColor, letterSpacing: 1.5, textTransform: 'uppercase'}}>Side Note</div>
          <div style={{fontSize: 22, color: '#cbd5e1', lineHeight: 1.55}}>{lead || presentation.meta.subtitle || ''}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18}}>
          <div style={{fontSize: 54, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{padding: '18px 24px', borderRadius: 24, border: `1px solid ${tc}40`, background: `linear-gradient(90deg, ${tc}14, rgba(15,23,42,0.88))`, display: 'flex', alignItems: 'center', gap: 14, boxShadow: `0 12px 30px ${tc}12`}}>
                <IconBadge name={getItemIcon(item, index, 'sidebar-note')} color={tc} size={38} tone="soft" />
                <div style={{fontSize: 27, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
