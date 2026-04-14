import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const ManifestoSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 5);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const thesis = structure.strongPhrases[0] ?? structure.paragraphs.at(-1) ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'manifesto', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'manifesto'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="manifesto"
      sceneIcon={slideIcon}
    >
      <div style={styles.manifestoShell}>
        <div
          style={{
            ...styles.manifestoLeadCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.84))`,
            boxShadow: `0 24px 72px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Framework Note</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {thesis ? (
            <div
              style={{
                ...styles.manifestoThesis,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.76))`,
              }}
            >
              {thesis}
            </div>
          ) : null}
        </div>

        <div style={styles.manifestoStack}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'manifesto');

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.manifestoRuleCard,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(135deg, ${toneColor}17, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 18px 42px ${toneColor}16`,
                }}
              >
                <div style={styles.manifestoRuleTop}>
                  <div
                    style={{
                      ...styles.manifestoRuleIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      ...styles.cardTag,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}14`,
                    }}
                  >
                    Principle
                  </div>
                </div>

                <div style={styles.manifestoRuleMain}>
                  <IconBadge name={itemIcon} color={toneColor} size={40} tone={index === 0 ? 'solid' : 'soft'} />
                  <div style={styles.manifestoRuleText}>{item}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SceneChrome>
  );
};
