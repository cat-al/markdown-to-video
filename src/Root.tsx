import {Composition} from 'remotion';

import {MarkdownVideo, type MarkdownVideoProps} from './video/MarkdownVideo';
import {analyzeMarkdownPresentation} from './markdown';
import {previewMarkdown, previewPresentation} from './generated/preview-presentation';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MarkdownVideo"
      component={MarkdownVideo}
      fps={30}
      width={1920}
      height={1080}
      durationInFrames={300}
      defaultProps={{
        markdown: previewMarkdown,
        presentation: previewPresentation,
      } satisfies MarkdownVideoProps}
      calculateMetadata={({props}) => {
        const presentation = props.presentation ?? analyzeMarkdownPresentation(props.markdown, 30);

        return {
          durationInFrames: presentation.totalFrames,
          props: {
            ...props,
            presentation,
            themeColor: props.themeColor ?? presentation.meta.themeColor,
          },
        };
      }}
    />
  );
};
