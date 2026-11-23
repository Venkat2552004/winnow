/**
 * LinkedIn post taxonomy for Winnow's value filter.
 *
 * The goal is not to describe every format LinkedIn supports, but to separate
 * posts a busy professional can use from posts that consume time without
 * returning anything: ads, achievements without a lesson, generic stories,
 * engagement bait, memes, off-topic posts, and low-effort updates.
 */

export type PostType =
  | 'job_opportunity'
  | 'technical_breakdown'
  | 'actionable_advice'
  | 'self_improvement'
  | 'resource'
  | 'industry_insight'
  | 'case_study'
  | 'personal_lesson'
  | 'substantive_discussion'
  | 'achievement'
  | 'generic_story'
  | 'advertisement'
  | 'engagement_bait'
  | 'humor_meme'
  | 'off_topic'
  | 'low_effort'
  | 'other';

export const POST_TYPES: readonly PostType[] = [
  'job_opportunity',
  'technical_breakdown',
  'actionable_advice',
  'self_improvement',
  'resource',
  'industry_insight',
  'case_study',
  'personal_lesson',
  'substantive_discussion',
  'achievement',
  'generic_story',
  'advertisement',
  'engagement_bait',
  'humor_meme',
  'off_topic',
  'low_effort',
  'other',
];

export const POST_TYPE_LABEL: Record<PostType, string> = {
  job_opportunity: 'Job opportunity',
  technical_breakdown: 'Technical breakdown',
  actionable_advice: 'Actionable advice',
  self_improvement: 'Self-improvement',
  resource: 'Resource',
  industry_insight: 'Industry insight',
  case_study: 'Case study',
  personal_lesson: 'Personal lesson',
  substantive_discussion: 'Substantive discussion',
  achievement: 'Achievement',
  generic_story: 'Generic story',
  advertisement: 'Advertisement',
  engagement_bait: 'Engagement bait',
  humor_meme: 'Humor / meme',
  off_topic: 'Off-topic',
  low_effort: 'Low effort',
  other: 'Other',
};

/** Descriptions are sent to the evaluation model as choice criteria. */
export const POST_TYPE_DESCRIPTION: Record<PostType, string> = {
  job_opportunity:
    'A job posting, referral request, open role, recruiter outreach, or hiring announcement with enough detail to act on',
  technical_breakdown:
    'A project, engineering, or technical deep dive with concrete details: architecture, code, tools, metrics, tradeoffs, or a build log',
  actionable_advice:
    'A how-to, framework, checklist, or specific suggestion the reader can apply to improve their work',
  self_improvement:
    'Career growth, productivity, leadership, or habit advice with actionable substance, not just motivation',
  resource:
    'A useful tool, template, guide, dataset, course, or curated list the reader can use',
  industry_insight:
    'Specific industry news, market analysis, or trend commentary with evidence or a clear point of view',
  case_study:
    'A situation → decision → result → lesson story with concrete outcomes or numbers',
  personal_lesson:
    'A personal story that ends with a clear, transferable professional lesson',
  substantive_discussion:
    'A thoughtful professional question or debate that invites real discussion, not a one-line engagement prompt',
  achievement:
    'A promotion, award, milestone, certification, work anniversary, or “humbled to announce” post with no useful lesson',
  generic_story:
    'An inspirational or relatable anecdote with no concrete takeaway, numbers, or actionable lesson',
  advertisement:
    'A product, service, event, or self-promotion post whose main purpose is to sell or advertise',
  engagement_bait:
    'A post that explicitly asks for likes, comments, shares, follows, tags, or votes to boost reach',
  humor_meme:
    'A joke, meme, funny video, or viral clip with little or no professional value',
  off_topic:
    'Politics, sports, entertainment, religion, or personal life with no professional relevance',
  low_effort:
    'A one-liner, pure hashtags, “Thoughts?”, a context-free poll, or a post with almost no text',
  other: 'Anything that does not fit the categories above',
};

/**
 * Category prior, 0-100. The model's quality rating and signals move the final
 * score around this anchor, so a vague job post still beats a polished ad.
 */
export const POST_TYPE_BASE: Record<PostType, number> = {
  job_opportunity: 85,
  technical_breakdown: 85,
  actionable_advice: 80,
  resource: 78,
  case_study: 75,
  self_improvement: 70,
  industry_insight: 70,
  personal_lesson: 60,
  substantive_discussion: 55,
  other: 35,
  achievement: 20,
  generic_story: 20,
  advertisement: 10,
  engagement_bait: 5,
  humor_meme: 10,
  off_topic: 5,
  low_effort: 0,
};

/** Types Winnow should keep visible by default. */
export const VALUE_POST_TYPES: readonly PostType[] = [
  'job_opportunity',
  'technical_breakdown',
  'actionable_advice',
  'self_improvement',
  'resource',
  'industry_insight',
  'case_study',
  'personal_lesson',
  'substantive_discussion',
];

/** Types Winnow should blur by default. */
export const LOW_VALUE_POST_TYPES: readonly PostType[] = [
  'achievement',
  'generic_story',
  'advertisement',
  'engagement_bait',
  'humor_meme',
  'off_topic',
  'low_effort',
];

export function isPostType(value: unknown): value is PostType {
  return typeof value === 'string' && value in POST_TYPE_BASE;
}

/**
 * Ensures the first label is a post type so the overlay always shows the
 * classification rather than a raw signal.
 */
export function normalizePostLabels(labels: unknown): string[] {
  const values = Array.isArray(labels)
    ? labels.filter((label): label is string => typeof label === 'string')
    : [];
  const type = values.find((label) => isPostType(label)) ?? 'other';
  return [type, ...values.filter((label) => label !== type)];
}
