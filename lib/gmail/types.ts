import type { EmailCategory, EmailClassification } from '../jev/types';

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  labelIds: string[];
  hasListUnsubscribe: boolean;
  /** Raw List-Unsubscribe header value, when present. */
  listUnsubscribe: string | null;
  /** Raw List-Unsubscribe-Post header value, when present. */
  listUnsubscribePost: string | null;
}

export interface GmailLabel {
  id: string;
  name: string;
}

export interface GmailStatus {
  connected: boolean;
  email: string | null;
  clientIdConfigured: boolean;
}

export interface OrganizeRow {
  message: GmailMessageMeta;
  classification: EmailClassification;
  labelNames: string[];
}

export interface OrganizeSummary {
  labeled: number;
  skipped: number;
  total: number;
}

export interface PriorityEntry {
  id: string;
  subject: string;
  from: string;
  date: string;
  category: EmailCategory;
  priority: number;
  reason: string;
  at: number;
}

export interface UnsubscribeSender {
  /** Lowercased sender address. */
  email: string;
  name: string;
  count: number;
  sampleSubject: string;
  https: string | null;
  mailto: string | null;
  oneClick: boolean;
  messageIds: string[];
}

export type UnsubscribeResult = 'posted' | 'opened' | 'mailto' | 'none';

export interface CleanupCandidate {
  id: string;
  subject: string;
  from: string;
  date: string;
  category: EmailCategory;
  priority: number;
}

export interface CleanupPreview {
  candidates: CleanupCandidate[];
  total: number;
  olderThanDays: number;
}

export type CleanupMode = 'archive' | 'trash';
