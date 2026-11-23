import type OpenAI from 'openai';
import { describeHttpError, HttpError } from '../http';
import { withRetry } from '../queue';
import { errorMessage, clamp } from '../types';
import { ROAR_MODEL } from './config';

/**
 * Roar's evaluation endpoint is not OpenAI-compatible: there is no `messages`
 * field and no completion. It takes typed questions and returns a probability
 * for each answer. The `jev` model is an evaluation model, so this is the
 * endpoint Winnow's classifier uses.
 */

export type EvaluateQuestion =
  | {
      type: 'boolean';
      instructions?: string;
      criteria?: { true?: string; false?: string };
    }
  | {
      type: 'choice';
      instructions?: string;
      criteria: Record<string, string | null>;
    }
  | {
      type: 'score';
      instructions?: string;
      criteria: Array<string | Record<string, unknown>>;
    };

export interface EvaluateBooleanAnswer {
  type: 'boolean';
  probability: number;
}

export interface EvaluateChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
}

export interface EvaluateScoreAnswer {
  type: 'score';
  score: number;
  probabilities: Record<string, number>;
  /** Roar's own confidence in the interpolated score, when provided. */
  confidence?: number;
  legend?: Record<string, string>;
}

export type EvaluateAnswer =
  | EvaluateBooleanAnswer
  | EvaluateChoiceAnswer
  | EvaluateScoreAnswer;

export interface EvaluateResponse {
  answers: Record<string, EvaluateAnswer>;
  usage?: { inputTokens: number; outputTokens: number };
}

export function evaluateModel(): string {
  const env =
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return env.ROAR_MODEL?.trim() || ROAR_MODEL;
}

function statusOf(error: unknown): number {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' ? status : 0;
}

/** Sends one evaluation request through the official OpenAI SDK transport. */
export async function evaluate(
  client: OpenAI,
  state: unknown,
  questions: Record<string, EvaluateQuestion>,
): Promise<EvaluateResponse> {
  return withRetry(
    async () => {
      try {
        return await client.post<EvaluateResponse>('/evaluate', {
          body: { model: evaluateModel(), state, questions },
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
}

/** Converts an interpolated score answer into a 0-100 value. */
export function scorePercent(answer: EvaluateAnswer | undefined, rungs: number): number {
  if (!answer || answer.type !== 'score' || rungs < 2) return 0;
  const max = rungs - 1;
  return Math.min(100, Math.max(0, (answer.score / max) * 100));
}

/** Converts an interpolated score answer into a 0-1 confidence. */
export function scoreConfidence(answer: EvaluateAnswer | undefined, rungs: number): number {
  return scorePercent(answer, rungs) / 100;
}

/** Picks the most likely option from a choice answer. */
export function choiceOf(answer: EvaluateAnswer | undefined): string | undefined {
  return answer?.type === 'choice' ? answer.choice : undefined;
}

/** True when a boolean answer crosses the probability threshold. */
export function isTrue(
  answer: EvaluateAnswer | undefined,
  threshold = 0.5,
): boolean {
  return answer?.type === 'boolean' && answer.probability >= threshold;
}

/** Best available confidence for an answer, normalized to 0-1. */
export function answerConfidence(answer: EvaluateAnswer | undefined): number {
  if (!answer) return 0;
  if (answer.type === 'score') {
    const maxProbability = Math.max(0, ...Object.values(answer.probabilities ?? {}));
    return clamp(Math.max(answer.confidence ?? 0, maxProbability), 0, 1);
  }
  if (answer.type === 'choice') {
    return clamp(Math.max(0, ...Object.values(answer.probabilities ?? {})), 0, 1);
  }
  return clamp(Math.abs(answer.probability - 0.5) * 2, 0, 1);
}

/** Probability of a specific choice option. */
export function choiceProbability(
  answer: EvaluateAnswer | undefined,
  option: string,
): number {
  if (answer?.type !== 'choice') return 0;
  return clamp(answer.probabilities[option] ?? 0, 0, 1);
}
