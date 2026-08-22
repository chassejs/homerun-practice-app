/* ===================================================================
   Homerun Practice — changelog.js
   Single source of truth for the What's-New modal and changelog.html.
   CHANGELOG.md is a hand-maintained mirror that must be updated
   alongside this array.
   =================================================================== */

window.HRP_CHANGELOG = (function () {
  'use strict';

  return [
    {
      version: '1.6',
      date: '2026-08-22',
      type: 'minor',
      title: '"Has video" filter + suggest a drill',
      highlights: [
        'New "🎥 Has video only" checkbox in Browse Drills narrows the library to just the drills with a demo video.',
        'The feedback form now has a "Suggest a drill to add" option, with a drill name field and an optional YouTube link field.'
      ]
    },
    {
      version: '1.5',
      date: '2026-08-22',
      type: 'minor',
      title: 'Demo video links for drills',
      highlights: [
        '85 drills in the library now show a red camera icon — click it to watch a demonstration video, which opens in a new tab. More drills will get videos in follow-up updates.'
      ]
    },
    {
      version: '1.4',
      date: '2026-08-21',
      type: 'minor',
      title: 'Fix: updates could fail to reach you',
      highlights: [
        'The offline cache now changes with every release. Previously the cache name never changed between deploys, so once installed as an app (or just left open a while), you could keep seeing an old version even after a new one shipped — the "update available" prompt still worked, but silently reopening the app did not always pick up the fix underneath it.'
      ]
    },
    {
      version: '1.3',
      date: '2026-08-21',
      type: 'minor',
      title: 'Fix mobile layout overflow',
      highlights: [
        'Fixed a horizontal scrolling/overflow bug on narrow phone screens (≤375px) that cut off the right edge of the Practice Planner.'
      ]
    },
    {
      version: '1.2',
      date: '2026-08-21',
      type: 'minor',
      title: 'Drill library navigation redesign',
      highlights: [
        'Browse Drills, Skill Plans, and Roadmap are now tabs instead of stacked sections — no more scrolling past the entire drill library to find a pre-built plan or the skill roadmap.',
        'Session Configuration now starts collapsed to get out of the way once you\'ve filled it in.',
        'Undo Last and Clear Plan moved next to Save/Load/Export/Import/Print, where the rest of the plan controls live.'
      ]
    },
    {
      version: '1.1',
      date: '2026-08-20',
      type: 'minor',
      title: 'Drill library Roadmap + Level filter, new app icon',
      highlights: [
        'New Roadmap view in the drill library — browse drills organized by skill progression.',
        'New Level filter to narrow the drill library to a specific skill level.',
        'Refreshed app icon.'
      ]
    },
    {
      version: '1.0',
      date: '2026-08-19',
      type: 'major',
      title: 'First release — split from Homerun Lineup',
      highlights: [
        'The Practice Planner is now its own app, split out of Homerun Lineup v2.2 so it can grow independently.',
        'Browse a searchable library of 368 drills sourced from the Youth Baseball Canada knowledge base.',
        'Build a timed practice plan — Sequential drills or multi-station mode — with a live time budget bar.',
        'Skill-focused pre-built plans you can load with one click.',
        'Save plans to this browser, print a clean practice sheet, and export/import your saved plans as a JSON file.',
        'Send feedback straight from the app, and get notified in-app when a new version is published.'
      ]
    }
  ];
}());
