import { cacheGet, cacheSet } from './cache';
import { heuristicEmailClassification } from './gmail/heuristics';
import { createJevClient } from './jev/client';
import {
  CATEGORY_PRIORITY_FLOOR,
  type EmailClassification,
  type EmailInput,
  type PostInput,
  type PostScore,
} from './jev/types';
import { heuristicPostScore } from './linkedin/heuristics';
import { sarvamClassifyEmail, sarvamScorePost } from './llm/sarvam';
import type { Settings } from './storage';
import { clamp, errorMessage } from './types';

/**
 * Bump this when the scoring model or prompt changes. It invalidates cached
 * results from older versions, which otherwise keep showing stale scores.
 */
const CACHE_VERSION = 'v2';

const EMAIL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const POST_TTL_MS = 24 * 60 * 60 * 1000;

/** Heuristics at or above this confidence are trusted without an AI call. */
const HEURISTIC_TRUST = 0.75;
/** AI results below this confidence escalate to the fallback model. */
const FALLBACK_BELOW = 0.6;

function applyPriorityFloor(result: EmailClassification): EmailClassification {
  return {
    ...result,
    priority: clamp(Math.max(result.priority, CATEGORY_PRIORITY_FLOOR[result.category]), 0, 100),
  };
}

/** Failures are not cached, so a transient error retries on the next scroll. */
async function cacheResult<T extends { confidence: number }>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  if (value.confidence <= 0) return;
  await cacheSet(key, value, ttlMs);
}

function shortError(error: unknown): string {
  const message = errorMessage(error).replace(/\s+/g, ' ').trim();
  return message.length > 120 ? `${message.slice(0, 117)}…` : message;
}

export async function classifyEmail(
  input: EmailInput,
  settings: Settings,
): Promise<EmailClassification> {
  const cacheKey = `email:${CACHE_VERSION}:${input.id}`;
  const cached = await cacheGet<EmailClassification>(cacheKey);
  if (cached) return cached;

  const heuristic = heuristicEmailClassification(input);
  if (heuristic && heuristic.confidence >= HEURISTIC_TRUST) {
    const result = applyPriorityFloor(heuristic);
    await cacheResult(cacheKey, result, EMAIL_TTL_MS);
    return result;
  }

  const jev = createJevClient(settings.jev);
  let result: EmailClassification;
  try {
    result = await jev.classifyEmail(input);
  } catch (error) {
    const message = shortError(error);
    console.warn('[jev] classifyEmail failed:', message);
    result = heuristic
      ? { ...heuristic, reason: `${heuristic.reason} (AI unavailable)` }
      : {
          category: 'other',
          priority: CATEGORY_PRIORITY_FLOOR.other,
          confidence: 0,
          reason: `Classification unavailable: ${message}`,
          source: 'error',
        };
  }

  if (result.confidence < FALLBACK_BELOW && settings.sarvam.apiKey) {
    try {
      const better = await sarvamClassifyEmail(input, settings.sarvam);
      if (better.confidence > result.confidence) result = better;
    } catch (error) {
      console.warn('[jev] Sarvam email fallback failed:', errorMessage(error));
    }
  }

  const final = applyPriorityFloor(result);
  await cacheResult(cacheKey, final, EMAIL_TTL_MS);
  return final;
}

export async function scorePost(input: PostInput, settings: Settings): Promise<PostScore> {
  const cacheKey = `post:${CACHE_VERSION}:${input.urn}`;
  const cached = await cacheGet<PostScore>(cacheKey);
  if (cached) return cached;

  const heuristic = heuristicPostScore(input);
  if (heuristic && heuristic.confidence >= HEURISTIC_TRUST) {
    await cacheResult(cacheKey, heuristic, POST_TTL_MS);
    return heuristic;
  }

  const jev = createJevClient(settings.jev);
  let result: PostScore;
  try {
    result = await jev.scorePost(input);
  } catch (error) {
    const message = shortError(error);
    console.warn('[jev] scorePost failed:', message);
    result = heuristic
      ? { ...heuristic, reason: `${heuristic.reason} (AI unavailable)` }
      : {
          score: 50,
          confidence: 0,
          labels: [],
          reason: `Scoring unavailable: ${message}`,
          source: 'error',
        };
  }

  if (result.confidence < FALLBACK_BELOW && settings.sarvam.apiKey) {
    try {
      const better = await sarvamScorePost(input, settings.sarvam);
      if (better.confidence > result.confidence) result = better;
    } catch (error) {
      console.warn('[jev] Sarvam post fallback failed:', errorMessage(error));
    }
  }

  await cacheResult(cacheKey, result, POST_TTL_MS);
  return result;
}
