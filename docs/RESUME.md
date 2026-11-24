# Winnow — resume notes

**Project:** Winnow — AI-powered Gmail organizer and LinkedIn feed filter
**Stack:** Chrome MV3, TypeScript, React, WXT, OpenAI SDK, IndexedDB, Gmail REST API, OAuth 2.0
**Repo:** https://github.com/Venkat2552004/winnow

---

## One-line summary

Built a Chrome MV3 extension that classifies and labels Gmail, filters low-value LinkedIn posts with an AI-backed value taxonomy, and degrades gracefully across provider failures, rate limits, and DOM changes.

---

## Resume bullets

Pick 4–6 and fill in the measured numbers after running the eval plan in `docs/EVALS.md`.

- Built a Chrome MV3 extension with two AI-powered workflows: Gmail classification/labeling and LinkedIn feed scoring, using TypeScript, React, WXT, the OpenAI SDK, IndexedDB, and the Gmail REST API.
- Designed a 16-category email taxonomy and five user presets, with priority floors, protected categories, idempotent label application, and cleanup safeguards for important and starred mail.
- Designed a 17-type LinkedIn post taxonomy with a value score, three presets, and per-type always-blur / always-keep overrides that take precedence over the score threshold.
- Built a provider-routing pipeline with Roar AI as the primary classifier, Sarvam as a low-confidence fallback, deterministic local heuristics, mock mode, retries, and IndexedDB caching.
- Hardened OAuth token refresh, Gmail rate-limit handling, cache versioning, label migration, and service-worker restarts; added a risk register and test matrix for the highest-risk failure modes.
- Built a Vitest suite of **119 tests across 17 files** and a golden-fixture eval harness; achieved **100% heuristic accuracy on 23 curated email fixtures** and **22 curated LinkedIn fixtures** (starter baseline).
- Added a CI quality gate for type-check, unit/integration tests, coverage, heuristic eval, production build, Playwright E2E, and secret scanning.
- Reached **58.6% line coverage** in the starter suite, with **97%+ on LinkedIn heuristics**, **100% on the LinkedIn decision engine**, **100% on cleanup/labels**, and **100% on the priority store**; the plan targets 80%+ on pure logic.
- Achieved **0 false positives and 0 false negatives** on the 22-post starter fixture set under the Balanced preset, scoring keep/blur through the shipped decision engine rather than a bare score comparison.

---

## Metrics to fill in

| Metric | Starter baseline | Target / next step | How measured |
|---|---|---|---|
| Email macro-F1 | **1.000** (23 curated fixtures) | Expand to 300+ fixtures | Golden email set |
| Important-category recall | **100%** (starter fixtures) | Keep ≥ 98% on expanded set | Golden email set |
| LinkedIn keep/blur accuracy | **100%** (22 curated fixtures, Balanced preset) | Expand to 300+ fixtures | Golden post set |
| False-positive blur rate | **0%** (starter fixtures) | Keep ≤ 5% on expanded set | Golden post set |
| p95 LinkedIn scoring latency | Not measured | ≤ 2.5 s | Performance test |
| Gmail preview (200 messages) | Not measured | ≤ 60 s cold / ≤ 20 s warm | Performance test |
| Cache hit rate | Not measured | ≥ 50% on repeat scroll | Instrumented run |
| Cost per 1,000 classifications | Not measured | Set provider budget | Provider usage |
| Test coverage | **58.6% lines** (starter) | 80%+ on pure logic | Vitest |
| Critical accessibility violations | Not measured | 0 | axe-core |

> The starter fixture numbers are small and curated to the heuristics. Do not present them as general accuracy. Expand the datasets and run the AI eval before quoting them externally.

---

## Interview talking points

### 1. Why the taxonomy matters

> “The first version scored posts with generic signals like ‘hype’ and ‘hashtag spam.’ That did not match how LinkedIn actually looks — almost every post has hashtags, and achievements, ads, and generic stories were slipping through. I rebuilt the classifier around 17 concrete post types, made the post type the main scoring prior, and only penalized hashtags when a post had no real commentary.”

### 2. How I handled provider failure

> “The extension has three layers: local heuristics, Roar AI, and Sarvam as a fallback. Clear-cut cases resolve locally; ambiguous cases go to Roar; low-confidence or failed calls escalate to Sarvam. Failures are not cached, so the next scroll retries. The UI always shows a readable error instead of a blank screen.”

### 3. How I protected user data

> “Content scripts never hold API keys. All network calls go through the background worker. Only sender, subject, snippet, and post text leave the browser — never full email bodies. The Roar request strips the browser `Origin` header with a declarativeNetRequest rule, and the repo has no committed secrets.”

### 4. How I made Gmail labeling safe

> “Labeling is idempotent: the second run reports `labeled 0 · skipped N`. Important categories are never cleanup-eligible, and starred or important mail is always excluded. Changing the label prefix or disabling a category removes stale labels instead of leaving duplicates.”

### 5. How I planned to know what breaks

> “I wrote a risk register and a test matrix before adding more features. The highest-risk areas are LinkedIn DOM churn, Gmail OAuth/token expiry, provider rate limits, service-worker restarts, and prompt injection. Each risk has a detection method, a mitigation, and a test ID. The eval plan covers unit, contract, integration, E2E, AI quality, performance, security, and accessibility.”

### 6. What I would improve next

> “I would add the automated harness first: Vitest for pure logic, Playwright for the extension, golden datasets for AI quality, and CI gates for regressions. Then I would add per-category confidence thresholds, user-configurable LinkedIn value categories, multilingual heuristics, and a label preview diff.”

---

## Short project description for a resume header

> **Winnow** — Chrome MV3 extension that organizes Gmail with AI-assisted category labels and filters low-value LinkedIn posts using a value-based post taxonomy. TypeScript, React, WXT, OpenAI SDK, Gmail REST API, IndexedDB, OAuth 2.0.

---

## What not to claim

- Do not claim measured accuracy or latency numbers until the eval harness has been run.
- Do not claim full test coverage; the plan is designed but the harness is the next step.
- Do not claim multi-account Gmail, i18n, or a Gmail in-page panel; those are roadmap items.
