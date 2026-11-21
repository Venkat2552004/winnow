import OpenAI from 'openai';
import { describeHttpError, HttpError } from '../http';
import type { JevClient, JevConfig } from '../jev/client';
import {
  CATEGORY_PRIORITY_FLOOR,
  isEmailCategory,
  type EmailClassification,
  type PostInput,
  type PostScore,
} from '../jev/types';
import { EMAIL_SYSTEM, extractJson, POST_SYSTEM } from '../llm/prompts';
import { withRetry } from '../queue';
import { clamp, errorMessage } from '../types';
import { ROAR_BASE_URL, ROAR_MODEL } from './config';

export interface RoarConfig {
  apiKey: string;
  baseUrl?: string;
}

/** Official OpenAI SDK pointed at the Roar AI gateway. */
export function createRoarSdk(config: RoarConfig): OpenAI {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? ROAR_BASE_URL,
    // The extension is a browser runtime; the key never leaves this device.
    dangerouslyAllowBrowser: true,
    timeout: 15_000,
    // Retries are handled by withRetry so we can classify errors consistently.
    maxRetries: 0,
  });
}

function statusOf(error: unknown): number {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : 0;
}

async function chatJson(
  client: OpenAI,
  model: string,
  system: string,
  user: string,
): Promise<unknown> {
  const completion = await withRetry(
    async () => {
      try {
        return await client.chat.completions.create({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
      } catch (error) {
        const status = statusOf(error);
        throw new HttpError(
          'Roar AI',
          status,
          describeHttpError('Roar AI', status, errorMessage(error)),
        );
      }
    },
    {
      attempts: 2,
      shouldRetry: (error) => error instanceof HttpError && error.retryable,
    },
  );

  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error('Roar AI returned an empty completion');
  return extractJson(content);
}

/** Adapts the OpenAI-compatible gateway to the Jev classifier interface. */
export function createRoarJevClient(config: JevConfig): JevClient {
  const client = createRoarSdk({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || ROAR_BASE_URL,
  });
  const env =
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const model = env.ROAR_MODEL?.trim() || ROAR_MODEL;

  return {
    mode: 'live',
    async classifyEmail(input) {
      const raw = (await chatJson(
        client,
        model,
        EMAIL_SYSTEM,
        JSON.stringify(input),
      )) as Partial<EmailClassification>;
      const category = isEmailCategory(raw.category) ? raw.category : 'other';
      return {
        category,
        priority: clamp(
          Number.isFinite(raw.priority)
            ? Number(raw.priority)
            : CATEGORY_PRIORITY_FLOOR[category],
          0,
          100,
        ),
        confidence: clamp(
          Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0,
          0,
          1,
        ),
        reason: typeof raw.reason === 'string' ? raw.reason : '',
        source: 'roar',
      };
    },
    async scorePost(input: PostInput) {
      const raw = (await chatJson(
        client,
        model,
        POST_SYSTEM,
        JSON.stringify(input),
      )) as Partial<PostScore>;
      return {
        score: clamp(Number.isFinite(raw.score) ? Number(raw.score) : 50, 0, 100),
        confidence: clamp(
          Number.isFinite(raw.confidence) ? Number(raw.confidence) : 0,
          0,
          1,
        ),
        labels: Array.isArray(raw.labels)
          ? raw.labels.filter((label): label is string => typeof label === 'string')
          : [],
        reason: typeof raw.reason === 'string' ? raw.reason : '',
        source: 'roar',
      };
    },
  };
}
