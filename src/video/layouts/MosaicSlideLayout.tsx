import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const MosaicSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = [...structure.bulletItems, ...structure.orderedItems].slice(0, 6);
  const intro = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const support = structure.strongPhrases[0] ?? structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'mosaic', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'mosaic'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="mosaic"
      sceneIcon={slideIcon}
    >
      <div style={styles.mosaicShell}>
        <div
          style={{
            ...styles.mosaicLeadCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}16, rgba(15, 23, 42, 0.82))`,
            boxShadow: `0 26px 80px ${accentColor}18`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Scene Map</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {intro ? <div style={styles.largeBody}>{intro}</div> : null}
          {support ? (
            <div
              style={{
                ...styles.mosaicStatement,
                borderColor: `${accentColor}3a`,
                background: `linear-gradient(135deg, ${accentColor}16, rgba(15, 23, 42, 0.78))`,
              }}
            >
              {support}
            </div>
          ) : null}
        </div>

        <div style={styles.mosaicBoard}>
          {items.map((item, index) => {
            const toneColor = itemColors[index] ?? accentColor;
            const itemIcon = getItemIcon(item, index, 'mosaic');
            const isWide = items.length >= 5 && index === 0;
            const isTall = items.length >= 6 && index === 3;

            return (
              <div
                key={`${item}-${index}`}
                style={{
                  ...styles.mosaicCard,
                  gridColumn: isWide ? 'span 2' : undefined,
                  gridRow: isTall ? 'span 2' : undefined,
                  borderColor: `${toneColor}4a`,
                  background: `linear-gradient(160deg, ${toneColor}${isWide ? '1b' : '15'}, rgba(15, 23, 42, 0.88))`,
                  boxShadow: `0 20px 48px ${toneColor}16`,
                }}
              >
                <div style={styles.mosaicCardTop}>
                  <IconBadge name={itemIcon} color={toneColor} size={40} tone={index === 0 ? 'solid' : 'soft'} />
                  <div
                    style={{
                      ...styles.mosaicIndex,
                      color: toneColor,
                      borderColor: `${toneColor}33`,
                      background: `${toneColor}16`,
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </div>
                </div>
                <div style={{...styles.mosaicCardText, fontSize: isWide ? 34 : isTall ? 30 : styles.mosaicCardText.fontSize}}>{item}</div>
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
