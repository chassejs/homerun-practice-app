# Implementer Brief: Drill demo-video icons

You are implementing a small, additive feature in this repo (a static
HTML/JS/CSS app — no build step, no framework, no package manager for the
app code itself). Read the constraints carefully; several existing files
have "do not edit" rules.

## Goal

Add demonstration-video links to the Practice Planner's drill library. For
the 85 drills listed in `researched-videos.json` (in this same directory,
`.claude/build-runs/2026-08-22T18-11-18/researched-videos.json`), the drill
card and the drill detail modal should show a distinctive **red camera
icon**. Clicking it opens the drill's video `url` in a **new browser tab**
(`target="_blank" rel="noopener noreferrer"`), without also triggering the
card's existing "open detail" click handler. Drills with no entry in that
JSON file get no icon and are otherwise completely unchanged.

This is purely additive: do not change any existing field, filter, plan
management, or export/print behavior.

## Constraints

- `src/drills-data.js` is auto-generated ("DO NOT EDIT BY HAND" — see its
  top comment) — never hand-edit it. Put the new video data in a **new**
  file instead: `src/drill-videos-data.js`.
- `src/drill-videos-data.js` must set `window.DRILL_VIDEOS_DATA` to a plain
  object keyed by drill `id`, each value `{ url, title }`. Copy the data
  straight out of `researched-videos.json` in this directory — same 85 keys,
  same `url`/`title` values — but **do not** include the JSON file's
  `_comment` key in the generated JS object. Follow the same
  `window.<NAME> = {...}` style already used in `src/drills-data.js` (open
  that file first to see the exact pattern — top-of-file comment,
  `window.DRILLS_DATA = { ... }`).
- Open `index.html` and find the existing `<script src="src/drills-data.js">`
  tag. Add one new `<script src="src/drill-videos-data.js"></script>` tag
  immediately after it (drills data must load first, video overlay second).
- Open `practice.js` and find:
  - `buildDrillCard(drill, isInPlan)` — this builds each drill card. Near
    where the existing "add" button is created (search for `pdrill-add-btn`
    and the `addBtn.addEventListener('click', ...)` block that calls
    `e.stopPropagation()` before `toggleDrillInPlan`), add a new video
    icon/link **only when** `window.DRILL_VIDEOS_DATA &&
    window.DRILL_VIDEOS_DATA[drill.id]` is truthy. Build it as an `<a>`
    element (so it's a real link, not a button faking a link):
    `href` = the researched `url`, `target="_blank"`,
    `rel="noopener noreferrer"`, class `pdrill-video-link`, `aria-label`
    = `'Watch demo video for ' + drill.title`, and its `click` listener
    must call `e.stopPropagation()` (mirror the existing add-button
    listener) so clicking it does NOT also call `openDrillDetail`. Put a
    camera icon inside it — either an inline `<svg>` (simplest: a small
    camera-body + lens shape, `fill="currentColor"`) or a Unicode glyph
    (`📹` or `🎥`) — styled red via CSS (see `styles.css` step below). Append
    this link to the card in a sensible spot near the add button, not
    overlapping it.
  - `openDrillDetail(drillId)` — this builds the modal header. Near where
    `bdgs` (badges) are appended to `titleGroup`/`header` (search for
    `drill-detail-badges`), add the same kind of `<a>` link (class
    `pdrill-video-link-detail`, same `target`/`rel`/`aria-label` pattern,
    same conditional on `window.DRILL_VIDEOS_DATA[drill.id]`) so the modal
    also shows the icon/link when a video exists for that drill.
  - Do **not** modify `makeBadge`, `intensityClass`, `filterDrills`,
    `toggleDrillInPlan`, `toggleDrillInStations`, any PDF/print/export code,
    or any existing CSS class name — only add new code paths gated on the
    `DRILL_VIDEOS_DATA` lookup, and only add new CSS classes.
- Open `styles.css`, find where `.pdrill-card`, `.pdrill-add-btn`, and
  `.drill-detail-badges` / `.drill-detail-header` are styled (for
  conventions: does the file use CSS custom properties / theme variables?
  match that convention rather than hardcoding colors that might clash with
  a dark theme if one exists — but the icon itself should always render
  red, e.g. `color: #d32f2f` or similar, since "red camera = has video" is
  the whole point of the affordance). Add two new rules:
  `.pdrill-video-link` (compact, sized to sit next to the card's add
  button, red, clear hover/focus state) and `.pdrill-video-link-detail`
  (slightly larger, for the modal header, red, clear hover/focus state).
  Do not edit any existing rule.
- No network calls anywhere in this feature — all data is static in
  `drill-videos-data.js`.
- Code style: match the existing files — `practice.js` uses ES5-style
  `function` declarations and `document.createElement`/`textContent`/
  `appendChild` DOM building, no JSX, no template literals required (plain
  string concatenation is fine, matching the surrounding code). No new
  dependencies, no build step.

## Acceptance Criteria (what the reviewer will check)

1. `src/drill-videos-data.js` exists, defines `window.DRILL_VIDEOS_DATA` as
   a plain object with exactly the 85 keys from `researched-videos.json`
   (no `_comment` key), each with non-empty `url` (starts with
   `https://www.youtube.com/`) and `title`.
2. `index.html` loads `src/drill-videos-data.js` via `<script>` immediately
   after the `src/drills-data.js` tag; the new JS file has no syntax errors.
3. Drills present in `DRILL_VIDEOS_DATA` show a red camera icon/link on
   their card, opening the correct URL in a new tab, and clicking it does
   NOT open the drill detail modal (must call `stopPropagation`).
4. Drills absent from `DRILL_VIDEOS_DATA` show no icon anywhere and are
   otherwise unchanged.
5. The drill detail modal shows the same icon/link (same URL, new tab) for
   drills that have a video; no icon for drills that don't.
6. Every video link/icon has an `aria-label` naming the action + drill
   title.
7. No existing behavior (search/filter, add-to-plan `+` button, badges,
   click-to-open-detail on the rest of the card) changes.
8. No new JS syntax errors; the app still loads cleanly.
9. `src/drills-data.js`, `scripts/sync-drills.mjs`, PDF/export code, and
   plan-building logic are untouched.

## Notes

- You do not have shell/network access in this session — do not attempt to
  run any command (no `node --check`, no dev server, nothing). Just use
  Read/Write/Edit. The reviewer will run all verification afterward.
- Work file by file: `src/drill-videos-data.js` first, then `index.html`,
  then `practice.js`, then `styles.css`. Read each file's relevant section
  before editing it so your edits match the exact existing surrounding
  code (function names, class names, indentation).
