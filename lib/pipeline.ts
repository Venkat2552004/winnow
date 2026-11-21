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

export async function classifyEmail(
  input: EmailInput,
  settings: Settings,
): Promise<EmailClassification> {
  const cacheKey = `email:${input.id}`;
  const cached = await cacheGet<EmailClassification>(cacheKey);
  if (cached) return cached;

  const heuristic = heuristicEmailClassification(input);
  if (heuristic && heuristic.confidence >= HEURISTIC_TRUST) {
    const result = applyPriorityFloor(heuristic);
    await cacheSet(cacheKey, result, EMAIL_TTL_MS);
    return result;
  }

  const jev = createJevClient(settings.jev);
  let result: EmailClassification;
  try {
    result = await jev.classifyEmail(input);
  } catch (error) {
    console.warn('[jev] classifyEmail failed:', errorMessage(error));
    result = heuristic ?? {
      category: 'other',
      priority: CATEGORY_PRIORITY_FLOOR.other,
      confidence: 0,
      reason: 'Classification unavailable',
      source: 'heuristic',
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
  await cacheSet(cacheKey, final, EMAIL_TTL_MS);
  return final;
}

export async function scorePost(input: PostInput, settings: Settings): Promise<PostScore> {
  const cacheKey = `post:${input.urn}`;
  const cached = await cacheGet<PostScore>(cacheKey);
  if (cached) return cached;

  const heuristic = heuristicPostScore(input);
  if (heuristic && heuristic.confidence >= HEURISTIC_TRUST) {
    await cacheSet(cacheKey, heuristic, POST_TTL_MS);
    return heuristic;
  }

  const jev = createJevClient(settings.jev);
  let result: PostScore;
  try {
    result = await jev.scorePost(input);
  } catch (error) {
    console.warn('[jev] scorePost failed:', errorMessage(error));
    result = heuristic ?? {
      score: 50,
      confidence: 0,
      labels: [],
      reason: 'Scoring unavailable',
      source: 'heuristic',
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

  await cacheSet(cacheKey, result, POST_TTL_MS);
  return result;
}
