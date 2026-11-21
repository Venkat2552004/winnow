import OpenAI from 'openai';
import type { JevClient, JevConfig } from '../jev/client';
import {
  CATEGORY_PRIORITY_FLOOR,
  isEmailCategory,
  type EmailCategory,
  type EmailClassification,
  type EmailInput,
  type PostInput,
  type PostScore,
} from '../jev/types';
import { clamp } from '../types';
import { ROAR_BASE_URL } from './config';
import {
  choiceOf,
  evaluate,
  isTrue,
  scoreConfidence,
  scorePercent,
  type EvaluateQuestion,
  type EvaluateResponse,
} from './evaluate';

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

const EMAIL_CATEGORIES: Record<EmailCategory, string> = {
  action_required: 'Needs a reply or a task from the user',
  personal: 'A real person writing directly to the user',
  bank_statement: 'A bank or card statement',
  invoice: 'A bill or invoice that needs paying',
  receipt: 'A purchase receipt or order confirmation',
  security_alert: 'A login, password or security warning',
  travel: 'A flight, hotel or trip booking',
  legal: 'A contract, legal notice or compliance matter',
  newsletter: 'A newsletter or digest',
  notification: 'An automated product or service notification',
  promotion: 'Marketing, sales or promotional mail',
  other: 'Anything that does not fit the other categories',
};

const PRIORITY_RUNGS = ['ignore', 'read later', 'read today', 'act now'];
const CONFIDENCE_RUNGS = ['guessing', 'unsure', 'fairly sure', 'certain'];
const QUALITY_RUNGS = [
  'pure engagement bait',
  'thin or promotional',
  'ordinary',
  'useful',
  'genuinely insightful',
];

const POST_LABELS: Record<string, string> = {
  engagement_bait: 'Asks for likes, comments or shares instead of making a point',
  hype: 'Uses inflated, breathless or buzzword-heavy language',
  promotional: 'Primarily advertises a product, service or the author',
  hashtag_spam: 'Stuffed with hashtags or keyword tags',
  repost: 'Mostly repeats someone else’s content without adding insight',
  thin_content: 'Says very little beyond a platitude or a one-liner',
  viral_slop: 'Optimised for reach rather than usefulness',
  insightful: 'Offers a non-obvious idea, data or experience',
  technical: 'Contains substantive technical detail',
  news: 'Reports a concrete, timely development',
};

function emailQuestions(): Record<string, EvaluateQuestion> {
  return {
    category: {
      type: 'choice',
      instructions: 'What kind of email is this?',
      criteria: EMAIL_CATEGORIES,
    },
    priority: {
      type: 'score',
      instructions: 'How urgently should the user see this email today?',
      criteria: PRIORITY_RUNGS,
    },
    confidence: {
      type: 'score',
      instructions: 'How confident are you in the category?',
      criteria: CONFIDENCE_RUNGS,
    },
  };
}

function postQuestions(): Record<string, EvaluateQuestion> {
  const questions: Record<string, EvaluateQuestion> = {
    quality: {
      type: 'score',
      instructions: 'How useful is this post to a busy professional?',
      criteria: QUALITY_RUNGS,
    },
    confidence: {
      type: 'score',
      instructions: 'How confident are you in this rating?',
      criteria: CONFIDENCE_RUNGS,
    },
  };

  for (const [label, instructions] of Object.entries(POST_LABELS)) {
    questions[label] = { type: 'boolean', instructions };
  }

  return questions;
}

function emailReason(
  category: EmailCategory,
  priority: number,
  answers: EvaluateResponse['answers'],
): string {
  const categoryAnswer = answers.category;
  const categoryProbability =
    categoryAnswer?.type === 'choice'
      ? categoryAnswer.probabilities[category]
      : undefined;
  const certainty =
    categoryProbability === undefined
      ? ''
      : ` (${Math.round(categoryProbability * 100)}% likely)`;
  const urgency = PRIORITY_RUNGS[Math.round((priority / 100) * (PRIORITY_RUNGS.length - 1))];
  return `${category}${certainty}; priority: ${urgency}.`;
}

function postReason(score: number, labels: string[]): string {
  const signal = labels.length ? labels.join(', ') : 'no negative signals';
  return `Rated ${Math.round(score)}/100; ${signal}.`;
}

/** Adapts Roar's evaluation endpoint to the Jev classifier interface. */
export function createRoarJevClient(config: JevConfig): JevClient {
  const client = createRoarSdk({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || ROAR_BASE_URL,
  });

  return {
    mode: 'live',
    async classifyEmail(input: EmailInput) {
      const response = await evaluate(client, input, emailQuestions());
      const answers = response.answers;
      const rawCategory = choiceOf(answers.category);
      const category = isEmailCategory(rawCategory) ? rawCategory : 'other';
      const priority = clamp(
        Math.max(
          scorePercent(answers.priority, PRIORITY_RUNGS.length),
          CATEGORY_PRIORITY_FLOOR[category],
        ),
        0,
        100,
      );
      const confidence = clamp(
        scoreConfidence(answers.confidence, CONFIDENCE_RUNGS.length),
        0,
        1,
      );

      return {
        category,
        priority: Math.round(priority),
        confidence,
        reason: emailReason(category, priority, answers),
        source: 'roar',
      } satisfies EmailClassification;
    },
    async scorePost(input: PostInput) {
      const response = await evaluate(client, input, postQuestions());
      const answers = response.answers;
      const score = clamp(scorePercent(answers.quality, QUALITY_RUNGS.length), 0, 100);
      const confidence = clamp(
        scoreConfidence(answers.confidence, CONFIDENCE_RUNGS.length),
        0,
        1,
      );
      const labels = Object.keys(POST_LABELS).filter((label) => isTrue(answers[label]));

      return {
        score: Math.round(score),
        confidence,
        labels,
        reason: postReason(score, labels),
        source: 'roar',
      } satisfies PostScore;
    },
  };
}
