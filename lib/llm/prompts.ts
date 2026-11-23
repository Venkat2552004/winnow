import { ALL_CATEGORIES, type EmailCategory } from '../jev/types';
import { POST_TYPES, POST_TYPE_DESCRIPTION } from '../linkedin/taxonomy';

/** Shared prompts and JSON parsing for OpenAI-compatible chat models. */

export function emailSystem(categories?: readonly EmailCategory[]): string {
  const list = (categories?.length ? categories : ALL_CATEGORIES).join(', ');
  return `You classify email for a personal inbox.
Return JSON only: {"category": string, "priority": number, "confidence": number, "reason": string}.
category must be one of: ${list}.
priority is 0-100 where 70+ means the user should see it today.
confidence is 0-1. reason is one short sentence.`;
}

export function postSystem(): string {
  const typeList = POST_TYPES.map(
    (type) => `- ${type}: ${POST_TYPE_DESCRIPTION[type]}`,
  ).join('\n');

  return `You rate LinkedIn posts for a busy professional who only wants high-value content.
Return JSON only: {"score": number, "confidence": number, "labels": string[], "reason": string}.
score is 0-100. 70+ means keep it visible; below 35 means low value.
labels must start with one post type:
${typeList}
Then add any signals that apply: specific_details, actionable, evidence, original_insight, useful_links, technical_depth, hiring_specifics, clear_takeaway, vague, hype, promotional, engagement_bait, off_topic, humor_only, no_text, hashtag_only, repost_without_commentary, generic_motivation, achievement_only, low_effort_question.
High value: job opportunities, technical breakdowns, actionable advice, self-improvement, resources, industry insight, case studies, personal lessons with a takeaway, substantive discussion.
Low value: achievements without a lesson, generic stories, ads, engagement bait, humor/memes, off-topic posts, low-effort posts.
Hashtags are common on LinkedIn; do not penalize a post just for using hashtags. Only treat a post as hashtag-only when it has no real commentary beyond hashtags.
confidence is 0-1. reason is one short sentence.`;
}

/** Pulls the first JSON object out of a model reply, fenced or not. */
export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? content;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no JSON');
  return JSON.parse(body.slice(start, end + 1));
}
