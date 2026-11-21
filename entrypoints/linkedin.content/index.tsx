import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main() {
    if (!location.pathname.startsWith('/feed')) return;
    document.documentElement.dataset.jevLinkedin = 'loaded';
    console.info('[jev] LinkedIn content script loaded');
  },
});
