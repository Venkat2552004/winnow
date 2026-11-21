import { describeHttpError, HttpError } from '../http';
import { withRetry } from '../queue';
import { clamp, errorMessage } from '../types';
import {
  CATEGORY_PRIORITY_FLOOR,
  isEmailCategory,
  type EmailClassification,
  type EmailInput,
  type PostInput,
  type PostScore,
} from '../jev/types';

export interface SarvamConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const TIMEOUT_MS = 8000;

function extractJson(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1] ?? content;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Sarvam returned no JSON');
  return JSON.parse(body.slice(start, end + 1));
}

async function chatJson(
  config: SarvamConfig,
  system: string,
  user: string,
): Promise<unknown> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model: config.model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });

  const response = await withRetry(
    async () => {
      let result: Response;
      try {
        result = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${config.apiKey}`,
          },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new HttpError('Sarvam', 0, `Sarvam is unreachable (${errorMessage(error)})`);
      }

      if (!result.ok) {
        const detail = await result.text().catch(() => '');
        throw new HttpError(
          'Sarvam',
          result.status,
          describeHttpError('Sarvam', result.status, detail),
        );
      }
      return result;
    },
    {
      attempts: 2,
      shouldRetry: (error) => error instanceof HttpError && error.retryable,
    },
  );

  const json = (await response.json()) as ChatCompletionResponse;
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('Sarvam returned an empty completion');
  return extractJson(content);
}

const EMAIL_SYSTEM = `You classify email for a personal inbox.
Return JSON only: {"category": string, "priority": number, "confidence": number, "reason": string}.
category must be one of: action_required, personal, bank_statement, invoice, receipt, security_alert, travel, legal, newsletter, notification, promotion, other.
priority is 0-100 where 70+ means the user should see it today.
confidence is 0-1. reason is one short sentence.`;

const POST_SYSTEM = `You rate LinkedIn posts for usefulness to a busy professional.
Return JSON only: {"score": number, "confidence": number, "labels": string[], "reason": string}.
score is 0-100 where 0 is pure engagement bait and 100 is genuinely insightful.
labels may include: engagement_bait, hype, promotional, hashtag_spam, repost, thin_content, viral_slop, insightful, technical, news.
confidence is 0-1. reason is one short sentence.`;

export async function sarvamClassifyEmail(
  input: EmailInput,
  config: SarvamConfig,
): Promise<EmailClassification> {
  const raw = (await chatJson(config, EMAIL_SYSTEM, JSON.stringify(input))) as Partial<EmailClassification>;
  const category = isEmailCategory(raw.category) ? raw.category : 'other';
  return {
    category,
    priority: clamp(
      Number.isFinite(raw.priority) ? Number(raw.priority) : CATEGORY_PRIORITY_FLOOR[category],
      0,
      100,
    ),
    confidence: clamp(Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0, 0, 1),
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    source: 'sarvam',
  };
}

export async function sarvamScorePost(
  input: PostInput,
  config: SarvamConfig,
): Promise<PostScore> {
  const raw = (await chatJson(config, POST_SYSTEM, JSON.stringify(input))) as Partial<PostScore>;
  return {
    score: clamp(Number.isFinite(raw.score) ? Number(raw.score) : 50, 0, 100),
    confidence: clamp(Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0, 0, 1),
    labels: Array.isArray(raw.labels) ? raw.labels.filter((l): l is string => typeof l === 'string') : [],
    reason: typeof raw.reason === 'string' ? raw.reason : '',
    source: 'sarvam',
  };
}
