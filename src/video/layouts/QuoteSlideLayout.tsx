import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences, stripMarkdownSyntax} from '../utils';
import {IconBadge} from '../components/icons';
import {getSlideIcon, getItemIcon} from '../theme/keyword-matching';
import {getDistinctItemToneColors} from '../theme/palettes';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const QuoteSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const sentences = getNarrationSentences(slide.narration);
  const statement = stripMarkdownSyntax(
    structure.strongPhrases[0]
      ?? structure.paragraphs.find((paragraph) => /[；;]|更像|不是/.test(paragraph))
      ?? sentences.at(-1)
      ?? slide.heading,
  );
  const support = structure.paragraphs[0] ?? sentences[0] ?? presentation.meta.subtitle ?? '';
  const compareItems = statement
    .split(/[；;]/)
    .map((item) => stripMarkdownSyntax(item).trim())
    .filter(Boolean)
    .slice(0, 2);
  const note = structure.paragraphs.find((paragraph) => paragraph !== support && paragraph !== statement)
    ?? presentation.meta.subtitle
    ?? '';
  const slideIcon = getSlideIcon(slide, 'quote', structure);
  const itemColors = getDistinctItemToneColors({accentColor, items: compareItems, variant: 'quote'});

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="quote"
      sceneIcon={slideIcon}
    >
      <div style={styles.quoteShell}>
        <div
          style={{
            ...styles.quoteHeroCard,
            borderColor: `${accentColor}40`,
            background: `linear-gradient(180deg, ${accentColor}16, rgba(2, 6, 23, 0.84))`,
            boxShadow: `0 28px 84px ${accentColor}1a`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={56} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Closing Note</div>
          </div>
          <div style={styles.quoteHeading}>{slide.heading}</div>
          <div style={styles.quoteStatement}>"{statement}"</div>
          {support ? <div style={styles.quoteSupport}>{support}</div> : null}
        </div>

        {compareItems.length > 0 ? (
          <div
            style={{
              ...styles.quoteCompareRow,
              gridTemplateColumns: `repeat(${Math.max(compareItems.length, 1)}, minmax(0, 1fr))`,
            }}
          >
            {compareItems.map((item, index) => {
              const toneColor = itemColors[index] ?? accentColor;
              const itemIcon = getItemIcon(item, index, 'quote');

              return (
                <div
                  key={`${item}-${index}`}
                  style={{
                    ...styles.quoteCompareCard,
                    borderColor: `${toneColor}4a`,
                    background: `linear-gradient(160deg, ${toneColor}18, rgba(15, 23, 42, 0.88))`,
                    boxShadow: `0 18px 44px ${toneColor}16`,
                  }}
                >
                  <div style={styles.quoteCompareTop}>
                    <IconBadge name={itemIcon} color={toneColor} size={42} tone={index === 0 ? 'solid' : 'soft'} />
                    <div
                      style={{
                        ...styles.cardTag,
                        color: toneColor,
                        borderColor: `${toneColor}33`,
                        background: `${toneColor}14`,
                      }}
                    >
                      {index === 0 ? 'Perspective A' : 'Perspective B'}
                    </div>
                  </div>
                  <div style={styles.quoteCompareText}>{item}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {note && note !== support && note !== statement ? (
          <div
            style={{
              ...styles.quoteNote,
              borderColor: `${accentColor}33`,
              background: `linear-gradient(135deg, ${accentColor}12, rgba(15, 23, 42, 0.74))`,
            }}
          >
            {note}
          </div>
        ) : null}
      </div>
    </SceneChrome>
  );
};
