# Winnow — Roadmap

## Now / Next / Later

| Horizon | Feature | Why |
|---|---|---|
| **Next** | Full-mailbox labeling mode | Current labeling is capped at 1,000 messages from the last 90 days. Users need a safe way to label the whole mailbox. |
| Next | AI eval runner with live providers | The heuristic eval is in place; the next step is measuring Roar/Sarvam quality, cost, and latency on expanded fixtures. |
| Next | Per-category confidence thresholds | Let users tune precision/recall per label instead of one global priority threshold. |
| **Done** | User-configurable LinkedIn value categories | Presets plus always-blur and always-keep overrides in the LinkedIn settings card. |
| Later | Multi-account Gmail | Support more than one connected Gmail account. |
| Later | i18n and multilingual heuristics | Current heuristics are English-first. |
| Later | Offline queue and better retry UX | Make long runs resilient to network loss. |
| Later | Label preview diff | Show exactly which labels will be added/removed before applying. |
| Later | Accessibility and keyboard shortcuts | Expand beyond the current keyboard-reachable overlay. |
| Later | Cost and latency budgets | Surface estimated AI cost/time before a large run. |

---

## Next: Full-mailbox labeling mode

### Problem

Today the Gmail flow is:

1. **Load recent mail** — previews 10 messages only.
2. **Preview classification** — fetches up to `maxMessages` (UI max 1,000) from the last `lookbackDays` (UI max 90).
3. **Apply labels** — applies labels only to the previewed rows.

So the current ceiling is **1,000 messages from the last 90 days per run**. Older mail is never fetched, and mail beyond the first 1,000 in the window is skipped.

### Goal

Let a user label their entire mailbox safely, with progress, pause/resume, and no data loss.

### UX

Settings → Gmail → **Label all mail**:

- Scope selector:
  - All mail
  - Inbox only
  - Date range
- Options:
  - Skip Promotions / Social / Spam / Trash
  - Dry run (classify only, no labels)
  - Apply priority label
- Summary before starting:
  - Estimated messages
  - Estimated AI calls after heuristic pre-filter
  - Estimated time and cost warning
- Progress:
  - Total / processed / labeled / skipped / failed
  - Progress bar
  - Pause / Resume / Cancel
  - Last error
- Completion:
  - Summary with counts and a link to Gmail
  - “Run again” is idempotent

### Technical design

#### 1. Paginated message discovery

Add a paginated iterator around `users.messages.list`:

- Query: `-in:chats -in:spam -in:trash` plus optional scope filters.
- Page size: 100 (Gmail API max).
- Persist `pageToken` so a run can resume.
- Do not stop at `maxMessages`; stop when `nextPageToken` is absent or the user cancels.

#### 2. Persistent job state

Store the job in `chrome.storage.local` under a versioned key, e.g. `jev.gmail.job.v1`:

```ts
interface LabelAllJob {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'cancelled' | 'done' | 'error';
  query: string;
  pageToken: string | null;
  processed: number;
  labeled: number;
  skipped: number;
  failed: number;
  startedAt: number;
  updatedAt: number;
  lastError: string | null;
}
```

The MV3 service worker can be terminated mid-run, so the job must be resumable from storage.

#### 3. Resume with alarms

- Add the `alarms` permission.
- Create a periodic alarm (e.g. every 1 minute) while a job is running.
- On alarm or worker startup, resume a `running` job from its persisted state.
- Clear the alarm when the job is done, paused, or cancelled.

#### 4. Chunked metadata + classification

- Fetch metadata in chunks of 50–100 messages.
- Classify with the existing `TaskQueue` (concurrency 3–5).
- Reuse the existing cache so repeat runs are cheap.
- Persist progress after each chunk.

#### 5. Chunked label application

`users.messages.batchModify` accepts up to 1,000 IDs per request. The current `applyLabels` groups by add/remove set but does not chunk. Add:

- Split each group’s IDs into chunks of ≤1,000.
- Apply chunks sequentially with retry/backoff.
- Persist the labeled state after each chunk.

#### 6. Rate limits and backoff

- Gmail API: respect 429/5xx with exponential backoff; pause the job on repeated failures.
- AI providers: reuse the existing retry/fallback logic; surface provider errors in the job state.
- Add a small delay between chunks to avoid quota spikes.

#### 7. Safety

- Never fetch full email bodies; metadata only.
- Never label spam or trash.
- Never auto-archive or delete.
- Important categories remain protected from cleanup.
- Labeling is additive by default; stale-label removal only happens for messages Winnow previously labeled.
- Dry run must write nothing.
- Cancel must stop before the next chunk and leave already-labeled messages intact.

### Acceptance criteria

- [ ] Can label 10,000+ messages across multiple runs without losing progress.
- [ ] Resumes after a service worker restart.
- [ ] Shows progress and supports pause/resume/cancel.
- [ ] Re-running is idempotent (`labeled 0` for already-correct messages).
- [ ] `batchModify` is chunked to ≤1,000 IDs.
- [ ] Handles 429/5xx with backoff and a readable error.
- [ ] Dry run writes nothing.
- [ ] No full email bodies are fetched.
- [ ] Spam and trash are never labeled.
- [ ] Important categories are never cleanup-eligible.

### Test plan

- **Unit:** pagination, chunking, job-state transitions, resume logic.
- **Integration:** mock Gmail API with 2,500 messages, 429 responses, and a simulated worker restart.
- **E2E:** options UI progress, pause/resume, cancel, dry run.
- **Performance:** 10,000 messages; memory, time, and API call counts.
- **Safety:** no spam/trash, no full bodies, idempotency, protected categories.

### Risks

| Risk | Mitigation |
|---|---|
| Gmail API quota exhaustion | Chunking, backoff, pause/resume, small delays |
| MV3 worker termination | Persist job state, resume via alarms |
| AI cost/time on large mailboxes | Heuristic pre-filter, cache, dry-run estimate, cost warning |
| Partial failures | Per-chunk progress, retry, readable error, resume |
| Label collisions | Preview, prefix option, idempotent apply |
| User cancels mid-run | Stop before next chunk; already-labeled mail stays labeled |

### Out of scope

- Auto-archive or auto-delete
- Reading full email bodies
- Multi-account Gmail
- Server-side job execution
- Background labeling without user confirmation

---

## Next: AI eval runner with live providers

- Add `npm run eval:ai` that runs the golden fixtures through Roar and Sarvam.
- Compare against the heuristic baseline.
- Report accuracy, macro-F1, keep/blur accuracy (split by blur cause), calibration, latency, and cost.
- Support `--mock` for CI and `--live` for manual runs.
- Gate releases on regression thresholds from `docs/EVALS.md`.
- Evaluate every preset, not just Balanced, so override lists are covered at parity.

## Next: Per-category confidence thresholds

- Let users set a confidence floor per label.
- Low-confidence results fall back to `Other` or stay unlabeled.
- Add a settings UI and a preview of the effect.

## Shipped: User-configurable LinkedIn value categories

- Balanced, Focus, and Chill presets seed the category lists.
- Every post type can be moved to **Always blur** or **Always keep** in settings.
- Keep wins over blur when a type is in both lists.
- Types in neither list use the existing **Blur below** score threshold.
- The popup's Feed tab shows the active preset and list counts, with an Edit shortcut.

## Later: Multi-account Gmail

- Store tokens per account.
- Add an account switcher.
- Keep the current single-account flow as the default.

## Later: i18n and multilingual heuristics

- Add language detection.
- Keep English heuristics as a fast path.
- Fall back to the AI for non-English text.
- Add localized UI strings.

## Later: Offline queue and retry UX

- Queue failed classifications and label writes.
- Retry when the network returns.
- Show a clear “pending” state.

## Later: Label preview diff

- Show exactly which labels will be added or removed per message.
- Allow deselecting individual changes before applying.

## Later: Accessibility and keyboard shortcuts

- Full keyboard navigation for popup and options.
- Shortcuts for pause/resume and reveal.
- axe-core checks in CI.

## Later: Cost and latency budgets

- Estimate AI calls, time, and cost before large runs.
- Show provider usage in settings.
- Add a budget warning for full-mailbox runs.
