# Design system

Jev's visual identity is **procedural**. Every mark, gradient, and avatar is derived from a seed string, so the same message, sender, or post always looks the same — no images to ship, no model call, no network.

## Seeds

`lib/ui/generative.ts` turns a string into a stable visual fingerprint:

1. `hashSeed` — FNV-1a over the string.
2. `mulberry32` — a small deterministic PRNG.
3. `signalFor(seed)` — returns a base hue, a second hue, nine bar heights, a rotation, and a phase.

Seeds are stable identifiers:

| Surface | Seed |
|---|---|
| Brand mark | `jev-brand` |
| Popup header | `jev-popup-header` |
| Settings header | `jev-options-header` |
| Onboarding card | `jev-onboarding` |
| Section marks | `jev-gmail`, `jev-linkedin`, `jev-api`, … |
| Priority mail | message ID (via category hue) |
| Sender avatar | sender email |
| Cleanup avatar | sender email |
| LinkedIn overlay | post URN, or a stable hash when no URN exists |

Changing a seed changes that surface's identity, so treat them as part of the design.

## Primitives

| Component | What it draws |
|---|---|
| `SignalMark` | A five-bar waveform. The same seed always draws the same bars. |
| `SignalAvatar` | A seeded two-tone gradient circle with initials. |
| `Aurora` | Three seeded radial gradients, blurred into a mesh backdrop. |
| `ScoreRing` | A radial 0–100 score arc with the number in the middle. |
| `categoryHue` | Semantic hue per email category. |
| `scoreHue` | Red → amber → green as a score rises. |

## Colour

Category hues are semantic, not random:

| Category | Hue |
|---|---|
| Security alert | red (6) |
| Bank statement | green (152) |
| Invoice / receipt | amber (38) |
| Travel | cyan (194) |
| Legal | violet (268) |
| Action required | orange (22) |
| Personal | pink (330) |
| Notification | blue (212) |
| Newsletter | teal (172) |
| Promotion | magenta (300) |
| Other | slate (220) |

Scores use a continuous ramp: `0` is red, `50` is amber, `100` is green. The number is always shown next to the colour, so colour is never the only signal.

## Surfaces

- **Popup** — aurora header, brand signal, status pills with semantic dots, priority rows with a category dot, short category label, and score ring.
- **Settings** — aurora header and onboarding card, a signal mark per section, seeded glow on the Gmail, unsubscribe, and LinkedIn cards, sender and cleanup avatars.
- **LinkedIn** — the blur overlay uses the post's seed for its glow and signal mark, the score for its ring and accent, and keeps the reason and a clear **Reveal post** action. After reveal, a compact `Jev <score>` badge stays on the post.

## Accessibility

- Decorative SVGs are `aria-hidden`; meaningful rings carry an `aria-label`.
- Every switch has an `aria-label`.
- Colour is paired with text (category label, score number, status text).
- `prefers-reduced-motion` disables the aurora drift and transitions.
- The LinkedIn overlay is keyboard reachable (`role="button"`, `tabIndex`, Enter/Space).

## Extending

- **New email category** — add it to `EmailCategory`, `CATEGORY_HUE`, `CATEGORY_LABEL`, `CATEGORY_SHORT`, and the Gmail label map.
- **New surface** — pick a stable seed and, if it belongs to a feature, a hue. Use `SignalMark` for section identity, `Aurora` for hero surfaces, and `ScoreRing` for any 0–100 value.
- **New avatar** — pass a stable string (email, ID, URN) to `SignalAvatar`; never pass a display name that changes.
