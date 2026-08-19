# Homerun Practice

A simple, offline, browser-based practice plan builder for baseball coaches —
split out of the Homerun Lineup app (v2.2) so it can grow on its own.

## How to open

Double-click **`index.html`**. It runs entirely in your browser — no install,
no server, no internet connection required after the first load. (Chrome,
Edge, Safari, or Firefox.)

All your data is saved automatically in that browser's local storage on this
computer. There is no cloud and no account.

> **Important:** because data lives in *this browser on this computer*, it is
> not automatically shared between devices, and clearing your browser data
> will erase it. Use **Export** regularly (see below) to keep a backup file.

## The Practice Planner

1. **Session Configuration** — team name, date, theme/focus, location, start
   time, session duration, and coach's notes.
2. **Drill Library** — search 368 drills sourced from the Youth Baseball
   Canada knowledge base, or filter by skill, intensity, or age range. Click
   a card to see full detail (purpose, setup, coaching cues, execution
   steps, common faults, equipment); click **+** to add it to your plan.
3. **Skill-Focused Plans** — pre-built plans organized by skill; click one to
   load it instantly.
4. **The plan panel (right)** — build your plan in one of two modes:
   - **Sequential drills** — an ordered list, each drill with its own
     editable duration.
   - **Stations** — split the session into stations (e.g. hitting, infield,
     baserunning) running in parallel, each with one time allocation and its
     own drill list.
   A live **time budget bar** shows how much of your session is used up.
5. **Save / Load** — save the current plan to this browser and reopen it
   later. **Undo Last** reverts the most recent change; **Clear Plan** wipes
   the current plan (with confirmation).
6. **Print / PDF** — a clean, timed practice sheet with the timeline (or
   station breakdown), drill details, and your coach's notes. Choose
   **"Save as PDF"** as the printer to export a file.

## Backup & restore

- **Export** downloads a `homerun-practice-plans-YYYY-MM-DD.json` file with
  every plan you've saved in this browser. Keep these somewhere safe.
- **Import** loads plans from a previously exported file and adds them to
  what you already have — a plan with the same name as one you already saved
  is overwritten, everything else is left untouched.

Because the app stores data in this browser (not a cloud account), exporting
regularly is the safest way to avoid losing your plans.

## Drill data

Drill content is generated from the Youth Baseball Canada knowledge base
(`/Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/*.md`) by
`scripts/sync-drills.mjs`, which writes `src/drills-data.js`. Re-run it with:

```
npm run sync:drills
```

The sync also runs automatically as a prebuild step (`npm run build`), so
deploys always reflect the current KB snapshot. See
[`scripts/README.md`](scripts/README.md) for details. `src/drills-data.js`
must never be hand-edited — all content changes belong in the KB.

## Visual identity

This app uses the same Homerun Baseball Ottawa brand tokens as Homerun
Lineup and the marketing site — navy `#062448`, red `#a3301f`, cream
`#f6f3ec` — sourced from the KB brand package at
`/Users/jschasse/knowledge-base/homerun-ottawa/brand/`. Do not change these
five hex values; see [`styles.css`](styles.css).

## Files

- `index.html` — page structure (Practice Planner + Help & Guide views)
- `styles.css` — brand tokens, shared chrome, and all Practice Planner styling
- `shell.js` — minimal nav-tab switching between the two views
- `practice.js` — all Practice Planner logic (drills, plan builder, save/load,
  export/import, print)
- `src/drills-data.js` — generated drill data (do not hand-edit)
- `version.js`, `versionCompat.js`, `changelog.js`, `changelog.html`,
  `appUpdates.js`, `uiModal.js`, `feedback.js` — version footer, What's New,
  in-app update checks, and the feedback form (see
  [`docs/VERSIONING.md`](docs/VERSIONING.md))
