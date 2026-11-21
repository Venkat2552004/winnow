import type { PostInput } from '../jev/types';

/** Legacy post URNs found in data-urn / data-id attributes. */
const LEGACY_POST_URN = /^urn:li:(activity|aggregate|ugcPost|share|fsd_update|fsd_post):/;
/** Activity URNs found inside links or arbitrary attributes. */
const ACTIVITY_URN = /urn:li:activity:\d+/;

const LEGACY_ROOT_SELECTORS = [
  '[data-urn^="urn:li:"]',
  '[data-id^="urn:li:"]',
  '.feed-shared-update-v2',
  '[data-testid="main-feed-activity-card"]',
] as const;

const TEXT_SELECTORS = [
  '[data-testid="expandable-text-box"]',
  '.update-components-text',
  '.feed-shared-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-inline-show-more-text',
  '[data-testid="main-feed-activity-card__commentary"]',
] as const;

const AUTHOR_SELECTORS = [
  '.update-components-actor__title span[aria-hidden="true"]',
  '.update-components-actor__name span[aria-hidden="true"]',
  '.update-components-actor__name',
  '.feed-shared-actor__name',
  'a[href*="/in/"] span[aria-hidden="true"]',
  'a[href*="/in/"]',
  'a[href*="/company/"]',
] as const;

const MEDIA_SELECTOR = [
  'video',
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

function textOf(element: Element | null): string {
  if (!element) return '';
  const inner = (element as HTMLElement).innerText?.trim();
  if (inner) return inner;
  return element.textContent?.trim() ?? '';
}

function firstText(scope: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const text = textOf(scope.querySelector<HTMLElement>(selector));
    if (text) return text;
  }
  return '';
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function hasListItemAncestor(element: HTMLElement, boundary: HTMLElement): boolean {
  let parent = element.parentElement;
  while (parent && parent !== boundary) {
    if (parent.getAttribute('role') === 'listitem') return true;
    parent = parent.parentElement;
  }
  return false;
}

/**
 * New LinkedIn feed: posts are role="listitem" inside [data-testid="mainFeed"],
 * with commentary in [data-testid="expandable-text-box"].
 */
function findModernRoots(scope: ParentNode): HTMLElement[] {
  const feed = scope.querySelector<HTMLElement>('[data-testid="mainFeed"]');

  if (feed) {
    const items = Array.from(feed.querySelectorAll<HTMLElement>('[role="listitem"]')).filter(
      (item) => !hasListItemAncestor(item, feed),
    );
    if (items.length > 0) return items;
  }

  // Fallback: climb from each commentary box to its card-like ancestor.
  const boundary = feed ?? document.body;
  const roots = new Set<HTMLElement>();
  for (const box of boundary.querySelectorAll<HTMLElement>(
    '[data-testid="expandable-text-box"]',
  )) {
    const root = box.closest<HTMLElement>('[role="listitem"]') ?? climbToCard(box, boundary);
    if (root) roots.add(root);
  }
  return [...roots];
}

function climbToCard(box: HTMLElement, boundary: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = box;
  let best: HTMLElement | null = null;
  while (node && node !== boundary) {
    const boxes = node.querySelectorAll('[data-testid="expandable-text-box"]').length;
    if (boxes > 1) break;
    if (node.offsetHeight > 120) best = node;
    node = node.parentElement;
  }
  return best;
}

function findLegacyRoots(scope: ParentNode): HTMLElement[] {
  const candidates = new Set<HTMLElement>();
  for (const selector of LEGACY_ROOT_SELECTORS) {
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

function isBetterRoot(candidate: HTMLElement, current: HTMLElement): boolean {
  const candidateDirect = candidate.hasAttribute('data-urn') || candidate.hasAttribute('data-id');
  const currentDirect = current.hasAttribute('data-urn') || current.hasAttribute('data-id');
  if (candidateDirect !== currentDirect) return candidateDirect;
  return candidate.contains(current);
}

/** One element per post. */
export function findPostRoots(scope: ParentNode = document): HTMLElement[] {
  const modern = findModernRoots(scope);
  if (modern.length > 0) return modern;
  return findLegacyRoots(scope);
}

function findActivityUrn(element: HTMLElement): string | null {
  for (const anchor of element.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const match = anchor.href.match(ACTIVITY_URN);
    if (match) return match[0];
  }

  const nodes = element.querySelectorAll<HTMLElement>('*');
  const limit = Math.min(nodes.length, 300);
  for (let index = 0; index < limit; index += 1) {
    const node = nodes[index];
    if (!node) continue;
    for (const attribute of node.attributes) {
      const match = attribute.value.match(ACTIVITY_URN);
      if (match) return match[0];
    }
  }
  return null;
}

export function getUrn(element: HTMLElement): string | null {
  const own = element.getAttribute('data-urn') ?? element.getAttribute('data-id');
  if (own && LEGACY_POST_URN.test(own)) return own;
  return findActivityUrn(element);
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
    const text = textOf(node);
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

function countFromText(text: string, pattern: RegExp): number {
  const match = text.match(pattern);
  return match?.[1] ? parseCount(match[1]) : 0;
}

export function extractPost(element: HTMLElement): PostInput | null {
  const text = extractText(element);
  // Media-only posts can't be judged on text; leave them alone.
  if (text.length < 20) return null;

  const author = firstText(element, AUTHOR_SELECTORS) || 'Unknown';
  const urn = getUrn(element) ?? `urn:li:jev:${hashString(`${author}|${text}`)}`;

  const header = element.querySelector<HTMLElement>(
    '.update-components-header__text-view, .feed-shared-header__text-view',
  );
  const preview = textOf(element).slice(0, 400);

  return {
    urn,
    author,
    text,
    isRepost:
      /reposted|shared a post/i.test(header?.textContent ?? '') || /reposted this/i.test(preview),
    hasMedia: Boolean(element.querySelector(MEDIA_SELECTOR)),
    likes:
      parseCount(
        element.querySelector<HTMLElement>('.social-details-social-counts__reactions-count')
          ?.textContent,
      ) || countFromText(preview, /([\d.,]+[KM]?)\s*(?:reactions?|likes?)/i),
    comments:
      parseCount(
        element.querySelector<HTMLElement>('.social-details-social-counts__comments')?.textContent,
      ) || countFromText(preview, /([\d.,]+[KM]?)\s*comments?/i),
  };
}
