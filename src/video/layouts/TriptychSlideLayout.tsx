import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const TriptychSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.orderedItems, ...structure.bulletItems].slice(0, 3);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'triptych', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'triptych'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="triptych"
      sceneIcon={slideIcon}
    >
      <div style={styles.triptychShell}>
        <div
          style={{
            ...styles.triptychHeaderCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.8))`,
            boxShadow: `0 22px 64px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Three Angles</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.secondaryBody}>{intro}</div> : null}
        </div>

        <div style={styles.triptychColumns}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'triptych');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.triptychCard,
                  borderColor: `${toneColor}4a`,
                  borderTop: `6px solid ${toneColor}`,
                  background: `linear-gradient(180deg, ${toneColor}18, rgba(15, 23, 42, 0.9))`,
                  boxShadow: `0 22px 48px ${toneColor}16`,
                }}
              >
                <div style={styles.triptychCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={44} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.triptychIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={styles.triptychCardText}>{item}</div>
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

        {support ? (
          <div
            style={{
              ...styles.triptychSupportPill,
              borderColor: `${accentColor}3a`,
              background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.78))`,
            }}
          >
            {support}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};
