import { describe, expect, it } from 'vitest';
import {
  decidePost,
  postTypeOf,
  shouldBlurPost,
  type LinkedInBlurConfig,
} from '../lib/linkedin/decision';
import {
  LINKEDIN_PRESETS,
  LOW_VALUE_POST_TYPES,
  VALUE_POST_TYPES,
  type PostType,
} from '../lib/linkedin/taxonomy';
import type { PostScore } from '../lib/winnow/types';

function scored(type: string, value: number): PostScore {
  return {
    score: value,
    confidence: 1,
    labels: [type],
    reason: '',
    source: 'heuristic',
  };
}

const config: LinkedInBlurConfig = {
  threshold: 35,
  blurCategories: ['advertisement', 'low_effort'],
  keepCategories: ['resource', 'job_opportunity'],
};

describe('postTypeOf', () => {
  it('returns the leading post type', () => {
    expect(postTypeOf(scored('resource', 80))).toBe('resource');
  });

  it('falls back to other for unknown or missing labels', () => {
    expect(postTypeOf(scored('unknown', 80))).toBe('other');
    expect(postTypeOf({ ...scored('', 80), labels: [] })).toBe('other');
  });
});

describe('shouldBlurPost', () => {
  it('always keeps types on the keep list, even at score 0', () => {
    expect(shouldBlurPost(scored('resource', 0), config)).toBe(false);
    expect(shouldBlurPost(scored('job_opportunity', 0), config)).toBe(false);
  });

  it('always blurs types on the blur list, even at score 100', () => {
    expect(shouldBlurPost(scored('advertisement', 100), config)).toBe(true);
    expect(shouldBlurPost(scored('low_effort', 100), config)).toBe(true);
  });

  it('falls back to the threshold for types in neither list', () => {
    expect(shouldBlurPost(scored('other', 34), config)).toBe(true);
    expect(shouldBlurPost(scored('other', 35), config)).toBe(false);
    expect(shouldBlurPost(scored('other', 90), config)).toBe(false);
  });

  it('treats an unknown type like other', () => {
    expect(shouldBlurPost(scored('mystery', 10), config)).toBe(true);
    expect(shouldBlurPost(scored('mystery', 80), config)).toBe(false);
  });

  it('lets keep win when a type is in both lists', () => {
    expect(
      shouldBlurPost(scored('advertisement', 100), {
        threshold: 35,
        blurCategories: ['advertisement'],
        keepCategories: ['advertisement'],
      }),
    ).toBe(false);
  });
});

describe('decidePost', () => {
  it('reports a category override separately from a score blur', () => {
    expect(decidePost(scored('advertisement', 95), config)).toEqual({
      blur: true,
      cause: 'category',
      type: 'advertisement',
    });
    expect(decidePost(scored('other', 10), config)).toEqual({
      blur: true,
      cause: 'score',
      type: 'other',
    });
  });

  it('reports keep for kept and high-scoring unlisted types', () => {
    expect(decidePost(scored('resource', 5), config)).toMatchObject({
      blur: false,
      cause: 'keep',
    });
    expect(decidePost(scored('other', 80), config)).toMatchObject({
      blur: false,
      cause: 'keep',
    });
  });
});

describe('presets', () => {
  it('never overlap blur and keep', () => {
    for (const preset of LINKEDIN_PRESETS) {
      const overlap = preset.blurCategories.filter((type) =>
        preset.keepCategories.includes(type),
      );
      expect(overlap, preset.id).toEqual([]);
    }
  });

  it('balanced matches the default keep and blur lists', () => {
    const balanced = LINKEDIN_PRESETS.find((preset) => preset.id === 'balanced');
    expect(balanced).toBeDefined();
    expect([...(balanced?.blurCategories ?? [])]).toEqual([...LOW_VALUE_POST_TYPES]);
    expect([...(balanced?.keepCategories ?? [])]).toEqual([...VALUE_POST_TYPES]);
  });

  it('preserves the default blur decision at threshold 35', () => {
    const balanced = LINKEDIN_PRESETS.find((preset) => preset.id === 'balanced');
    if (!balanced) throw new Error('balanced preset missing');
    const configForPreset: LinkedInBlurConfig = {
      threshold: balanced.threshold,
      blurCategories: balanced.blurCategories,
      keepCategories: balanced.keepCategories,
    };

    for (const type of LOW_VALUE_POST_TYPES as readonly PostType[]) {
      expect(shouldBlurPost(scored(type, 50), configForPreset), type).toBe(true);
    }
    for (const type of VALUE_POST_TYPES as readonly PostType[]) {
      expect(shouldBlurPost(scored(type, 20), configForPreset), type).toBe(false);
    }
  });
});
