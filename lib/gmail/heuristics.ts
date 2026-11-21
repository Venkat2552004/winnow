import type { EmailClassification, EmailInput } from '../jev/types';

interface Rule {
  category: EmailClassification['category'];
  confidence: number;
  reason: string;
  test: (input: EmailInput) => boolean;
}

const from = (input: EmailInput): string => input.from.toLowerCase();
const subject = (input: EmailInput): string => input.subject.toLowerCase();
const haystack = (input: EmailInput): string =>
  `${input.from} ${input.subject} ${input.snippet}`.toLowerCase();

const RULES: Rule[] = [
  {
    category: 'security_alert',
    confidence: 0.92,
    reason: 'Security/verification language from a service sender',
    test: (i) =>
      /(password|passcode|verification code|verify your|two-factor|2fa|new login|sign-in attempt|suspicious|security alert|unusual activity)/.test(
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
      /(itinerary|boarding pass|flight confirmation|reservation|check-in|booking confirmation|your trip)/.test(
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
    category: 'receipt',
    confidence: 0.85,
    reason: 'Order or purchase confirmation',
    test: (i) =>
      /(order confirmed|order confirmation|your receipt|thanks for your order|has shipped|out for delivery|delivered)/.test(
        haystack(i),
      ),
  },
  {
    category: 'promotion',
    confidence: 0.8,
    reason: 'Marketing or discount language',
    test: (i) =>
      /(\d+% off|sale ends|limited time|deal of the day|black friday|cyber monday|coupon|promo code)/.test(
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
    category: 'notification',
    confidence: 0.75,
    reason: 'Automated no-reply sender',
    test: (i) => /(no-?reply|do-?not-?reply|notifications?@)/.test(from(i)),
  },
];

/**
 * Cheap, deterministic classification. Returns null when no rule fires so the
 * caller can escalate to the AI layer.
 */
export function heuristicEmailClassification(input: EmailInput): EmailClassification | null {
  for (const rule of RULES) {
    if (!rule.test(input)) continue;
    return {
      category: rule.category,
      priority: 0, // filled in by the pipeline from the category floor
      confidence: rule.confidence,
      reason: rule.reason,
      source: 'heuristic',
    };
  }

  // A human-looking sender with no bulk markers is probably personal.
  const looksHuman =
    !input.hasListUnsubscribe && !/(no-?reply|notifications?@|news@|marketing@)/.test(from(input));
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
