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
  answerConfidence,
  choiceOf,
  choiceProbability,
  evaluate,
  isTrue,
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
  action_required:
    'A person or system needs the user to reply, approve, sign, pay, or complete a task',
  personal: 'A real person writing to the user socially or personally, not a bulk message',
  bank_statement: 'A bank, card, or brokerage statement, balance, or transaction summary',
  invoice: 'A bill, invoice, or payment request with an amount due',
  receipt: 'A receipt, order confirmation, or shipping confirmation for a purchase',
  security_alert: 'A login alert, password reset, suspicious activity, or security warning',
  travel: 'A flight, hotel, train, rental, or trip itinerary or booking',
  legal: 'A contract, legal notice, policy change, or compliance matter',
  newsletter: 'A recurring newsletter, digest, or editorial email',
  notification: 'An automated product, app, or service notification that is not marketing',
  promotion: 'A marketing offer, sale, product launch, or promotional email',
  other: 'Anything that does not fit the categories above',
};

const URGENCY_RUNGS = ['ignore', 'read later', 'read today', 'act now'];

const QUALITY_RUNGS = [
  'pure engagement bait: asks for likes, comments, or shares, or uses a cliffhanger with no substance',
  'thin or promotional: mostly an ad, announcement, or platitude with little to learn',
  'low substance: a personal update or generic advice with no new information',
  'ordinary: a normal professional post with a clear point but nothing novel',
  'useful: shares a concrete lesson, result, or resource the reader can apply',
  'insightful: offers a non-obvious idea, data, or first-hand experience with specifics',
  'exceptional: original analysis or hard-won detail that changes how the reader thinks',
];

interface PostSignal {
  label: string;
  instructions: string;
  weight: number;
  /** Probability needed before the signal counts. */
  threshold?: number;
}

/**
 * Positive signals raise the score, negative signals lower it. Positive
 * adjustments are capped so the model's quality rating stays the main driver.
 */
const POST_SIGNALS: PostSignal[] = [
  {
    label: 'substance',
    instructions:
      'Does the post contain a concrete, verifiable claim, data point, result, or first-hand experience with specifics?',
    weight: 6,
    threshold: 0.6,
  },
  {
    label: 'actionable',
    instructions:
      'Can the reader apply a specific method, lesson, or next step from this post?',
    weight: 5,
    threshold: 0.6,
  },
  {
    label: 'insightful',
    instructions:
      'Does the post offer a non-obvious idea or a genuinely new perspective, not just generic advice?',
    weight: 6,
    threshold: 0.6,
  },
  {
    label: 'technical',
    instructions:
      'Does the post contain substantive technical detail rather than vague claims?',
    weight: 4,
    threshold: 0.6,
  },
  {
    label: 'news',
    instructions:
      'Does the post report a specific, timely development with a date, version, or concrete event?',
    weight: 3,
    threshold: 0.6,
  },
  {
    label: 'personal_story',
    instructions:
      'Does the post tell a specific personal story with a clear lesson, rather than a generic anecdote?',
    weight: 2,
    threshold: 0.6,
  },
  {
    label: 'engagement_bait',
    instructions: 'Does the post ask for likes, comments, shares, or tags instead of making a point?',
    weight: -14,
  },
  {
    label: 'hype',
    instructions: 'Does the post use inflated, breathless, or buzzword-heavy language?',
    weight: -9,
  },
  {
    label: 'promotional',
    instructions: 'Does the post primarily advertise a product, service, event, or the author?',
    weight: -11,
  },
  {
    label: 'hashtag_spam',
    instructions: 'Is the post stuffed with hashtags or keyword tags?',
    weight: -7,
  },
  {
    label: 'repost',
    instructions: 'Does the post mostly repeat someone else’s content without adding insight?',
    weight: -6,
  },
  {
    label: 'thin_content',
    instructions: 'Does the post say very little beyond a platitude or a one-liner?',
    weight: -9,
  },
  {
    label: 'viral_slop',
    instructions: 'Does the post look optimised for reach rather than usefulness?',
    weight: -11,
  },
];

function emailQuestions(): Record<string, EvaluateQuestion> {
  return {
    category: {
      type: 'choice',
      instructions: 'What kind of email is this? Pick the single best category.',
      criteria: EMAIL_CATEGORIES,
    },
    urgency: {
      type: 'score',
      instructions: 'How urgently should the user see this email today?',
      criteria: URGENCY_RUNGS,
    },
    needs_action: {
      type: 'boolean',
      instructions: 'Does the user need to reply, approve, sign, pay, or complete a task?',
    },
    time_sensitive: {
      type: 'boolean',
      instructions: 'Does this email have a deadline or event in the next 48 hours?',
    },
    automated: {
      type: 'boolean',
      instructions: 'Was this sent automatically by a system rather than written by a person?',
    },
  };
}

function postQuestions(): Record<string, EvaluateQuestion> {
  const questions: Record<string, EvaluateQuestion> = {
    quality: {
      type: 'score',
      instructions:
        'How useful is this post to a busy professional? Use the full scale and do not default to the middle.',
      criteria: QUALITY_RUNGS,
    },
  };

  for (const signal of POST_SIGNALS) {
    questions[signal.label] = { type: 'boolean', instructions: signal.instructions };
  }

  return questions;
}

function emailReason(
  category: EmailCategory,
  priority: number,
  answers: EvaluateResponse['answers'],
): string {
  const probability = choiceProbability(answers.category, category);
  const certainty = probability > 0 ? ` (${Math.round(probability * 100)}% likely)` : '';
  const urgency =
    URGENCY_RUNGS[
      Math.round((priority / 100) * (URGENCY_RUNGS.length - 1))
    ] ?? 'read later';
  const signals: string[] = [];
  if (isTrue(answers.needs_action)) signals.push('needs action');
  if (isTrue(answers.time_sensitive)) signals.push('time-sensitive');
  if (isTrue(answers.automated)) signals.push('automated');
  const suffix = signals.length ? `; ${signals.join(', ')}` : '';
  return `${category}${certainty}; priority: ${urgency}${suffix}.`;
}

function postReason(score: number, labels: string[]): string {
  const signal = labels.length ? labels.join(', ') : 'no strong signals';
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

      const urgency = scorePercent(answers.urgency, URGENCY_RUNGS.length);
      // The category floor is the main driver. Urgency and flags can only add
      // a small amount, so a time-limited promotion cannot outrank real mail.
      const priority = clamp(
        CATEGORY_PRIORITY_FLOOR[category] +
          (isTrue(answers.needs_action) ? 5 : 0) +
          (isTrue(answers.time_sensitive) ? 5 : 0) +
          (urgency / 100) * 10,
        0,
        100,
      );

      // The probability of the chosen category is a better confidence signal
      // than a separate self-rating question.
      const confidence = clamp(
        Math.max(
          choiceProbability(answers.category, category),
          answerConfidence(answers.urgency) * 0.8,
        ),
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

      const base = scorePercent(answers.quality, QUALITY_RUNGS.length);
      const labels: string[] = [];
      let positive = 0;
      let negative = 0;

      for (const signal of POST_SIGNALS) {
        if (!isTrue(answers[signal.label], signal.threshold)) continue;
        labels.push(signal.label);
        if (signal.weight > 0) positive += signal.weight;
        else negative += signal.weight;
      }

      // Cap the upside so a few positive flags cannot turn an average post
      // into a perfect score. Negative signals are not capped.
      const score = clamp(base + Math.min(positive, 12) + negative, 0, 100);

      // Put the strongest negative signal first: the overlay shows labels[0]
      // and blurred posts are the ones where the downside matters most.
      const weightOf = (label: string): number =>
        POST_SIGNALS.find((signal) => signal.label === label)?.weight ?? 0;
      labels.sort((a, b) => weightOf(a) - weightOf(b));

      const confidence = clamp(
        Math.max(answerConfidence(answers.quality), 0.5),
        0,
        1,
      );

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
