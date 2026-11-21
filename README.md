# Jev

A Chrome extension that does two things:

1. **Gmail organizer** — auto-labels recent mail by category, builds a priority view, and helps you unsubscribe from and archive bulk senders.
2. **LinkedIn de-slop** — scores feed posts for value and blurs the low-value ones behind a click-to-reveal overlay.

Both use the **Roar AI gateway** (OpenAI-compatible, via the official OpenAI SDK) as the primary classifier, with **Sarvam** as a fallback for low-confidence results. **Mock mode** uses deterministic local heuristics, so every feature works end to end without a network call.

Full design and roadmap: [`docs/PLAN.md`](docs/PLAN.md). Visual system: [`docs/DESIGN.md`](docs/DESIGN.md). Manual test checklist: [`docs/TESTING.md`](docs/TESTING.md).

## Status

| Phase | State |
|---|---|
| 0 — Scaffold | ✅ done |
| 1 — AI layer | ✅ done (mock + live client, fallback, cache, queue) |
| 2 — LinkedIn blur | ✅ done (detection, scoring, blur overlay, stats) |
| 3 — Gmail auth + read | ✅ done (OAuth, token refresh, metadata fetch) |
| 4 — Gmail classify + label | ✅ done (preview, Jev/* labels, batchModify, priority inbox) |
| 5 — Unsubscribe + cleanup | ✅ done (List-Unsubscribe, one-click POST, bulk archive/trash) |
| 6 — Polish | ✅ done (retries, cache eviction, onboarding, icons, docs) |
| 7 — Generative identity | ✅ done (seeded signals, auroras, avatars, score rings) |

## Design

Jev's look is **procedural**: every waveform, gradient, avatar, and score ring is derived from a stable seed — a message ID, sender email, post URN, or section name. The same item always draws the same mark, with no images to ship and no model call.

- **Signal marks** — a seeded five-bar waveform identifies each feature.
- **Auroras** — seeded mesh gradients behind the popup and settings headers.
- **Category hues** — security is red, bank green, invoices amber, travel cyan, legal violet.
- **Score rings** — a red → amber → green ramp with the number always visible.
- **Sender avatars** — seeded gradient circles with initials.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the primitives, seeds, and how to extend them.

## Setup

```bash
npm install
npm run dev
```

`npm run dev` opens a Chrome instance with the extension loaded and hot reload enabled.

To load it manually:

1. `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `.output/chrome-mv3`

> Unpacked extension IDs are derived from the folder path. If you move `.output/chrome-mv3`, the ID changes and the Gmail redirect URI must be updated.

## Configure

Open the extension's **Settings** page.

### AI

Jev uses the **Roar AI gateway** by default through the official OpenAI SDK. The `jev` model is an **evaluation** model, so Jev calls `POST /v1/evaluate` with typed questions instead of chat completions.

1. Add your key to `.env`:
   ```
   ROAR_API_KEY=...
   ```
   `.env` is gitignored. The key is read at build time and never committed.
2. Optional overrides: `ROAR_BASE_URL` (default `https://api.roar-ai.com/v1`) and `ROAR_MODEL` (default `jev`).
3. Rebuild the extension. The **AI provider** section shows the gateway URL and a masked key.
4. Test the gateway from the terminal:
   ```bash
   npm run test:roar
   ```

- **Mock mode** — turn on to use local heuristics without calling the gateway.
- **Sarvam fallback** — base URL, model, and key. Used only when the primary result is low confidence.
- **Privacy** — accept the data-sharing notice before using the extension.

### Gmail

1. Create a Google Cloud project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External, Testing) and add your Gmail address as a test user.
3. Create an OAuth client of type **Web application**.
4. Add this authorized redirect URI (the exact value is also shown in Jev's settings):
   ```
   https://YOUR_EXTENSION_ID.chromiumapp.org/
   ```
5. Paste the **client ID** into Jev → Gmail → OAuth client ID.
6. Click **Connect Gmail** and approve the `gmail.modify` scope.

The client secret is not needed — Jev uses the implicit flow.

### LinkedIn

- **Blur threshold** — default 35. Higher blurs more.
- **Pause** — stops scoring without disabling the extension.
- **Debug overlay** — shows a live diagnostic pill on LinkedIn.

Keys are stored in `chrome.storage.local` and never committed. `.env` is optional and only provides build-time defaults.

## Using Jev

### Gmail organizer

1. Settings → Gmail → **Preview classification** — classifies recent mail without writing anything.
2. Review the category and priority score for each message.
3. **Apply labels** — creates `Jev/*` labels and applies them with `batchModify`. Re-running only changes what differs.

The popup shows the top priority mail (score ≥ your threshold) with a direct link into Gmail.

### Unsubscribe & cleanup

- **Scan senders** — groups recent mail by sender, keeping only senders with a `List-Unsubscribe` header.
- **Unsubscribe selected** — sends RFC 8058 one-click POSTs directly, or opens the unsubscribe link / mailto in a background tab.
- **Archive after unsubscribe** — optionally removes that sender's scanned messages from the inbox.
- **Preview cleanup** — finds promotions, newsletters, and notifications older than the cleanup age. Starred and important mail is never included.
- **Archive / Trash** — removes `INBOX` or moves to Trash. Trash asks for confirmation.

### LinkedIn

Scroll the feed. Posts scoring below the threshold are blurred behind a reveal card showing the score ring, the reason, and a **Reveal post** button. After revealing, a compact `Jev <score>` badge stays on the post. The popup shows today's scored / blurred / revealed counts.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run compile` | Type-check only |
| `npm run test:roar` | Send one evaluation request to the `jev` model |
| `npm run zip` | Package for distribution |

## Layout

```
entrypoints/
  background.ts        message router, AI orchestration, Gmail jobs
  popup/               quick toggles, priority inbox, diagnostics
  options/             keys, OAuth client ID, onboarding, cleanup
  gmail.content/       Gmail content script shell
  linkedin.content/    LinkedIn content script
lib/
  jev/                 typed API client (live + mock) and contracts
  roar/                OpenAI SDK client for the Roar AI gateway
  llm/                 shared prompts and Sarvam fallback client
  gmail/               API, auth, labels, organizer, unsubscribe, cleanup
  linkedin/            detection, extraction, heuristics, overlay
  pipeline.ts          heuristic → Jev → Sarvam routing
  cache.ts             IndexedDB cache with eviction
  queue.ts             concurrency + retry
  http.ts              HTTP error classification
  ui/                  generative primitives, score ring, avatars, error boundary
  storage.ts           typed settings
  messaging.ts         typed runtime messages
scripts/
  test-roar.mjs        one-shot gateway smoke test
```

## Privacy

Email metadata (sender, subject, snippet) and LinkedIn post text are sent to the Roar AI gateway, and to Sarvam when the fallback is used. Full email bodies are never sent. No analytics, no telemetry.

## Troubleshooting

### LinkedIn posts aren't blurring

1. **Rebuild and reload.** Content scripts don't hot-swap into tabs that are already open.
   ```bash
   npm run build
   ```
   Then `chrome://extensions` → reload Jev → reload the LinkedIn tab.
2. **Turn on the debug overlay.** Settings → LinkedIn → *Debug overlay*. A pill appears bottom-right showing `posts · scored · blurred · revealed`.
3. **Popup → Developer tools → Diagnose.** Reports how many post roots were found and the last error.
4. **Popup → Developer tools → Test blur.** Blurs the first post with a fake score.
   - Test blur works, real scoring doesn't → extraction or API issue.
   - Test blur fails → the page selectors need updating (`lib/linkedin/dom.ts`).
5. **Popup → Developer tools → Test AI.** Sends one real email and one real post to the configured provider. The toast shows the provider, model, category, priority, and post score — or the exact error.
6. **Clear stale scores.** Popup → **Clear cache**. This also tells the open LinkedIn tab to drop its in-memory scores and re-scan. Old scores are cached for 24 hours; the cache key is versioned so a scoring change invalidates them automatically.
7. **Check the console** for `[jev]` logs (enable debug first).

Leave **Mock mode** on to use local heuristics. Sarvam is still used for posts the local heuristics can't confidently judge.

### Gmail errors

| Error | Fix |
|---|---|
| `redirect_uri_mismatch` | Copy the redirect URI from Jev's settings into Google Cloud exactly — the extension ID must match. |
| `invalid_client` | Client ID typo, or the client isn't type **Web application**. |
| `access_denied` | Your Gmail isn't in **Test users** on the consent screen. |
| `Gmail API has not been used` | Enable **Gmail API** in APIs & Services → Library. |
| `Gmail session expired` | Click **Connect Gmail** again — silent refresh failed. |
| `Gmail API rate limit reached` | Wait a moment and retry; Jev already retries once automatically. |
| `Could not reach the Gmail API` | Reload the extension so the new host permissions apply. |

### AI errors

- **Roar AI unreachable / rate limited** — Jev retries once, then falls back to local heuristics (and Sarvam if configured). Check `ROAR_API_KEY` and the gateway URL.
- **Sarvam rejected the credentials** — verify the key and model in Settings.
- **Roar AI rejected the credentials** — check `ROAR_API_KEY` in `.env`, then rebuild the extension.
- **Everything scores 55** — mock mode is on and no heuristic matched. Turn off **Mock mode** to use the gateway.
- **Everything scores 50 / "Scoring unavailable"** — the gateway call failed and no heuristic matched. Open **Popup → Developer tools → Test AI** to see the exact error, then **Clear cache** and reload the LinkedIn tab. Failures are no longer cached, so the next scroll retries.
- **Scores look stale after changing the model** — the cache key is versioned, but an open LinkedIn tab keeps scores in memory. Click **Clear cache** or reload the tab.
