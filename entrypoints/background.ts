import { defineBackground } from 'wxt/utils/define-background';
import { cacheClear, cachePrune } from '../lib/cache';
import { getMessageMeta, GmailApiError, listMessageIds, batchModify } from '../lib/gmail/api';
import {
  clearToken,
  connectGmail,
  disconnectGmail,
  getAccessToken,
  getConnectedEmail,
} from '../lib/gmail/auth';
import { applyCleanup, previewCleanup } from '../lib/gmail/cleanup';
import type { GmailMessageMeta } from '../lib/gmail/types';
import {
  applyLabels,
  clearOrganizerState,
  getPriorityItems,
  previewRecent,
} from '../lib/gmail/organizer';
import { scanUnsubscribes } from '../lib/gmail/senders';
import { performUnsubscribe } from '../lib/gmail/unsubscribe';
import type { Envelope, Handlers, Request } from '../lib/messaging';
import { createJevClient, resolveJevConfig } from '../lib/jev/client';
import { classifyEmail, scorePost } from '../lib/pipeline';
import { TaskQueue } from '../lib/queue';
import { isRoarBaseUrl, ROAR_MODEL } from '../lib/roar/config';
import { getSettings, updateSettings } from '../lib/storage';
import { errorMessage } from '../lib/types';

const metadataQueue = new TaskQueue(5);

export default defineBackground(() => {
  // Trim stale cache entries whenever the worker starts.
  void cachePrune().catch(() => undefined);

  // Roar rejects browser-origin requests, so a static rule strips Origin for
  // api.roar-ai.com. Warn if the rule is missing after an update.
  void chrome.declarativeNetRequest
    ?.getEnabledRulesets()
    .then((ids) => {
      if (!ids.includes('roar-headers')) {
        console.warn('[jev] Roar header rule is not enabled — requests may get a 403');
      }
    })
    .catch(() => undefined);

  async function withGmailToken<T>(run: (token: string) => Promise<T>): Promise<T> {
    const settings = await getSettings();
    if (!settings.gmail.clientId) {
      throw new Error('Add your Gmail OAuth client ID in settings first');
    }

    let token = await getAccessToken(settings.gmail.clientId, false);
    try {
      return await run(token);
    } catch (error) {
      if (error instanceof GmailApiError && error.status === 401) {
        await clearToken();
        token = await getAccessToken(settings.gmail.clientId, false);
        return run(token);
      }
      throw error;
    }
  }

  const handlers: Handlers = {
    ping: async () => {
      const settings = await getSettings();
      const jev = resolveJevConfig(settings.jev);
      const live = !jev.mock && Boolean(jev.baseUrl && jev.apiKey);
      return {
        version: chrome.runtime.getManifest().version,
        mode: live ? 'live' : 'mock',
        provider: live ? (isRoarBaseUrl(jev.baseUrl) ? 'roar' : 'jev') : 'mock',
      };
    },
    'settings:get': () => getSettings(),
    'settings:update': ({ patch }) => updateSettings(patch),
    'jev:classifyEmail': async ({ input }) => classifyEmail(input, await getSettings()),
    'jev:scorePost': async ({ input }) => scorePost(input, await getSettings()),
    'jev:test': async () => {
      const settings = await getSettings();
      const jev = createJevClient(settings.jev);
      const resolved = resolveJevConfig(settings.jev);
      const provider =
        jev.mode === 'mock' ? 'mock' : isRoarBaseUrl(resolved.baseUrl) ? 'roar' : 'jev';

      const email = await jev.classifyEmail({
        id: 'jev-test-email',
        from: 'billing@stripe.com',
        subject: 'Your invoice for November is ready',
        snippet: 'Invoice #1042 for $49.00 is due on 30 November.',
        hasListUnsubscribe: false,
        receivedAt: new Date().toISOString(),
      });

      const post = await jev.scorePost({
        urn: 'urn:li:jev:test',
        author: 'Jev test',
        text: 'We migrated 40 services to Postgres 17 over six months. The biggest win was deleting 12,000 lines of ORM code. Here is the migration plan we used, including the rollback steps.',
        isRepost: false,
        hasMedia: false,
        likes: 10,
        comments: 2,
      });

      return { email, post, provider, model: ROAR_MODEL };
    },
    'cache:clear': async () => {
      await cacheClear();
      return { cleared: true };
    },

    'gmail:status': async () => {
      const settings = await getSettings();
      const email = await getConnectedEmail();
      return {
        connected: Boolean(email),
        email,
        clientIdConfigured: Boolean(settings.gmail.clientId),
      };
    },
    'gmail:connect': async () => {
      const settings = await getSettings();
      if (!settings.gmail.clientId) {
        throw new Error('Add your Gmail OAuth client ID in settings first');
      }
      const email = await connectGmail(settings.gmail.clientId);
      return { email };
    },
    'gmail:disconnect': async () => {
      await disconnectGmail();
      return { ok: true };
    },
    'gmail:recent': async ({ limit }) => {
      const settings = await getSettings();
      const count = limit ?? 10;

      return withGmailToken(async (token) => {
        const ids = await listMessageIds(
          token,
          `newer_than:${settings.gmail.lookbackDays}d -in:chats`,
          count,
        );
        const messages: GmailMessageMeta[] = await Promise.all(
          ids.map((id) => metadataQueue.run(() => getMessageMeta(token, id))),
        );
        return { messages };
      });
    },
    'gmail:preview': async () => {
      const settings = await getSettings();
      return withGmailToken(async (token) => ({ rows: await previewRecent(token, settings) }));
    },
    'gmail:apply': async ({ rows }) => {
      return withGmailToken(async (token) => applyLabels(token, rows));
    },
    'gmail:priority': async () => {
      const settings = await getSettings();
      const items = await getPriorityItems(50);
      return {
        items: items.filter((item) => item.priority >= settings.gmail.priorityThreshold),
      };
    },
    'gmail:reset': async () => {
      await clearOrganizerState();
      return { ok: true };
    },
    'gmail:unsubscribe:scan': async () => {
      const settings = await getSettings();
      return withGmailToken(async (token) => ({
        senders: await scanUnsubscribes(token, settings),
      }));
    },
    'gmail:unsubscribe:run': async ({ sender, archive }) => {
      const result = await performUnsubscribe({
        https: sender.https,
        mailto: sender.mailto,
        oneClick: sender.oneClick,
      });

      let archived = 0;
      if (archive && sender.messageIds.length > 0) {
        archived = await withGmailToken(async (token) => {
          await batchModify(token, sender.messageIds, [], ['INBOX']);
          return sender.messageIds.length;
        });
      }

      return { result, archived };
    },
    'gmail:cleanup:preview': async () => {
      const settings = await getSettings();
      return withGmailToken(async (token) => previewCleanup(token, settings));
    },
    'gmail:cleanup:apply': async ({ ids, mode }) => {
      return withGmailToken(async (token) => applyCleanup(token, ids, mode));
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
