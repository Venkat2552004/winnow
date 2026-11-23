import { beforeEach, describe, expect, it } from 'vitest';
import { cacheClear } from '../lib/cache';
import { classifyEmail, scorePost } from '../lib/pipeline';
import { DEFAULT_SETTINGS, type Settings } from '../lib/storage';
import type { EmailInput, PostInput } from '../lib/winnow/types';

function mockSettings(): Settings {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.jev.mock = true;
  settings.sarvam.apiKey = '';
  return settings;
}

const email = (overrides: Partial<EmailInput> = {}): EmailInput => ({
  id: `email-${Math.random()}`,
  from: 'sender@example.com',
  subject: 'Subject',
  snippet: 'Snippet',
  hasListUnsubscribe: false,
  receivedAt: new Date().toISOString(),
  ...overrides,
});

const post = (text: string, overrides: Partial<PostInput> = {}): PostInput => ({
  urn: `urn:li:activity:${Math.random()}`,
  author: 'Test Author',
  text,
  isRepost: false,
  hasMedia: false,
  likes: 10,
  comments: 2,
  ...overrides,
});

beforeEach(async () => {
  await cacheClear();
});

describe('classifyEmail', () => {
  it('classifies a security email and applies the priority floor', async () => {
    const result = await classifyEmail(
      email({ subject: 'Security alert', snippet: 'Your verification code is 123456' }),
      mockSettings(),
    );

    expect(result.category).toBe('security_alert');
    expect(result.priority).toBeGreaterThanOrEqual(90);
  });

  it('falls back to other for an unmatched email in mock mode', async () => {
    const result = await classifyEmail(
      email({ from: 'no-reply@example.com', subject: 'FYI', snippet: 'No action needed' }),
      mockSettings(),
    );

    expect(result.category).toBe('other');
  });

  it('respects disabled categories', async () => {
    const settings = mockSettings();
    settings.gmail.enabledCategories = ['security_alert'];

    const result = await classifyEmail(
      email({ subject: 'Sale ends soon', snippet: '50% off this weekend' }),
      settings,
    );

    expect(result.category).toBe('other');
  });
});

describe('scorePost', () => {
  it('keeps a job post', async () => {
    const result = await scorePost(
      post(
        "We're hiring a Senior Backend Engineer in Bengaluru. 5+ years with Go, Postgres, and Kubernetes. Apply here.",
      ),
      mockSettings(),
    );

    expect(result.labels[0]).toBe('job_opportunity');
    expect(result.score).toBeGreaterThanOrEqual(35);
  });

  it('blurs a hashtag-only post', async () => {
    const result = await scorePost(
      post('#engineering #tech #jobs #hiring #career #software'),
      mockSettings(),
    );

    expect(result.labels[0]).toBe('low_effort');
    expect(result.score).toBeLessThan(35);
  });

  it('falls back to other for an unmatched post in mock mode', async () => {
    const result = await scorePost(post('A short note with no clear signals.'), mockSettings());
    expect(result.labels[0]).toBe('other');
  });
});
