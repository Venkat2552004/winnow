import { defineBackground } from 'wxt/utils/define-background';
import { cacheClear } from '../lib/cache';
import type { Envelope, Handlers, Request } from '../lib/messaging';
import { classifyEmail, scorePost } from '../lib/pipeline';
import { getSettings, isJevLive, updateSettings } from '../lib/storage';
import { errorMessage } from '../lib/types';

export default defineBackground(() => {
  const handlers: Handlers = {
    ping: async () => {
      const settings = await getSettings();
      return {
        version: chrome.runtime.getManifest().version,
        mode: isJevLive(settings) ? 'live' : 'mock',
      };
    },
    'settings:get': () => getSettings(),
    'settings:update': ({ patch }) => updateSettings(patch),
    'jev:classifyEmail': async ({ input }) => classifyEmail(input, await getSettings()),
    'jev:scorePost': async ({ input }) => scorePost(input, await getSettings()),
    'cache:clear': async () => {
      await cacheClear();
      return { cleared: true };
    },
  };

  chrome.runtime.onMessage.addListener((message: Request, _sender, sendResponse) => {
    const type = (message as Request | undefined)?.type;
    if (!type || !(type in handlers)) return false;

    const handler = handlers[type] as (request: Request) => Promise<unknown>;
    handler(message)
      .then((data) => sendResponse({ ok: true, data } satisfies Envelope<unknown>))
      .catch((error) =>
        sendResponse({ ok: false, error: errorMessage(error) } satisfies Envelope<never>),
      );
    return true;
  });
});
