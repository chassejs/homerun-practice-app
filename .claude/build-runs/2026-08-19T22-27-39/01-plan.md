## Goal

Add a library of pre-made, full-practice plans sized to the two practice
lengths coaches actually book a field for — 60 minutes and 120 minutes — so a
coach can pick a plan that already fits their time slot instead of manually
assembling one from the existing single-skill "Skill-Focused Plans" gallery
(which are all ~72–90 min, single-skill, e.g. "Hitting Fundamentals"). The new
plans are full-team sessions that move through warm-up → throwing → hitting →
defense (infield/outfield) → baserunning/situational → cool-down, at four
different levels/emphases per duration (8 plans total: 4× 60-min, 4× 120-min).

This app's drill/plan content is generated from the Youth Baseball Canada KB
(`scripts/sync-drills.mjs` reads `.../wiki/drills/standard-plans.md` and
writes `src/drills-data.js`, which must never be hand-edited). So "adding
plans" means appending new `PLAN:` blocks to the KB source file in the exact
format the sync script already parses, then regenerating `src/drills-data.js`
via `npm run sync:drills`. Because the existing gallery only auto-syncs the
session's time-budget bar for a coach who leaves the default 90-minute
duration untouched, loading a 60- or 120-minute template currently leaves the
budget bar wrong (e.g. loading a 120-min plan against the default 90-min
budget shows it "over budget" even though that's the intended length) — this
plan also fixes that so the new content displays correctly, and a small
gallery-label fix so the new plans get their own readable tab.

## Constraints

- `src/drills-data.js` is generated output — it must NOT be hand-edited.
  All content changes go into
  `/Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/standard-plans.md`,
  followed by running `npm run sync:drills` (or `npm run build`, which runs
  it as a prebuild step) to regenerate `src/drills-data.js`.
- Every drill slug referenced in a new `PLAN:` block must already exist in
  the KB drill catalog — the exact slugs and durations below were pulled
  live from the current `src/drills-data.js` (368 drills) and verified to
  resolve with no "not in KB" warnings. Do not invent or rename slugs.
- Preserve the existing `PLAN:` block format exactly (field order and names
  shown in `standard-plans.md`'s own "Format" section) so the parser in
  `scripts/sync-drills.mjs` (`loadStandardPlans`/`finalizePlan`) picks them
  up correctly. Do not modify the parser itself.
- Do not change any existing `PLAN:` block or any existing drill file in the
  KB — this is additive only.
- Do not change the five brand hex colors, the app's file layout, or the
  Stations-mode logic. Keep changes framework-free vanilla JS consistent
  with the rest of `practice.js` (IIFE, `function` declarations, no new
  dependencies).
- `total_duration` values below are the human-readable label; the sync
  script independently computes the authoritative `totalMin` by summing
  each listed drill's real `durationMinutes` — the labels below were chosen
  to match that computed sum.

## Step-by-Step Implementation Plan

1. Open
   `/Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/standard-plans.md`
   and append the 8 `PLAN:` blocks listed below to the end of the `## Plans`
   section (after the last existing plan, before end of file), using the
   exact same blank-line-separated block format as existing entries. Also
   bump the file's frontmatter `date_modified:` to today's date.

2. In `practice.js`, add `'full-practice'` to the front of the `SKILL_ORDER`
   array (currently starts `'hitting', 'throwing', ...`) so the new plans
   get their own gallery tab, ordered first:
   ```js
   const SKILL_ORDER = [
     'full-practice', 'hitting', 'throwing', 'infield', 'outfield', 'catching',
     'pitching', 'baserunning', 'bunting', 'situational', 'conditioning'
   ];
   ```

3. In `practice.js`, fix the `capitalize()` helper (used to render gallery
   tab labels from the raw `skill` token) so a hyphenated token like
   `'full-practice'` renders as "Full Practice" instead of "Full-practice".
   Replace:
   ```js
   function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
   ```
   with a version that title-cases each hyphen-separated word and joins
   with spaces:
   ```js
   function capitalize(s) {
     return s ? s.split('-').map(function (w) {
       return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
     }).join(' ') : s;
   }
   ```
   Verify this doesn't change existing single-word skill labels (`'hitting'`
   → `'Hitting'`, etc. — unaffected since `split('-')` on a string with no
   hyphen returns a one-element array).

4. In `practice.js`, in `loadPlanFromTemplate(plan)`, sync the session
   duration budget to the loaded plan's actual total so the time-budget bar
   is correct immediately after loading any template (existing skill plans
   too, not just the new ones). Add this right after `pushUndo();` and
   before building `planItems`, using the existing `syncMetaInputs()`
   helper that already exists for this purpose:
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

5. Run `npm run sync:drills` from the repo root to regenerate
   `src/drills-data.js` from the updated KB file. Confirm the console output
   reports the new plan count (39 existing + 8 new = 47) and no
   "drill ... not in KB — skipped" warnings for any of the 8 new plans.

6. Confirm `src/drills-data.js`'s `plans` array now contains all 8 new plan
   objects with `id`, `skill: "full-practice"`, and a `totalMin` reasonably
   close to their target (60-min plans in the 58–65 range, 120-min plans in
   the 112–125 range — see exact expected sums per plan below).

### The 8 new `PLAN:` blocks (append verbatim, in this order)

```
PLAN: full-practice-60-youth-fundamentals
label: 60-Minute Practice — Youth Fundamentals
skill: full-practice
skill_category: Full Practice
difficulty_range: Beginner
age_range: 7–10U
total_duration: ~63 min
age: 7–10
drills: dynamic-warmup-routine,arm-circle-warm-up,partner-catch-routine,standard-tee,bucket-grounders-stationary,short-hop-standard,home-to-first-run-through,catch-the-cloud,cooldown-static-stretch
notes: A tight hour covering catch, throw, tee work, grounders, and a fun baserunning finish — built for a single one-hour slot with young players who need variety over volume.

PLAN: full-practice-60-all-around
label: 60-Minute Practice — All-Around
skill: full-practice
skill_category: Full Practice
difficulty_range: Beginner–Intermediate
age_range: 9–14U
total_duration: ~61 min
age: 9–14
drills: dynamic-warmup-routine,partner-catch-routine,standard-soft-toss,short-hop-standard,drop-step-standard,secondary-lead,rounding-bases-turns,cooldown-static-stretch
notes: One drill per phase of the game — throw, hit, field, and run — for a standard one-hour practice slot with no wasted time.

PLAN: full-practice-60-competitive-tuneup
label: 60-Minute Practice — Competitive Tune-Up
skill: full-practice
skill_category: Full Practice
difficulty_range: Intermediate–Advanced
age_range: 12–18U
total_duration: ~61 min
age: 12–18
drills: arm-circle-warm-up,rocker-step-throw,two-ball-soft-toss,live-front-toss-bp,slow-to-fast-grounders,crow-hop-relay-throw,first-step-leadoff,cooldown-static-stretch
notes: A fast-paced sharpening session for competitive teams with limited field time — live BP, game-speed grounders, and a first-step read to close.

PLAN: full-practice-60-pregame-sharpen
label: 60-Minute Practice — Pre-Game Sharpen
skill: full-practice
skill_category: Full Practice
difficulty_range: Intermediate
age_range: 10–18U
total_duration: ~61 min
age: 10–18
drills: dynamic-warmup-routine,pre-game-throw-routine,standard-soft-toss,four-corner-infield,fly-ball-communication,primary-lead,infield-communication-pre-pitch,signs-signals-drill
notes: A light activation session for the hour before a game — arm care, timing, communication calls, and signs. Keep intensity moderate; save the legs.

PLAN: full-practice-120-youth-foundations
label: 120-Minute Practice — Youth Foundations
skill: full-practice
skill_category: Full Practice
difficulty_range: Beginner
age_range: 7–10U
total_duration: ~119 min
age: 7–10
drills: dynamic-warmup-routine,arm-circle-warm-up,partner-catch-routine,chest-pass-catch,freeze-at-the-t,target-throw-accuracy,standard-tee,low-high-tee,standard-soft-toss,bucket-grounders-stationary,short-hop-standard,four-corner-infield,kneeling-catch,directional-call-outs,catch-the-cloud,home-to-first-run-through,rounding-bases-turns,cooldown-static-stretch
notes: A full two-hour session for young players — short stations across throwing, hitting, infield, and outfield basics with a baserunning finish. Rotate groups every 10–12 minutes to hold attention.

PLAN: full-practice-120-all-around
label: 120-Minute Practice — All-Around
skill: full-practice
skill_category: Full Practice
difficulty_range: Intermediate
age_range: 9–14U
total_duration: ~119 min
age: 9–14
drills: dynamic-warmup-routine,arm-circle-warm-up,partner-catch-routine,target-throw-accuracy,standard-tee,tee-location-variation,standard-soft-toss,live-front-toss-bp,slow-to-fast-grounders,triangle-footwork-infield,drop-step-standard,fly-ball-communication,secondary-lead,rounding-bases-turns,cooldown-static-stretch
notes: The standard two-hour team practice — full coverage of throwing, hitting, infield, outfield, and baserunning with live BP as the centrepiece.

PLAN: full-practice-120-competitive-advanced
label: 120-Minute Practice — Competitive and Advanced
skill: full-practice
skill_category: Full Practice
difficulty_range: Advanced
age_range: 12–18U
total_duration: ~123 min
age: 12–18
drills: arm-circle-warm-up,arm-care-band-routine,rocker-step-throw,long-toss-progression,two-ball-soft-toss,pitch-recognition-take,live-front-toss-bp,situational-bp-rounds,slow-to-fast-grounders,dp-communication,crow-hop-relay-throw,first-step-leadoff,baserunning-first-to-second,cooldown-static-stretch
notes: A demanding two-hour session for older, competitive teams — full arm care, long toss, situational BP rounds, and double-play communication.

PLAN: full-practice-120-tournament-prep
label: 120-Minute Practice — Tournament Prep
skill: full-practice
skill_category: Full Practice
difficulty_range: Intermediate–Advanced
age_range: 11–18U
total_duration: ~120 min
age: 11–18
drills: dynamic-warmup-routine,arm-circle-warm-up,partner-catch-routine,standard-soft-toss,live-front-toss-bp,slow-to-fast-grounders,dp-communication,cutoff-relay-alignment,situational-rundown-defense,bunt-defense-coverage,baserunning-first-to-second,pop-fly-priority-team,cooldown-static-stretch
notes: Full-team situational work ahead of a tournament — cutoffs, relays, rundowns, bunt defense, and pop-fly priority, with live BP to keep bats loose.
```

## File List

- `/Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/standard-plans.md`
  — KB source of truth for plans; append the 8 new `PLAN:` blocks above and
  bump `date_modified`. (Outside this git repo — lives in the KB, not
  tracked by this project's git history.)
- [src/drills-data.js](src/drills-data.js) — generated output; regenerated
  by `npm run sync:drills`, never hand-edited.
- [practice.js](practice.js) — `SKILL_ORDER` array, `capitalize()` helper,
  and `loadPlanFromTemplate()` function (three small, surgical edits).

## Acceptance Criteria

1. `standard-plans.md` contains exactly 8 new `PLAN:` blocks matching the
   content specified above verbatim (ids, all fields, drill lists, notes),
   appended without altering any existing plan block.
2. Running `npm run sync:drills` succeeds with no "not in KB — skipped"
   warnings for any of the 8 new plans, and reports 47 total plans loaded.
3. `src/drills-data.js`'s `plans` array contains all 8 new plan objects,
   each with `skill: "full-practice"`, and each `totalMin` matches what a
   manual sum of its listed drills' `durationMinutes` would produce (60-min
   plans between 58–65 min inclusive; 120-min plans between 112–125 min
   inclusive).
4. In the running app, the Skill-Focused Plans gallery shows a tab labeled
   "Full Practice" (not "Full-practice" or "full-practice"), and clicking it
   filters to exactly the 8 new plan cards, each showing its duration badge.
5. Clicking any of the 8 new plan cards loads it into the sequential plan
   list with the correct drill count and order, AND updates the Session
   Configuration "Session duration" field and the time-budget bar to match
   that plan's actual total (not left at the previous/default value).
6. Loading any pre-existing skill plan (e.g. "Hitting Fundamentals") also
   now updates the duration field/budget bar to that plan's `totalMin`,
   confirming the `loadPlanFromTemplate` fix applies generally, not just to
   the new plans.
7. No existing plan, drill, or unrelated UI behavior changes — `git diff`
   inside the app repo touches only `practice.js` (the three described
   edits) and the regenerated `src/drills-data.js`.
