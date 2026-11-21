import type { CSSProperties } from 'react';
import { auroraFor } from './generative';

interface AuroraProps {
  seed: string;
  hue?: number;
  className?: string;
}

/** Seeded mesh-gradient backdrop. Purely decorative. */
export function Aurora({ seed, hue, className }: AuroraProps) {
  return (
    <div
      className={className ? `aurora ${className}` : 'aurora'}
      style={auroraFor(seed, hue) as CSSProperties}
      aria-hidden="true"
    />
  );
}
