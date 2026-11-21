import type { PostScore } from '../jev/types';

const STYLE_ID = 'jev-linkedin-styles';

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
  filter: blur(7px) saturate(0.75);
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
  border-radius: 8px;
  background: rgba(10, 13, 18, 0.45);
  cursor: pointer;
}

.${OVERLAY_CLASS}:focus-visible {
  outline: 2px solid #5b8cff;
  outline-offset: -2px;
}

.${OVERLAY_CLASS}__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  max-width: 320px;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(14, 17, 22, 0.94);
  border: 1px solid rgba(91, 140, 255, 0.35);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #e6edf6;
  text-align: center;
}

.${OVERLAY_CLASS}__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.${OVERLAY_CLASS}__badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #ffb4a8;
}

.${OVERLAY_CLASS}__score {
  font-size: 12px;
  font-weight: 600;
  color: #8b98ab;
}

.${OVERLAY_CLASS}__reason {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: #8b98ab;
}

.${OVERLAY_CLASS}__cta {
  font-size: 12px;
  font-weight: 600;
  color: #5b8cff;
}

.${BADGE_CLASS} {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 40;
  padding: 2px 7px;
  border-radius: 999px;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 10px;
  font-weight: 700;
  color: #8b98ab;
  background: rgba(14, 17, 22, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.jev-debug-pill {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2147483647;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(14, 17, 22, 0.92);
  border: 1px solid rgba(91, 140, 255, 0.4);
  color: #e6edf6;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11px;
  line-height: 1.4;
  pointer-events: none;
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

function showBadge(element: HTMLElement, score: PostScore): void {
  if (element.querySelector(`.${BADGE_CLASS}`)) return;
  const badge = document.createElement('span');
  badge.className = BADGE_CLASS;
  badge.textContent = `Jev ${Math.round(score.score)}`;
  badge.title = score.reason || 'Jev score';
  element.appendChild(badge);
}

function buildOverlay(score: PostScore, reveal: () => void): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'button');
  overlay.tabIndex = 0;
  overlay.setAttribute(
    'aria-label',
    `Low value post, score ${Math.round(score.score)} out of 100. Activate to reveal.`,
  );

  const card = document.createElement('div');
  card.className = `${OVERLAY_CLASS}__card`;

  const row = document.createElement('div');
  row.className = `${OVERLAY_CLASS}__row`;

  const badge = document.createElement('span');
  badge.className = `${OVERLAY_CLASS}__badge`;
  badge.textContent = 'Low value';

  const scoreLabel = document.createElement('span');
  scoreLabel.className = `${OVERLAY_CLASS}__score`;
  scoreLabel.textContent = `${Math.round(score.score)}/100`;

  row.append(badge, scoreLabel);

  const reason = document.createElement('p');
  reason.className = `${OVERLAY_CLASS}__reason`;
  reason.textContent = score.reason || 'Filtered by Jev';

  const cta = document.createElement('span');
  cta.className = `${OVERLAY_CLASS}__cta`;
  cta.textContent = 'Click to reveal';

  card.append(row, reason, cta);
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
export function blurPost(element: HTMLElement, score: PostScore, onReveal: () => void): boolean {
  if (element.hasAttribute(REVEALED_ATTR)) return false;
  element.classList.add(SCORED_CLASS);
  if (element.querySelector(`.${OVERLAY_CLASS}`)) return false;

  element.classList.add(BLUR_CLASS);

  const overlay = buildOverlay(score, () => {
    element.classList.remove(BLUR_CLASS);
    overlay.remove();
    element.setAttribute(REVEALED_ATTR, '1');
    showBadge(element, score);
    onReveal();
  });

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
