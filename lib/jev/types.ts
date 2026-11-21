export type EmailCategory =
  | 'action_required'
  | 'personal'
  | 'bank_statement'
  | 'invoice'
  | 'receipt'
  | 'security_alert'
  | 'travel'
  | 'legal'
  | 'newsletter'
  | 'notification'
  | 'promotion'
  | 'other';

export type ClassificationSource = 'jev' | 'roar' | 'sarvam' | 'heuristic' | 'mock' | 'error';

/** Categories that must never be auto-archived and always get a priority floor. */
export const IMPORTANT_CATEGORIES: readonly EmailCategory[] = [
  'security_alert',
  'bank_statement',
  'invoice',
  'travel',
  'legal',
  'action_required',
  'personal',
];

export const CATEGORY_PRIORITY_FLOOR: Record<EmailCategory, number> = {
  security_alert: 90,
  bank_statement: 85,
  invoice: 80,
  travel: 75,
  legal: 75,
  action_required: 70,
  personal: 60,
  receipt: 40,
  notification: 30,
  newsletter: 20,
  promotion: 10,
  other: 30,
};

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  security_alert: 'Security',
  bank_statement: 'Bank statement',
  invoice: 'Invoice',
  travel: 'Travel',
  legal: 'Legal',
  action_required: 'Action required',
  personal: 'Personal',
  receipt: 'Receipt',
  notification: 'Notification',
  newsletter: 'Newsletter',
  promotion: 'Promotion',
  other: 'Other',
};

/** Compact labels for narrow surfaces like the popup. */
export const CATEGORY_SHORT: Record<EmailCategory, string> = {
  security_alert: 'Security',
  bank_statement: 'Bank',
  invoice: 'Invoice',
  travel: 'Travel',
  legal: 'Legal',
  action_required: 'Action',
  personal: 'Personal',
  receipt: 'Receipt',
  notification: 'Notice',
  newsletter: 'News',
  promotion: 'Promo',
  other: 'Other',
};

/** Gmail label path for each category. Nested paths create nested labels. */
export const CATEGORY_GMAIL_LABEL: Record<EmailCategory, string> = {
  security_alert: 'Jev/Security',
  bank_statement: 'Jev/Finance/Bank',
  invoice: 'Jev/Finance/Receipts',
  receipt: 'Jev/Finance/Receipts',
  travel: 'Jev/Travel',
  legal: 'Jev/Legal',
  action_required: 'Jev/Action',
  personal: 'Jev/Personal',
  notification: 'Jev/Notifications',
  newsletter: 'Jev/Newsletter',
  promotion: 'Jev/Promotions',
  other: 'Jev/Other',
};

export const PRIORITY_LABEL = 'Jev/Priority';

export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  hasListUnsubscribe: boolean;
  receivedAt: string;
}

export interface EmailClassification {
  category: EmailCategory;
  /** 0-100. */
  priority: number;
  /** 0-1. */
  confidence: number;
  reason: string;
  source: ClassificationSource;
}

export interface PostInput {
  urn: string;
  author: string;
  text: string;
  isRepost: boolean;
  hasMedia: boolean;
  likes: number;
  comments: number;
}

export interface PostScore {
  /** 0-100 value score. */
  score: number;
  /** 0-1. */
  confidence: number;
  labels: string[];
  reason: string;
  source: ClassificationSource;
}

export function isEmailCategory(value: unknown): value is EmailCategory {
  return typeof value === 'string' && value in CATEGORY_PRIORITY_FLOOR;
}
