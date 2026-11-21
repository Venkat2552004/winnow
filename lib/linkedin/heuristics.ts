import type { PostInput, PostScore } from '../jev/types';
import { clamp } from '../types';

interface Signal {
  label: string;
  weight: number;
  test: (post: PostInput) => boolean;
}

const text = (post: PostInput): string => post.text.toLowerCase();

const SIGNALS: Signal[] = [
  {
    label: 'engagement_bait',
    weight: 22,
    test: (p) =>
      /(agree\?|thoughts\?|who else|tag someone|comment (yes|below|your)|dm me|drop a|follow for more|repost if)/.test(
        text(p),
      ),
  },
  {
    label: 'hype',
    weight: 18,
    test: (p) =>
      /(thrilled to announce|humbled|blessed|game[- ]changer|excited to share|so proud to|what an honor|🚀|🙏)/.test(
        text(p),
      ),
  },
  {
    label: 'promotional',
    weight: 20,
    test: (p) =>
      /(link in (the )?comments|sign up|register now|webinar|limited time|book a (free )?call|free guide|download the|join my)/.test(
        text(p),
      ),
  },
  {
    label: 'hashtag_spam',
    weight: 14,
    test: (p) => (p.text.match(/#\w+/g)?.length ?? 0) > 5,
  },
  {
    label: 'repost',
    weight: 10,
    test: (p) => p.isRepost,
  },
  {
    label: 'thin_content',
    weight: 12,
    test: (p) => p.text.trim().length < 80,
  },
  {
    label: 'viral_slop',
    weight: 12,
    test: (p) => p.likes > 500 && p.comments < p.likes * 0.02,
  },
];

/**
 * Deterministic pre-filter. High confidence means "resolve locally"; low
 * confidence means "ask Jev". Returns null when there is nothing to go on.
 */
export function heuristicPostScore(post: PostInput): PostScore | null {
  const matched = SIGNALS.filter((signal) => signal.test(post));
  if (matched.length === 0) return null;

  const penalty = matched.reduce((sum, signal) => sum + signal.weight, 0);
  const score = clamp(70 - penalty, 0, 100);
  const confidence = matched.length >= 2 ? 0.85 : 0.6;

  return {
    score,
    confidence,
    labels: matched.map((signal) => signal.label),
    reason: `Matched: ${matched.map((signal) => signal.label).join(', ')}`,
    source: 'heuristic',
  };
}
