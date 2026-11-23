import type { EmailCategory, EmailClassification, EmailInput } from '../winnow/types';

interface Rule {
  category: EmailCategory;
  confidence: number;
  reason: string;
  test: (input: EmailInput) => boolean;
}

const from = (input: EmailInput): string => input.from.toLowerCase();
const subject = (input: EmailInput): string => input.subject.toLowerCase();
const haystack = (input: EmailInput): string =>
  `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();

/**
 * Rules run in order. The first match wins, so specific transactional signals
 * come before broad ones like "has a List-Unsubscribe header".
 */
const RULES: Rule[] = [
  {
    category: 'security_alert',
    confidence: 0.92,
    reason: 'Security or verification language',
    test: (i) =>
      /(password|passcode|verification code|one-time code|otp|verify your|two-factor|2fa|new login|sign-in attempt|suspicious|security alert|unusual activity|account locked)/.test(
        haystack(i),
      ),
  },
  {
    category: 'bank_statement',
    confidence: 0.9,
    reason: 'Statement or account-summary language from a financial sender',
    test: (i) =>
      /(bank|credit card|statement|account summary|e-statement|balance|transaction history)/.test(
        haystack(i),
      ) && /(statement|summary|e-statement)/.test(haystack(i)),
  },
  {
    category: 'invoice',
    confidence: 0.88,
    reason: 'Invoice or payment-due language',
    test: (i) =>
      /(invoice|payment due|amount due|bill is ready|pay your|autopay|billing statement)/.test(
        haystack(i),
      ),
  },
  {
    category: 'travel',
    confidence: 0.88,
    reason: 'Booking, itinerary, or reservation language',
    test: (i) =>
      /(itinerary|boarding pass|flight confirmation|reservation|check-in|booking confirmation|your trip|hotel|rental car)/.test(
        haystack(i),
      ),
  },
  {
    category: 'legal',
    confidence: 0.8,
    reason: 'Contract, insurance, or government correspondence',
    test: (i) =>
      /(contract|terms of service|policy update|insurance|tax return|irs|hmrc|legal notice|agreement)/.test(
        haystack(i),
      ),
  },
  {
    category: 'jobs',
    confidence: 0.86,
    reason: 'Job alert, recruiter, or application language',
    test: (i) =>
      /(job alert|new job|recruiter|interview|hiring|career|indeed|glassdoor|ziprecruiter|linkedin job|talent|position at|role at|opportunity at|job application|application received|application update|application status)/.test(
        haystack(i),
      ),
  },
  {
    category: 'payment',
    confidence: 0.84,
    reason: 'Payment, refund, or subscription-charge language',
    test: (i) =>
      /(payment received|payment confirmation|payment successful|receipt for your payment|autopay|refund|subscription charge|you were charged|charged to your)/.test(
        haystack(i),
      ),
  },
  {
    category: 'shopping',
    confidence: 0.85,
    reason: 'Order, shipping, or delivery language',
    test: (i) =>
      /(order confirmed|order confirmation|your receipt|thanks for your order|has shipped|out for delivery|delivered|tracking|return request|return label|return your order|start a return|your order)/.test(
        haystack(i),
      ),
  },
  {
    category: 'offers',
    confidence: 0.82,
    reason: 'Marketing, discount, or sale language',
    test: (i) =>
      /(\d+% off|sale ends|limited time|deal of the day|black friday|cyber monday|coupon|promo code|discount|save now|exclusive offer|shop now)/.test(
        haystack(i),
      ),
  },
  {
    category: 'signup',
    confidence: 0.82,
    reason: 'Welcome, onboarding, or account-activation language',
    test: (i) =>
      /(welcome to|complete your profile|getting started|onboarding|activate your account|account created|trial|sign up|registration)/.test(
        haystack(i),
      ),
  },
  {
    category: 'social',
    confidence: 0.84,
    reason: 'Social media notification or activity',
    test: (i) =>
      /(linkedin|facebook|twitter|x\.com|instagram|reddit|discord|tiktok|pinterest|snapchat|mentioned you|new follower|started following|commented|liked your|friend request|connection request|invited you|tagged you)/.test(
        haystack(i),
      ),
  },
  {
    category: 'newsletter',
    confidence: 0.8,
    reason: 'Bulk mail with a List-Unsubscribe header',
    test: (i) => i.hasListUnsubscribe,
  },
  {
    category: 'alerts',
    confidence: 0.76,
    reason: 'Automated app, service, or system notification',
    test: (i) =>
      /(notification|alert|reminder|monitoring|downtime|incident|status update|service status|usage report|quota|limit reached)/.test(
        haystack(i),
      ),
  },
  {
    category: 'action_required',
    confidence: 0.78,
    reason: 'Action or response requested',
    test: (i) =>
      /(action required|needs your attention|please review|please approve|please sign|please reply|respond by|awaiting your|your approval)/.test(
        haystack(i),
      ),
  },
];

/**
 * Cheap, deterministic classification. Returns null when no rule fires so the
 * caller can escalate to the AI layer. Disabled categories are skipped.
 */
export function heuristicEmailClassification(
  input: EmailInput,
  allowed?: readonly EmailCategory[],
): EmailClassification | null {
  const allow = (category: EmailCategory): boolean =>
    !allowed || allowed.length === 0 || allowed.includes(category);

  for (const rule of RULES) {
    if (!allow(rule.category)) continue;
    if (!rule.test(input)) continue;
    return {
      category: rule.category,
      priority: 0, // filled in by the pipeline from the category floor
      confidence: rule.confidence,
      reason: rule.reason,
      source: 'heuristic',
    };
  }

  if (!allow('personal')) return null;

  // A human-looking sender with no bulk markers is probably personal.
  const looksHuman =
    !input.hasListUnsubscribe &&
    !/(no-?reply|notifications?@|alerts?@|news@|marketing@)/.test(from(input));
  if (looksHuman && subject(input).length > 0) {
    return {
      category: 'personal',
      priority: 0,
      confidence: 0.55,
      reason: 'No bulk markers; likely personal mail',
      source: 'heuristic',
    };
  }

  return null;
}
