import { clamp } from '../types';
import { heuristicEmailClassification } from '../gmail/heuristics';
import { heuristicPostScore } from '../linkedin/heuristics';
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
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Jev API ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return (await response.json()) as T;
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
      const raw = await postJson<unknown>(`${base}/v1/classify/email`, config.apiKey, {
        message: input,
      });
      return normalizeEmail(raw);
    },
    async scorePost(input) {
      const raw = await postJson<unknown>(`${base}/v1/score/post`, config.apiKey, {
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

export function createJevClient(config: JevConfig): JevClient {
  const live = !config.mock && Boolean(config.baseUrl.trim() && config.apiKey.trim());
  return live ? createLiveClient(config) : createMockClient();
}
