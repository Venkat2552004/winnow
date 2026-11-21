import type { PostInput } from '../jev/types';

/** Post-like URNs. Comments and member URNs are excluded. */
const POST_URN = /^urn:li:(activity|aggregate|ugcPost|share|fsd_update|fsd_post):/;

const ROOT_SELECTORS = [
  '[data-urn^="urn:li:"]',
  '[data-id^="urn:li:"]',
  '.feed-shared-update-v2',
  '[data-testid="main-feed-activity-card"]',
] as const;

const TEXT_SELECTORS = [
  '.update-components-text',
  '.feed-shared-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-inline-show-more-text',
  '[data-testid="expandable-text-box"]',
  '[data-testid="main-feed-activity-card__commentary"]',
] as const;

const AUTHOR_SELECTORS = [
  '.update-components-actor__title span[aria-hidden="true"]',
  '.update-components-actor__name span[aria-hidden="true"]',
  '.update-components-actor__name',
  '.feed-shared-actor__name',
] as const;

const MEDIA_SELECTOR = [
  '.update-components-image',
  '.update-components-video',
  '.update-components-linkedin-video',
  '.feed-shared-image',
  '.feed-shared-video',
].join(', ');

/** Regions whose text must never be mistaken for post commentary. */
const NON_CONTENT_SELECTOR = [
  '.update-components-actor',
  '.feed-shared-actor',
  '.update-components-header',
  '.feed-shared-header',
  '.social-details-social-counts',
  '.feed-shared-social-action-bar',
  '.update-components-social-actions',
].join(', ');

function firstText(scope: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const element = scope.querySelector<HTMLElement>(selector);
    const text = element?.innerText?.trim();
    if (text) return text;
  }
  return '';
}

function urnOf(element: HTMLElement): string | null {
  const own = element.getAttribute('data-urn') ?? element.getAttribute('data-id');
  return own && POST_URN.test(own) ? own : null;
}

export function getUrn(element: HTMLElement): string | null {
  const own = urnOf(element);
  if (own) return own;

  const nested = element.querySelectorAll<HTMLElement>('[data-urn^="urn:li:"], [data-id^="urn:li:"]');
  for (const node of nested) {
    const value = node.getAttribute('data-urn') ?? node.getAttribute('data-id');
    if (value && POST_URN.test(value)) return value;
  }
  return null;
}

function isBetterRoot(candidate: HTMLElement, current: HTMLElement): boolean {
  const candidateDirect = urnOf(candidate) !== null;
  const currentDirect = urnOf(current) !== null;
  if (candidateDirect !== currentDirect) return candidateDirect;
  return candidate.contains(current);
}

/** One element per activity, deduped by URN. */
export function findPostRoots(scope: ParentNode = document): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of ROOT_SELECTORS) {
    scope.querySelectorAll<HTMLElement>(selector).forEach((element) => candidates.add(element));
  }

  const byUrn = new Map<string, HTMLElement>();
  for (const element of candidates) {
    const urn = getUrn(element);
    if (!urn) continue;
    const current = byUrn.get(urn);
    if (!current || isBetterRoot(element, current)) byUrn.set(urn, element);
  }
  return [...byUrn.values()];
}

/**
 * Last-resort text extraction: the longest leaf text block that isn't part of
 * the author header or the social action bar.
 */
function fallbackText(element: HTMLElement): string {
  const nodes = element.querySelectorAll<HTMLElement>('[dir="ltr"], [dir="auto"]');
  let best = '';
  for (const node of nodes) {
    if (node.closest(NON_CONTENT_SELECTOR)) continue;
    if (node.querySelector('[dir="ltr"], [dir="auto"]')) continue;
    const text = node.innerText?.trim() ?? '';
    if (text.length > best.length) best = text;
  }
  return best;
}

function extractText(element: HTMLElement): string {
  const direct = firstText(element, TEXT_SELECTORS);
  if (direct.length >= 20) return direct;
  const fallback = fallbackText(element);
  return fallback.length > direct.length ? fallback : direct;
}

function parseCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const match = raw.replace(/,/g, '').match(/([\d.]+)\s*([km])?/i);
  if (!match?.[1]) return 0;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value)) return 0;
  const suffix = match[2]?.toLowerCase();
  const multiplier = suffix === 'k' ? 1_000 : suffix === 'm' ? 1_000_000 : 1;
  return Math.round(value * multiplier);
}

export function extractPost(element: HTMLElement): PostInput | null {
  const urn = getUrn(element);
  if (!urn) return null;

  const text = extractText(element);
  // Media-only posts can't be judged on text; leave them alone.
  if (text.length < 20) return null;

  const header = element.querySelector<HTMLElement>(
    '.update-components-header__text-view, .feed-shared-header__text-view',
  );

  return {
    urn,
    author: firstText(element, AUTHOR_SELECTORS) || 'Unknown',
    text,
    isRepost: /reposted|shared a post/i.test(header?.textContent ?? ''),
    hasMedia: Boolean(element.querySelector(MEDIA_SELECTOR)),
    likes: parseCount(
      element.querySelector<HTMLElement>('.social-details-social-counts__reactions-count')
        ?.textContent,
    ),
    comments: parseCount(
      element.querySelector<HTMLElement>('.social-details-social-counts__comments')?.textContent,
    ),
  };
}
