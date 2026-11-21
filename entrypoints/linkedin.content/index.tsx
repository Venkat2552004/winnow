import { defineContentScript } from 'wxt/utils/define-content-script';
import type { PostScore } from '../../lib/jev/types';
import { extractPost, findPostRoots } from '../../lib/linkedin/dom';
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

const VISIBILITY_DELAY_MS = 300;
const SCAN_DEBOUNCE_MS = 200;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  runAt: 'document_idle',
  main() {
    let settings: Settings | null = null;
    let scanTimer: number | undefined;

    const queue = new TaskQueue(2);
    const scores = new Map<HTMLElement, PostScore>();
    const pending = new WeakSet<HTMLElement>();
    const revealed = new WeakSet<HTMLElement>();
    const countedBlur = new WeakSet<HTMLElement>();

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

    function active(): boolean {
      return Boolean(settings?.linkedin.enabled) && !settings?.linkedin.paused;
    }

    function applyDecision(element: HTMLElement, score: PostScore): void {
      if (!settings || revealed.has(element)) return;

      if (score.score < settings.linkedin.threshold) {
        const added = blurPost(element, score, () => {
          revealed.add(element);
          void bumpStats({ revealed: 1 });
        });
        if (added && !countedBlur.has(element)) {
          countedBlur.add(element);
          void bumpStats({ blurred: 1 });
        }
      } else {
        unblurPost(element);
      }
    }

    function scan(): void {
      if (!active()) return;

      for (const element of findPostRoots()) {
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
        return;
      }

      try {
        const score = await queue.run(() => sendMessage({ type: 'jev:scorePost', input: post }));
        scores.set(element, score);
        pending.delete(element);
        void bumpStats({ scored: 1 });
        applyDecision(element, score);
      } catch (error) {
        pending.delete(element);
        console.warn('[jev] failed to score post', error);
      }
    }

    function applySettings(): void {
      if (!settings) return;
      if (!active()) {
        resetAll();
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

    void (async () => {
      settings = await getSettings();
      injectStyles();

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
