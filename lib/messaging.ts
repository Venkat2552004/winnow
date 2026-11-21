import type { GmailMessageMeta, GmailStatus } from './gmail/types';
import type { EmailClassification, EmailInput, PostInput, PostScore } from './jev/types';
import type { Settings } from './storage';
import type { DeepPartial } from './types';

export type Request =
  | { type: 'ping' }
  | { type: 'settings:get' }
  | { type: 'settings:update'; patch: DeepPartial<Settings> }
  | { type: 'jev:classifyEmail'; input: EmailInput }
  | { type: 'jev:scorePost'; input: PostInput }
  | { type: 'cache:clear' }
  | { type: 'gmail:status' }
  | { type: 'gmail:connect' }
  | { type: 'gmail:disconnect' }
  | { type: 'gmail:recent'; limit?: number };

export interface ResponseMap {
  ping: { version: string; mode: 'mock' | 'live' };
  'settings:get': Settings;
  'settings:update': Settings;
  'jev:classifyEmail': EmailClassification;
  'jev:scorePost': PostScore;
  'cache:clear': { cleared: true };
  'gmail:status': GmailStatus;
  'gmail:connect': { email: string | null };
  'gmail:disconnect': { ok: true };
  'gmail:recent': { messages: GmailMessageMeta[] };
}

export type RequestType = Request['type'];
export type ResponseFor<K extends RequestType> = ResponseMap[K];

export type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

export type Handlers = {
  [K in RequestType]: (request: Extract<Request, { type: K }>) => Promise<ResponseFor<K>>;
};

export async function sendMessage<K extends RequestType>(
  request: Extract<Request, { type: K }>,
): Promise<ResponseFor<K>> {
  const response = (await chrome.runtime.sendMessage(request)) as Envelope<ResponseFor<K>> | undefined;
  if (!response) throw new Error('No response from the Jev background worker');
  if (!response.ok) throw new Error(response.error);
  return response.data;
}
