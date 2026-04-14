import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';

export const SplitQuoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const quoteText = structure.strongPhrases[0] ?? structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const explanation = structure.paragraphs[1] ?? getNarrationSentences(slide.narration)[1] ?? '';
  const slideIcon = getSlideIcon(slide, 'split-quote', structure);
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 3);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'split-quote'});

  return (
    <SceneChrome accentColor={accentColor} presentation={presentation} slide={slide} slideIndex={slideIndex} variant="split-quote" sceneIcon={slideIcon}>
      <div style={{height: '100%', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 28}}>
        <div style={{borderRadius: 38, padding: '42px 40px', border: `1px solid ${accentColor}3f`, background: `linear-gradient(180deg, ${accentColor}16, rgba(2,6,23,0.84))`, display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: `0 24px 64px ${accentColor}18`}}>
          <div style={{fontSize: 80, lineHeight: 0.8, fontWeight: 900, color: `${accentColor}35`}}>"</div>
          <div style={{fontSize: 44, fontWeight: 850, color: '#f8fafc', lineHeight: 1.2, marginTop: 8}}>{slide.heading}</div>
          <div style={{marginTop: 24, fontSize: 36, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.4}}>{quoteText}</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18}}>
          {explanation ? <div style={{padding: '24px 28px', borderRadius: 28, border: `1px solid ${accentColor}30`, background: `linear-gradient(135deg, ${accentColor}0d, rgba(15,23,42,0.82))`, fontSize: 28, color: '#cbd5e1', lineHeight: 1.55}}>{explanation}</div> : null}
          {items.map((item, index) => {
            const tc = itemColors[index] ?? accentColor;
            return (
              <div key={`${item}-${index}`} style={{padding: '18px 22px', borderRadius: 24, border: `1px solid ${tc}40`, background: `linear-gradient(135deg, ${tc}14, rgba(15,23,42,0.88))`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: `0 12px 30px ${tc}12`}}>
                <IconBadge name={getItemIcon(item, index, 'split-quote')} color={tc} size={36} tone="soft" />
                <div style={{fontSize: 26, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4}}>{item}</div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
