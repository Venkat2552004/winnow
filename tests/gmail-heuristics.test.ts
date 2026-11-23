import { describe, expect, it } from 'vitest';
import { heuristicEmailClassification } from '../lib/gmail/heuristics';
import type { EmailInput } from '../lib/winnow/types';

const email = (overrides: Partial<EmailInput> = {}): EmailInput => ({
  id: 'test-email',
  from: 'sender@example.com',
  subject: 'Subject',
  snippet: 'Snippet',
  hasListUnsubscribe: false,
  receivedAt: new Date().toISOString(),
  ...overrides,
});

describe('email heuristics', () => {
  it.each([
    [
      'security_alert',
      email({ subject: 'Security alert', snippet: 'Your verification code is 123456' }),
    ],
    [
      'bank_statement',
      email({ from: 'statements@bank.com', subject: 'Your statement', snippet: 'Account summary' }),
    ],
    ['invoice', email({ subject: 'Invoice due', snippet: 'Amount due $49' })],
    ['travel', email({ subject: 'Flight confirmation', snippet: 'Your itinerary' })],
    ['legal', email({ subject: 'Terms of service update', snippet: 'Policy update' })],
    ['jobs', email({ subject: 'Job alert', snippet: 'New job: Senior Engineer' })],
    ['payment', email({ subject: 'Payment confirmation', snippet: 'Payment received' })],
    ['shopping', email({ subject: 'Order confirmed', snippet: 'Your order has shipped' })],
    ['offers', email({ subject: 'Sale ends soon', snippet: '50% off this weekend' })],
    ['signup', email({ subject: 'Welcome to Acme', snippet: 'Complete your profile' })],
    [
      'social',
      email({
        from: 'notifications@linkedin.com',
        subject: 'New follower',
        snippet: 'Jane started following you',
      }),
    ],
    [
      'newsletter',
      email({ subject: 'Weekly digest', snippet: 'This week in tech', hasListUnsubscribe: true }),
    ],
    [
      'alerts',
      email({ subject: 'Status update', snippet: 'We are monitoring the incident' }),
    ],
    ['action_required', email({ subject: 'Action required', snippet: 'Please review' })],
    [
      'personal',
      email({ from: 'friend@example.com', subject: 'Lunch', snippet: 'Are you free?' }),
    ],
  ])('classifies %s', (expected, input) => {
    expect(heuristicEmailClassification(input)?.category).toBe(expected);
  });

  it('skips disabled categories', () => {
    const offers = email({ subject: 'Sale ends soon', snippet: '50% off this weekend' });
    expect(heuristicEmailClassification(offers, ['security_alert'])).toBeNull();
    expect(heuristicEmailClassification(offers, ['newsletter'])).toBeNull();
    expect(heuristicEmailClassification(offers, ['offers'])?.category).toBe('offers');
  });

  it('does not fall back to personal when personal is disabled', () => {
    const personal = email({ from: 'friend@example.com', subject: 'Lunch' });
    expect(heuristicEmailClassification(personal, ['security_alert'])).toBeNull();
    expect(heuristicEmailClassification(personal, ['personal'])?.category).toBe('personal');
  });
});
