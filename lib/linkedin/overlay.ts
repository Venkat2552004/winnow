import type { PostScore } from '../jev/types';
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
  background: radial-gradient(120% 120% at 50% 0%, rgba(10, 13, 19, 0.32), rgba(10, 13, 19, 0.64));
  backdrop-filter: blur(2px);
  cursor: pointer;
}

.${OVERLAY_CLASS}:focus-visible {
  outline: 2px solid hsl(var(--jev-hue, 220) 85% 62%);
  outline-offset: -2px;
}

.${OVERLAY_CLASS}__card {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: min(340px, 100%);
  padding: 16px 18px;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 45%),
    rgba(14, 17, 22, 0.93);
  border: 1px solid hsl(var(--jev-hue, 220) 80% 60% / 0.35);
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.45),
    0 0 0 1px hsl(var(--jev-hue, 220) 80% 60% / 0.12);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e8eef8;
  text-align: left;
}

.${OVERLAY_CLASS}__glow {
  position: absolute;
  inset: -40%;
  pointer-events: none;
  background:
    radial-gradient(50% 50% at 18% 0%, hsl(var(--jev-hue, 220) 85% 62% / 0.35), transparent 70%),
    radial-gradient(50% 50% at 92% 18%, hsl(var(--jev-hue-2, 260) 85% 62% / 0.25), transparent 70%);
  filter: blur(18px);
}

.${OVERLAY_CLASS}__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.${OVERLAY_CLASS}__top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.${OVERLAY_CLASS}__ring {
  flex: 0 0 auto;
}

.${OVERLAY_CLASS}__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.${OVERLAY_CLASS}__badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: hsl(var(--jev-hue, 220) 85% 74%);
}

.${OVERLAY_CLASS}__score {
  font-size: 12px;
  color: #8b98ab;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.${OVERLAY_CLASS}__reason {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: #a9b6c8 !important;
  font-family: inherit !important;
}

.${OVERLAY_CLASS}__cta {
  align-self: flex-start;
  padding: 6px 13px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 650;
  color: #fff;
  background: linear-gradient(
    135deg,
    hsl(var(--jev-hue, 220) 85% 60%),
    hsl(var(--jev-hue-2, 260) 85% 60%)
  );
  box-shadow: 0 6px 18px hsl(var(--jev-hue, 220) 85% 50% / 0.35);
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
  const size = 46;
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
  text.setAttribute('font-size', String(size * 0.32));
  text.setAttribute('font-weight', '700');
  text.setAttribute('fill', '#e8eef8');
  text.textContent = String(Math.round(clamped));

  svg.append(track, arc, text);
  return svg;
}

function buildSignal(seed: string, hue: number): SVGSVGElement {
  const signal = signalFor(seed, hue);
  const size = 22;
  const bars = signal.bars.slice(0, 5);
  const slot = size / bars.length;
  const barWidth = Math.max(1.5, slot * 0.5);

  const svg = svgEl('svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');

  bars.forEach((value, index) => {
    const height = Math.max(2, value * size * 0.9);
    const rect = svgEl('rect');
    rect.setAttribute('x', String(index * slot + (slot - barWidth) / 2));
    rect.setAttribute('y', String((size - height) / 2));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', String(barWidth / 2));
    rect.setAttribute('fill', hsl(hue, 82, 64, 0.9));
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
  badge.textContent = `Jev ${Math.round(score.score)}`;
  badge.title = score.reason || 'Jev score';
  element.appendChild(badge);
}

function buildOverlay(score: PostScore, reveal: () => void, seed: string): HTMLElement {
  const signal = signalFor(seed);
  const hue = scoreHue(score.score);

  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'button');
  overlay.tabIndex = 0;
  overlay.style.setProperty('--jev-hue', String(Math.round(hue)));
  overlay.setAttribute('aria-label', `Low value post, score ${Math.round(score.score)} out of 100. Activate to reveal.`);

  const card = document.createElement('div');
  card.className = `${OVERLAY_CLASS}__card`;
  card.style.setProperty('--jev-hue', String(Math.round(hue)));
  card.style.setProperty('--jev-hue-2', String(Math.round(signal.hue2)));

  const glow = document.createElement('div');
  glow.className = `${OVERLAY_CLASS}__glow`;

  const content = document.createElement('div');
  content.className = `${OVERLAY_CLASS}__content`;

  const top = document.createElement('div');
  top.className = `${OVERLAY_CLASS}__top`;

  const meta = document.createElement('div');
  meta.className = `${OVERLAY_CLASS}__meta`;

  const badge = document.createElement('span');
  badge.className = `${OVERLAY_CLASS}__badge`;
  badge.textContent = 'Low value';

  const scoreLabel = document.createElement('span');
  scoreLabel.className = `${OVERLAY_CLASS}__score`;
  const label = score.labels[0]?.replace(/_/g, ' ');
  scoreLabel.textContent = `${Math.round(score.score)}/100${label ? ` · ${label}` : ''}`;

  meta.append(badge, scoreLabel);
  top.append(buildRing(score.score, hue), meta, buildSignal(seed, hue));

  const reason = document.createElement('div');
  reason.className = `${OVERLAY_CLASS}__reason`;
  reason.textContent = score.reason || 'Filtered by Jev';

  const cta = document.createElement('span');
  cta.className = `${OVERLAY_CLASS}__cta`;
  cta.textContent = 'Reveal post';

  content.append(top, reason, cta);
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
): boolean {
  if (element.hasAttribute(REVEALED_ATTR)) return false;
  element.classList.add(SCORED_CLASS);
  if (element.querySelector(`.${OVERLAY_CLASS}`)) return false;

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
  );

  element.appendChild(overlay);
  return true;
}

/** Removes the blur without marking the post as revealed. */
export function unblurPost(element: HTMLElement): void {
  element.classList.remove(BLUR_CLASS);
  element.querySelector(`.${OVERLAY_CLASS}`)?.remove();
}

/** Removes every Jev artifact from a post. */
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
