import { hsl, signalFor } from './generative';

interface SignalAvatarProps {
  seed: string;
  label: string;
  size?: number;
  hue?: number;
  className?: string;
}

function initials(label: string): string {
  const words = label
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!;
  if (words.length === 1) return first.slice(0, 2).toUpperCase();
  const last = words[words.length - 1]!;
  return (first[0]! + last[0]!).toUpperCase();
}

/**
 * Seeded gradient avatar. The same sender always gets the same colors and
 * initials, so the list feels stable without storing any images.
 */
export function SignalAvatar({ seed, label, size = 24, hue, className }: SignalAvatarProps) {
  const signal = signalFor(seed, hue);
  const angle = signal.rotation;
  const background = `linear-gradient(${angle}deg, ${hsl(signal.hue, 78, 58)}, ${hsl(signal.hue2, 74, 46)})`;

  return (
    <span
      className={className ? `signal-avatar ${className}` : 'signal-avatar'}
      style={{
        width: size,
        height: size,
        background,
        fontSize: Math.max(8, Math.round(size * 0.36)),
      }}
      aria-hidden="true"
      title={label}
    >
      {initials(label)}
    </span>
  );
}
