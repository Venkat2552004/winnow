import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Jev',
    description: 'Organize Gmail and de-slop your LinkedIn feed.',
    permissions: ['storage', 'identity'],
    host_permissions: [
      'https://mail.google.com/*',
      'https://*.linkedin.com/*',
      'https://gmail.googleapis.com/*',
      'https://oauth2.googleapis.com/*',
    ],
    optional_host_permissions: ['https://*/*'],
  },
});
