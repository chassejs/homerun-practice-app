## Goal

Two small, independent additive features for the Practice Planner:

1. **"Has video" filter** in the Browse Drills pane — a checkbox that, when
   checked, narrows the drill list to only the drills that have an entry in
   `window.DRILL_VIDEOS_DATA` (the demo-video overlay shipped in v1.5),
   combining with the existing skill/intensity/age/level/search filters
   exactly like every other filter already does.
2. **"Suggest a drill" option in the feedback form** — a new choice in the
   existing "What is this about?" category dropdown. Selecting it reveals
   two additional fields: a required drill-name text field, and an optional
   YouTube-link text field. Submitting composes these into the existing
   mailto: report (no backend, no network — same mechanism the feedback
   form already uses for every other category).

Both features are pure client-side additions to the existing static
HTML/JS/CSS app; neither touches the KB, the sync script, or
`src/drills-data.js`.

## Constraints

- No build step, no framework, no new dependencies. Match existing code
  style exactly: `practice.js` and `feedback.js` use ES5-style `function`
  declarations, `document.createElement`/`el()`-helper DOM building, `var`/
  `const`/`let` as already used in each file (feedback.js uses `var`
  throughout; practice.js uses `const`/`let`). No JSX, no template literals
  required.
- **Filter feature:**
  - Do not change the shape or meaning of any existing filter state
    (`filterSkill`, `filterIntensity`, `filterAge`, `filterLevel`,
    `showAllAges`, `searchQuery`) or `filterDrills()`'s existing checks —
    only add one new check.
  - The checkbox must degrade gracefully if `window.DRILL_VIDEOS_DATA` is
    ever absent (e.g. checking it filters to zero results and the existing
    "No drills match your filters" empty state shows — no crash).
  - Reuse the existing checkbox pattern already in this same panel
    (`#pp-show-all-ages` in `index.html`, wired in `bindAgeFilter()` in
    `practice.js`) — same markup shape, same binding style — rather than
    inventing a new UI pattern.
  - Must not affect the Skill Plans or Roadmap tabs, plan-building logic, or
    PDF/print/export code.
- **Feedback-form feature:**
  - `feedback.js`'s `CATEGORIES` array and `open()` function are the only
    places that need to change; do not alter `buildBody`, `buildSubject`,
    `copyText`, or the confirmation-screen logic beyond what's needed to
    pass the new composed details through (the existing `buildBody(rating,
    catLabel, details)` signature should NOT change — compose the extra
    lines into the `details` string before calling it).
  - The two new fields must be visually hidden (not just present-but-empty)
    whenever the category is anything other than the new "suggest a drill"
    value, using the same scoped `.hidden` toggle-class convention already
    used elsewhere in this codebase (e.g. `.modal-overlay.hidden`,
    `.pstations-wrap.hidden` in `styles.css`) — add a new scoped rule, do
    not add a bare global `.hidden { display: none }` (there isn't one
    today and other `.hidden` usages rely on being scoped).
  - Drill name is required only when "suggest a drill" is selected (reuse
    the existing `showError`/`maybeClearError` pattern already in `open()`).
    The YouTube link field is optional; if filled in, do a light format
    check (must start with `http://` or `https://`) — do not hard-require
    a `youtube.com` domain, since a friendly submitter might paste another
    host by mistake and the report is just an email, not a stored record.
  - The existing "Describe the issue or idea" textarea stays required for
    every other category exactly as today; for the new "suggest a drill"
    category it becomes optional (the drill name + video link already carry
    the essential information) — do not remove or relabel the field itself.
  - No network calls anywhere — this still only builds a `mailto:` URL.

## Step-by-Step Implementation Plan

1. **Filter checkbox markup** — in `index.html`, inside the existing
   `.pform-two-col` row that already holds Age Range / Level / "Show all
   ages" (around the `pp-show-all-ages` checkbox), add one more `.pfield`
   with a checkbox `id="pp-has-video"` and a label reading `🎥 Has video
   only` (or similarly clear text with the same red-camera visual
   association used elsewhere), matching the exact markup shape of the
   existing `pp-show-all-ages` field.
2. **Filter state + logic** — in `practice.js`, add
   `let filterHasVideo = false;` next to the other filter state variables,
   and add one new check inside `filterDrills()`:
   `if (filterHasVideo && !(window.DRILL_VIDEOS_DATA &&
   window.DRILL_VIDEOS_DATA[d.id])) return false;` placed alongside the
   other filter checks (after the age filter, before the text-search
   check, matching the existing ordering style/comment pattern).
3. **Filter binding** — add a `bindVideoFilter()` function in `practice.js`
   mirroring `bindLevelFilter()`'s shape (get the checkbox by id, listen for
   `change`, set `filterHasVideo = chk.checked`, call `renderDrillCards()`),
   and call it once alongside the other `bind*Filter()` calls in the main
   init block.
4. **Feedback category** — in `feedback.js`, add one new entry to the
   `CATEGORIES` array: `{ value: 'suggest-drill', label: 'Suggest a drill
   to add' }` (placed logically among the existing entries, e.g. right
   after `'feature'` — Feature request — since it's a specific kind of
   feature request).
5. **New feedback fields** — in `feedback.js`'s `open()` → `build`
   function, after the existing category field and before (or after) the
   details field, add a new wrapper `div` with class
   `feedback-drill-fields` (start with class `feedback-drill-fields
   hidden`) containing:
   - a `.feedback-field` with a label "Drill name" and a required-when-shown
     text `input` (`id="feedback-drill-name"`).
   - a `.feedback-field` with a label "Link to a YouTube demo (optional)"
     and a text/url `input` (`id="feedback-drill-video"`,
     `placeholder="https://www.youtube.com/watch?v=…"`).
6. **Show/hide + validation wiring** — extend the existing
   `categoryEl.addEventListener('change', ...)` handler (or add a second
   listener) so that changing the category toggles the `hidden` class on
   the new wrapper based on `categoryEl.value === 'suggest-drill'`. Extend
   the submit handler's validation:
   - if `categoryEl.value === 'suggest-drill'`: require a non-empty,
     trimmed drill-name value (else `showError(...)` focusing that field,
     mirroring the existing category/details error pattern); if the video
     field is non-empty, require it to start with `http://` or `https://`
     (else a distinct error message focusing that field); the existing
     "Describe the issue or idea" textarea becomes optional in this branch
     only (skip its required check).
   - for every other category, behavior is completely unchanged (details
     textarea still required as today).
7. **Compose the report body** — still in the submit handler, before
   calling `buildBody(rating, catLabel, details)`, when
   `categoryEl.value === 'suggest-drill'` build a composed `details` string,
   e.g.:
   ```
   Suggested drill: <drill name>
   Demo video: <url, or "not provided">

   <existing free-text details, if any>
   ```
   and pass that composed string as `details` — `buildBody`'s own signature
   and internals stay untouched.
8. **CSS** — in `styles.css`, near the existing `.feedback-field` /
   `.feedback-error` rules, add `.feedback-drill-fields.hidden { display:
   none; }` (new, scoped rule — do not touch any existing rule) plus any
   minimal styling needed so the two new fields look consistent with
   `#feedback-category` / `#feedback-details` (reuse those exact selectors'
   declarations as a model for the new `#feedback-drill-name` /
   `#feedback-drill-video` inputs).

## File List

- `index.html` — add the new "Has video only" checkbox field in the Browse
  Drills filter row.
- `practice.js` — add `filterHasVideo` state, the new `filterDrills()`
  check, and `bindVideoFilter()` wired into init.
- `feedback.js` — add the `suggest-drill` category, the two new fields,
  show/hide + validation logic, and body composition.
- `styles.css` — add the new scoped `.feedback-drill-fields.hidden` rule and
  matching input styling for the two new feedback fields.

## Acceptance Criteria

1. `index.html` has a new checkbox (distinct id from `pp-show-all-ages`) in
   the same filter row, with a clear "has video" label.
2. Checking the new checkbox and no others narrows Browse Drills to exactly
   the 85 drills present in `window.DRILL_VIDEOS_DATA` (verifiable via the
   existing "N drills of 391" status line reading "85 drills of 391").
3. The new checkbox combines correctly with at least one other existing
   filter (e.g. selecting a skill chip together with "Has video only" shows
   only that skill's drills that also have a video) — i.e. it is a genuine
   additional `&&` condition, not a replacement of the others.
4. Unchecking the box restores the full unfiltered set exactly as before
   this change (391 drills, or whatever the currently-existing filters
   would already show).
5. In the feedback form, the category dropdown includes a new "Suggest a
   drill to add" option; selecting it reveals a required "Drill name" field
   and an optional YouTube-link field, both hidden for every other category
   value.
6. Submitting with "Suggest a drill to add" selected and an empty drill-name
   field shows a validation error and does not open the mail client;
   filling in a drill name (with the video field left blank) submits
   successfully.
7. Filling in the video field with a non-URL-looking value (not starting
   `http://`/`https://`) blocks submission with a clear error; a value that
   does start with `http://`/`https://` is accepted.
8. The composed email body (verifiable via the existing "Copy report"
   confirmation-screen text) contains a "Suggested drill: <name>" line and
   a "Demo video: <url or 'not provided'>" line when this category is used,
   and contains neither line for every other category.
9. Every other existing feedback-form category still requires and behaves
   exactly as before (rating, category, and details-textarea validation
   unchanged) — no regression from this addition.
10. `node --check` (or equivalent parse check) passes on `practice.js` and
    `feedback.js`; the app loads in the browser with no new console errors.
11. No changes to `src/drills-data.js`, `src/drill-videos-data.js`,
    `scripts/sync-drills.mjs`, `buildBody`/`buildSubject`/`copyText`
    internals, or plan-building/PDF/export code.
