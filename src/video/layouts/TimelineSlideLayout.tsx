import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const TimelineSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 5);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'timeline', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'timeline'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="timeline"
      sceneIcon={slideIcon}
    >
      <div style={styles.timelineShell}>
        <div
          style={{
            ...styles.timelineHeroCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.78))`,
            boxShadow: `0 20px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={52} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Flow View</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {support ? <div style={styles.secondaryBody}>{support}</div> : null}
        </div>

        <div style={styles.timelineTrack}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'timeline');

            return (
              <div key={`${item}-${index}`} style={styles.timelineStep}>
                {index < items.length - 1 ? (
                  <div
                    style={{
                      ...styles.timelineConnector,
                      background: `linear-gradient(90deg, ${toneColor}, ${accentColor}55)`,
                    }}
                  />
                ) : null}

                <div style={styles.timelineMarkerRow}>
                  <div
                    style={{
                      ...styles.timelineDot,
                      background: `radial-gradient(circle, ${toneColor} 0%, ${toneColor}aa 55%, rgba(15, 23, 42, 0) 72%)`,
                      boxShadow: `0 0 0 8px ${toneColor}1f, 0 0 36px ${toneColor}22`,
                    }}
                  />
                  <div
                    style={{
                      ...styles.timelineStepNumber,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>

                <div
                  style={{
                    ...styles.timelineCard,
                    borderColor: `${toneColor}4a`,
                    background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.82))`,
                    boxShadow: `0 18px 42px ${toneColor}16`,
                  }}
                >
                  <div style={styles.timelineCardTop}>
                    <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
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
                  <div style={styles.timelineText}>{item}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
