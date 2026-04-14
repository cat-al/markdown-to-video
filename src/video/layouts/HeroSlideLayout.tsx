import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const HeroSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const highlightItems = structure.bulletItems.slice(0, 3);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const supportText = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const heroIcon = getSlideIcon(slide, 'hero', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: highlightItems, variant: 'hero'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="hero"
      sceneIcon={heroIcon}
    >
      <div style={styles.heroShell}>
        <div style={styles.labelRow}>
          <IconBadge name={heroIcon} color={accentColor} size={56} tone="solid" />
          <div style={{...styles.heroKicker, color: accentColor, marginBottom: 0}}>Featured Topic</div>
        </div>
        <div style={styles.heroHeading}>{slide.heading}</div>
        {lead ? <div style={styles.heroLead}>{lead}</div> : null}
        {supportText ? <div style={styles.heroSupport}>{supportText}</div> : null}
        {highlightItems.length > 0 ? (
          <div style={styles.heroChipRow}>
            {highlightItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'hero');

              return (
                <div
                  key={item}
                  style={{
                    ...styles.heroChip,
                    borderColor: `${toneColor}4d`,
                    background: `linear-gradient(135deg, ${toneColor}18, rgba(15, 23, 42, 0.82))`,
                    boxShadow: `0 18px 40px ${toneColor}14`,
                  }}
                >
                  <IconBadge name={itemIcon} color={toneColor} size={38} tone="soft" />
                  <span style={styles.heroChipText}>{item}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};
