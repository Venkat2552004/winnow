# Jev

A Chrome extension that does two things:

1. **Gmail organizer** — auto-labels recent mail by category, builds a priority view, and helps you unsubscribe from and archive bulk senders.
2. **LinkedIn de-slop** — scores feed posts for value and blurs the low-value ones behind a click-to-reveal overlay.

Both use the **Jev API** as the primary classifier, with **Sarvam** as a fallback for low-confidence results. Until the Jev API is live, the extension runs in **mock mode** using deterministic local heuristics — every feature works end to end.

Full design and roadmap: [`docs/PLAN.md`](docs/PLAN.md).

## Status

| Phase | State |
|---|---|
| 0 — Scaffold | ✅ done |
| 1 — AI layer | ✅ done (mock + live client, fallback, cache, queue) |
| 2 — LinkedIn blur | ✅ done (detection, scoring, blur overlay, stats) |
| 3 — Gmail auth + read | ⏳ next |
| 4 — Gmail classify + label | ⏳ |
| 5 — Unsubscribe + cleanup | ⏳ |
| 6 — Polish | ⏳ |

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

## Configure

Open the extension's **Settings** page:

- **Jev API** — base URL and key. Leave **Mock mode** on to use local heuristics.
- **Sarvam fallback** — base URL, model, and key. Used only when Jev is unavailable or unsure.
- **Gmail** — OAuth client ID from your Google Cloud project (scope `gmail.modify`).
- **LinkedIn** — blur threshold (default 35).
- **Privacy** — accept the data-sharing notice.

Keys are stored in `chrome.storage.local` and never committed. `.env` is optional and only provides build-time defaults.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run compile` | Type-check only |
| `npm run zip` | Package for distribution |

## Layout

```
entrypoints/
  background.ts        message router, AI orchestration
  popup/               quick toggles + threshold
  options/             keys, OAuth client ID, privacy
  gmail.content/       Gmail content script
  linkedin.content/    LinkedIn content script
lib/
  jev/                 typed API client (live + mock) and contracts
  llm/                 Sarvam fallback client
  gmail/               email heuristics
  linkedin/            post heuristics
  pipeline.ts          heuristic → Jev → Sarvam routing
  cache.ts             IndexedDB cache
  queue.ts             concurrency + retry
  storage.ts           typed settings
  messaging.ts         typed runtime messages
```

## Privacy

Email metadata (sender, subject, snippet) and LinkedIn post text are sent to the Jev API, and to Sarvam when the fallback is used. Full email bodies are never sent. No analytics, no telemetry.
