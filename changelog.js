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
      version: '1.2',
      date: '2026-08-21',
      type: 'minor',
      title: 'Fix mobile layout overflow',
      highlights: [
        'Fixed a horizontal scrolling/overflow bug on narrow phone screens (≤375px) that cut off the right edge of the Practice Planner.'
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
