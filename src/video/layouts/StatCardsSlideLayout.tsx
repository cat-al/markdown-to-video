import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const StatCardsSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const slideIcon = getSlideIcon(slide, 'stat-cards', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'stat-cards'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="stat-cards" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', gap: 24}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
          <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Data Insights</div>
        </div>
        <div style={{fontSize: 52, fontWeight: 850, color: '#f8fafc', lineHeight: 1.08}}>{slide.heading}</div>
        <div style={{flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18}}>
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            const numMatch = item.match(/[\d.]+%?/);
            const num = numMatch ? numMatch[0] : String(index + 1).padStart(2, '0');
            const label = numMatch ? item.replace(numMatch[0], '').trim() : item;
            return (
              <div key={`${item}-${index}`} style={{
                borderRadius: 30, padding: '28px 24px', border: `1px solid ${tc}4a`,
                background: `linear-gradient(180deg, ${tc}18, rgba(15,23,42,0.85))`,
                display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                textAlign: 'center', boxShadow: `0 18px 44px ${tc}16`,
              }}>
                <div style={{fontSize: 52, fontWeight: 900, color: tc, lineHeight: 1}}>{num}</div>
                <div style={{marginTop: 14, fontSize: 24, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4}}>{label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
