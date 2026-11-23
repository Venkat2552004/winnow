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
    expect(overlay?.textContent).toContain('advertisement');

    overlay?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onReveal).toHaveBeenCalledOnce();
    expect(element.classList.contains(BLUR_CLASS)).toBe(false);
    expect(element.querySelector(`.${OVERLAY_CLASS}`)).toBeNull();
    expect(element.querySelector('.jev-badge')?.textContent).toBe('Winnow 10');
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
