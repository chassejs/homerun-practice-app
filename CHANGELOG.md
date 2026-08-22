# Changelog

`changelog.js` is the source of truth for what the app displays. This file is a hand-maintained mirror and must be updated alongside it.

Numbering scheme: a minor update adds 0.1; a major update adds 1.0 and resets the minor to 0.

## v1.5 — 2026-08-22 (minor) — Demo video links for drills

- 85 drills in the library now show a red camera icon — click it to watch a demonstration video (opens in a new tab). More drills will get videos in follow-up updates.

## v1.4 — 2026-08-21 (minor) — Fix: updates could fail to reach you

- The offline cache now changes with every release. Previously the cache name never changed between deploys, so you could keep seeing an old version even after a new one shipped.

## v1.3 — 2026-08-21 (minor) — Fix mobile layout overflow

- Fixed a horizontal scrolling/overflow bug on narrow phone screens (≤375px) that cut off the right edge of the Practice Planner.

## v1.2 — 2026-08-21 (minor) — Drill library navigation redesign

- Browse Drills, Skill Plans, and Roadmap are now tabs instead of stacked sections — no more scrolling past the entire drill library to find a pre-built plan or the skill roadmap.
- Session Configuration now starts collapsed to get out of the way once you've filled it in.
- Undo Last and Clear Plan moved next to Save/Load/Export/Import/Print, where the rest of the plan controls live.

## v1.1 — 2026-08-20 (minor) — Drill library Roadmap + Level filter, new app icon

- New Roadmap view in the drill library — browse drills organized by skill progression.
- New Level filter to narrow the drill library to a specific skill level.
- Refreshed app icon.

## v1.0 — 2026-08-19 (major) — First release — split from Homerun Lineup

- The Practice Planner is now its own app, split out of Homerun Lineup v2.2 so it can grow independently.
- Browse a searchable library of 368 drills sourced from the Youth Baseball Canada knowledge base.
- Build a timed practice plan — Sequential drills or multi-station mode — with a live time budget bar.
- Skill-focused pre-built plans you can load with one click.
- Save plans to this browser, print a clean practice sheet, and export/import your saved plans as a JSON file.
- Send feedback straight from the app, and get notified in-app when a new version is published.
