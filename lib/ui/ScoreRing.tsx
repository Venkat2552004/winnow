import { hsl, scoreHue, scoreRing } from './generative';

interface ScoreRingProps {
  score: number;
  size?: number;
  hue?: number;
  showValue?: boolean;
  className?: string;
}

/** Compact radial score indicator. */
export function ScoreRing({
  score,
  size = 30,
  hue,
  showValue = true,
  className,
}: ScoreRingProps) {
  const stroke = Math.max(2, size * 0.1);
  const radius = (size - stroke) / 2;
  const { circumference, offset } = scoreRing(score, radius);
  const color = hsl(hue ?? scoreHue(score), 82, 62);
  const center = size / 2;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Score ${Math.round(score)} out of 100`}
      style={{ flex: '0 0 auto' }}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={stroke}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: 'stroke-dashoffset 400ms ease' }}
      />
      {showValue && (
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.34}
          fontWeight={700}
          fill="var(--text)"
        >
          {Math.round(score)}
        </text>
      )}
    </svg>
  );
}
