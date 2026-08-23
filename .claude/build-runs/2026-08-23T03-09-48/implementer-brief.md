# Implementer Brief: Expand drill-videos-data.js from 85 to 191 entries

This is a small, purely mechanical data-merge task. You have shell access in
this session (git, node, npm allowed) — use `node --check` to verify your
work when done.

## Goal

`src/drill-videos-data.js` currently sets `window.DRILL_VIDEOS_DATA` to an
object with 85 drill-id → `{ url, title }` entries. There is a second file
in this same run's directory,
`.claude/build-runs/2026-08-23T03-09-48/researched-videos-batch2.json`,
containing 106 **additional** drill-id → `{ url, title }` entries (none of
which duplicate an existing key). Merge the two into an expanded
`src/drill-videos-data.js` with all 191 entries.

## Steps

1. Read `src/drill-videos-data.js` in full. Note its exact top-of-file
   comment and the `window.DRILL_VIDEOS_DATA = { ... };` assignment format.
2. Read `.claude/build-runs/2026-08-23T03-09-48/researched-videos-batch2.json`
   in full. It has a top-level `"_comment"` key — that key is metadata for
   humans only and must NOT appear anywhere in the output file.
3. Rewrite `src/drill-videos-data.js` so `window.DRILL_VIDEOS_DATA` contains
   all 85 original entries (unchanged — same `url`/`title` values, copied
   exactly) PLUS all 106 entries from the batch-2 JSON file (excluding its
   `_comment` key), for exactly 191 total entries. Keep the same file-level
   comment style and `window.DRILL_VIDEOS_DATA = { ... };` assignment
   pattern already used in the file — this is purely additive data, not a
   rewrite of the file's structure or style.
4. One entry, `conditioning-agility-t-drill-baseball`, and another entry,
   `t-drill-agility`, both point at the same URL in the batch-2 JSON
   (`https://www.youtube.com/watch?v=JK1aeobA2Sk`). This is intentional —
   keep both keys as-is, do not deduplicate or merge them into one.
5. Do not touch `index.html`, `practice.js`, `styles.css`,
   `src/drills-data.js`, or any other file — this task only changes
   `src/drill-videos-data.js`.
6. Run `node --check src/drill-videos-data.js` and fix anything it flags.

## Constraints

- No new dependencies, no build step, no network calls.
- Do not alter any of the 85 existing entries' `url` or `title` values —
  copy them exactly as they are today.
- Do not alter the format/shape of entries — every entry is
  `"drill-id": { "url": "https://...", "title": "..." }`, matching the
  file's current style.
- The final object must have exactly 191 keys and no `_comment` key.

## Acceptance Criteria (what the reviewer will check)

1. `src/drill-videos-data.js` still assigns `window.DRILL_VIDEOS_DATA` as a
   plain object, same comment/assignment style as before.
2. The object has exactly 191 keys, no `_comment` key.
3. All 85 pre-existing keys are present with byte-identical `url`/`title`
   values compared to the file before this change.
4. All 106 new keys from `researched-videos-batch2.json` are present with
   the exact `url`/`title` values from that file.
5. `node --check src/drill-videos-data.js` passes.
6. No other file is modified.
