import { beforeEach, describe, expect, it } from 'vitest';
import { extractPost } from '../lib/linkedin/dom';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('extractPost', () => {
  it('extracts a modern post', () => {
    document.body.innerHTML = `
      <div data-urn="urn:li:activity:123">
        <a href="/in/jane-doe"><span aria-hidden="true">Jane Doe</span></a>
        <div data-testid="expandable-text-box">
          We migrated 40 services to Postgres 17. P99 latency dropped from 800ms to 120ms.
        </div>
        <video></video>
        <span class="social-details-social-counts__reactions-count">1.2K</span>
        <span class="social-details-social-counts__comments">34</span>
      </div>
    `;

    const root = document.querySelector<HTMLElement>('[data-urn]');
    expect(root).not.toBeNull();

    const post = extractPost(root!);
    expect(post).not.toBeNull();
    expect(post?.urn).toBe('urn:li:activity:123');
    expect(post?.author).toBe('Jane Doe');
    expect(post?.text).toContain('We migrated 40 services');
    expect(post?.hasMedia).toBe(true);
    expect(post?.likes).toBe(1200);
    expect(post?.comments).toBe(34);
  });

  it('keeps short text posts so low-effort content can be classified', () => {
    document.body.innerHTML = `
      <div data-urn="urn:li:activity:124">
        <div data-testid="expandable-text-box">Thoughts?</div>
      </div>
    `;

    const post = extractPost(document.querySelector<HTMLElement>('[data-urn]')!);
    expect(post?.text).toBe('Thoughts?');
  });

  it('keeps hashtag-only posts', () => {
    document.body.innerHTML = `
      <div data-urn="urn:li:activity:125">
        <div data-testid="expandable-text-box">#engineering #tech #jobs #hiring</div>
      </div>
    `;

    const post = extractPost(document.querySelector<HTMLElement>('[data-urn]')!);
    expect(post?.text).toContain('#engineering');
  });

  it('skips media-only posts with no commentary', () => {
    document.body.innerHTML = `
      <div data-urn="urn:li:activity:126">
        <a href="/in/jane-doe"><span aria-hidden="true">Jane Doe</span></a>
        <video></video>
      </div>
    `;

    expect(extractPost(document.querySelector<HTMLElement>('[data-urn]')!)).toBeNull();
  });

  it('detects reposts', () => {
    document.body.innerHTML = `
      <div data-urn="urn:li:activity:127">
        <div class="update-components-header__text-view">Jane Doe reposted this</div>
        <div data-testid="expandable-text-box">A useful technical breakdown with concrete details.</div>
      </div>
    `;

    const post = extractPost(document.querySelector<HTMLElement>('[data-urn]')!);
    expect(post?.isRepost).toBe(true);
  });
});
