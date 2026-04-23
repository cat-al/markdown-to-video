import {OffthreadVideo, staticFile} from 'remotion';

export const HtmlSlideBackground: React.FC<{
  videoSrc: string;
}> = ({videoSrc}) => (
  <OffthreadVideo
    src={staticFile(videoSrc)}
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    }}
  />
);
