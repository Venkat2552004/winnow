import { describe, expect, it } from 'vitest';
import { parseListUnsubscribe, parseSender } from '../lib/gmail/unsubscribe';

describe('parseListUnsubscribe', () => {
  it('parses angle-bracket HTTPS and mailto targets', () => {
    const target = parseListUnsubscribe(
      '<https://example.com/unsub>, <mailto:unsub@example.com>',
      'List-Unsubscribe=One-Click',
    );
    expect(target).toEqual({
      https: 'https://example.com/unsub',
      mailto: 'mailto:unsub@example.com',
      oneClick: true,
    });
  });

  it('parses values without angle brackets', () => {
    const target = parseListUnsubscribe('https://example.com/unsub, mailto:unsub@example.com');
    expect(target?.https).toBe('https://example.com/unsub');
    expect(target?.mailto).toBe('mailto:unsub@example.com');
    expect(target?.oneClick).toBe(false);
  });

  it('returns null when there is no target', () => {
    expect(parseListUnsubscribe(null)).toBeNull();
    expect(parseListUnsubscribe('')).toBeNull();
    expect(parseListUnsubscribe('not a url')).toBeNull();
  });
});

describe('parseSender', () => {
  it('extracts a display name and lowercased email', () => {
    expect(parseSender('"Acme News" <News@Acme.com>')).toEqual({
      email: 'news@acme.com',
      name: 'Acme News',
    });
  });

  it('handles a bare email address', () => {
    expect(parseSender('News@Acme.com')).toEqual({
      email: 'news@acme.com',
      name: 'news@acme.com',
    });
  });
});
