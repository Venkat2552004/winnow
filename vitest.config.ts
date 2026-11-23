import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    env: {
      ROAR_API_KEY: '',
      ROAR_BASE_URL: '',
      WXT_JEV_BASE_URL: '',
      WXT_JEV_API_KEY: '',
      WXT_SARVAM_API_KEY: '',
      WXT_GMAIL_CLIENT_ID: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: ['lib/**/*.d.ts'],
    },
  },
});
