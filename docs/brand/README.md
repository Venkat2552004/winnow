# Winnow — brand directions

**Tagline:** Keep the signal.

Winnow means to separate the valuable from the worthless — literally to separate grain from chaff. That is the product: keep the signal in Gmail and LinkedIn, drop the noise.

## Concepts

| File | Concept | Best for |
|---|---|---|
| `winnow-signal-sieve.svg` | **Signal Sieve** — five-bar waveform that doubles as a subtle “W” and a sieve. Noise dots resolve into one clean signal line. | Horizontal lockup, extension header, README hero. |
| `winnow-aurora-wordmark.svg` | **Aurora Wordmark** — seeded aurora mesh behind a crisp wordmark with a small signal mark above it. | Splash screens, onboarding, settings header. |
| `winnow-w-monogram.svg` | **W Monogram** — bold “W” built from signal strokes inside a rounded app icon, shown at 32, 48, and 64 px. | Toolbar icon, favicon, app icon. |

Open `index.html` in a browser to preview all three on the product background.

## Palette

| Token | Value |
|---|---|
| Background | `#0a0d13` |
| Surface | `#141a24` |
| Signal blue | `#6b9bff` |
| Signal violet | `#8b6bff` |
| Aurora teal | `#46d1c0` |
| Text | `#e8eef8` |
| Muted | `#8b98ab` |

## App icon

`winnow-icon.svg` is the standalone 512×512 icon. Exported PNGs are in `icons/` at 16, 32, 48, 96, 128, and 512 px. To rebrand the extension, copy them into `public/icon/` using the existing filenames.

## Usage notes

- The SVGs use the system sans-serif stack. For production, set the wordmark in your chosen typeface.
- The W Monogram is designed to stay legible at 16 px; the exported icon set covers 16, 32, 48, 96, and 128 px.
- Keep the tagline uppercase with generous letter-spacing: `KEEP THE SIGNAL.`
- The signal mark and aurora are already part of the extension's procedural visual system, so these directions reuse existing primitives rather than introducing a new style.
