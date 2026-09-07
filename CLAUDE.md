# CLAUDE.md

Guidance for working on **Celebrate** — Chris's occasion-card maker with a Google Calendar
radar. Part of the Ortiz app family; the `family-app-standards` skill governs conventions.

## Target device

Chris is on an **Android Pixel (Chrome)**; Kat may be on an iPhone. Tap targets are 48px.
Never `alert()`/`confirm()`/`prompt()` — use `confirmSheet`, `promptSheet`, `menuSheet`.

## Stack

One `index.html` (inline CSS + JS, no build, no framework), `sw.js`, `manifest.json`, `icons/`.
Deployed by GitHub Pages from `main` at https://ortizzle.github.io/Celebrate/. Third-party code
is only html2canvas and gif.js from cdnjs. DOM is built with `el(tag, attrs, kids)`; never
`innerHTML` with anything that came from a calendar, a person, or the user.

Bump `APP_VERSION` in `index.html` **and** `CACHE` in `sw.js` together on every change, or
phones keep the old build.

## Data (all local, this browser only)

- `localStorage` under `celebrate_*`: `settings` (client ID, API key — never in code), `people`
  (notes, private), `aliases` (duplicate merges), `skipped` (the one remove rule, `person|key`),
  `manual` (dates added by hand; the date's own year is the origin year → age), `made`, `calCache`.
- IndexedDB `celebrate/drafts`: `__current__` working card, named drafts, and `sent:true`
  archive records that carry the full-size export `file` for one year (`pruneOldImages`).
- A person is keyed by `pkey(name)`; cards link via `personKey`. Everything that shows or hides a
  person reads `isRemoved(key)`.
- Photos never leave the phone. The only upload is an explicit "Save to Drive" of a finished card
  or a backup. The Google token lives in memory only.

## Stickers and motion

Stickers are inline SVG in `STICKERS`; animated parts are `<g class="…">` with **no transform
attribute**. Every animation in `ANIMS` is a pure function of loop phase t∈[0,1) with f(0)=f(1);
the live preview and the 16-frame GIF sample the same function. Parts move through the SVG
`transform` attribute because html2canvas rasterises SVG by serialising it.

## Tests

`tests/run.sh` runs every `tests/*.test.js` (Playwright, headless) against a local static server.
Run them before pushing; they cover calendar picking, people/remove/merge/backup, drafts and
archive, the editor workflow, stickers and GIF export, the service worker, and year-over-year
features. Each prints its checks and ends with `errors: none`.
