# Implementer Brief — 60/120-minute pre-made practice plans

## Goal

The KB source file has already been updated (outside this repo, not your
concern) with 8 new full-practice plan entries: 4 sized to 60 minutes, 4
sized to 120 minutes, under a new `skill: full-practice` category. Your job
is the mechanical build/wire-up work entirely inside this repo:

1. Regenerate `src/drills-data.js` from the updated KB source.
2. Make three small, surgical edits to `practice.js` so the new plans
   display correctly and the session time-budget stays in sync when any
   plan template (new or pre-existing) is loaded.
3. Verify the result.

Do NOT touch any KB file — it's outside this repo and already correct.
Do NOT hand-edit `src/drills-data.js` — only `npm run sync:drills` may
write it.

## Constraints

- Only touch `practice.js` and (via the sync script) `src/drills-data.js`.
  No other files.
- Keep style consistent with the surrounding code in `practice.js`: vanilla
  JS, `function` declarations (not arrow functions), same indentation
  (2 spaces inside the IIFE, so top-level statements inside the module are
  indented 4 spaces — match whatever the exact lines around your edit use).
- Do not reformat or touch any code outside the three specific edits below.
- Do not add any new dependencies, build steps, or files.
- This project has no shell access reliability guarantee in this
  environment — if a Bash tool call is unavailable or gets cut off, still
  make the two `practice.js` edits via Write/Edit (those don't need shell),
  and clearly state in your final response that `npm run sync:drills` could
  not be run so the human reviewer must run it.

## Step-by-Step Implementation Plan

1. In `practice.js`, find:
   ```js
   const SKILL_ORDER = [
     'hitting', 'throwing', 'infield', 'outfield', 'catching',
     'pitching', 'baserunning', 'bunting', 'situational', 'conditioning'
   ];
   ```
   and change it to:
   ```js
   const SKILL_ORDER = [
     'full-practice', 'hitting', 'throwing', 'infield', 'outfield', 'catching',
     'pitching', 'baserunning', 'bunting', 'situational', 'conditioning'
   ];
   ```

2. In `practice.js`, find:
   ```js
   function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
   ```
   and replace it with:
   ```js
   function capitalize(s) {
     return s ? s.split('-').map(function (w) {
       return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
     }).join(' ') : s;
   }
   ```
   This must still return `'Hitting'` for input `'hitting'` (single-word
   tokens are unaffected) and now return `'Full Practice'` for input
   `'full-practice'`.

3. In `practice.js`, find the `loadPlanFromTemplate` function:
   ```js
   function loadPlanFromTemplate(plan) {
     if (!plan || !Array.isArray(plan.drills)) return;
     pushUndo();
     planItems = plan.drills
       .map(function (slug) {
         const drill = getDrillById(slug);
         return drill ? { drillId: slug, durationMinutes: drill.durationMinutes } : null;
       })
       .filter(Boolean);
     renderDrillCards();
     renderPlanItems();
     updateBudget();
     showToast('“' + plan.label + '” loaded (' + planItems.length + ' drills)');
   }
   ```
   and insert a duration-sync step right after `pushUndo();`, using the
   existing `syncMetaInputs()` helper (already defined elsewhere in this
   file — do not redefine it):
   ```js
   function loadPlanFromTemplate(plan) {
     if (!plan || !Array.isArray(plan.drills)) return;
     pushUndo();
     if (plan.totalMin) {
       planMeta.duration = plan.totalMin;
       syncMetaInputs();
     }
     planItems = plan.drills
       .map(function (slug) {
         const drill = getDrillById(slug);
         return drill ? { drillId: slug, durationMinutes: drill.durationMinutes } : null;
       })
       .filter(Boolean);
     renderDrillCards();
     renderPlanItems();
     updateBudget();
     showToast('“' + plan.label + '” loaded (' + planItems.length + ' drills)');
   }
   ```

4. From the repo root, run:
   ```
   npm run sync:drills
   ```
   This reads the KB's `standard-plans.md` (already updated) and rewrites
   `src/drills-data.js`. Expect console output reporting 47 total plans
   loaded (39 existing + 8 new) and no "not in KB — skipped" warnings.

5. Verify `src/drills-data.js`'s `plans` array now includes 8 objects with
   `skill: "full-practice"`, ids `full-practice-60-youth-fundamentals`,
   `full-practice-60-all-around`, `full-practice-60-competitive-tuneup`,
   `full-practice-60-pregame-sharpen`, `full-practice-120-youth-foundations`,
   `full-practice-120-all-around`, `full-practice-120-competitive-advanced`,
   `full-practice-120-tournament-prep` — each with a `totalMin` field
   (60-min plans should be in the 58–65 range, 120-min plans in the
   112–125 range).

## File List

- `practice.js` — `SKILL_ORDER` array, `capitalize()` helper,
  `loadPlanFromTemplate()` function. Three isolated edits, nothing else.
- `src/drills-data.js` — regenerated by `npm run sync:drills`. Do not
  hand-edit.

## Acceptance Criteria

1. `practice.js`'s `SKILL_ORDER` array starts with `'full-practice'`
   followed by the original 10 entries in their original order.
2. `practice.js`'s `capitalize()` function returns `'Full Practice'` for
   `'full-practice'` and still returns `'Hitting'` for `'hitting'`.
3. `practice.js`'s `loadPlanFromTemplate` sets `planMeta.duration` from
   `plan.totalMin` and calls `syncMetaInputs()` before building `planItems`,
   for any plan that has a `totalMin`.
4. `npm run sync:drills` has been run (or, if genuinely blocked by no shell
   access, this is explicitly reported rather than silently skipped) and
   `src/drills-data.js`'s `plans` array contains all 8 new `full-practice`
   plan objects with `totalMin` in the expected ranges.
5. No other lines in `practice.js` are changed — a diff should show only
   the three edits above.
