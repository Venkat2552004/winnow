import { defineContentScript } from 'wxt/utils/define-content-script';
import type { PostScore } from '../../lib/winnow/types';
import {
  DIAGNOSE_MESSAGE,
  PROBE_MESSAGE,
  RESET_MESSAGE,
  TEST_BLUR_MESSAGE,
  type LinkedInDiagnostics,
  type TestBlurResult,
} from '../../lib/linkedin/diagnostics';
import { decidePost } from '../../lib/linkedin/decision';
import { extractPost, findPostRoots, getUrn } from '../../lib/linkedin/dom';
import { probeDom } from '../../lib/linkedin/probe';
import {
  BLUR_CLASS,
  OVERLAY_CLASS,
  blurPost,
  injectStyles,
  resetAll,
  unblurPost,
} from '../../lib/linkedin/overlay';
import { sendMessage } from '../../lib/messaging';
import { TaskQueue } from '../../lib/queue';
import { bumpStats } from '../../lib/stats';
import { getSettings, onSettingsChanged, type Settings } from '../../lib/storage';
import { errorMessage } from '../../lib/types';

const VISIBILITY_DELAY_MS = 300;
const SCAN_DEBOUNCE_MS = 200;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export default defineContentScript({
  matches: ['https://*.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    let settings: Settings | null = null;
    let scanTimer: number | undefined;
    let pill: HTMLElement | null = null;

    let lastRootCount = 0;
    let blurredCount = 0;
    let revealedCount = 0;
    let lastError: string | null = null;
    let lastSample: LinkedInDiagnostics['sample'] = null;

    const queue = new TaskQueue(2);
    const scores = new Map<HTMLElement, PostScore>();
    let pending = new WeakSet<HTMLElement>();
    let revealed = new WeakSet<HTMLElement>();
    let countedBlur = new WeakSet<HTMLElement>();

    const intersection = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          intersection.unobserve(element);
          void scoreWhenVisible(element);
        }
      },
      { rootMargin: '300px 0px' },
    );

    function debugLog(...args: unknown[]): void {
      if (settings?.linkedin.debug) console.info('[winnow]', ...args);
    }

    function active(): boolean {
      return Boolean(settings?.linkedin.enabled) && !settings?.linkedin.paused;
    }

    function diagnostics(): LinkedInDiagnostics {
      return {
        loaded: true,
        active: active(),
        roots: lastRootCount,
        scored: scores.size,
        blurred: blurredCount,
        revealed: revealedCount,
        lastError,
        sample: lastSample,
      };
    }

    function renderPill(): void {
      if (!settings?.linkedin.debug) {
        pill?.remove();
        pill = null;
        return;
      }
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'jev-debug-pill';
        document.body.appendChild(pill);
      }
      const d = diagnostics();
      pill.textContent = `Winnow · ${d.roots} posts · ${d.scored} scored · ${d.blurred} blurred · ${d.revealed} revealed${d.lastError ? ` · error: ${d.lastError}` : ''}`;
    }

    function applyDecision(element: HTMLElement, score: PostScore): void {
      if (!settings || revealed.has(element)) return;

      const decision = decidePost(score, settings.linkedin);
      if (decision.blur) {
        const added = blurPost(
          element,
          score,
          () => {
            revealed.add(element);
            revealedCount += 1;
            void bumpStats({ revealed: 1 });
            renderPill();
          },
          getUrn(element) ?? 'jev-post',
          decision.cause,
        );
        if (added && !countedBlur.has(element)) {
          countedBlur.add(element);
          blurredCount += 1;
          void bumpStats({ blurred: 1 });
          debugLog('blurred', score.score, score.reason);
        }
      } else {
        unblurPost(element);
      }
      renderPill();
    }

    function scan(): void {
      if (!active()) return;

      const roots = findPostRoots();
      lastRootCount = roots.length;
      debugLog(`scan: ${roots.length} post roots`);

      for (const element of roots) {
        if (scores.has(element) || pending.has(element)) continue;
        pending.add(element);
        intersection.observe(element);
      }

      // Repair posts whose overlay was wiped by a LinkedIn re-render.
      for (const [element, score] of scores) {
        if (!element.isConnected) {
          scores.delete(element);
          continue;
        }
        const needsRepair =
          !revealed.has(element) &&
          element.classList.contains(BLUR_CLASS) &&
          !element.querySelector(`.${OVERLAY_CLASS}`);
        if (needsRepair) applyDecision(element, score);
      }

      renderPill();
    }

    async function scoreWhenVisible(element: HTMLElement): Promise<void> {
      await delay(VISIBILITY_DELAY_MS);
      if (!active()) {
        pending.delete(element);
        return;
      }

      const post = extractPost(element);
      if (!post) {
        pending.delete(element);
        debugLog('skipped: no extractable text', element);
        return;
      }

      lastSample = { urn: post.urn, textLength: post.text.length, author: post.author };
      debugLog('scoring', post.urn, `${post.text.length} chars`, post.text.slice(0, 80));

      try {
        const score = await queue.run(() => sendMessage({ type: 'jev:scorePost', input: post }));
        scores.set(element, score);
        pending.delete(element);
        lastError = null;
        void bumpStats({ scored: 1 });
        debugLog('scored', post.urn, score.score, score.source, score.reason);
        applyDecision(element, score);
      } catch (error) {
        pending.delete(element);
        lastError = errorMessage(error);
        console.warn('[winnow] failed to score post', error);
        renderPill();
      }
    }

    function applySettings(): void {
      if (!settings) return;
      if (!active()) {
        resetAll();
        renderPill();
        return;
      }
      for (const [element, score] of scores) {
        if (!element.isConnected) {
          scores.delete(element);
          continue;
        }
        applyDecision(element, score);
      }
      scan();
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      const type = (message as { type?: string } | undefined)?.type;

      if (type === DIAGNOSE_MESSAGE) {
        sendResponse(diagnostics());
        return false;
      }

      if (type === PROBE_MESSAGE) {
        sendResponse(probeDom());
        return false;
      }

      if (type === RESET_MESSAGE) {
        resetAll();
        scores.clear();
        pending = new WeakSet<HTMLElement>();
        revealed = new WeakSet<HTMLElement>();
        countedBlur = new WeakSet<HTMLElement>();
        blurredCount = 0;
        revealedCount = 0;
        lastError = null;
        lastSample = null;
        scan();
        sendResponse({ ok: true });
        return false;
      }

      if (type === TEST_BLUR_MESSAGE) {
        const [first] = findPostRoots();
        if (!first) {
          sendResponse({ ok: false, error: 'No post roots found on this page' } satisfies TestBlurResult);
          return false;
        }
        const fake: PostScore = {
          score: 10,
          confidence: 1,
          labels: ['diagnostic'],
          reason: 'Diagnostic test blur',
          source: 'heuristic',
        };
        const urn = getUrn(first) ?? 'unknown';
        blurPost(first, fake, () => undefined, urn);
        sendResponse({ ok: true, urn } satisfies TestBlurResult);
        return false;
      }

      return false;
    });

    void (async () => {
      settings = await getSettings();
      injectStyles();
      console.info('[winnow] LinkedIn content script loaded');

      const observer = new MutationObserver(() => {
        if (scanTimer !== undefined) return;
        scanTimer = window.setTimeout(() => {
          scanTimer = undefined;
          scan();
        }, SCAN_DEBOUNCE_MS);
      });
      observer.observe(document.body, { childList: true, subtree: true });

      scan();
      onSettingsChanged((next) => {
        settings = next;
        applySettings();
      });
    })();
  },
});
