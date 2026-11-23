import type { EmailCategory } from '../winnow/types';

/** FNV-1a. Stable across sessions and platforms. */
export function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Small, fast PRNG. Deterministic for a given seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Signal {
  seed: number;
  hue: number;
  hue2: number;
  /** Normalized bar heights, 0.2–1. */
  bars: number[];
  rotation: number;
  phase: number;
}

export function signalFor(seed: string, hue?: number): Signal {
  const value = hashSeed(seed);
  const random = mulberry32(value);
  const baseHue = hue ?? Math.round(random() * 360);
  const bars = Array.from({ length: 9 }, () => 0.22 + random() * 0.78);

  return {
    seed: value,
    hue: baseHue,
    hue2: (baseHue + 40 + Math.round(random() * 90)) % 360,
    bars,
    rotation: Math.round(random() * 360),
    phase: random(),
  };
}

export function hsl(hue: number, saturation: number, lightness: number, alpha = 1): string {
  const h = Math.round(hue);
  const s = Math.round(saturation);
  const l = Math.round(lightness);
  return alpha >= 1 ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${alpha})`;
}

/** Semantic hue per email category. */
export const CATEGORY_HUE: Record<EmailCategory, number> = {
  security_alert: 6,
  bank_statement: 152,
  invoice: 38,
  travel: 194,
  legal: 268,
  action_required: 22,
  jobs: 210,
  personal: 330,
  payment: 48,
  shopping: 280,
  offers: 300,
  signup: 172,
  social: 200,
  alerts: 212,
  newsletter: 160,
  other: 220,
};

export function categoryHue(category: EmailCategory): number {
  return CATEGORY_HUE[category] ?? 220;
}

/** 0 → red, 50 → amber, 100 → green. */
export function scoreHue(score: number): number {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped < 50) return 6 + (clamped / 50) * 34;
  return 40 + ((clamped - 50) / 50) * 115;
}

/** A soft, seeded mesh gradient for headers and hero cards. */
export function auroraFor(seed: string, hue?: number): { background: string } {
  const signal = signalFor(seed, hue);
  const random = mulberry32(signal.seed);

  const layers = Array.from({ length: 3 }, () => {
    const x = Math.round(8 + random() * 84);
    const y = Math.round(6 + random() * 88);
    const layerHue = (signal.hue + random() * 70) % 360;
    const spread = 45 + Math.round(random() * 35);
    return `radial-gradient(${spread}% ${spread + 20}% at ${x}% ${y}%, ${hsl(layerHue, 85, 62, 0.3)} 0%, transparent 70%)`;
  });

  return { background: layers.join(', ') };
}

/** CSS custom properties for a seeded glow. */
export function glowVars(seed: string, hue?: number): Record<string, string> {
  const signal = signalFor(seed, hue);
  return {
    '--glow-hue': String(Math.round(signal.hue)),
    '--glow-hue-2': String(Math.round(signal.hue2)),
    '--glow': hsl(signal.hue, 85, 62, 0.35),
  };
}

export function scoreRing(score: number, radius: number): { circumference: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  return { circumference, offset: circumference * (1 - clamped / 100) };
}
