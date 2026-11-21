import type { GmailLabel, GmailMessageMeta } from './types';

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GmailApiError(
      response.status,
      `Gmail API ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

interface MessageListResponse {
  messages?: Array<{ id: string }>;
  nextPageToken?: string;
}

export async function listMessageIds(
  token: string,
  query: string,
  max: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < max) {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(100, max - ids.length)),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const page = await request<MessageListResponse>(token, `/messages?${params.toString()}`);
    for (const message of page.messages ?? []) ids.push(message.id);

    if (!page.nextPageToken || (page.messages ?? []).length === 0) break;
    pageToken = page.nextPageToken;
  }

  return ids.slice(0, max);
}

interface RawMessage {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  payload?: { headers?: Array<{ name: string; value: string }> };
}

const METADATA_HEADERS = [
  'From',
  'Subject',
  'Date',
  'List-Unsubscribe',
  'List-Unsubscribe-Post',
];

export async function getMessageMeta(token: string, id: string): Promise<GmailMessageMeta> {
  const params = new URLSearchParams({ format: 'metadata' });
  for (const header of METADATA_HEADERS) params.append('metadataHeaders', header);

  const raw = await request<RawMessage>(token, `/messages/${id}?${params.toString()}`);
  const headers = new Map(
    (raw.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]),
  );

  return {
    id: raw.id,
    threadId: raw.threadId,
    from: headers.get('from') ?? '',
    subject: headers.get('subject') ?? '(no subject)',
    date: headers.get('date') ?? '',
    snippet: raw.snippet ?? '',
    labelIds: raw.labelIds ?? [],
    hasListUnsubscribe: headers.has('list-unsubscribe'),
  };
}

export async function listLabels(token: string): Promise<GmailLabel[]> {
  const data = await request<{ labels?: GmailLabel[] }>(token, '/labels');
  return data.labels ?? [];
}

export async function createLabel(token: string, name: string): Promise<GmailLabel> {
  try {
    return await request<GmailLabel>(token, '/labels', {
      method: 'POST',
      body: JSON.stringify({
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }),
    });
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 409) {
      const existing = (await listLabels(token)).find((label) => label.name === name);
      if (existing) return existing;
    }
    throw error;
  }
}

export async function batchModify(
  token: string,
  ids: string[],
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await request(token, '/messages/batchModify', {
    method: 'POST',
    body: JSON.stringify({ ids, addLabelIds, removeLabelIds }),
  });
}
