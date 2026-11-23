import type { PostInput, PostScore } from '../winnow/types';
import { clamp } from '../types';
import type { PostType } from './taxonomy';

const TECH_KEYWORDS = [
  'architecture',
  'migrated',
  'migration',
  'deployed',
  'deployment',
  'latency',
  'throughput',
  'database',
  'postgres',
  'mysql',
  'redis',
  'kafka',
  'api',
  'sdk',
  'codebase',
  'refactor',
  'debug',
  'performance',
  'benchmark',
  'kubernetes',
  'docker',
  'typescript',
  'javascript',
  'python',
  'golang',
  'rust',
  'react',
  'node',
  'aws',
  'gcp',
  'azure',
  'microservice',
  'monolith',
  'serverless',
  'ci/cd',
  'observability',
  'tracing',
  'load balancer',
  'cache',
  'index',
  'query',
  'schema',
  'orm',
  'test coverage',
  'incident',
  'postmortem',
  'rollback',
  'feature flag',
  'build in public',
  'open source',
  'github',
];

const JOB_PATTERN =
  /(we(?:'| a)?re hiring|we are hiring|job opening|open role|open position|job opportunity|job referral|referral for (?:a|the) (?:role|position|job)|apply now|apply here|vacancy|join our team|looking for a (?:senior |staff |principal )?(?:engineer|developer|designer|manager|analyst|scientist)|hiring for|dm me for (?:a )?referral|send your resume|share your resume)/;
const ADVICE_PATTERN =
  /(how to|here(?:'| i)?s how|steps?|checklist|framework|template|tips?|mistakes?|lessons?|do this|try this|avoid|improve|better way|guide|playbook|advice|recommend)/;
const RESOURCE_PATTERN =
  /(free|template|guide|tool|resource|dataset|course|newsletter|download|cheat sheet|repo|github|open source|documentation|tutorial|curated|list of|collection)/;
const SELF_IMPROVEMENT_PATTERN =
  /(career|productivity|leadership|habit|focus|time management|growth|learning|skills?|mindset|confidence|communication|networking|interview|promotion|salary|negotiat)/;
const INDUSTRY_PATTERN =
  /(market|industry|report|data|survey|trend|forecast|analysis|research|study|benchmark|state of)/;
const CASE_STUDY_PATTERN =
  /(case study|we tried|we tested|results?|revenue|conversion|churn|growth|before and after|what we learned|experiment|a\/b test|roi|metrics?|numbers?)/;
const PERSONAL_LESSON_PATTERN =
  /(i learned|lesson|mistake|failed|failure|rejected|changed my|what i wish i knew|in hindsight|looking back|my biggest)/;
const DISCUSSION_PATTERN =
  /(what do you think|how do you|what would you|discussion|debate|question for|curious|your experience|share your)/;

const AD_PATTERN =
  /(buy now|sign up|register now|limited time|discount|special offer|limited offer|exclusive offer|\bdemo\b|book a call|our product|launch(?:ing)?|webinar|free trial|shop now|on sale|sale ends|flash sale|\bpromo\b|sponsored)/;
const ACHIEVEMENT_PATTERN =
  /(promoted|promotion|award|honou?red|humbled|thrilled to announce|excited to share|proud to|certified|certification|graduated|work anniversary|milestone|new role|starting a new position|joined .* as)/;
const GENERIC_STORY_PATTERN =
  /(i was rejected|i failed|i got fired|i quit|a recruiter told me|story time|let me tell you|here(?:'| i)?s what happened|i never thought|i couldn(?:'|o)t believe)/;
const ENGAGEMENT_BAIT_PATTERN =
  /(agree\?|thoughts\?|comment (?:yes|below|your)|tag someone|share if|like if|follow for more|repost if|who else|drop a|dm me|comment below|let me know in the comments|reaction)/;
const HUMOR_PATTERN = /(😂|🤣|😅|meme|joke|funny|lol|lmao|humou?r|comic|standup|stand-up)/g;
const OFF_TOPIC_PATTERN =
  /(cricket|politics|political|election|government|minister|parliament|religion|religious|temple|mosque|church|movie|bollywood|hollywood|celebrity|actor|actress|sports?|football|soccer|olympics|entertainment|netflix|box office)/g;
const MOTIVATION_PATTERN =
  /(mindset|grind|hustle|never give up|believe in yourself|dream big|success is|failure is|motivation|inspiration|you can do it|keep going|stay positive)/;

function stripNoise(value: string): string {
  return value
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countHashtags(value: string): number {
  return value.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function countTechKeywords(value: string): number {
  return TECH_KEYWORDS.filter((keyword) => value.includes(keyword)).length;
}

function result(
  postType: PostType,
  score: number,
  confidence: number,
  labels: string[],
  reason: string,
): PostScore {
  return {
    score: clamp(score, 0, 100),
    confidence,
    labels: [postType, ...labels.filter((label) => label !== postType)],
    reason,
    source: 'heuristic',
  };
}

/**
 * Deterministic pre-filter for clear-cut posts. Ambiguous posts return null so
 * the AI layer can classify them with the full taxonomy.
 */
export function heuristicPostScore(post: PostInput): PostScore | null {
  const lower = post.text.toLowerCase();
  const stripped = stripNoise(post.text);
  const hashtags = countHashtags(post.text);
  const words = stripped.split(/\s+/).filter(Boolean).length;
  const hasLink = /https?:\/\//i.test(post.text);
  const hasNumbers = /\d/.test(post.text);
  const techMatches = countTechKeywords(lower);

  // 1. Job opportunity. Check before low-effort so a short hiring post is kept.
  if (JOB_PATTERN.test(lower)) {
    const specific =
      hasNumbers ||
      /(remote|hybrid|onsite|location|salary|equity|apply|resume|role|position|company)/.test(
        lower,
      );
    return result(
      'job_opportunity',
      specific ? 88 : 78,
      specific ? 0.9 : 0.8,
      specific ? ['job_opportunity', 'hiring_specifics'] : ['job_opportunity'],
      'Job or referral post.',
    );
  }

  // 2. Resource. A link or enough text separates a real resource from a promo.
  if (RESOURCE_PATTERN.test(lower) && (hasLink || words > 30) && !AD_PATTERN.test(lower)) {
    return result(
      'resource',
      80,
      0.8,
      ['resource', 'useful_links'],
      'Resource or tool recommendation.',
    );
  }

  // 3. Low effort / hashtag-only. Hashtags are normal on LinkedIn; only flag
  // posts where there is essentially no commentary left after removing them.
  if (
    stripped.length < 20 ||
    (hashtags > 3 && stripped.length < 20) ||
    /^(thoughts\?|agree\?|this\.?|yes\?|no\?)$/i.test(stripped)
  ) {
    return result(
      'low_effort',
      5,
      0.9,
      ['low_effort', 'no_text'],
      'Almost no text beyond hashtags or a one-liner.',
    );
  }

  // 4. Technical breakdown.
  if (techMatches >= 3 && (hasNumbers || words > 40)) {
    return result(
      'technical_breakdown',
      86,
      0.85,
      ['technical_breakdown', 'technical_depth'],
      'Technical breakdown with concrete details.',
    );
  }

  // 5. Actionable advice. If it also looks promotional, let the AI decide.
  if (ADVICE_PATTERN.test(lower) && (words > 30 || hasNumbers)) {
    if (AD_PATTERN.test(lower)) return null;
    return result(
      'actionable_advice',
      80,
      0.8,
      ['actionable_advice', 'actionable'],
      'Actionable advice or how-to.',
    );
  }

  // 6. Self-improvement.
  if (SELF_IMPROVEMENT_PATTERN.test(lower) && ADVICE_PATTERN.test(lower)) {
    if (AD_PATTERN.test(lower)) return null;
    return result(
      'self_improvement',
      72,
      0.74,
      ['self_improvement', 'actionable'],
      'Career or self-improvement advice.',
    );
  }

  // 7. Case study.
  if (CASE_STUDY_PATTERN.test(lower) && hasNumbers) {
    return result(
      'case_study',
      76,
      0.74,
      ['case_study', 'evidence'],
      'Case study with concrete results.',
    );
  }

  // 8. Industry insight.
  if (INDUSTRY_PATTERN.test(lower) && (hasNumbers || words > 40)) {
    return result(
      'industry_insight',
      72,
      0.74,
      ['industry_insight', 'evidence'],
      'Industry analysis or data.',
    );
  }

  // 9. Personal lesson.
  if (PERSONAL_LESSON_PATTERN.test(lower) && (ADVICE_PATTERN.test(lower) || words > 40)) {
    return result(
      'personal_lesson',
      62,
      0.74,
      ['personal_lesson', 'clear_takeaway'],
      'Personal story with a lesson.',
    );
  }

  // 10. Substantive discussion.
  if (DISCUSSION_PATTERN.test(lower) && words > 30) {
    return result(
      'substantive_discussion',
      58,
      0.74,
      ['substantive_discussion'],
      'Professional discussion prompt.',
    );
  }

  // 11. Low-value categories.
  if (ENGAGEMENT_BAIT_PATTERN.test(lower)) {
    return result(
      'engagement_bait',
      8,
      0.9,
      ['engagement_bait'],
      'Explicit engagement bait.',
    );
  }

  if (
    countMatches(lower, OFF_TOPIC_PATTERN) >= 2 &&
    techMatches < 3 &&
    !JOB_PATTERN.test(lower)
  ) {
    return result(
      'off_topic',
      8,
      0.8,
      ['off_topic'],
      'Off-topic for a professional feed.',
    );
  }

  if (countMatches(lower, HUMOR_PATTERN) >= 2 && !ADVICE_PATTERN.test(lower) && techMatches < 3) {
    return result('humor_meme', 12, 0.78, ['humor_meme'], 'Humor or meme post.');
  }

  if (AD_PATTERN.test(lower) && !ADVICE_PATTERN.test(lower) && !RESOURCE_PATTERN.test(lower)) {
    return result(
      'advertisement',
      12,
      0.78,
      ['advertisement', 'promotional'],
      'Promotional post.',
    );
  }

  if (
    ACHIEVEMENT_PATTERN.test(lower) &&
    !ADVICE_PATTERN.test(lower) &&
    !PERSONAL_LESSON_PATTERN.test(lower)
  ) {
    return result(
      'achievement',
      22,
      0.72,
      ['achievement', 'achievement_only'],
      'Achievement announcement without a lesson.',
    );
  }

  if (
    GENERIC_STORY_PATTERN.test(lower) &&
    !ADVICE_PATTERN.test(lower) &&
    !PERSONAL_LESSON_PATTERN.test(lower)
  ) {
    return result(
      'generic_story',
      22,
      0.72,
      ['generic_story', 'vague'],
      'Generic story without a concrete takeaway.',
    );
  }

  if (MOTIVATION_PATTERN.test(lower) && !ADVICE_PATTERN.test(lower)) {
    return result(
      'generic_story',
      20,
      0.72,
      ['generic_story', 'generic_motivation'],
      'Generic motivation without a concrete takeaway.',
    );
  }

  if (post.isRepost && stripped.length < 120) {
    return result(
      'low_effort',
      20,
      0.72,
      ['low_effort', 'repost_without_commentary'],
      'Reshare without added commentary.',
    );
  }

  return null;
}
