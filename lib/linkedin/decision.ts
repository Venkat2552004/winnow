import type { PostScore } from '../winnow/types';
import { isPostType, type PostType } from './taxonomy';

export interface LinkedInBlurConfig {
  threshold: number;
  blurCategories: readonly string[];
  keepCategories: readonly string[];
}

/** Why a post ended up blurred, or why it was kept. */
export type BlurCause = 'category' | 'score' | 'keep';

export type BlurDecision =
  | { blur: true; cause: 'category' | 'score'; type: PostType }
  | { blur: false; cause: 'keep'; type: PostType };

/** The post type drives the override lists; unknown labels fall back to Other. */
export function postTypeOf(score: PostScore): PostType {
  const [first] = score.labels;
  return isPostType(first) ? first : 'other';
}

/**
 * Keep wins over blur. Types in neither list fall back to the score threshold,
 * which preserves the original threshold-only behavior.
 */
export function decidePost(score: PostScore, config: LinkedInBlurConfig): BlurDecision {
  const type = postTypeOf(score);
  if (config.keepCategories.includes(type)) return { blur: false, cause: 'keep', type };
  if (config.blurCategories.includes(type)) return { blur: true, cause: 'category', type };
  return score.score < config.threshold
    ? { blur: true, cause: 'score', type }
    : { blur: false, cause: 'keep', type };
}

export function shouldBlurPost(score: PostScore, config: LinkedInBlurConfig): boolean {
  return decidePost(score, config).blur;
}
