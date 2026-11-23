import type { BlurCause } from './decision';
import { isPostType, POST_TYPE_LABEL } from './taxonomy';
import type { PostScore } from '../winnow/types';
import { hsl, scoreHue, signalFor } from '../ui/generative';

const STYLE_ID = 'jev-linkedin-styles';
const SVG_NS = 'http://www.w3.org/2000/svg';

export const BLUR_CLASS = 'jev-blurred';
export const OVERLAY_CLASS = 'jev-overlay';
const BADGE_CLASS = 'jev-badge';
const SCORED_CLASS = 'jev-scored';
const REVEALED_ATTR = 'data-jev-revealed';

const STYLES = `
.${SCORED_CLASS} {
  position: relative !important;
}

.${BLUR_CLASS} > *:not(.${OVERLAY_CLASS}):not(.${BADGE_CLASS}) {
  filter: blur(7px) saturate(0.7);
  pointer-events: none !important;
  user-select: none !important;
}

.${OVERLAY_CLASS} {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-radius: 10px;
  background:
    radial-gradient(130% 110% at 50% -10%, hsl(var(--jev-accent, 220) 70% 40% / 0.2), transparent 62%),
    rgba(8, 11, 16, 0.55);
  backdrop-filter: blur(3px) saturate(0.9);
  cursor: pointer;
}

.${OVERLAY_CLASS}:focus-visible {
  outline: 2px solid hsl(var(--jev-accent, 220) 85% 62%);
  outline-offset: -2px;
}

.${OVERLAY_CLASS}__card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: min(360px, 100%);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0) 46%),
    rgba(13, 16, 22, 0.94);
  border: 1px solid hsl(var(--jev-accent, 220) 70% 60% / 0.3);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.5),
    0 0 0 1px hsl(var(--jev-accent, 220) 70% 60% / 0.1),
    0 0 42px hsl(var(--jev-accent, 220) 80% 55% / 0.16);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e8eef8;
  text-align: left;
  animation: jev-card-in 220ms cubic-bezier(0.21, 1, 0.35, 1) both;
}

@keyframes jev-card-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.${OVERLAY_CLASS}__glow {
  position: absolute;
  inset: -45%;
  pointer-events: none;
  background:
    radial-gradient(46% 46% at 14% -6%, hsl(var(--jev-accent, 220) 85% 62% / 0.4), transparent 68%),
    radial-gradient(46% 46% at 96% 14%, hsl(var(--jev-accent-2, 260) 85% 62% / 0.26), transparent 68%);
  filter: blur(22px);
}

.${OVERLAY_CLASS}__card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(115deg, transparent 38%, rgba(255, 255, 255, 0.09) 50%, transparent 62%);
  transform: translateX(-60%);
  animation: jev-sheen 900ms ease-out 140ms both;
}

@keyframes jev-sheen {
  to {
    transform: translateX(60%);
  }
}

.${OVERLAY_CLASS}__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 15px 17px 14px;
}

.${OVERLAY_CLASS}__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.${OVERLAY_CLASS}__ring {
  flex: 0 0 auto;
  filter: drop-shadow(0 0 10px hsl(var(--jev-score-hue, 220) 85% 55% / 0.35));
}

.${OVERLAY_CLASS}__meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.${OVERLAY_CLASS}__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 750;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: hsl(var(--jev-accent, 220) 90% 80%);
  background: hsl(var(--jev-accent, 220) 70% 45% / 0.18);
  border: 1px solid hsl(var(--jev-accent, 220) 70% 60% / 0.3);
  white-space: nowrap;
}

.${OVERLAY_CLASS}__eyebrow::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: hsl(var(--jev-accent, 220) 90% 65%);
  box-shadow: 0 0 6px hsl(var(--jev-accent, 220) 90% 65% / 0.9);
}

.${OVERLAY_CLASS}__title {
  font-size: 14.5px;
  font-weight: 680;
  letter-spacing: -0.01em;
  color: #f2f6fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.${OVERLAY_CLASS}__score {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #8b98ab;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.${OVERLAY_CLASS}__sig {
  flex: 0 0 auto;
  opacity: 0.75;
}

.${OVERLAY_CLASS}__reason {
  margin: 0;
  padding-top: 11px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  font-size: 12px;
  line-height: 1.5;
  color: #a9b6c8 !important;
  font-family: inherit !important;
}

.${OVERLAY_CLASS}__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.${OVERLAY_CLASS}__cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 680;
  color: #fff;
  background: linear-gradient(
    135deg,
    hsl(var(--jev-accent, 220) 85% 60%),
    hsl(var(--jev-accent-2, 260) 85% 60%)
  );
  box-shadow: 0 8px 22px hsl(var(--jev-accent, 220) 85% 50% / 0.34);
}

.${OVERLAY_CLASS}__cta::after {
  content: '→';
  font-size: 12px;
  transition: transform 140ms ease;
}

.${OVERLAY_CLASS}:hover .${OVERLAY_CLASS}__cta::after {
  transform: translateX(2px);
}

.${OVERLAY_CLASS}__hint {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6f7c8f;
  white-space: nowrap;
}

.${BADGE_CLASS} {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--jev-hue, 220) 85% 78%);
  background: rgba(14, 17, 22, 0.85);
  border: 1px solid hsl(var(--jev-hue, 220) 80% 60% / 0.4);
  box-shadow: 0 0 12px hsl(var(--jev-hue, 220) 80% 60% / 0.25);
  pointer-events: none;
}

.${BADGE_CLASS}::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--jev-hue, 220) 85% 62%);
  box-shadow: 0 0 8px hsl(var(--jev-hue, 220) 85% 62% / 0.8);
}

.jev-debug-pill {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(14, 17, 22, 0.9);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(107, 155, 255, 0.4);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: #e8eef8;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  pointer-events: none;
}

.jev-debug-pill::before {
  content: '';
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #46d17a;
  box-shadow: 0 0 10px rgba(70, 209, 122, 0.8);
}

@media (prefers-reduced-motion: reduce) {
  .${OVERLAY_CLASS}__card,
  .${OVERLAY_CLASS}__card::after {
    animation: none !important;
  }
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function buildRing(score: number, hue: number): SVGSVGElement {
  const size = 48;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const center = size / 2;

  const svg = svgEl('svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(`${OVERLAY_CLASS}__ring`);

  const track = svgEl('circle');
  track.setAttribute('cx', String(center));
  track.setAttribute('cy', String(center));
  track.setAttribute('r', String(radius));
  track.setAttribute('fill', 'none');
  track.setAttribute('stroke', 'rgba(255, 255, 255, 0.12)');
  track.setAttribute('stroke-width', String(stroke));

  const arc = svgEl('circle');
  arc.setAttribute('cx', String(center));
  arc.setAttribute('cy', String(center));
  arc.setAttribute('r', String(radius));
  arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', hsl(hue, 85, 62));
  arc.setAttribute('stroke-width', String(stroke));
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('stroke-dasharray', String(circumference));
  arc.setAttribute('stroke-dashoffset', String(offset));
  arc.setAttribute('transform', `rotate(-90 ${center} ${center})`);

  const text = svgEl('text');
  text.setAttribute('x', '50%');
  text.setAttribute('y', '50%');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', String(size * 0.31));
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', '#e8eef8');
  text.textContent = String(Math.round(clamped));

  svg.append(track, arc, text);
  return svg;
}

function buildSignal(seed: string, hue: number): SVGSVGElement {
  const signal = signalFor(seed, hue);
  const size = 26;
  const bars = signal.bars.slice(0, 5);
  const slot = size / bars.length;
  const barWidth = Math.max(1.5, slot * 0.46);

  const svg = svgEl('svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(`${OVERLAY_CLASS}__sig`);

  bars.forEach((value, index) => {
    const height = Math.max(2, value * size * 0.88);
    const rect = svgEl('rect');
    rect.setAttribute('x', String(index * slot + (slot - barWidth) / 2));
    rect.setAttribute('y', String((size - height) / 2));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', String(barWidth / 2));
    rect.setAttribute('fill', hsl(hue, 82, 68, 0.9));
    svg.append(rect);
  });

  return svg;
}

function showBadge(element: HTMLElement, score: PostScore): void {
  if (element.querySelector(`.${BADGE_CLASS}`)) return;
  const hue = scoreHue(score.score);
  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.style.setProperty('--jev-hue', String(Math.round(hue)));
  badge.textContent = `Winnow ${Math.round(score.score)}`;
  badge.title = score.reason || 'Winnow score';
  element.appendChild(badge);
}

/** Human name for the post's primary label, e.g. advertisement → Advertisement. */
function typeLabelOf(score: PostScore): string {
  const [first] = score.labels;
  if (isPostType(first)) return POST_TYPE_LABEL[first];
  return first ? first.replace(/_/g, ' ') : 'Filtered post';
}

/**
 * The accent is the reason the post is hidden, so a high-scoring category
 * override never paints itself green — the ring keeps the true score hue.
 */
function causeCopy(cause: BlurCause): {
  eyebrow: string;
  fallbackReason: string;
  accentHue: number;
} {
  if (cause === 'category') {
    return {
      eyebrow: 'Hidden by category',
      fallbackReason: 'You chose to always blur this post type.',
      accentHue: 268,
    };
  }
  return {
    eyebrow: 'Low value',
    fallbackReason: 'Scored below your blur threshold.',
    accentHue: 8,
  };
}

function buildOverlay(
  score: PostScore,
  reveal: () => void,
  seed: string,
  cause: BlurCause,
): HTMLElement {
  const signal = signalFor(seed);
  const hue = scoreHue(score.score);
  const typeLabel = typeLabelOf(score);
  const copy = causeCopy(cause);
  const accentHue = copy.accentHue;

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'button');
  overlay.tabIndex = 0;
  overlay.dataset.jevCause = cause;
  overlay.style.setProperty('--jev-accent', String(Math.round(accentHue)));
  overlay.setAttribute(
    'aria-label',
    `${copy.eyebrow}: ${typeLabel}, score ${Math.round(score.score)} out of 100. Activate to reveal.`,
  );

  const card = document.createElement('div');
  card.className = `${OVERLAY_CLASS}__card`;
  card.style.setProperty('--jev-accent', String(Math.round(accentHue)));
  card.style.setProperty('--jev-accent-2', String(Math.round(signal.hue2)));
  card.style.setProperty('--jev-score-hue', String(Math.round(hue)));

  const glow = document.createElement('div');
  glow.className = `${OVERLAY_CLASS}__glow`;

  const content = document.createElement('div');
  content.className = `${OVERLAY_CLASS}__content`;

  const top = document.createElement('div');
  top.className = `${OVERLAY_CLASS}__top`;

  const meta = document.createElement('div');
  meta.className = `${OVERLAY_CLASS}__meta`;

  const eyebrow = document.createElement('span');
  eyebrow.className = `${OVERLAY_CLASS}__eyebrow`;
  eyebrow.textContent = copy.eyebrow;

  const title = document.createElement('span');
  title.className = `${OVERLAY_CLASS}__title`;
  title.textContent = typeLabel;

  const scoreLabel = document.createElement('span');
  scoreLabel.className = `${OVERLAY_CLASS}__score`;
  scoreLabel.textContent = `Value score ${Math.round(score.score)}/100`;

  meta.append(eyebrow, title, scoreLabel);
  top.append(buildRing(score.score, hue), meta, buildSignal(seed, hue));

  const reason = document.createElement('p');
  reason.className = `${OVERLAY_CLASS}__reason`;
  reason.textContent = score.reason || copy.fallbackReason;

  const footer = document.createElement('div');
  footer.className = `${OVERLAY_CLASS}__footer`;

  const cta = document.createElement('span');
  cta.className = `${OVERLAY_CLASS}__cta`;
  cta.textContent = 'Reveal post';

  const hint = document.createElement('span');
  hint.className = `${OVERLAY_CLASS}__hint`;
  hint.textContent = 'Enter to show';

  footer.append(cta, hint);
  content.append(top, reason, footer);
  card.append(glow, content);
  overlay.append(card);

  overlay.addEventListener('click', reveal);
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    reveal();
  });

  return overlay;
}

/**
 * Blurs a post and overlays a reveal card. Returns true only when a new blur
 * was applied (so callers can count it once).
 */
export function blurPost(
  element: HTMLElement,
  score: PostScore,
  onReveal: () => void,
  seed = 'jev',
  cause: BlurCause = 'score',
): boolean {
  if (element.hasAttribute(REVEALED_ATTR)) return false;
  element.classList.add(SCORED_CLASS);

  const existing = element.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
  if (existing && existing.dataset.jevCause === cause) return false;
  existing?.remove();

  element.classList.add(BLUR_CLASS);

  const overlay = buildOverlay(
    score,
    () => {
      element.classList.remove(BLUR_CLASS);
      overlay.remove();
      element.setAttribute(REVEALED_ATTR, '1');
      showBadge(element, score);
      onReveal();
    },
    seed,
    cause,
  );

  element.appendChild(overlay);
  return true;
}

/** Removes the blur without marking the post as revealed. */
export function unblurPost(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS);
  element.querySelector(`.${OVERLAY_CLASS}`)?.remove();
}

/** Removes every Winnow artifact from a post. */
export function resetPost(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS, SCORED_CLASS);
  element.querySelector(`.${OVERLAY_CLASS}`)?.remove();
  element.querySelector(`.${BADGE_CLASS}`)?.remove();
  element.removeAttribute(REVEALED_ATTR);
}

export function resetAll(): void {
  document
    .querySelectorAll<HTMLElement>(`.${BLUR_CLASS}, .${SCORED_CLASS}`)
    .forEach((element) => resetPost(element));
}
