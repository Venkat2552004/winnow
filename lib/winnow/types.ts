export type EmailCategory =
  | 'security_alert'
  | 'bank_statement'
  | 'invoice'
  | 'travel'
  | 'legal'
  | 'action_required'
  | 'jobs'
  | 'personal'
  | 'payment'
  | 'shopping'
  | 'offers'
  | 'signup'
  | 'social'
  | 'alerts'
  | 'newsletter'
  | 'other';

export type ClassificationSource = 'jev' | 'roar' | 'sarvam' | 'heuristic' | 'mock' | 'error';

/** Every category in display order. */
export const ALL_CATEGORIES: readonly EmailCategory[] = [
  'security_alert',
  'bank_statement',
  'invoice',
  'travel',
  'legal',
  'action_required',
  'jobs',
  'personal',
  'payment',
  'shopping',
  'offers',
  'signup',
  'social',
  'alerts',
  'newsletter',
  'other',
];

/** Categories that must never be auto-archived and always get a priority floor. */
export const IMPORTANT_CATEGORIES: readonly EmailCategory[] = [
  'security_alert',
  'bank_statement',
  'invoice',
  'travel',
  'legal',
  'action_required',
  'jobs',
  'personal',
];

export const CATEGORY_PRIORITY_FLOOR: Record<EmailCategory, number> = {
  security_alert: 90,
  bank_statement: 85,
  invoice: 80,
  travel: 75,
  legal: 75,
  action_required: 70,
  jobs: 65,
  personal: 60,
  payment: 55,
  signup: 50,
  shopping: 45,
  alerts: 35,
  social: 30,
  other: 30,
  newsletter: 20,
  offers: 10,
};

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  security_alert: 'Security',
  bank_statement: 'Bank statement',
  invoice: 'Invoice',
  travel: 'Travel',
  legal: 'Legal',
  action_required: 'Action required',
  jobs: 'Jobs',
  personal: 'Personal',
  payment: 'Payment',
  shopping: 'Shopping',
  offers: 'Offers',
  signup: 'Signup',
  social: 'Social',
  alerts: 'Alerts',
  newsletter: 'Newsletter',
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
  jobs: 'Jobs',
  personal: 'Personal',
  payment: 'Payment',
  shopping: 'Shopping',
  offers: 'Offers',
  signup: 'Signup',
  social: 'Social',
  alerts: 'Alerts',
  newsletter: 'News',
  other: 'Other',
};

/** Relative Gmail label path for each category. */
export const CATEGORY_LABEL_PATH: Record<EmailCategory, string> = {
  security_alert: 'Security',
  bank_statement: 'Finance/Bank',
  invoice: 'Finance/Invoices',
  travel: 'Travel',
  legal: 'Legal',
  action_required: 'Action',
  jobs: 'Jobs',
  personal: 'Personal',
  payment: 'Finance/Payments',
  shopping: 'Shopping',
  offers: 'Offers',
  signup: 'Signups',
  social: 'Social',
  alerts: 'Alerts',
  newsletter: 'Newsletters',
  other: 'Other',
};

export const PRIORITY_LABEL_PATH = 'Priority';

export function normalizeLabelPrefix(prefix: string): string {
  return prefix.trim().replace(/^\/+|\/+$/g, '');
}

/** Builds the Gmail label name for a category, optionally under a prefix. */
export function gmailLabelFor(category: EmailCategory, prefix = ''): string {
  const clean = normalizeLabelPrefix(prefix);
  const path = CATEGORY_LABEL_PATH[category];
  return clean ? `${clean}/${path}` : path;
}

export function priorityLabelFor(prefix = ''): string {
  const clean = normalizeLabelPrefix(prefix);
  return clean ? `${clean}/${PRIORITY_LABEL_PATH}` : PRIORITY_LABEL_PATH;
}

export type CategoryGroup = 'important' | 'money' | 'accounts' | 'other';

export const CATEGORY_GROUP: Record<EmailCategory, CategoryGroup> = {
  security_alert: 'important',
  bank_statement: 'important',
  invoice: 'important',
  travel: 'important',
  legal: 'important',
  action_required: 'important',
  jobs: 'important',
  personal: 'important',
  payment: 'money',
  shopping: 'money',
  offers: 'money',
  signup: 'accounts',
  social: 'accounts',
  alerts: 'accounts',
  newsletter: 'accounts',
  other: 'other',
};

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  important: 'Important',
  money: 'Money & shopping',
  accounts: 'Accounts & social',
  other: 'Other',
};

export type EmailLabelPresetId =
  | 'everyday'
  | 'founder'
  | 'job_seeker'
  | 'minimal'
  | 'inbox_zero'
  | 'custom';

export interface EmailLabelPreset {
  id: Exclude<EmailLabelPresetId, 'custom'>;
  name: string;
  description: string;
  enabledCategories: readonly EmailCategory[];
  cleanupCategories: readonly EmailCategory[];
  priorityThreshold: number;
}

export const EMAIL_LABEL_PRESETS: readonly EmailLabelPreset[] = [
  {
    id: 'everyday',
    name: 'Everyday',
    description: 'All labels, balanced priority. Good for a normal personal inbox.',
    enabledCategories: ALL_CATEGORIES,
    cleanupCategories: ['offers', 'newsletter', 'social', 'alerts', 'signup'],
    priorityThreshold: 70,
  },
  {
    id: 'founder',
    name: 'Founder / operator',
    description: 'All labels, with jobs, signups, and finance surfaced earlier.',
    enabledCategories: ALL_CATEGORIES,
    cleanupCategories: ['offers', 'newsletter', 'social', 'shopping'],
    priorityThreshold: 50,
  },
  {
    id: 'job_seeker',
    name: 'Job seeker',
    description: 'Focus on jobs, recruiters, signups, and alerts.',
    enabledCategories: [
      'security_alert',
      'bank_statement',
      'invoice',
      'travel',
      'legal',
      'action_required',
      'jobs',
      'personal',
      'signup',
      'alerts',
      'other',
    ],
    cleanupCategories: ['signup', 'alerts'],
    priorityThreshold: 50,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Only the labels that usually need attention.',
    enabledCategories: [
      'security_alert',
      'bank_statement',
      'invoice',
      'action_required',
      'jobs',
      'personal',
      'other',
    ],
    cleanupCategories: ['other'],
    priorityThreshold: 70,
  },
  {
    id: 'inbox_zero',
    name: 'Inbox zero',
    description: 'All labels, with aggressive cleanup for low-value mail.',
    enabledCategories: ALL_CATEGORIES,
    cleanupCategories: ['offers', 'newsletter', 'social', 'alerts', 'signup', 'shopping', 'other'],
    priorityThreshold: 70,
  },
];

export const DEFAULT_ENABLED_CATEGORIES: readonly EmailCategory[] = ALL_CATEGORIES;
export const DEFAULT_CLEANUP_CATEGORIES: readonly EmailCategory[] = [
  'offers',
  'newsletter',
  'social',
  'alerts',
  'signup',
];

export interface EmailInput {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  hasListUnsubscribe: boolean;
  receivedAt: string;
}

export interface ClassifyOptions {
  /** Categories the user has enabled. Empty means no restriction. */
  categories?: readonly EmailCategory[];
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

/**
 * Picks a valid category, respecting the user's enabled set. When the model
 * returns a disabled category, fall back to Other. If Other is disabled too,
 * the organizer simply leaves the message unlabeled.
 */
export function resolveEmailCategory(
  value: unknown,
  allowed?: readonly EmailCategory[],
): EmailCategory {
  if (isEmailCategory(value)) {
    if (!allowed || allowed.length === 0 || allowed.includes(value)) return value;
  }
  return 'other';
}
