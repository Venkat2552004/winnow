import { hsl, signalFor } from './generative';

interface SignalMarkProps {
  seed: string;
  hue?: number;
  size?: number;
  bars?: number;
  className?: string;
  title?: string;
}

/**
 * A tiny deterministic waveform. The same seed always draws the same mark, so
 * a message keeps its identity across renders and sessions.
 */
export function SignalMark({
  seed,
  hue,
  size = 18,
  bars = 5,
  className,
  title,
}: SignalMarkProps) {
  const signal = signalFor(seed, hue);
  const values = signal.bars.slice(0, Math.max(1, bars));
  const slot = size / values.length;
  const barWidth = Math.max(1.5, slot * 0.52);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={title ?? 'Winnow signal'}
      style={{ overflow: 'visible', flex: '0 0 auto' }}
    >
      {values.map((value, index) => {
        const height = Math.max(2, value * size * 0.92);
        const x = index * slot + (slot - barWidth) / 2;
        const y = (size - height) / 2;
        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={height}
            rx={barWidth / 2}
            fill={hsl(signal.hue, 82, 64, 0.9)}
          />
        );
      })}
    </svg>
  );
}
