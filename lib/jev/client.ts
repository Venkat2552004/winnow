import { describeHttpError, HttpError } from '../http';
import { withRetry } from '../queue';
import { clamp, errorMessage } from '../types';
import { heuristicEmailClassification } from '../gmail/heuristics';
import { heuristicPostScore } from '../linkedin/heuristics';
import { createRoarJevClient } from '../roar/client';
import { isRoarBaseUrl, ROAR_BASE_URL } from '../roar/config';
import {
  CATEGORY_PRIORITY_FLOOR,
  isEmailCategory,
  type EmailClassification,
  type EmailInput,
  type PostInput,
  type PostScore,
} from './types';

export interface JevConfig {
  baseUrl: string;
  apiKey: string;
  mock: boolean;
}

export interface JevClient {
  readonly mode: 'mock' | 'live';
  classifyEmail(input: EmailInput): Promise<EmailClassification>;
  scorePost(input: PostInput): Promise<PostScore>;
}

const TIMEOUT_MS = 2500;

async function postJson<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new HttpError(
      'Jev API',
      0,
      `Jev API is unreachable (${errorMessage(error)})`,
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(
      'Jev API',
      response.status,
      describeHttpError('Jev API', response.status, detail),
    );
  }
  return (await response.json()) as T;
}

function request<T>(url: string, apiKey: string, body: unknown): Promise<T> {
  return withRetry(() => postJson<T>(url, apiKey, body), {
    attempts: 2,
    shouldRetry: (error) => error instanceof HttpError && error.retryable,
  });
}

function normalizeEmail(raw: unknown): EmailClassification {
  const value = (raw ?? {}) as Partial<EmailClassification>;
  const category = isEmailCategory(value.category) ? value.category : 'other';
  return {
    category,
    priority: clamp(
      Number.isFinite(value.priority) ? Number(value.priority) : CATEGORY_PRIORITY_FLOOR[category],
      0,
      100,
    ),
    confidence: clamp(Number.isFinite(value.confidence) ? Number(value.confidence) : 0, 0, 1),
    reason: typeof value.reason === 'string' ? value.reason : '',
    source: 'jev',
  };
}

function normalizePost(raw: unknown): PostScore {
  const value = (raw ?? {}) as Partial<PostScore>;
  return {
    score: clamp(Number.isFinite(value.score) ? Number(value.score) : 50, 0, 100),
    confidence: clamp(Number.isFinite(value.confidence) ? Number(value.confidence) : 0, 0, 1),
    labels: Array.isArray(value.labels) ? value.labels.filter((l): l is string => typeof l === 'string') : [],
    reason: typeof value.reason === 'string' ? value.reason : '',
    source: 'jev',
  };
}

function createLiveClient(config: JevConfig): JevClient {
  const base = config.baseUrl.replace(/\/+$/, '');
  return {
    mode: 'live',
    async classifyEmail(input) {
      const raw = await request<unknown>(`${base}/v1/classify/email`, config.apiKey, {
        message: input,
      });
      return normalizeEmail(raw);
    },
    async scorePost(input) {
      const raw = await request<unknown>(`${base}/v1/score/post`, config.apiKey, {
        post: input,
      });
      return normalizePost(raw);
    },
  };
}

function createMockClient(): JevClient {
  return {
    mode: 'mock',
    async classifyEmail(input) {
      const heuristic = heuristicEmailClassification(input);
      if (heuristic) {
        return {
          ...heuristic,
          priority: CATEGORY_PRIORITY_FLOOR[heuristic.category],
          source: 'mock',
        };
      }
      return {
        category: 'other',
        priority: CATEGORY_PRIORITY_FLOOR.other,
        confidence: 0.4,
        reason: 'Mock classifier: no rule matched',
        source: 'mock',
      };
    },
    async scorePost(input) {
      const heuristic = heuristicPostScore(input);
      if (heuristic) return { ...heuristic, source: 'mock' };
      return {
        score: 55,
        confidence: 0.4,
        labels: [],
        reason: 'Mock scorer: no signals matched',
        source: 'mock',
      };
    },
  };
}

/**
 * Merges stored settings with the build-time Roar key. A key in .env is enough
 * to go live; explicit settings always win.
 */
export function resolveJevConfig(config: JevConfig): JevConfig {
  const env =
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const envKey = env.ROAR_API_KEY?.trim() ?? '';
  const envBaseUrl = env.ROAR_BASE_URL?.trim() || ROAR_BASE_URL;
  const baseUrl = config.baseUrl.trim() || (envKey ? envBaseUrl : '');
  const apiKey = config.apiKey.trim() || envKey;
  const usingEnvOnly = !config.baseUrl.trim() && !config.apiKey.trim() && Boolean(envKey);

  return {
    baseUrl,
    apiKey,
    mock: usingEnvOnly ? false : config.mock,
  };
}

export function createJevClient(config: JevConfig): JevClient {
  const resolved = resolveJevConfig(config);
  const live = !resolved.mock && Boolean(resolved.baseUrl.trim() && resolved.apiKey.trim());
  if (!live) return createMockClient();
  return isRoarBaseUrl(resolved.baseUrl)
    ? createRoarJevClient(resolved)
    : createLiveClient(resolved);
}
