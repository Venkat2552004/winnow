# Jev — Chrome Extension Plan

**Status:** Draft v0.1 · awaiting sign-off
**Scope:** Personal use, loaded unpacked (no Chrome Web Store review in v1)

---

## 1. Product summary

A single MV3 extension, **Jev**, with two independent features:

| # | Feature | Surface | What it does |
|---|---------|---------|--------------|
| 1 | **Gmail organizer** | `mail.google.com` | Auto-labels mail by category, surfaces a priority view, and provides bulk-sender unsubscribe + archive cleanup. |
| 2 | **LinkedIn de-slop** | `linkedin.com/feed` | Scores feed posts for value and blurs low-value ones behind a click-to-reveal overlay. |

Both features share one AI layer: **Jev API** (primary) with **Sarvam** as a fallback for low-confidence results.

---

## 2. Decisions locked in

| Decision | Choice |
|---|---|
| Features | Two (Gmail + LinkedIn). Architecture stays extensible for a third. |
| Gmail access | Gmail REST API + OAuth 2.0 (`chrome.identity.launchWebAuthFlow`) |
| Gmail features | Auto-label + priority inbox **and** unsubscribe + cleanup |
| LinkedIn scoring | Jev API score, with local heuristics as a free pre-filter |
| AI backend | Jev API (custom REST) primary → Sarvam fallback on low confidence / errors |
| Stack | WXT + React + TypeScript, MV3 |
| Distribution | Unpacked, personal use |
| Blur UX | Blur + click-to-reveal, threshold slider in popup |
| Key storage | `chrome.storage.local` via options page (never in repo) |
| Jev API status | Not live yet → build against a typed interface with a **mock mode** |

---

## 3. Architecture

```
jev/
├── wxt.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── entrypoints/
│   ├── background.ts              # service worker: message router, queues, API calls
│   ├── popup/                     # global toggles, thresholds, stats
│   ├── options/                   # keys, OAuth client ID, test-connection, cache reset
│   ├── gmail.content/             # content script + Jev panel on mail.google.com
│   └── linkedin.content/          # content script + blur overlay on linkedin.com
├── lib/
│   ├── jev/client.ts              # typed Jev client (real + mock)
│   ├── jev/types.ts               # request/response contracts
│   ├── llm/sarvam.ts              # fallback client (OpenAI-compatible)
│   ├── gmail/auth.ts              # OAuth flow, token cache, silent re-auth
│   ├── gmail/api.ts               # Gmail REST wrapper (list/get/batchModify/labels)
│   ├── gmail/unsubscribe.ts       # List-Unsubscribe parsing + one-click POST
│   ├── linkedin/dom.ts            # post detection + text extraction
│   ├── linkedin/heuristics.ts     # cheap pre-filter rules
│   ├── queue.ts                   # concurrency-limited queue w/ retry+backoff
│   ├── cache.ts                   # IndexedDB score/classification cache
│   ├── storage.ts                 # typed chrome.storage wrapper + schema
│   └── messaging.ts               # typed runtime message bus
└── docs/PLAN.md
```

**Key principle:** content scripts never hold API keys. All network calls go through the background service worker via typed messages.

### Permissions

```jsonc
{
  "permissions": ["storage", "identity"],
  "host_permissions": [
    "https://mail.google.com/*",
    "https://www.linkedin.com/*",
    "https://www.googleapis.com/*"
  ],
  "optional_host_permissions": ["https://*/*"]  // requested on first unsubscribe POST
}
```

---

## 4. Jev API contract (proposed — needs your confirmation)

```http
POST {baseUrl}/v1/classify/email
Authorization: Bearer <jev_key>
Content-Type: application/json

{
  "message": {
    "id": "18c...",
    "from": "news@substack.com",
    "subject": "Weekly digest",
    "snippet": "This week in...",
    "hasListUnsubscribe": true,
    "receivedAt": "2026-11-20T10:00:00Z"
  }
}
```

```json
{
  "category": "action_required | personal | bank_statement | invoice | receipt | security_alert | travel | legal | newsletter | notification | promotion | other",
  "priority": 0,
  "confidence": 0.0,
  "reason": "string"
}
```

**Category taxonomy.** Categories marked ★ are *important*: they get a priority floor and are never auto-archived by cleanup.

| Category | Meaning | Priority floor |
|---|---|---|
| ★ `security_alert` | Password resets, 2FA, new login, suspicious activity | 90 |
| ★ `bank_statement` | Bank/credit-card statements, account summaries, tax docs | 85 |
| ★ `invoice` | Bills due, invoices, payment requests | 80 |
| ★ `travel` | Bookings, itineraries, boarding passes, cancellations | 75 |
| ★ `legal` | Contracts, insurance, government/tax correspondence | 75 |
| ★ `action_required` | Needs a reply or a decision | 70 |
| ★ `personal` | Real human correspondence | 60 |
| `receipt` | Purchase confirmations, order shipped | 40 |
| `notification` | App/social/service notifications | 30 |
| `newsletter` | Opted-in digests and content | 20 |
| `promotion` | Marketing, sales, offers | 10 |
| `other` | Unclassified | 30 |

```http
POST {baseUrl}/v1/score/post
Authorization: Bearer <jev_key>

{
  "post": {
    "urn": "urn:li:activity:123",
    "author": "Jane Doe",
    "text": "I'm thrilled to announce...",
    "isRepost": false,
    "hasMedia": true,
    "likes": 1200,
    "comments": 340
  }
}
```

```json
{
  "score": 0,
  "confidence": 0.0,
  "labels": ["engagement_bait", "promotional"],
  "reason": "string"
}
```

**Mock mode:** if no Jev key is set (or `JEV_MOCK=1`), the client returns deterministic heuristic-derived responses. The entire extension is usable end-to-end before the API exists. Swapping in the real API is a one-file change.

**Fallback routing:** if `confidence < 0.6` or the Jev call errors/times out (2s), escalate to Sarvam with a compact prompt. Results cached either way.

---

## 5. Feature detail

### 5.1 Gmail — auto-label + priority

**Flow**
1. Background job fetches recent mail: `users.messages.list` (default: last 7 days, cap 200, paginated).
2. Fetch metadata only: `users.messages.get?format=metadata` with `From, Subject, Date, List-Unsubscribe, List-Id` + `snippet`.
3. **Heuristic pre-filter** (no API cost): `List-Unsubscribe` present → newsletter candidate; `noreply@`/`no-reply@` → notification; known receipt domains → receipt; else → send to Jev.
4. Jev classifies → category + priority + confidence.
5. Create missing labels once, then `users.messages.batchModify`:

   ```
   Jev/Priority
   Jev/Action
   Jev/Personal
   Jev/Security
   Jev/Travel
   Jev/Legal
   Jev/Finance
   Jev/Finance/Bank
   Jev/Finance/Receipts
   Jev/Newsletter
   Jev/Notifications
   Jev/Promotions
   ```

   Mapping: `bank_statement → Jev/Finance/Bank`, `invoice`/`receipt → Jev/Finance/Receipts`, `security_alert → Jev/Security`, `travel → Jev/Travel`, `legal → Jev/Legal`, `action_required → Jev/Action`, `personal → Jev/Personal`, `newsletter → Jev/Newsletter`, `notification → Jev/Notifications`, `promotion → Jev/Promotions`.
6. Idempotency: store `messageId → labelVersion` so re-runs don't re-classify or re-label.

**Priority view:** `Jev/Priority` label applied when `priority >= 70` (which includes every ★ category by floor). A floating **Jev** button on Gmail opens a panel listing top priority threads (subject, sender, age, category, reason). No surgery on Gmail's own DOM.

**Safety:** v1 only *adds* labels. No auto-archive, no auto-delete. Cleanup's "archive all" is manual, confirmed, and refuses ★ categories.

### 5.2 Gmail — unsubscribe + cleanup

**Unsubscribe**
- Parse `List-Unsubscribe` header: prefer HTTPS one-click (RFC 8058, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`), fall back to `mailto:` (opens compose).
- HTTPS POST runs from the background worker; requests `optional_host_permissions` on first use.
- Result recorded per sender so the UI shows "unsubscribed" state.

**Cleanup**
- Aggregate by sender domain: message count, last received, unsubscribe support.
- "Top bulk senders" list sorted by volume.
- Actions per sender: **Unsubscribe**, **Archive all** (`batchModify` remove `INBOX`), both behind a confirmation with a count preview.
- Dry-run preview before any bulk action.

### 5.3 LinkedIn — blur low-value posts

**Detection**
- `MutationObserver` on the feed + `IntersectionObserver` so only visible posts get scored.
- Resilient selectors: `[data-urn^="urn:li:activity"]`, `.feed-shared-update-v2`, text via `.update-components-text` / `.feed-shared-text`, with fallbacks.
- Extract: URN, author, text, isRepost, hasMedia, likes, comments.

**Heuristic pre-filter (free, instant)**
- Engagement bait: "agree?", "thoughts?", "comment YES", "DM me", "follow for more".
- Hype: "thrilled to announce", "humbled", "🚀", "game-changer".
- Hashtag spam (>5), link-in-comments, webinar/signup promos, reposts, near-empty text.
- Clear-cut cases resolve locally; ambiguous ones go to Jev.

**Scoring**
- Queue with max 2 concurrent, 300ms visibility debounce, retry with backoff.
- Cache by URN + text hash in IndexedDB (scrolling back is free).
- Threshold default 35, adjustable 0–100 in popup.

**Blur UX**
- Card gets `filter: blur(8px)` + overlay: `Low value · 23/100 · click to reveal`.
- Click reveals for the session; score badge stays visible.
- Popup: on/off toggle, threshold slider, "pause on this site", today's stats (scored / blurred / revealed).

---

## 6. Execution plan

| Phase | Work | Est. |
|---|---|---|
| **0 — Scaffold** ✅ | WXT + React + TS init, manifest, typed messaging + storage, popup + options shells, lint/format. Loads unpacked. | 0.5 d |
| **1 — AI layer** ✅ | Jev client + mock mode, Sarvam fallback, IndexedDB cache, concurrency queue, confidence routing, "Test connection" in options. | 1 d |
| **2 — LinkedIn** ✅ | Post detection, extraction, heuristics, scoring queue, blur overlay + reveal, threshold, pause, stats. Works fully on mock Jev. | 1.5 d |
| **3 — Gmail auth + read** ✅ | OAuth via `launchWebAuthFlow`, token cache + silent re-auth, Gmail REST wrapper, metadata fetch. Options shows connected account. | 1 d |
| **4 — Gmail classify + label** ✅ | Pre-filter, Jev classification, label creation, `batchModify`, idempotency, priority panel. | 1.5 d |
| **5 — Unsubscribe + cleanup** ✅ | `List-Unsubscribe` parsing, one-click POST + optional permission, mailto fallback, bulk-sender aggregation, archive-all with confirmation. | 1 d |
| **6 — Polish** ✅ | Error/rate-limit states, cache eviction, consent notice, README + manual test checklist. | 1 d |

**Total: ~7 working days.** Phases 2 and 3 are independent and can be built in parallel.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Gmail OAuth in "Testing" mode → 7-day token expiry, consent screens | Publish app to "In production" (unverified, ≤100 users) for personal use; silent re-auth via `prompt=none`; clear error state with "Reconnect". |
| Gmail DOM changes break injected UI | Don't modify Gmail's DOM; own floating panel + API-driven data. |
| LinkedIn class-name churn | Multi-selector fallbacks keyed on `data-urn`; feature flag to disable; selectors isolated in one file. |
| LinkedIn ToS | Read-only DOM, local blur, no automated actions or scraping to a server. Low risk, documented. |
| Per-post AI cost/latency | Heuristics pre-filter, IndexedDB cache, 2-way concurrency, visibility debounce, threshold. |
| Unsubscribe POST needs broad host access | `optional_host_permissions` requested at click time, not install time. |
| Jev API not live | Mock mode + typed interface; real client is a drop-in swap. |
| Sending email content to a third party | One-time consent notice; only metadata + snippet sent, never full bodies; no analytics. |

---

## 8. Open questions (blocking sign-off)

1. **Jev API contract** — approve the proposed endpoints above, or paste the real docs (base URL, auth header, request/response shapes, rate limits).
2. **Google Cloud** — confirm OAuth client type **Web application** and that scope `gmail.modify` is acceptable (read + label changes, no send).
3. **Sarvam fallback model** — default to `deepseekv4.1-flash-1017` at `https://api.sarvam.ai/v2/chat/completions` (matches your OpenCode config)? Or a different Sarvam model?
4. **Auto-archive** — confirm v1 is label-only (no destructive actions). Recommended.
5. **Third feature** — parked; the phase structure leaves room for it after Phase 6.
