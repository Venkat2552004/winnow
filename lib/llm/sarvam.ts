import { describeHttpError, HttpError } from '../http';
import { withRetry } from '../queue';
import { clamp, errorMessage } from '../types';
import { EMAIL_SYSTEM, extractJson, POST_SYSTEM } from './prompts';
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
