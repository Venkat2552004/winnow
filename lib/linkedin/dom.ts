import type { PostInput } from '../jev/types';

const ROOT_SELECTORS = [
  '[data-urn^="urn:li:activity"]',
  '[data-id^="urn:li:activity"]',
  '.feed-shared-update-v2',
] as const;

const TEXT_SELECTORS = [
  '.update-components-text',
  '.feed-shared-text',
  '.feed-shared-update-v2__description',
  '.feed-shared-inline-show-more-text',
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

function firstText(scope: ParentNode, selectors: readonly string[]): string {
  for (const selector of selectors) {
    const element = scope.querySelector<HTMLElement>(selector);
    const text = element?.innerText?.trim();
    if (text) return text;
  }
  return '';
}

export function getUrn(element: HTMLElement): string | null {
  const own = element.getAttribute('data-urn') ?? element.getAttribute('data-id');
  if (own?.startsWith('urn:li:activity')) return own;

  const nested = element.querySelector<HTMLElement>(
    '[data-urn^="urn:li:activity"], [data-id^="urn:li:activity"]',
  );
  const nestedUrn = nested?.getAttribute('data-urn') ?? nested?.getAttribute('data-id');
  return nestedUrn?.startsWith('urn:li:activity') ? nestedUrn : null;
}

function isBetterRoot(candidate: HTMLElement, current: HTMLElement): boolean {
  const candidateDirect = candidate.hasAttribute('data-urn') || candidate.hasAttribute('data-id');
  const currentDirect = current.hasAttribute('data-urn') || current.hasAttribute('data-id');
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

  const text = firstText(element, TEXT_SELECTORS);
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
