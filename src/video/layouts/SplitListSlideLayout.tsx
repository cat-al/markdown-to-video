import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon, getIconLabel} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const SplitListSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const items = (structure.bulletItems.length > 0 ? structure.bulletItems : structure.orderedItems).slice(0, 5);
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const detail = structure.paragraphs[1] ?? presentation.meta.subtitle ?? '';
  const slideIcon = getSlideIcon(slide, 'split-list', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items, variant: 'split-list'});
  const isReversed = slideIndex % 2 === 1;

  const infoCard = (
    <div
      style={{
        ...styles.infoCard,
        boxShadow: `0 24px 80px ${accentColor}1a`,
        borderColor: `${accentColor}40`,
        background: `linear-gradient(180deg, ${accentColor}16, rgba(15, 23, 42, 0.76))`,
      }}
    >
      <div style={styles.labelRow}>
        <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
        <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Core Idea</div>
      </div>
      <div style={styles.primaryTitle}>{slide.heading}</div>
      {lead ? <div style={styles.largeBody}>{lead}</div> : null}
      {detail ? <div style={styles.secondaryBody}>{detail}</div> : null}
    </div>
  );

  const featureList = (
    <div style={styles.cardStackColumn}>
      {items.map((item, index) => {
        const toneColor = itemColors[index] ?? accentColor;
        const itemIcon = getItemIcon(item, index, 'split-list');

        return (
          <div
            key={`${item}-${index}`}
            style={{
              ...styles.listFeatureCard,
              borderColor: `${toneColor}52`,
              background: `linear-gradient(135deg, ${toneColor}${index === 0 ? '1f' : '14'}, rgba(15, 23, 42, 0.9))`,
              boxShadow: `0 18px 48px ${toneColor}18`,
            }}
          >
            <div style={styles.featureMetaColumn}>
              <IconBadge name={itemIcon} color={toneColor} size={46} tone={index === 0 ? 'solid' : 'soft'} />
              <div
                style={{
                  ...styles.featureIndexPill,
                  color: toneColor,
                  borderColor: `${toneColor}33`,
                  background: `${toneColor}16`,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
            </div>
            <div style={styles.featureContent}>
              <div style={styles.featureText}>{item}</div>
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
          </div>
        );
      })}
    </div>
  );

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="split-list"
      sceneIcon={slideIcon}
    >
      <div style={styles.splitShell}>
        {isReversed ? featureList : infoCard}
        {isReversed ? infoCard : featureList}
      </div>
    </SceneChrome>
  );
};
