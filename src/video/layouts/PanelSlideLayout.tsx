import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';
import {markdownComponents, ReactMarkdown, remarkGfm} from '../components/MarkdownRenderer';
import {parseSlideStructure} from '../logic/slide-structure';

export const PanelSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
}> = ({accentColor, presentation, slide, slideIndex}) => {
  const structure = parseSlideStructure(slide.markdown);
  const slideIcon = getSlideIcon(slide, 'panel', structure);

  return (
    <SceneChrome
      accentColor={accentColor}
      presentation={presentation}
      slide={slide}
      slideIndex={slideIndex}
      variant="panel"
      sceneIcon={slideIcon}
    >
      <div
        style={{
          ...styles.card,
          borderTop: `8px solid ${accentColor}`,
          borderColor: `${accentColor}3a`,
          background: `linear-gradient(180deg, ${accentColor}12, rgba(15, 23, 42, 0.76))`,
          boxShadow: `0 30px 80px ${accentColor}22`,
        }}
      >
        <div style={styles.cardHeader}>
          <div style={styles.panelTitleGroup}>
            <IconBadge name={slideIcon} color={accentColor} size={54} tone="solid" />
            <div>
              <div style={{...styles.kicker, color: accentColor}}>Slide {slideIndex + 1}</div>
              <div style={styles.heading}>{slide.heading}</div>
            </div>
          </div>
        </div>

        {presentation.meta.subtitle ? <div style={styles.subtitle}>{presentation.meta.subtitle}</div> : null}

        <div style={styles.markdownBody}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {slide.markdown}
          </ReactMarkdown>
        </div>
      </div>
    </SceneChrome>
  );
};
