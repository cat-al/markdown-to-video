import type {IconName} from '../../types';
import {styles} from '../../styles';

export const AppIcon: React.FC<{
  color?: string;
  name: IconName;
  size?: number;
}> = ({color = 'currentColor', name, size = 20}) => {
  const commonProps = {
    fill: 'none',
    stroke: color,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 2.35,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'spark' ? (
        <>
          <path {...commonProps} d="M12 3.5 13.8 8.2 18.5 10 13.8 11.8 12 16.5 10.2 11.8 5.5 10 10.2 8.2 12 3.5Z" />
          <path {...commonProps} d="M18 4.5v3" />
          <path {...commonProps} d="M19.5 6h-3" />
        </>
      ) : null}
      {name === 'layers' ? (
        <>
          <path {...commonProps} d="m12 4.5 7.5 4.2L12 13 4.5 8.7 12 4.5Z" />
          <path {...commonProps} d="m5.7 11.6 6.3 3.5 6.3-3.5" />
          <path {...commonProps} d="m5.7 15.3 6.3 3.7 6.3-3.7" />
        </>
      ) : null}
      {name === 'switch' ? (
        <>
          <path {...commonProps} d="M7 7h10" />
          <path {...commonProps} d="m13.8 3.8 3.2 3.2-3.2 3.2" />
          <path {...commonProps} d="M17 17H7" />
          <path {...commonProps} d="m10.2 20.2-3.2-3.2 3.2-3.2" />
        </>
      ) : null}
      {name === 'alert' ? (
        <>
          <path {...commonProps} d="M12 4.5 20 18.5H4L12 4.5Z" />
          <path {...commonProps} d="M12 9.5v4.2" />
          <path {...commonProps} d="M12 16.8h.01" />
        </>
      ) : null}
      {name === 'focus' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="6.2" />
          <circle {...commonProps} cx="12" cy="12" r="2.2" />
          <path {...commonProps} d="M12 2.8v2.4" />
          <path {...commonProps} d="M12 18.8v2.4" />
          <path {...commonProps} d="M2.8 12h2.4" />
          <path {...commonProps} d="M18.8 12h2.4" />
        </>
      ) : null}
      {name === 'clock' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8.2" />
          <path {...commonProps} d="M12 7.8v4.7l3.3 2" />
        </>
      ) : null}
      {name === 'check' ? (
        <>
          <circle {...commonProps} cx="12" cy="12" r="8.2" />
          <path {...commonProps} d="m8.4 12.2 2.4 2.5 4.9-5" />
        </>
      ) : null}
      {name === 'code' ? (
        <>
          <path {...commonProps} d="m9.2 8.2-4 3.8 4 3.8" />
          <path {...commonProps} d="m14.8 8.2 4 3.8-4 3.8" />
          <path {...commonProps} d="m13.1 5.6-2.2 12.8" />
        </>
      ) : null}
      {name === 'trend' ? (
        <>
          <path {...commonProps} d="M5 17.5h14" />
          <path {...commonProps} d="m6.2 14.8 3.8-4 3.2 2.7 4.6-5.3" />
          <path {...commonProps} d="M15.2 8.2h2.6v2.6" />
        </>
      ) : null}
      {name === 'quote' ? (
        <>
          <path {...commonProps} d="M9.8 8.5H7.6A2.6 2.6 0 0 0 5 11.1V13a2.5 2.5 0 0 0 2.5 2.5H10V13H8.2" />
          <path {...commonProps} d="M18.8 8.5h-2.2a2.6 2.6 0 0 0-2.6 2.6V13a2.5 2.5 0 0 0 2.5 2.5H19V13h-1.8" />
        </>
      ) : null}
      {name === 'list' ? (
        <>
          <path {...commonProps} d="M9 7h10" />
          <path {...commonProps} d="M9 12h10" />
          <path {...commonProps} d="M9 17h10" />
          <circle {...commonProps} cx="5.5" cy="7" r="1" />
          <circle {...commonProps} cx="5.5" cy="12" r="1" />
          <circle {...commonProps} cx="5.5" cy="17" r="1" />
        </>
      ) : null}
    </svg>
  );
};

export const IconBadge: React.FC<{
  color: string;
  name: IconName;
  size?: number;
  tone?: 'soft' | 'solid';
}> = ({color, name, size = 52, tone = 'soft'}) => {
  return (
    <div
      style={{
        ...styles.iconBadgeBase,
        width: size,
        height: size,
        color: '#eff6ff',
        background:
          tone === 'solid'
            ? `linear-gradient(135deg, ${color}, ${color}bb)`
            : `linear-gradient(135deg, ${color}70, ${color}20)`,
        borderColor: tone === 'solid' ? `${color}88` : `${color}55`,
        boxShadow:
          tone === 'solid'
            ? `0 16px 40px ${color}35, inset 0 1px 0 rgba(255,255,255,0.18)`
            : `0 12px 30px ${color}20, inset 0 1px 0 rgba(255,255,255,0.12)`,
      }}
    >
      <AppIcon name={name} size={Math.max(20, Math.round(size * 0.54))} color="currentColor" />
    </div>
  );
};
