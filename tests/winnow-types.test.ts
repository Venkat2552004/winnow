import { describe, expect, it } from 'vitest';
import { normalizePostLabels } from '../lib/linkedin/taxonomy';
import {
  EMAIL_LABEL_PRESETS,
  gmailLabelFor,
  priorityLabelFor,
  resolveEmailCategory,
} from '../lib/winnow/types';

describe('email label helpers', () => {
  it('builds flat labels by default', () => {
    expect(gmailLabelFor('security_alert')).toBe('Security');
    expect(gmailLabelFor('bank_statement')).toBe('Finance/Bank');
    expect(gmailLabelFor('offers')).toBe('Offers');
    expect(priorityLabelFor()).toBe('Priority');
  });

  it('builds prefixed labels and normalizes slashes', () => {
    expect(gmailLabelFor('offers', 'Winnow')).toBe('Winnow/Offers');
    expect(gmailLabelFor('offers', '/Winnow/')).toBe('Winnow/Offers');
    expect(priorityLabelFor('Winnow/')).toBe('Winnow/Priority');
  });

  it('resolves disabled categories to other', () => {
    expect(resolveEmailCategory('offers', ['security_alert', 'other'])).toBe('other');
    expect(resolveEmailCategory('offers', ['security_alert'])).toBe('other');
    expect(resolveEmailCategory('offers', ['offers'])).toBe('offers');
    expect(resolveEmailCategory('not-a-category', ['offers'])).toBe('other');
  });

  it('ships five presets', () => {
    expect(EMAIL_LABEL_PRESETS.map((preset) => preset.id)).toEqual([
      'everyday',
      'founder',
      'job_seeker',
      'minimal',
      'inbox_zero',
    ]);
  });

  it('keeps preset cleanup categories inside the enabled set', () => {
    for (const preset of EMAIL_LABEL_PRESETS) {
      for (const category of preset.cleanupCategories) {
        expect(preset.enabledCategories).toContain(category);
      }
    }
  });
});

describe('post label normalization', () => {
  it('puts the post type first', () => {
    expect(normalizePostLabels(['specific_details', 'job_opportunity'])).toEqual([
      'job_opportunity',
      'specific_details',
    ]);
  });

  it('falls back to other when no type is present', () => {
    expect(normalizePostLabels(['unknown'])).toEqual(['other', 'unknown']);
    expect(normalizePostLabels(undefined)).toEqual(['other']);
  });
});
