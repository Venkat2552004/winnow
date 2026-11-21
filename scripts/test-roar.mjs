import OpenAI from 'openai';

// Load .env without adding a dependency. Node 20.12+ supports loadEnvFile.
try {
  process.loadEnvFile('.env');
} catch {
  // .env is optional; the key may already be in the environment.
}

const apiKey = process.env.ROAR_API_KEY;
if (!apiKey) {
  console.error('ROAR_API_KEY is missing. Add it to .env first.');
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: process.env.ROAR_BASE_URL ?? 'https://api.roar-ai.com/v1',
  maxRetries: 0,
});

// `jev` is an evaluation model, so it is called through /v1/evaluate rather
// than /v1/chat/completions. See https://roar-ai.com/docs/evaluate.
const response = await client.post('/evaluate', {
  body: {
    model: process.env.ROAR_MODEL ?? 'jev',
    state: 'The user asks: what is 17 * 23? The answer given is 391.',
    questions: {
      correct: {
        type: 'boolean',
        instructions: 'Is the answer arithmetically correct?',
      },
      confidence: {
        type: 'score',
        instructions: 'How confident are you in that judgement?',
        criteria: ['guessing', 'unsure', 'fairly sure', 'certain'],
      },
    },
  },
});

console.log(JSON.stringify(response.answers, null, 2));
