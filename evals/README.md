# Winnow evals

Starter golden datasets and a heuristic eval runner.

## Run

```bash
npm run eval:heuristics
```

The runner reads the JSONL fixtures, runs the local heuristics, writes a report to `evals/reports/`, and exits non-zero if email accuracy or LinkedIn type accuracy drops below 80%.

## Fixtures

### `fixtures/emails.jsonl`

One JSON object per line:

```json
{
  "id": "email-security",
  "from": "accounts@google.com",
  "subject": "Security alert",
  "snippet": "Your verification code is 482913.",
  "hasListUnsubscribe": false,
  "receivedAt": "2026-11-20T10:00:00Z",
  "expectedCategory": "security_alert",
  "expectedPriorityBand": "90-100",
  "important": true,
  "requiresAI": false,
  "notes": "Verification code and security alert"
}
```

- `expectedCategory` must be one of the 16 email categories.
- `requiresAI: true` skips the item in the heuristic eval; it belongs in the AI eval.
- `important` marks categories that must never be cleanup-eligible.

### `fixtures/posts.jsonl`

One JSON object per line:

```json
{
  "id": "post-job",
  "urn": "urn:li:activity:1001",
  "author": "Test Author",
  "text": "We're hiring a Senior Backend Engineer...",
  "isRepost": false,
  "hasMedia": false,
  "likes": 10,
  "comments": 2,
  "expectedType": "job_opportunity",
  "expectedKeepAt35": true,
  "requiresAI": false,
  "notes": "Job posting with specifics"
}
```

- `expectedType` must be one of the 17 post types, or `skip` for media-only posts.
- `expectedKeepAt35` is the expected keep/blur decision at the default threshold.
- `requiresAI: true` skips the item in the heuristic eval; it belongs in the AI eval.

## Adding examples

- Prefer synthetic or redacted data. Do not add real personal email or private LinkedIn posts.
- Add edge cases deliberately: ambiguous categories, hashtag-heavy posts, achievements with lessons, prompt injection, non-English text.
- Keep one example per line; no trailing commas.
- Run `npm run eval:heuristics` after editing.

## Reports

`evals/reports/` is gitignored. CI uploads the JSON and Markdown reports as artifacts.

## Next steps

- Add an AI eval runner that calls Roar/Sarvam (or mock mode) and compares against the same fixtures.
- Add a confusion matrix and calibration report.
- Add adversarial fixtures for prompt injection and malformed provider responses.
