## Goal

Expand demo-video coverage for the Practice Planner's drill library from 85
to 191 of the app's 391 drills (an additional 106 drills researched this
session via web search, spot-checked for validity), and verify the quality
of the videos already shipped in v1.5/v1.6. This is a data-only expansion —
the UI (red camera icon on cards + detail modal, the "Has video only"
filter, the feedback-form suggestion option) already exists and needs no
changes; only `src/drill-videos-data.js`'s data object grows.

## Constraints

- `src/drills-data.js` is auto-generated and must never be hand-edited —
  unaffected by this change regardless.
- `src/drill-videos-data.js` is the existing data overlay (see v1.5) — it
  must be **expanded**, not replaced: all 85 existing keys stay exactly as
  they are today (same `url`/`title`), and the 106 new keys from
  `researched-videos-batch2.json` (in this run's directory) are added
  alongside them. Final key count must be exactly 191, with no `_comment`
  key carried over from the JSON source.
- No changes to `index.html`, `practice.js`, `styles.css`, or any other file
  — the video icon, filter checkbox, and feedback-suggestion UI already
  read from `window.DRILL_VIDEOS_DATA` generically and need nothing new to
  pick up the larger dataset.
- One entry (`conditioning-agility-t-drill-baseball` and `t-drill-agility`)
  intentionally shares the same URL — both drill records describe the same
  T-drill agility pattern in the KB. This is deliberate, not a copy-paste
  error; keep both keys.
- Preserve the existing file's format exactly: same top-of-file comment
  style, same `window.DRILL_VIDEOS_DATA = { ... };` assignment, same
  `{ "url": ..., "title": ... }` per-entry shape, entries may be grouped/
  ordered however is convenient (matching source order from the JSON files
  is simplest and least error-prone).

## Step-by-Step Implementation Plan

1. Read the existing `src/drill-videos-data.js` in full (85 entries) to
   confirm current format and exact byte content.
2. Read `.claude/build-runs/2026-08-23T03-09-48/researched-videos-batch2.json`
   in this run's directory (106 new entries; ignore its `_comment` key).
3. Produce a new `src/drill-videos-data.js` containing all 191 entries
   (85 existing + 106 new), preserving the existing 85 entries' `url`/
   `title` values character-for-character and adding the 106 new ones,
   with no `_comment` key anywhere in the output.
4. Do not touch any other file.

## File List

- `src/drill-videos-data.js` — expand from 85 to 191 entries by merging in
  the 106 new drill→video mappings from `researched-videos-batch2.json`,
  keeping all 85 existing entries unchanged.

## Acceptance Criteria

1. `src/drill-videos-data.js` still sets `window.DRILL_VIDEOS_DATA` as a
   plain object (same top-of-file comment style and assignment pattern as
   before).
2. The object has exactly 191 keys — no more, no fewer, no `_comment` key.
3. All 85 keys that existed before this change are still present with
   their exact same `url` and `title` values (byte-for-byte unchanged) —
   verifiable by diffing against the pre-change file.
4. All 106 new keys from `researched-videos-batch2.json` are present with
   the exact `url` and `title` values from that file — verifiable by
   diffing against the source JSON.
5. `node --check src/drill-videos-data.js` passes (valid JS syntax).
6. No other file in the repository is modified.
7. The app still loads with no new console errors, the existing red camera
   icon / "Has video only" filter / feedback-form video-suggestion field
   continue to work exactly as before — now against the larger 191-entry
   dataset (verifiable by loading the app and confirming the "Has video
   only" filter status line reads "191 drills of 391").
