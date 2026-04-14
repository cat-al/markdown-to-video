import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import type {SlideVariant, IconName, MarkdownPresentation, MarkdownSlide} from '../types';
import {getActiveCaption} from '../utils';
import {getLayoutTheme} from '../theme/layout-theme';
import {styles} from '../styles';

export const SceneChrome: React.FC<{
  accentColor: string;
  presentation: MarkdownPresentation;
  slide: MarkdownSlide;
  slideIndex: number;
  variant: SlideVariant;
  sceneIcon: IconName;
  children?: React.ReactNode;
}> = ({accentColor, presentation, slide, slideIndex, variant, sceneIcon, children}) => {
  void sceneIcon;

  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const activeCaption = getActiveCaption(slide.captionCues, frame);

  const entrance = spring({
    fps,
    frame,
    config: {
      damping: 18,
      stiffness: 120,
      mass: 0.9,
    },
    durationInFrames: 24,
  });

  const y = interpolate(entrance, [0, 1], [52, 0]);
  const contentOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const captionOpacity = interpolate(frame, [2, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glow = interpolate(frame, [0, slide.durationInFrames], [0.32, 0.88], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const layoutTheme = getLayoutTheme(accentColor, variant);

  return (
    <AbsoluteFill style={{...styles.scene, background: layoutTheme.background}}>
      {slide.audioSrc ? <Html5Audio src={staticFile(slide.audioSrc)} /> : null}

      <div
        style={{
          ...styles.backgroundOrb,
          width: 620 * layoutTheme.orbScale,
          height: 620 * layoutTheme.orbScale,
          background: `radial-gradient(circle, ${accentColor} 0%, rgba(124, 58, 237, 0) 72%)`,
          left: -180,
          top: -170,
          opacity: glow,
        }}
      />
      <div
        style={{
          ...styles.backgroundOrb,
          width: 520 * layoutTheme.orbScale,
          height: 520 * layoutTheme.orbScale,
          background: `radial-gradient(circle, ${layoutTheme.accentMid} 0%, rgba(56, 189, 248, 0) 72%)`,
          right: -140,
          bottom: -180,
          opacity: glow * 0.78,
        }}
      />
      <div style={{...styles.gridOverlay, opacity: 0.16 + glow * 0.06}} />

      <div style={styles.topBar}>
        <div style={styles.metaGroup}>
          <div style={styles.metaText}>
            {presentation.meta.title ?? 'Untitled deck'} · {slideIndex + 1}/{presentation.slides.length}
          </div>
        </div>
      </div>

      <div
        style={{
          ...styles.contentStage,
          opacity: contentOpacity,
          transform: `translateY(${y}px) scale(${0.965 + entrance * 0.035})`,
        }}
      >
        {children}
      </div>

      {activeCaption ? (
        <div style={{...styles.captionShell, opacity: captionOpacity}}>
          <div style={styles.captionText}>{activeCaption.text}</div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
