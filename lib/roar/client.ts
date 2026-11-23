import OpenAI from 'openai';
import type { JevClient, JevConfig } from '../winnow/client';
import {
  ALL_CATEGORIES,
  CATEGORY_PRIORITY_FLOOR,
  resolveEmailCategory,
  type ClassifyOptions,
  type EmailCategory,
  type EmailClassification,
  type EmailInput,
  type PostInput,
  type PostScore,
} from '../winnow/types';
import {
  isPostType,
  POST_TYPE_BASE,
  POST_TYPE_DESCRIPTION,
  POST_TYPE_LABEL,
  type PostType,
} from '../linkedin/taxonomy';
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
  security_alert:
    'A login alert, password reset, verification code, suspicious activity, or security warning',
  bank_statement: 'A bank, card, or brokerage statement, balance, or transaction summary',
  invoice: 'A bill, invoice, or payment request with an amount due',
  travel: 'A flight, hotel, train, rental, or trip itinerary or booking',
  legal: 'A contract, legal notice, policy change, insurance, or government/tax matter',
  action_required:
    'A person or system needs the user to reply, approve, sign, or complete a task',
  jobs: 'A job alert, recruiter message, application update, interview request, or hiring notice',
  personal: 'A real person writing to the user socially or personally, not a bulk message',
  payment: 'A payment confirmation, autopay notice, refund, or subscription charge',
  shopping: 'An order confirmation, shipping update, delivery notice, return, or purchase receipt',
  offers: 'A marketing offer, sale, discount, promo code, product launch, or promotional email',
  signup: 'A welcome email, onboarding message, account activation, or trial reminder',
  social: 'A social media notification, mention, follow, comment, like, or connection request',
  alerts: 'An automated app, service, system, or monitoring notification that is not marketing',
  newsletter: 'A recurring newsletter, digest, or editorial email',
  other: 'Anything that does not fit the categories above',
};

const URGENCY_RUNGS = ['ignore', 'read later', 'read today', 'act now'];

const QUALITY_RUNGS = [
  'no value: pure noise, bait, or off-topic',
  'low value: generic, promotional, or entertaining but not useful',
  'some value: a clear point but little specificity or actionability',
  'useful: a concrete lesson, resource, or opportunity the reader can use',
  'high value: specific, actionable, and directly relevant to work or career',
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
 * adjustments are capped so the post type and quality rating stay the main
 * drivers.
 */
const POST_SIGNALS: PostSignal[] = [
  {
    label: 'specific_details',
    instructions:
      'Does the post include concrete details such as numbers, tools, names, steps, or outcomes?',
    weight: 6,
    threshold: 0.6,
  },
  {
    label: 'actionable',
    instructions:
      'Can the reader apply a specific method, lesson, or next step from this post?',
    weight: 6,
    threshold: 0.6,
  },
  {
    label: 'evidence',
    instructions:
      'Does the post support its claims with data, examples, or first-hand experience?',
    weight: 5,
    threshold: 0.6,
  },
  {
    label: 'original_insight',
    instructions:
      'Does the post offer a non-obvious idea or a genuinely new perspective, not just generic advice?',
    weight: 5,
    threshold: 0.6,
  },
  {
    label: 'useful_links',
    instructions:
      'Does the post point to a useful resource, tool, template, or guide?',
    weight: 4,
    threshold: 0.6,
  },
  {
    label: 'technical_depth',
    instructions:
      'Does the post contain substantive technical detail rather than vague claims?',
    weight: 5,
    threshold: 0.6,
  },
  {
    label: 'hiring_specifics',
    instructions:
      'Does the post include a specific role, company, location, or application path?',
    weight: 5,
    threshold: 0.6,
  },
  {
    label: 'clear_takeaway',
    instructions:
      'Does the post end with a clear, transferable lesson or next step?',
    weight: 4,
    threshold: 0.6,
  },
  {
    label: 'vague',
    instructions: 'Is the post mostly generic claims without specifics?',
    weight: -8,
    threshold: 0.6,
  },
  {
    label: 'hype',
    instructions: 'Does the post use inflated, breathless, or buzzword-heavy language?',
    weight: -7,
  },
  {
    label: 'promotional',
    instructions: 'Is the post mainly advertising a product, service, event, or the author?',
    weight: -10,
  },
  {
    label: 'engagement_bait',
    instructions:
      'Does the post explicitly ask for likes, comments, shares, follows, tags, or votes?',
    weight: -12,
  },
  {
    label: 'off_topic',
    instructions:
      'Is the post about politics, sports, entertainment, religion, or personal life with no professional relevance?',
    weight: -12,
  },
  {
    label: 'humor_only',
    instructions:
      'Is the post mainly a joke, meme, or funny video with little professional value?',
    weight: -8,
  },
  {
    label: 'no_text',
    instructions: 'Does the post have almost no text to judge?',
    weight: -10,
  },
  {
    label: 'hashtag_only',
    instructions:
      'Is the post essentially only hashtags with no real commentary? Hashtags are common on LinkedIn; only flag this when there is no substantive text.',
    weight: -10,
  },
  {
    label: 'repost_without_commentary',
    instructions: 'Is this a reshare with no added insight or commentary?',
    weight: -8,
  },
  {
    label: 'generic_motivation',
    instructions:
      'Is the post generic motivation or inspiration without a concrete takeaway?',
    weight: -8,
  },
  {
    label: 'achievement_only',
    instructions:
      'Is the post only an achievement announcement with no useful lesson?',
    weight: -6,
  },
  {
    label: 'low_effort_question',
    instructions:
      'Is the post a one-line question or poll with no context or substance?',
    weight: -8,
  },
];

function emailQuestions(allowed?: readonly EmailCategory[]): Record<string, EvaluateQuestion> {
  const categories = allowed?.length ? allowed : ALL_CATEGORIES;
  const criteria = Object.fromEntries(
    categories.map((category) => [category, EMAIL_CATEGORIES[category]]),
  );

  return {
    category: {
      type: 'choice',
      instructions: 'What kind of email is this? Pick the single best category.',
      criteria,
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
    post_type: {
      type: 'choice',
      instructions: 'What kind of LinkedIn post is this? Pick the single best type.',
      criteria: POST_TYPE_DESCRIPTION,
    },
    quality: {
      type: 'score',
      instructions:
        'How useful is this post to a busy professional who only wants high-value content? Use the full scale and do not default to the middle.',
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

function postReason(postType: PostType, labels: string[]): string {
  const type = POST_TYPE_LABEL[postType];
  const signals = labels.filter((label) => label !== postType).slice(0, 3);
  return `${type}${signals.length ? ` · ${signals.join(', ')}` : ''}.`;
}

/** Adapts Roar's evaluation endpoint to the Winnow classifier interface. */
export function createRoarJevClient(config: JevConfig): JevClient {
  const client = createRoarSdk({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl || ROAR_BASE_URL,
  });

  return {
    mode: 'live',
    async classifyEmail(input: EmailInput, options?: ClassifyOptions) {
      const allowed = options?.categories?.length ? options.categories : undefined;
      const response = await evaluate(client, input, emailQuestions(allowed));
      const answers = response.answers;
      const rawCategory = choiceOf(answers.category);
      const category = resolveEmailCategory(rawCategory, allowed);

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

      const rawType = choiceOf(answers.post_type);
      const postType = isPostType(rawType) ? rawType : 'other';
      const base = POST_TYPE_BASE[postType];
      const quality = scorePercent(answers.quality, QUALITY_RUNGS.length);

      const signalLabels: string[] = [];
      let positive = 0;
      let negative = 0;

      for (const signal of POST_SIGNALS) {
        if (!isTrue(answers[signal.label], signal.threshold)) continue;
        signalLabels.push(signal.label);
        if (signal.weight > 0) positive += signal.weight;
        else negative += signal.weight;
      }

      // The post type is the main prior; the quality rating and signals refine
      // it. Cap the upside so a few positive flags cannot turn an average post
      // into a perfect score. Negative signals are not capped.
      const score = clamp(
        base * 0.7 + quality * 0.3 + Math.min(positive, 12) + negative,
        0,
        100,
      );
      const labels = [postType, ...signalLabels.filter((label) => label !== postType)];

      const confidence = clamp(
        Math.max(
          choiceProbability(answers.post_type, postType),
          answerConfidence(answers.quality),
          0.5,
        ),
        0,
        1,
      );

      return {
        score: Math.round(score),
        confidence,
        labels,
        reason: postReason(postType, labels),
        source: 'roar',
      } satisfies PostScore;
    },
  };
}
