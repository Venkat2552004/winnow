import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['https://mail.google.com/*'],
  main() {
    document.documentElement.dataset.jevGmail = 'loaded';
    console.info('[winnow] Gmail content script loaded');
  },
});
