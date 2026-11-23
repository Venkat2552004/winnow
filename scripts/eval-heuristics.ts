import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { heuristicEmailClassification } from '../lib/gmail/heuristics';
import { heuristicPostScore } from '../lib/linkedin/heuristics';
import type { PostType } from '../lib/linkedin/taxonomy';
import type { EmailCategory } from '../lib/winnow/types';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

interface EmailFixture {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  hasListUnsubscribe: boolean;
  receivedAt: string;
  expectedCategory: EmailCategory;
  expectedPriorityBand?: string;
  important?: boolean;
  requiresAI?: boolean;
  notes?: string;
}

interface PostFixture {
  id: string;
  urn: string;
  author: string;
  text: string;
  isRepost: boolean;
  hasMedia: boolean;
  likes: number;
  comments: number;
  expectedType: PostType | 'skip';
  expectedKeepAt35: boolean;
  requiresAI?: boolean;
  notes?: string;
}

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const emailFixtures = readJsonl<EmailFixture>(join(root, 'evals/fixtures/emails.jsonl'));
const emailResults = emailFixtures.map((fixture) => {
  const result = heuristicEmailClassification({
    id: fixture.id,
    from: fixture.from,
    subject: fixture.subject,
    snippet: fixture.snippet,
    hasListUnsubscribe: fixture.hasListUnsubscribe,
    receivedAt: fixture.receivedAt,
  });
  const predicted = result?.category ?? 'other';
  return {
    fixture,
    predicted,
    correct: predicted === fixture.expectedCategory,
    skipped: Boolean(fixture.requiresAI),
  };
});

const emailEvaluated = emailResults.filter((result) => !result.skipped);
const emailCorrect = emailEvaluated.filter((result) => result.correct).length;
const emailAccuracy = emailEvaluated.length ? emailCorrect / emailEvaluated.length : 0;

const confusion = new Map<string, number>();
for (const result of emailEvaluated) {
  const key = `${result.fixture.expectedCategory}->${result.predicted}`;
  confusion.set(key, (confusion.get(key) ?? 0) + 1);
}

const categories = [
  ...new Set(
    emailEvaluated.flatMap((result) => [
      result.fixture.expectedCategory,
      result.predicted as EmailCategory,
    ]),
  ),
];

const perCategory = categories.map((category) => {
  const tp = confusion.get(`${category}->${category}`) ?? 0;
  let fp = 0;
  let fn = 0;

  for (const [key, count] of confusion) {
    const [expected, predicted] = key.split('->');
    if (!expected || !predicted) continue;
    if (predicted === category && expected !== category) fp += count;
    if (expected === category && predicted !== category) fn += count;
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { category, tp, fp, fn, precision, recall, f1 };
});

const macroF1 = perCategory.length
  ? perCategory.reduce((sum, category) => sum + category.f1, 0) / perCategory.length
  : 0;

const postFixtures = readJsonl<PostFixture>(join(root, 'evals/fixtures/posts.jsonl'));
const postResults = postFixtures.map((fixture) => {
  const result = heuristicPostScore({
    urn: fixture.urn,
    author: fixture.author,
    text: fixture.text,
    isRepost: fixture.isRepost,
    hasMedia: fixture.hasMedia,
    likes: fixture.likes,
    comments: fixture.comments,
  });
  const predictedType = result?.labels[0] ?? 'other';
  const predictedKeep = (result?.score ?? 50) >= 35;
  return {
    fixture,
    predictedType,
    predictedKeep,
    correctType: predictedType === fixture.expectedType,
    correctKeep: predictedKeep === fixture.expectedKeepAt35,
    skipped: fixture.expectedType === 'skip' || Boolean(fixture.requiresAI),
  };
});

const postEvaluated = postResults.filter((result) => !result.skipped);
const postTypeCorrect = postEvaluated.filter((result) => result.correctType).length;
const postTypeAccuracy = postEvaluated.length ? postTypeCorrect / postEvaluated.length : 0;
const keepCorrect = postEvaluated.filter((result) => result.correctKeep).length;
const keepAccuracy = postEvaluated.length ? keepCorrect / postEvaluated.length : 0;
const falsePositive = postEvaluated.filter(
  (result) => result.fixture.expectedKeepAt35 && !result.predictedKeep,
).length;
const falseNegative = postEvaluated.filter(
  (result) => !result.fixture.expectedKeepAt35 && result.predictedKeep,
).length;

const report = {
  generatedAt: new Date().toISOString(),
  email: {
    total: emailFixtures.length,
    evaluated: emailEvaluated.length,
    skipped: emailFixtures.length - emailEvaluated.length,
    correct: emailCorrect,
    accuracy: emailAccuracy,
    macroF1,
    perCategory,
  },
  posts: {
    total: postFixtures.length,
    evaluated: postEvaluated.length,
    skipped: postFixtures.length - postEvaluated.length,
    typeCorrect: postTypeCorrect,
    typeAccuracy: postTypeAccuracy,
    keepCorrect,
    keepAccuracy,
    falsePositive,
    falseNegative,
  },
  failures: {
    email: emailEvaluated
      .filter((result) => !result.correct)
      .map((result) => ({
        id: result.fixture.id,
        expected: result.fixture.expectedCategory,
        predicted: result.predicted,
        notes: result.fixture.notes,
      })),
    posts: postEvaluated
      .filter((result) => !result.correctType || !result.correctKeep)
      .map((result) => ({
        id: result.fixture.id,
        expectedType: result.fixture.expectedType,
        predictedType: result.predictedType,
        expectedKeep: result.fixture.expectedKeepAt35,
        predictedKeep: result.predictedKeep,
        notes: result.fixture.notes,
      })),
  },
};

const reportsDir = join(root, 'evals/reports');
mkdirSync(reportsDir, { recursive: true });
writeFileSync(join(reportsDir, 'heuristics.json'), `${JSON.stringify(report, null, 2)}\n`);

const emailRows = perCategory
  .map(
    (category) =>
      `| ${category.category} | ${category.tp} | ${category.fp} | ${category.fn} | ${percent(category.precision)} | ${percent(category.recall)} | ${category.f1.toFixed(2)} |`,
  )
  .join('\n');

const emailFailures = report.failures.email
  .map(
    (failure) =>
      `- \`${failure.id}\`: expected **${failure.expected}**, got **${failure.predicted}**${failure.notes ? ` — ${failure.notes}` : ''}`,
  )
  .join('\n');

const postFailures = report.failures.posts
  .map(
    (failure) =>
      `- \`${failure.id}\`: expected **${failure.expectedType}** / keep=${failure.expectedKeep}, got **${failure.predictedType}** / keep=${failure.predictedKeep}${failure.notes ? ` — ${failure.notes}` : ''}`,
  )
  .join('\n');

const markdown = `# Winnow heuristic eval

Generated: ${report.generatedAt}

## Email

- Evaluated: **${emailEvaluated.length} / ${emailFixtures.length}** (skipped: ${emailFixtures.length - emailEvaluated.length})
- Accuracy: **${percent(emailAccuracy)}** (${emailCorrect}/${emailEvaluated.length})
- Macro-F1: **${macroF1.toFixed(3)}**

| Category | TP | FP | FN | Precision | Recall | F1 |
|---|---:|---:|---:|---:|---:|---:|
${emailRows}

## LinkedIn

- Evaluated: **${postEvaluated.length} / ${postFixtures.length}** (skipped: ${postFixtures.length - postEvaluated.length})
- Type accuracy: **${percent(postTypeAccuracy)}** (${postTypeCorrect}/${postEvaluated.length})
- Keep/blur accuracy: **${percent(keepAccuracy)}** (${keepCorrect}/${postEvaluated.length})
- False positives (valuable blurred): **${falsePositive}**
- False negatives (low-value kept): **${falseNegative}**

## Failures

### Email

${emailFailures || 'None.'}

### LinkedIn

${postFailures || 'None.'}
`;

writeFileSync(join(reportsDir, 'heuristics.md'), markdown);

console.log(`Email accuracy: ${percent(emailAccuracy)} (${emailCorrect}/${emailEvaluated.length})`);
console.log(`Email macro-F1: ${macroF1.toFixed(3)}`);
console.log(
  `Post type accuracy: ${percent(postTypeAccuracy)} (${postTypeCorrect}/${postEvaluated.length})`,
);
console.log(
  `Post keep/blur accuracy: ${percent(keepAccuracy)} (${keepCorrect}/${postEvaluated.length})`,
);
console.log(`Report: ${join(reportsDir, 'heuristics.md')}`);

if (emailAccuracy < 0.8 || postTypeAccuracy < 0.8) {
  console.error('Heuristic eval is below the 80% threshold.');
  process.exitCode = 1;
}
