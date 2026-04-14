import {type Components} from 'react-markdown';
import type {LayoutProps, MarkdownPresentation, MarkdownSlide, SlideStructure} from '../types';
import {IconBadge} from '../components/icons';
import {getSlideIcon} from '../theme/keyword-matching';
import {SceneChrome} from '../components/SceneChrome';
import {styles} from '../styles';
import {markdownComponents, ReactMarkdown, remarkGfm} from '../components/MarkdownRenderer';

const tablePageComponents: Components = {
  ...markdownComponents,
  h1: () => null,
  h2: () => null,
  h3: () => null,
  p: ({children}) => <p style={{...styles.paragraph, fontSize: 22, margin: '0 0 8px'}}>{children}</p>,
  table: ({children}) => (
    <div style={{margin: '0', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(71, 85, 105, 0.45)', backgroundColor: 'rgba(15, 23, 42, 0.55)'}}>
      <table style={{width: '100%', borderCollapse: 'collapse' as const, fontSize: 21, lineHeight: 1.35}}>{children}</table>
    </div>
  ),
  thead: ({children}) => <thead style={{backgroundColor: 'rgba(51, 65, 85, 0.6)'}}>{children}</thead>,
  tbody: ({children}) => <tbody>{children}</tbody>,
  tr: ({children}) => <tr style={{borderBottom: '1px solid rgba(71, 85, 105, 0.3)'}}>{children}</tr>,
  th: ({children}) => <th style={{padding: '9px 14px', fontWeight: 700, color: '#f1f5f9', textAlign: 'left' as const, fontSize: 19}}>{children}</th>,
  td: ({children}) => <td style={{padding: '7px 14px', color: '#cbd5e1', textAlign: 'left' as const, fontSize: 20}}>{children}</td>,
};

export const TableSlideLayout: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  structure: SlideStructure;
}> = ({accentColor, presentation, slide, slideIndex, structure}) => {
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
          height: '100%',
          borderRadius: 28,
          padding: '28px 36px',
          background: `linear-gradient(180deg, ${accentColor}10, rgba(15, 23, 42, 0.76))`,
          border: `1px solid ${accentColor}3a`,
          borderTop: `5px solid ${accentColor}`,
          backdropFilter: 'blur(18px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0}}>
          <IconBadge name={slideIcon} color={accentColor} size={40} tone="solid" />
          <div style={{fontSize: 30, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2}}>{slide.heading}</div>
        </div>

        <div style={{flex: 1, overflow: 'hidden'}}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={tablePageComponents}>
            {slide.markdown}
          </ReactMarkdown>
        </div>
      </div>
    </SceneChrome>
  );
};
