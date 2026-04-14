import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const ArgumentSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 4);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const thesis = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'argument', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'argument'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="argument"
      sceneIcon={slideIcon}
    >
      <div style={styles.argumentShell}>
        <div
          style={{
            ...styles.argumentHeaderCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}15, rgba(15, 23, 42, 0.82))`,
            boxShadow: `0 24px 72px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Why It Works</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {thesis ? (
            <div
              style={{
                ...styles.argumentThesis,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}18, rgba(15, 23, 42, 0.76))`,
              }}
            >
              {thesis}
            </div>
          ) : null}
        </div>

        <div
          style={{
            ...styles.argumentBoard,
            gridTemplateColumns: items.length >= 4 ? 'repeat(2, minmax(0, 1fr))' : `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
          }}
        >
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'argument');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.argumentCard,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(160deg, ${toneColor}17, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 18px 44px ${toneColor}16`,
                }}
              >
                <div style={styles.argumentCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.argumentIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={styles.argumentCardText}>{item}</div>
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
