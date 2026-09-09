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

## Looks

`LOOKS` are recipes, not pictures: each sets palette, fonts, `style.show` flags, `style.shadow`,
and drops overlay stickers plus `look:true` text blocks filled from the person (name, `state.count`,
a note). `applyLook` replaces all stickers and look/auto texts, keeps user text blocks. Photo looks
hide the message (the note stands in) and put the sign-off at the bottom.

## Photo frames

`PHOTO_FRAMES` painters draw onto the photo's own canvas in `drawPhoto`, after the mask clip is
released, so strokes and ornaments show in full. `frameOutline` rebuilds the mask path inset by n
pixels (the path keeps the transform it was built under; the line width does not), which is why one
frame works on every mask. `atCorners` scales by `u` (1% of the short side) so ornaments hold their
proportions from a 340px preview to a 1080px export. Occasion suggestions come from each frame's
`occasions` list — keep every occasion covered by at least one frame (the suite asserts it).

## Navigation and reversibility

Every `.overlay` and the editor view maps to a history entry (`syncNav`, a MutationObserver on the
`hidden` attribute); `popstate` closes the topmost sheet, then leaves the editor. Never open or
close an overlay outside a `.overlay` element or the stack drifts.

`setLayout(id)` is the only way the layout changes: it carries the photo (`carryPhoto`) so one never
vanishes, clears an active look (`clearLook`, restoring `show` flags), and offers `toastUndo`.
Any single tap that rearranges the card must offer `toastUndo` with a `snapshot()` taken first.

## Rows

An Upcoming row has exactly two tap targets: `.occ-open` (the whole row → that person's sheet) and
one action button. Per-occurrence options (mark done, skip this year) and per-date options live on
the person sheet, keyed by the occurrence key `pkey(name)|date` from `upcomingItems()`. Resist
adding a third control to the row; the person's card is where management goes.

## Dates on screen

`renderToday()` fills the header label and re-runs on `visibilitychange` so an app left open
overnight is not a day behind. `whenEl(days)` is the bold countdown used by Upcoming rows, People
rows and the person sheet; `nextAnnual(md)` gives the next time a month-day comes around, which is
how People counts down beyond the 30-day scan window. All of it is Arizona-local via `AZ`.

## Tests

`tests/run.sh` runs every `tests/*.test.js` (Playwright, headless) against a local static server.
Run them before pushing; they cover calendar picking, people/remove/merge/backup, drafts and
archive, the editor workflow, stickers and GIF export, looks, Back-button navigation and undo,
the service worker, and year-over-year features. Each prints its checks and ends with `errors: none`.
