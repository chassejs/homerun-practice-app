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
