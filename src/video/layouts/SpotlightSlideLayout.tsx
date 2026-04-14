import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const SpotlightSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const sentences = getNarrationSentences(slide.narration);
  const spotlight = structure.strongPhrases[0] ?? sentences.at(-1) ?? slide.heading;
  const support = structure.paragraphs[0] ?? sentences[0] ?? presentation.meta.subtitle ?? '';
  const railItems = [...structure.bulletItems, ...structure.orderedItems].slice(0, 3);
  const slideIcon = getSlideIcon(slide, 'spotlight', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: railItems, variant: 'spotlight'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="spotlight"
      sceneIcon={slideIcon}
    >
      <div style={styles.spotlightShell}>
        <div
          style={{
            ...styles.spotlightMainCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}15, rgba(2, 6, 23, 0.82))`,
            boxShadow: `0 24px 72px ${accentColor}18`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Takeaway</div>
          </div>
          <div style={styles.spotlightHeading}>{slide.heading}</div>
          <div style={styles.spotlightQuote}>"{spotlight}"</div>
          {support ? <div style={styles.spotlightSupport}>{support}</div> : null}
        </div>

        {railItems.length > 0 ? (
          <div style={styles.sideRail}>
            {railItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'spotlight');

              return (
                <div
                  key={item}
                  style={{
                    ...styles.sideRailItem,
                    borderColor: `${toneColor}3a`,
                    background: `linear-gradient(135deg, ${toneColor}16, rgba(15, 23, 42, 0.78))`,
                    boxShadow: `0 16px 36px ${toneColor}14`,
                  }}
                >
                  <div style={styles.sideRailItemInner}>
                    <IconBadge name={itemIcon} color={toneColor} size={36} tone="soft" />
                    <div style={styles.sideRailTextGroup}>
                      <div style={styles.sideRailText}>{item}</div>
                      <div
                        style={{
                          ...styles.cardTag,
                          color: toneColor,
                          borderColor: `${toneColor}33`,
                          background: `${toneColor}14`,
                        }}
                      >
                        {getIconLabel(itemIcon)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};
