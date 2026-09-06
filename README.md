# Celebrate

Occasion-card maker that also watches your Google Calendar so birthdays, anniversaries and
the rest never sneak up on you. Single `index.html`, no build step, deployed on GitHub Pages.

## What it does

- **Upcoming** — signs in with Google (read-only calendar scope, token kept in memory only),
  scans every calendar you can see plus the Birthdays contacts calendar for the next 30 days,
  matches occasion keywords, dedupes the same person+date across calendars, and groups
  Today / This week / Later. Cards you've made get a check. Add anything not on a calendar by hand.
  Any row can be skipped once or muted for good (undo under "Skipped").
- **Make a card** — 18 occasions, 8 named palettes with per-color fine-tuning, 4 layouts in three
  formats (portrait 4:5, square 1:1, landscape 16:9), photos with circle / arch / blob / polaroid /
  full-bleed masks (drag to pan, pinch to zoom) plus filters and borders, solid / gradient / pattern /
  photo backgrounds, frames, 16 original SVG stickers (resize, rotate, flip, layer), free-floating
  text blocks, a Style tab (12 Google Fonts across display / body / handwriting roles, size sliders,
  alignment, text position/spacing, and auto-shrink-to-fit for long messages), undo/redo, named
  saved drafts with thumbnails, and a live preview that stays pinned in view while you scroll the
  editor below it.
- **Share** — 1080×1350 PNG (1080×1080 square, 1600×900 landscape) via the Web Share API on
  phones, with Download / Copy message / Email-HTML fallbacks. Optional "Ask Claude" for a draft.
  Every share, download or email auto-archives a snapshot under Drafts → Sent, so you always have
  a record of what actually went out.
- **Choose your calendars** — Settings lists every calendar from your last scan with checkboxes;
  by default only calendars you keep visible in Google Calendar (plus Birthdays) are scanned.

## Setup

1. Open Settings (gear) and paste a Google OAuth **client ID** (Web application type, with this
   site's origin under *Authorized JavaScript origins*). The Google Calendar API must be enabled
   on that Cloud project.
2. Optionally add an Anthropic API key for "Ask Claude" and extra keywords to match.

## Privacy

Everything stays in the browser: photos are never uploaded, calendar data is display-only and
cached locally, saved drafts live in this browser's IndexedDB, and the Google token is never
written to disk. No backend, no secrets in code.

## Local testing

```
npx serve .
```

Add `http://localhost:3000` (or whatever port `serve` picks) as an authorized origin on the
OAuth client to sign in locally.
