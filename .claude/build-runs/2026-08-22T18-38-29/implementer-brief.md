# Implementer Brief: "Has video" filter + "Suggest a drill" feedback option

You are implementing two small, independent, additive features in this
static HTML/JS/CSS app (no build step, no framework). Read the constraints
carefully — several files have established conventions to match exactly.

You DO have shell access in this session (git, node, npm are all allowed).
Use `node --check <file>` on every JS file you change before considering
this done, and fix anything it flags.

## Feature 1 — "Has video" filter in Browse Drills

**Where:** `index.html` has a filter row (search for `pp-show-all-ages`) with
Age Range, Level, and a "Show all ages" checkbox, inside a
`.pform-two-col` div. Add one more `.pfield` in that same row with a new
checkbox:

```html
<div class="pfield" style="display:flex;align-items:flex-end;padding-bottom:0.1rem">
  <label style="display:flex;align-items:center;gap:0.4rem;font-weight:normal;font-size:var(--text-sm);cursor:pointer;text-transform:none">
    <input type="checkbox" id="pp-has-video" style="width:15px;height:15px">
    🎥 Has video only
  </label>
</div>
```

(Copy the exact inline-style pattern already on the neighboring
`pp-show-all-ages` field so it lines up visually — read that exact block
first and match it.)

**Where:** `practice.js` — near the other filter state (search for `let
filterAge`), add:

```js
let filterHasVideo = false;
```

In `filterDrills()` (search for `function filterDrills`), add a new check
alongside the existing ones (after the age-filter block, before the text
search block):

```js
// Video filter
if (filterHasVideo && !(window.DRILL_VIDEOS_DATA && window.DRILL_VIDEOS_DATA[d.id])) return false;
```

Add a new binding function mirroring `bindLevelFilter()` (search for that
function to copy its shape exactly):

```js
function bindVideoFilter() {
  const chk = document.getElementById('pp-has-video');
  if (chk) chk.addEventListener('change', function () {
    filterHasVideo = chk.checked;
    renderDrillCards();
  });
}
```

Call `bindVideoFilter();` in the main init block, next to the other
`bind*Filter()` calls (search for `bindLevelFilter();` near the bottom of
the file to find where init calls live).

Do not touch `filterSkill`, `filterIntensity`, `filterAge`, `filterLevel`,
`showAllAges`, `searchQuery`, or any of their existing checks — only add
the new state variable, the new check, and the new binding function.

## Feature 2 — "Suggest a drill" option in the feedback form

**File:** `feedback.js` only (plus a small CSS addition in `styles.css`).

1. In the `CATEGORIES` array near the top of the file, add a new entry
   right after the `'feature'` entry:
   ```js
   { value: 'suggest-drill', label: 'Suggest a drill to add' },
   ```

2. In the `open()` function's `build:` callback, find where the category
   field and the details field are built (search for `detailsLabel` and
   `detailsEl`). Add two new fields in a wrapper div, placed between the
   category field and the details field:

   ```js
   var drillNameLabel = api.el('label', { for: 'feedback-drill-name', text: 'Drill name' });
   var drillNameEl = api.el('input', { type: 'text', id: 'feedback-drill-name' });

   var drillVideoLabel = api.el('label', { for: 'feedback-drill-video', text: 'Link to a YouTube demo (optional)' });
   var drillVideoEl = api.el('input', {
     type: 'text',
     id: 'feedback-drill-video',
     placeholder: 'https://www.youtube.com/watch?v=…'
   });

   var drillFieldsWrap = api.el('div', { class: 'feedback-drill-fields hidden' }, [
     api.el('div', { class: 'feedback-field' }, [drillNameLabel, drillNameEl]),
     api.el('div', { class: 'feedback-field' }, [drillVideoLabel, drillVideoEl])
   ]);
   ```

   (Check the `api.el` helper's actual signature/behavior first — look at
   how `categoryEl` or `detailsEl` are built with it — and match that
   exactly; the snippet above shows the intent, adjust syntax to whatever
   `api.el` actually expects if it differs.)

3. Insert `drillFieldsWrap` into the `form` element's children array, between
   the existing category field div and the details field div (search for
   where `form` is built with `api.el('form', ...)`).

4. Toggle visibility on category change. Find the existing
   `categoryEl.addEventListener('change', maybeClearError);` line and add
   logic (either in that same handler or a new one) that does:
   ```js
   drillFieldsWrap.classList.toggle('hidden', categoryEl.value !== 'suggest-drill');
   ```
   Call this once right after the category `<select>` is built too, in case
   a category is ever pre-selected (defensive; in practice the placeholder
   option is selected by default so it will start hidden either way).

5. Validation in the submit handler (search for
   `form.addEventListener('submit', ...)`). Current order is: require
   `categoryEl.value`, then require trimmed `detailsEl.value`. Change it to:
   - Keep the existing "category required" check first, unchanged.
   - If `categoryEl.value === 'suggest-drill'`:
     - Require a non-empty trimmed `drillNameEl.value`. If missing, call
       `showError('Please enter the name of the drill you\'d like added.',
       'drillName')` and `return`. You'll need to extend `showError` (or
       add an equivalent branch) to focus `drillNameEl` when
       `field === 'drillName'` — look at how `showError` currently branches
       on `'category'` vs. everything-else-focuses-`detailsEl`, and add a
       third branch.
     - If `drillVideoEl.value` is non-empty (after trim) and does NOT start
       with `http://` or `https://`, call
       `showError('Please enter a valid video link starting with http:// or
       https://, or leave it blank.', 'drillVideo')` and `return` (extend
       `showError`'s focus branching the same way, focusing `drillVideoEl`).
     - Do NOT require `detailsEl.value` in this branch (skip that specific
       check only when category is `suggest-drill`).
   - Else (every other category): keep the existing required-details check
     exactly as it is today.
   - Also extend `maybeClearError()` similarly so typing in `drillNameEl` or
     `drillVideoEl` clears an error that was set on those fields (mirror
     the existing `lastErrorOn === 'category'` / `'details'` branches with
     two more branches, and wire `input` listeners on both new fields that
     call `maybeClearError()`, mirroring the existing `detailsEl` input
     listener).

6. Compose the report body. Still in the submit handler, after validation
   passes and before calling `buildBody(rating, catLabel, details)`, change
   how the local `details` variable is built:
   ```js
   var details = trim(detailsEl.value);
   if (categoryEl.value === 'suggest-drill') {
     var drillName = trim(drillNameEl.value);
     var drillVideo = trim(drillVideoEl.value);
     var suggestion = 'Suggested drill: ' + drillName + '\n' +
       'Demo video: ' + (drillVideo || 'not provided');
     details = details ? (suggestion + '\n\n' + details) : suggestion;
   }
   ```
   Do not change `buildBody`'s own definition/signature — it still just
   receives the final `details` string as today.

7. CSS — in `styles.css`, near the existing `.feedback-field` /
   `.feedback-error` rules (search for `.feedback-field { margin-bottom`),
   add:
   ```css
   .feedback-drill-fields.hidden { display: none; }
   #feedback-drill-name,
   #feedback-drill-video {
     width: 100%;
     padding: 0.35rem 0.5rem;
     border: 1px solid var(--color-border);
     border-radius: var(--radius);
     font: inherit;
   }
   ```
   (Match whatever `#feedback-category` / `#feedback-details` actually
   declare — copy those exact declarations rather than retyping from
   memory, in case they differ slightly from what's shown here.)

## General constraints (both features)

- No new dependencies, no build step, no network calls.
- Match each file's existing code style (ES5 `var`/functions in
  `feedback.js`, `const`/`let` in `practice.js`; `document.createElement`/
  the `api.el` helper pattern each file already uses).
- Do not modify `buildBody`, `buildSubject`, `copyText`, `filterSkill` /
  `filterIntensity` / `filterAge` / `filterLevel` / `showAllAges` /
  `searchQuery`, or any plan-building/PDF/export/print code.
- Run `node --check practice.js` and `node --check feedback.js` after your
  edits and fix any reported syntax error before finishing.
- You may also run `npm test` if useful, but it is not required to pass for
  this change (it covers version/changelog bookkeeping this brief does not
  touch) — do not let it block you, just don't break anything it was
  already passing.

## Acceptance Criteria (what the reviewer will check)

1. New "🎥 Has video only" checkbox exists in the Browse Drills filter row.
2. Checking it alone narrows results to exactly the 85 drills with a video
   entry (status line reads "85 drills of 391").
3. It combines (AND-logic) with other filters (e.g. + a skill chip).
4. Unchecking restores prior behavior exactly.
5. Feedback category dropdown has "Suggest a drill to add"; selecting it
   reveals Drill name (required) + YouTube link (optional) fields, hidden
   for all other categories.
6. Empty drill name blocks submit with an error; a filled name (blank
   video) submits fine.
7. A video value not starting with `http://`/`https://` blocks submit with
   an error; one that does start with `http://`/`https://` is accepted.
8. The composed body contains "Suggested drill: ..." and "Demo video: ..."
   lines only for this category; every other category's body is unchanged
   from before.
9. No regression in any other category's existing required-field behavior.
10. `node --check` passes on both changed JS files; no new console errors
    when the app is loaded and the feedback modal is opened.
11. `src/drills-data.js`, `src/drill-videos-data.js`,
    `scripts/sync-drills.mjs`, and plan/PDF/export code are untouched.
