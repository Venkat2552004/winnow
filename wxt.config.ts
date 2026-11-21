import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    // Expose ROAR_* build-time values (notably ROAR_API_KEY) to import.meta.env.
    envPrefix: ['WXT_', 'ROAR_'],
  }),
  manifest: {
    name: 'Jev',
    description: 'Organize Gmail and de-slop your LinkedIn feed.',
    permissions: ['storage', 'identity'],
    host_permissions: [
      'https://mail.google.com/*',
      'https://*.linkedin.com/*',
      'https://gmail.googleapis.com/*',
      'https://oauth2.googleapis.com/*',
      'https://api.roar-ai.com/*',
      'https://api.sarvam.ai/*',
    ],
  },
});
