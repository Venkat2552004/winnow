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
