/** Shared prompts and JSON parsing for OpenAI-compatible chat models. */

export const EMAIL_SYSTEM = `You classify email for a personal inbox.
Return JSON only: {"category": string, "priority": number, "confidence": number, "reason": string}.
category must be one of: action_required, personal, bank_statement, invoice, receipt, security_alert, travel, legal, newsletter, notification, promotion, other.
priority is 0-100 where 70+ means the user should see it today.
confidence is 0-1. reason is one short sentence.`;

export const POST_SYSTEM = `You rate LinkedIn posts for usefulness to a busy professional.
Return JSON only: {"score": number, "confidence": number, "labels": string[], "reason": string}.
score is 0-100 where 0 is pure engagement bait and 100 is genuinely insightful.
labels may include: engagement_bait, hype, promotional, hashtag_spam, repost, thin_content, viral_slop, insightful, technical, news.
confidence is 0-1. reason is one short sentence.`;

/** Pulls the first JSON object out of a model reply, fenced or not. */
export function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? content;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Model returned no JSON');
  return JSON.parse(body.slice(start, end + 1));
}
