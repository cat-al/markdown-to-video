import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const GridSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 6);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const slideIcon = getSlideIcon(slide, 'grid', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'grid'});
  const isDenseGrid = items.length >= 5;

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="grid"
      sceneIcon={slideIcon}
    >
      <div style={styles.gridShell}>
        <div
          style={{
            ...styles.gridHeaderCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.78))`,
            boxShadow: `0 20px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Key Points</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.secondaryBody}>{intro}</div> : null}
        </div>

        <div
          style={{
            ...styles.metricsGrid,
            gridTemplateColumns: isDenseGrid ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
          }}
        >
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'grid');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.metricCard,
                  minHeight: isDenseGrid ? 156 : styles.metricCard.minHeight,
                  boxShadow: `0 18px 48px ${toneColor}14`,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.76))`,
                }}
              >
                <div style={styles.metricTopRow}>
                  <IconBadge name={itemIcon} color={toneColor} size={44} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.metricIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={{...styles.metricText, fontSize: isDenseGrid ? 26 : styles.metricText.fontSize}}>{item}</div>
                <div style={styles.cardTagRow}>
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
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
