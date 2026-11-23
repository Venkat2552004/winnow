import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BLUR_CLASS,
  OVERLAY_CLASS,
  blurPost,
  unblurPost,
} from '../lib/linkedin/overlay';
import type { PostScore } from '../lib/winnow/types';

const score: PostScore = {
  score: 10,
  confidence: 1,
  labels: ['advertisement'],
  reason: 'Test reason',
  source: 'heuristic',
};

beforeEach(() => {
  document.body.innerHTML = '';
});

function makePost(): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = '<p>Post content</p>';
  document.body.appendChild(element);
  return element;
}

describe('LinkedIn overlay', () => {
  it('blurs a post and reveals it on click', () => {
    const element = makePost();
    const onReveal = vi.fn();

    expect(blurPost(element, score, onReveal, 'urn:li:activity:1')).toBe(true);
    expect(element.classList.contains(BLUR_CLASS)).toBe(true);

    const overlay = element.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain('10/100');
    expect(overlay?.textContent).toContain('Advertisement');
    expect(overlay?.textContent).toContain('Low value');

    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onReveal).toHaveBeenCalledOnce();
    expect(element.classList.contains(BLUR_CLASS)).toBe(false);
    expect(element.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
    expect(element.querySelector('.jev-badge')?.textContent).toBe('Winnow 10');
  });

  it('labels a category override instead of a low score', () => {
    const element = makePost();
    const strong: PostScore = {
      score: 92,
      confidence: 1,
      labels: ['advertisement'],
      reason: 'Ad copy with a discount code.',
      source: 'heuristic',
    };

    blurPost(element, strong, () => undefined, 'urn:li:activity:2', 'category');

    const overlay = element.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
    expect(overlay?.dataset.jevCause).toBe('category');
    expect(overlay?.textContent).toContain('Hidden by category');
    expect(overlay?.textContent).not.toContain('Low value');
    expect(overlay?.textContent).toContain('92/100');
    expect(overlay?.textContent).toContain('Advertisement');
    expect(
      overlay?.querySelector(`.${OVERLAY_CLASS}__score`)?.textContent,
    ).toBe('Value score 92/100');
  });

  it('keeps the low-value copy for score-based blurs', () => {
    const element = makePost();
    blurPost(element, score, () => undefined, 'urn:li:activity:3', 'score');

    const overlay = element.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`);
    expect(overlay?.textContent).toContain('Low value');
    expect(overlay?.textContent).not.toContain('Hidden by category');
  });

  it('rebuilds the card when the blur cause changes', () => {
    const element = makePost();
    blurPost(element, score, () => undefined, 'urn:li:activity:4', 'score');
    expect(element.querySelector<HTMLElement>(`.${OVERLAY_CLASS}`)?.dataset.jevCause).toBe(
      'score',
    );

    expect(blurPost(element, score, () => undefined, 'urn:li:activity:4', 'category')).toBe(
      true,
    );
    const overlays = element.querySelectorAll(`.${OVERLAY_CLASS}`);
    expect(overlays).toHaveLength(1);
    expect((overlays[0] as HTMLElement).dataset.jevCause).toBe('category');
  });

  it('does not rebuild the card when the cause is unchanged', () => {
    const element = makePost();
    blurPost(element, score, () => undefined, 'urn:li:activity:5', 'score');
    expect(blurPost(element, score, () => undefined, 'urn:li:activity:5', 'score')).toBe(
      false,
    );
  });

  it('does not re-blur a revealed post', () => {
    const element = makePost();
    blurPost(element, score, () => undefined, 'urn:li:activity:1');
    element
      .querySelector<HTMLElement>(`.${OVERLAY_CLASS}`)
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(blurPost(element, score, () => undefined, 'urn:li:activity:1')).toBe(false);
  });

  it('unblurs without marking the post as revealed', () => {
    const element = makePost();
    blurPost(element, score, () => undefined, 'urn:li:activity:1');
    unblurPost(element);

    expect(element.classList.contains(BLUR_CLASS)).toBe(false);
    expect(element.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
    expect(element.hasAttribute('data-jev-revealed')).toBe(false);
  });
});
