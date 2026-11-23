import { describe, expect, it } from 'vitest';
import { heuristicPostScore } from '../lib/linkedin/heuristics';
import type { PostInput } from '../lib/winnow/types';

const post = (text: string, overrides: Partial<PostInput> = {}): PostInput => ({
  urn: 'urn:li:activity:1',
  author: 'Test Author',
  text,
  isRepost: false,
  hasMedia: false,
  likes: 10,
  comments: 2,
  ...overrides,
});

describe('LinkedIn heuristics', () => {
  it.each([
    [
      'job_opportunity',
      "We're hiring a Senior Backend Engineer in Bengaluru. 5+ years with Go, Postgres, and Kubernetes. Apply here.",
    ],
    [
      'technical_breakdown',
      'We migrated 40 services from a monolith to Postgres 17. P99 latency dropped from 800ms to 120ms. Here is the migration plan and rollback steps.',
    ],
    [
      'actionable_advice',
      'How to run a better incident review: 1) Write a timeline. 2) Separate trigger from root cause. 3) Assign one owner per action item.',
    ],
    ['resource', 'Free template: https://example.com/template'],
    ['self_improvement', 'Career advice: improve your communication and leadership'],
    [
      'case_study',
      'We tried a new onboarding flow and got 20% more conversions. Here is what we learned.',
    ],
    [
      'industry_insight',
      'The market is shifting. Our survey of 500 companies shows a clear trend.',
    ],
    [
      'personal_lesson',
      'I failed my first startup. Here is the lesson I learned about hiring.',
    ],
    [
      'substantive_discussion',
      'What do you think about remote work? I have been working remotely for five years and have seen teams struggle with communication and trust. I would love to hear how other teams handle async communication and build trust across time zones.',
    ],
    [
      'achievement',
      "I'm thrilled to announce that I've been promoted to Senior Engineering Manager at Acme. So grateful to my team.",
    ],
    [
      'generic_story',
      'I was rejected 100 times before I got my first job. I kept going. Never give up on your dreams.',
    ],
    [
      'advertisement',
      'Introducing our new AI-powered analytics platform. Book a demo today and get 20% off your first year. Limited time offer.',
    ],
    [
      'engagement_bait',
      'Comment YES if you agree! Tag someone who needs to see this.',
    ],
    ['humor_meme', "When the recruiter says we're like a family 😂😂"],
    ['off_topic', 'India vs Australia cricket match was a thriller. Sports at its best.'],
    ['low_effort', '#engineering #tech #jobs #hiring #career #software'],
  ])('classifies %s', (expected, text) => {
    const result = heuristicPostScore(post(text));
    expect(result?.labels[0]).toBe(expected);
  });

  it('keeps high-value posts above the default threshold', () => {
    const result = heuristicPostScore(
      post(
        'We migrated 40 services from a monolith to Postgres 17. P99 latency dropped from 800ms to 120ms. Here is the migration plan and rollback steps.',
      ),
    );
    expect(result?.score).toBeGreaterThanOrEqual(35);
  });

  it('blurs low-value posts below the default threshold', () => {
    const result = heuristicPostScore(post('#engineering #tech #jobs #hiring #career #software'));
    expect(result?.score).toBeLessThan(35);
  });

  it('does not penalize a substantive post for using hashtags', () => {
    const result = heuristicPostScore(
      post(
        'We migrated 40 services to Postgres 17. P99 latency dropped from 800ms to 120ms. #engineering #postgres #database',
      ),
    );
    expect(result?.labels[0]).toBe('technical_breakdown');
    expect(result?.score).toBeGreaterThanOrEqual(35);
  });

  it('treats a short one-liner as low effort', () => {
    const result = heuristicPostScore(post('Thoughts?'));
    expect(result?.labels[0]).toBe('low_effort');
    expect(result?.score).toBeLessThan(35);
  });
});
