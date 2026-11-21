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
