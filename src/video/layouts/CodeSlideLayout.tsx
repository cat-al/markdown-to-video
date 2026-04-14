import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {getNarrationSentences} from '../utils';
import {AppIcon, IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';

export const CodeSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
  const lead = structure.paragraphs[0] ?? getNarrationSentences(slide.narration)[0] ?? '';
  const codeLines = (structure.codeBlock ?? '').split('\n');
  const slideIcon = getSlideIcon(slide, 'code', structure);

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="code"
      sceneIcon={slideIcon}
    >
      <div style={styles.codeShell}>
        <div
          style={{
            ...styles.codeInfoCard,
            borderColor: `${accentColor}3f`,
            background: `linear-gradient(180deg, ${accentColor}14, rgba(15, 23, 42, 0.76))`,
            boxShadow: `0 22px 56px ${accentColor}16`,
          }}
        >
          <div style={styles.labelRow}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div style={{...styles.kicker, color: accentColor, marginBottom: 0}}>Code Walkthrough</div>
          </div>
          <div style={styles.primaryTitle}>{slide.heading}</div>
          {lead ? <div style={styles.largeBody}>{lead}</div> : null}
          {presentation.meta.subtitle ? <div style={styles.secondaryBody}>{presentation.meta.subtitle}</div> : null}
        </div>

        <div style={{...styles.codeCard, borderColor: `${accentColor}2a`, boxShadow: `0 32px 80px ${accentColor}14`}}>
          <div style={styles.codeCardTopBar}>
            <div style={styles.codeDots}>
              <span style={{...styles.codeDot, background: '#fb7185'}} />
              <span style={{...styles.codeDot, background: '#fbbf24'}} />
              <span style={{...styles.codeDot, background: '#34d399'}} />
            </div>
            <div style={styles.codeLanguage}>
              <AppIcon name="code" size={20} color="#93c5fd" />
              <span style={styles.codeLanguageText}>{structure.codeLanguage ?? 'code'}</span>
            </div>
          </div>

          <div style={styles.codeBody}>
            {codeLines.map((line, index) => (
              <div key={`${line}-${index}`} style={styles.codeRow}>
                <div style={styles.codeLineNumber}>{index + 1}</div>
                <div style={styles.codeLineText}>{line || ' '}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SceneChrome>
  );
};
