import type { UnsubscribeResult } from './types';

export interface UnsubscribeTarget {
  https: string | null;
  mailto: string | null;
  oneClick: boolean;
}

const ANGLE_URL = /<([^>]+)>/g;

/**
 * Parses `List-Unsubscribe` (and `List-Unsubscribe-Post`) into actionable
 * targets. Senders usually wrap URLs in angle brackets, but some omit them.
 */
export function parseListUnsubscribe(
  header: string | null | undefined,
  postHeader?: string | null,
): UnsubscribeTarget | null {
  if (!header) return null;

  const values: string[] = [];
  for (const match of header.matchAll(ANGLE_URL)) {
    const value = match[1]?.trim();
    if (value) values.push(value);
  }
  if (values.length === 0) {
    for (const part of header.split(',')) {
      const value = part.trim();
      if (value) values.push(value);
    }
  }

  const https = values.find((value) => /^https?:\/\//i.test(value)) ?? null;
  const mailto = values.find((value) => /^mailto:/i.test(value)) ?? null;
  if (!https && !mailto) return null;

  return {
    https,
    mailto,
    oneClick: /list-unsubscribe\s*=\s*one-click/i.test(postHeader ?? ''),
  };
}

/** Extracts the address and display name from a From header. */
export function parseSender(from: string): { email: string; name: string } {
  const angled = from.match(/^(.*?)<([^>]+)>/);
  if (angled) {
    const name = (angled[1] ?? '').trim().replace(/^"|"$/g, '');
    const email = (angled[2] ?? '').trim();
    return { email: email.toLowerCase(), name: name || email };
  }
  const email = from.trim().toLowerCase();
  return { email, name: email };
}

/**
 * Performs the unsubscribe. RFC 8058 one-click POSTs are sent directly with a
 * no-cors request (the response is opaque, but the request reaches the server).
 * Otherwise the link is opened in a background tab for the user to confirm.
 */
export async function performUnsubscribe(target: UnsubscribeTarget): Promise<UnsubscribeResult> {
  if (target.https && target.oneClick) {
    try {
      await fetch(target.https, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'List-Unsubscribe=One-Click',
      });
      return 'posted';
    } catch {
      // Fall through to opening the link.
    }
  }

  if (target.https) {
    await chrome.tabs.create({ url: target.https, active: false });
    return 'opened';
  }

  if (target.mailto) {
    await chrome.tabs.create({ url: target.mailto });
    return 'mailto';
  }

  return 'none';
}
