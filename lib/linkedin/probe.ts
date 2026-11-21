export interface DomProbe {
  url: string;
  title: string;
  bodyTextLength: number;
  counts: Record<string, number>;
  urnSamples: string[];
  dataIdSamples: string[];
  testIds: string[];
  feedClasses: string[];
  roles: string[];
  urnElements: Array<{ tag: string; className: string; urn: string; parent: string }>;
  feedContainer: { found: boolean; tag?: string; className?: string; children?: number };
}

const COUNT_SELECTORS = [
  '[data-urn]',
  '[data-id]',
  '[data-testid]',
  '.feed-shared-update-v2',
  '[data-testid="main-feed-activity-card"]',
  'article',
  '[role="article"]',
  '[role="feed"]',
  '[role="listitem"]',
  'main',
  '.scaffold-finite-scroll__content',
];

function sample(values: string[], limit = 12): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value || out.includes(value)) continue;
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function classNameOf(element: Element | null): string {
  if (!element) return '';
  const value = (element as HTMLElement).className;
  return typeof value === 'string' ? value.slice(0, 140) : '';
}

export function probeDom(): DomProbe {
  const counts: Record<string, number> = {};
  for (const selector of COUNT_SELECTORS) {
    counts[selector] = document.querySelectorAll(selector).length;
  }

  const urnSamples = sample(
    Array.from(document.querySelectorAll<HTMLElement>('[data-urn]')).map(
      (element) => element.getAttribute('data-urn') ?? '',
    ),
  );

  const dataIdSamples = sample(
    Array.from(document.querySelectorAll<HTMLElement>('[data-id]')).map(
      (element) => element.getAttribute('data-id') ?? '',
    ),
  );

  const testIds = sample(
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid]')).map(
      (element) => element.getAttribute('data-testid') ?? '',
    ),
    40,
  );

  const feedClasses = new Set<string>();
  const all = document.querySelectorAll<HTMLElement>('*');
  const limit = Math.min(all.length, 8000);
  for (let index = 0; index < limit && feedClasses.size < 80; index += 1) {
    const element = all[index];
    if (!element) continue;
    for (const name of element.classList) {
      if (/feed|update|scaffold|activity|card/i.test(name)) feedClasses.add(name);
      if (feedClasses.size >= 80) break;
    }
  }

  const roles = sample(
    Array.from(document.querySelectorAll<HTMLElement>('[role]')).map(
      (element) => element.getAttribute('role') ?? '',
    ),
  );

  const urnElements = Array.from(
    document.querySelectorAll<HTMLElement>('[data-urn], [data-id]'),
  )
    .slice(0, 6)
    .map((element) => ({
      tag: element.tagName.toLowerCase(),
      className: classNameOf(element),
      urn: element.getAttribute('data-urn') ?? element.getAttribute('data-id') ?? '',
      parent: element.parentElement
        ? `${element.parentElement.tagName.toLowerCase()}.${classNameOf(element.parentElement).slice(0, 80)}`
        : '',
    }));

  const container = document.querySelector<HTMLElement>('[role="feed"], main');
  const feedContainer = container
    ? {
        found: true,
        tag: container.tagName.toLowerCase(),
        className: classNameOf(container),
        children: container.children.length,
      }
    : { found: false };

  return {
    url: location.href,
    title: document.title,
    bodyTextLength: document.body.innerText.length,
    counts,
    urnSamples,
    dataIdSamples,
    testIds,
    feedClasses: [...feedClasses],
    roles,
    urnElements,
    feedContainer,
  };
}
