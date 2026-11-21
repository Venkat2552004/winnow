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
});

const completion = await client.chat.completions.create({
  model: process.env.ROAR_MODEL ?? 'llama-3.3-70b',
  messages: [
    {
      role: 'system',
      content: 'You are a concise assistant. Follow the user instruction exactly.',
    },
    {
      role: 'user',
      content: 'What is 17 * 23? Reply with only the number.',
    },
  ],
  temperature: 0,
});

const reply = completion.choices?.[0]?.message?.content;
if (!reply) {
  console.error('The gateway returned no message content.');
  console.error(JSON.stringify(completion, null, 2));
  process.exit(1);
}

console.log(reply.trim());
