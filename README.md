# Celebrate

Occasion-card maker that also watches your Google Calendar so birthdays, anniversaries and
the rest never sneak up on you. Single `index.html`, no build step, deployed on GitHub Pages.

## What it does

- **Upcoming** — signs in with Google (read-only calendar scope, token kept in memory only),
  scans every calendar you can see plus the Birthdays contacts calendar for the next 30 days,
  matches occasion keywords, dedupes the same person+date across calendars, and groups
  Today / This week / Later. Cards you've made get a check. Add anything not on a calendar by hand.
  Any row can be skipped once or muted for good (undo under "Skipped").
- **Make a card** — a guided flow: pick an Occasion (collapses to a one-line summary once chosen,
  with a "✨ Auto-design this card" shortcut that has Claude pick the whole look — palette, layout,
  fonts, stickers and message — from just the occasion and a line about the recipient, no photo
  access needed), then Layout, Style, Photo, Text, Colors, Stickers. 18 occasions, 8 named palettes
  with per-color fine-tuning, 4 layouts in three formats (portrait 4:5, square 1:1, landscape 16:9),
  photos with circle / arch / blob / polaroid / full-bleed masks (drag to pan, pinch to zoom) plus
  filters and borders, solid / gradient / pattern / photo backgrounds, frames, 27 original SVG
  stickers — every one animated (resize, rotate, flip, layer, or hold one still), free-floating text blocks, a Style tab (12 Google Fonts,
  size sliders, alignment, text position/spacing, auto-shrink-to-fit for long messages), undo/redo,
  named saved drafts with thumbnails, and a live preview that stays pinned in view while the editor
  below it scrolls.
- **Share** — 1080×1350 PNG (1080×1080 square, 1600×900 landscape) via the Web Share API on
  phones, with Download / Copy message / Email-HTML fallbacks, plus an **animated GIF** export
  (16 frames, seamless 2.4s loop) of whatever is moving on the card. Live preview and GIF are driven
  by the same animation functions, so the GIF is exactly what you saw. Optional "Ask Claude" for a message draft. Every share,
  download or email auto-archives a snapshot under Drafts → Sent, so you always have a record of
  what actually went out.
- **Choose your calendars** — Settings lists every calendar from your last scan with checkboxes;
  by default only calendars you keep visible in Google Calendar (plus Birthdays) are scanned.
- **People** — the durable layer under the calendar. Everyone seen on the calendar gets a
  person card (tap a name on Upcoming, or open the People tab): private notes that carry context
  from year to year, their known dates, their drafts, and every card ever sent to them. A card you
  start from a person stays linked to them ("For Kat ›" in the editor), Auto-design and Ask Claude
  read that person's notes, and each share/download/email lands in their history. The People tab
  sorts by Soon / A–Z / birthday Month and has a search box. Dates you add on a person get an
  "Add to Google Calendar" link (a prefilled new-event page, so the app never needs calendar
  write access).
- **One rule for who counts** — "Remove from Celebrate…" on a person (or from a row's ⋯ menu on
  Upcoming) marks them *not a person* (a trip, a holiday), *no cards needed*, or *duplicate of
  someone else*. Removed people vanish from Upcoming, People and the editor, and can be restored
  under People › Removed. Merging a duplicate moves their notes and cards to the other person and
  remembers the alias, so future calendar rows under either name land on one person.
- **Upcoming is the hub** — each row shows that person's drafts and past cards; the check opens
  their cards, and "Make card" continues the latest draft or starts a new one.
- **Backup** — Settings › Your data exports a restorable JSON backup (people, notes, dates, card
  history with thumbnails; no photos or full-size images), a plain-text version of the notes, or
  saves the backup straight to Drive. Restore merges: newer notes win, nothing is deleted.
- **Save to Google Drive** — on any sent card (person history, Drafts → Sent, or the export
  preview). The same Google sign-in now asks for `drive.file`, the narrowest Drive scope: the app
  can only see files it created itself, in a "Celebrate" folder it makes on first save. The Drive
  API must be enabled on the same Cloud project as the Calendar API.

## Setup

1. Open Settings (gear) and paste a Google OAuth **client ID** (Web application type, with this
   site's origin under *Authorized JavaScript origins*). The Google Calendar API must be enabled
   on that Cloud project.
2. Optionally add an Anthropic API key for "Ask Claude" and extra keywords to match.

## Privacy

Everything stays in the browser: photos are never uploaded, calendar data is display-only and
cached locally, people notes and saved drafts live in this browser's storage, and the Google
token is never written to disk. No backend, no secrets in code. The one exception is explicit:
tapping "Save to Drive" uploads that finished card image to your own Google Drive, and nothing
else — notes never leave the phone.

## Local testing

```
npx serve .
```

Add `http://localhost:3000` (or whatever port `serve` picks) as an authorized origin on the
OAuth client to sign in locally.
