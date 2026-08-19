Your previous attempt was rejected. Reason: Acceptance Criteria 6 FAILS (and
Criterion 5 partially fails) per `03-review.md`'s MAJOR issue.

## The bug

`pp-duration` in `index.html` is a fixed-option `<select>`:
```html
<select id="pp-duration">
  <option value="30">30 min</option>
  <option value="60">60 min</option>
  <option value="75">75 min</option>
  <option value="90" selected>90 min</option>
  <option value="120">120 min</option>
  <option value="150">150 min</option>
  <option value="180">3 hours</option>
</select>
```

Your `loadPlanFromTemplate` edit correctly sets `planMeta.duration =
plan.totalMin` and calls `syncMetaInputs()`, which calls
`setVal('pp-duration', String(planMeta.duration))`. But `setVal()` just does
`el.value = val || ''` — for a `<select>`, setting `.value` to a string that
doesn't match any `<option>`'s `value` (e.g. `"119"`, `"63"`, `"81"` — true
for most real plan totals, since only 30/60/75/90/120/150/180 are presets)
silently results in `el.value === ''` (no option selected). Live browser
verification confirmed this: after loading the "120-Minute Practice —
All-Around" plan (`totalMin: 119`), `document.getElementById('pp-duration').value`
is `""`, and loading the pre-existing "Hitting Fundamentals" plan
(`totalMin: 81`) shows the same thing. The budget bar's text
(`pbudget-fraction`) is still numerically correct since it reads
`planMeta.duration` directly, but the visible dropdown looks broken/blank to
a coach.

## The fix

In `practice.js`, find:
```js
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}
```
Replace it with a version that, for a `<select>` element, injects (or
reuses) a single synthetic `<option>` when the target value doesn't match
any existing option, so the select always visibly reflects the real number
instead of going blank:
```js
function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'SELECT') {
    const strVal = String(val || '');
    const hasMatch = Array.from(el.options).some(function (o) { return o.value === strVal; });
    if (!hasMatch && strVal) {
      let custom = el.querySelector('option[data-custom]');
      if (!custom) {
        custom = document.createElement('option');
        custom.setAttribute('data-custom', '');
        el.appendChild(custom);
      }
      custom.value = strVal;
      custom.textContent = strVal + ' min';
    }
    el.value = strVal;
    return;
  }
  el.value = val || '';
}
```

## Constraints (unchanged from the original brief)

- Only touch `practice.js`. This is the only remaining file needing a
  change — do not touch `index.html`, `src/drills-data.js`, or the KB.
- Do not change any other function or line in `practice.js`. `setVal` is
  used by `syncMetaInputs()` for six fields (`pp-team`, `pp-date`,
  `pp-theme`, `pp-location`, `pp-start`, `pp-duration`, `pp-notes`) — only
  `pp-duration` is a `<select>`, so the new branch must not change behavior
  for the other five (still plain `.value = val || ''`).
- No shell access is guaranteed in this environment — make the `practice.js`
  edit via Write/Edit regardless of whether Bash is available. If you can
  run `node --check practice.js`, do so and report the result; if you
  cannot, say so rather than silently skipping it.

## Acceptance Criteria (updated)

1. `setVal()` in `practice.js` matches the replacement above exactly
   (case matters less than behavior — but preserve the `SELECT` type check,
   the `data-custom` reuse pattern, and the plain `el.value = val || ''`
   fallback for non-select elements).
2. After this fix, loading the "120-Minute Practice — All-Around" plan
   (`totalMin: 119`) results in `document.getElementById('pp-duration').value === '119'`
   and the dropdown visibly shows "119 min" (not blank).
3. Loading a preset-matching plan (hypothetically, if any plan's totalMin
   were exactly 90) would still just select the existing `option value="90"`
   normally — no duplicate/broken options.
4. No other line in `practice.js` changes — diff should show only the
   `setVal` function body changing.
5. `node --check practice.js` passes (report this explicitly).
