import type { PostInput, PostScore } from '../jev/types';
import { clamp } from '../types';

interface Signal {
  label: string;
  weight: number;
  test: (post: PostInput) => boolean;
}

const text = (post: PostInput): string => post.text.toLowerCase();

const countMatches = (value: string, pattern: RegExp): number =>
  value.match(pattern)?.length ?? 0;

const SIGNALS: Signal[] = [
  {
    label: 'engagement_bait',
    weight: 20,
    test: (p) =>
      /(agree\?|thoughts\?|who else|tag someone|comment (yes|below|your)|dm me|drop a|follow for more|repost if|like if|share if)/.test(
        text(p),
      ),
  },
  {
    label: 'question_bait',
    weight: 12,
    test: (p) =>
      /(what do you think|am i wrong|change my mind|unpopular opinion|hot take|tell me why)/.test(
        text(p),
      ),
  },
  {
    label: 'hype',
    weight: 16,
    test: (p) =>
      /(thrilled to announce|humbled|blessed|game[- ]changer|excited to share|so proud to|what an honor|🚀|🙏)/.test(
        text(p),
      ),
  },
  {
    label: 'promotional',
    weight: 18,
    test: (p) =>
      /(link in (the )?comments|sign up|register now|webinar|limited time|book a (free )?call|free guide|download the|join my|buy now|discount code)/.test(
        text(p),
      ),
  },
  {
    label: 'self_promo',
    weight: 10,
    test: (p) =>
      /(i('| a)?m (excited|thrilled|proud)|my (new|latest)|we('| a)?re (launching|hiring)|i just (launched|shipped|published))/.test(
        text(p),
      ),
  },
  {
    label: 'crypto_hype',
    weight: 12,
    test: (p) => /(crypto|web3|nft|blockchain|defi|tokenomics|airdrop)/.test(text(p)),
  },
  {
    label: 'ai_hype',
    weight: 10,
    test: (p) =>
      /(ai will|ai is (changing|taking)|10x|revolutioni[sz]e|disrupt|superintelligence|agi)/.test(
        text(p),
      ),
  },
  {
    label: 'motivational',
    weight: 8,
    test: (p) =>
      /(mindset|grind|hustle|never give up|believe in yourself|dream big|success is|failure is)/.test(
        text(p),
      ),
  },
  {
    label: 'hashtag_spam',
    weight: 12,
    test: (p) => countMatches(p.text, /#\w+/g) > 5,
  },
  {
    label: 'link_dump',
    weight: 6,
    test: (p) =>
      countMatches(p.text, /https?:\/\//g) >= 2 ||
      /(read more|full article|link in (the )?comments)/.test(text(p)),
  },
  {
    label: 'emoji_spam',
    weight: 6,
    test: (p) =>
      countMatches(p.text, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) > 5,
  },
  {
    label: 'all_caps',
    weight: 6,
    test: (p) => {
      const letters = p.text.replace(/[^a-z]/gi, '');
      if (letters.length < 40) return false;
      const upper = p.text.replace(/[^A-Z]/g, '').length;
      return upper / letters.length > 0.3;
    },
  },
  {
    label: 'repost',
    weight: 8,
    test: (p) => p.isRepost,
  },
  {
    label: 'thin_content',
    weight: 10,
    test: (p) => p.text.trim().length < 80,
  },
  {
    label: 'viral_slop',
    weight: 10,
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
  const score = clamp(78 - penalty, 0, 100);
  const strongest = Math.max(...matched.map((signal) => signal.weight));
  const confidence =
    matched.length >= 3 ? 0.9 : matched.length === 2 ? 0.82 : strongest >= 18 ? 0.7 : 0.55;

  return {
    score,
    confidence,
    labels: matched.map((signal) => signal.label),
    reason: `Matched: ${matched.map((signal) => signal.label).join(', ')}`,
    source: 'heuristic',
  };
}
