# Versioning Policy — Homerun Practice

## Overview

The app uses two distinct version concepts:

| Concept | Where it lives | What it governs |
|---|---|---|
| **App version** (`APP_VERSION`) | `version.js`, `package.json` | Human-facing release label shown in the UI |
| **Data version** (`DATA_VERSION`) | `version.js` | Backup/restore JSON compatibility |

They move at different cadences. A cosmetic change bumps `APP_VERSION` but not `DATA_VERSION`. A schema change that affects the exported JSON bumps both.

## Single Source of Truth

All version constants are defined once in `version.js`:

```js
var APP_VERSION = '1.0';
var DATA_VERSION = '1.0';
var MIN_COMPATIBLE_DATA_VERSION = '1.0';
```

`practice.js` and `versionCompat.js` read from `window.HRP_VERSION` (set by `version.js`). No version string is hard-coded anywhere else.

`package.json` `"version"` must always match `APP_VERSION` (major.minor.0 format). Update both together.

## When to Bump APP_VERSION

Bump `APP_VERSION` (and `package.json` `"version"`) for any user-visible release:
- New features
- UI/UX changes
- Bug fixes

Format: `major.minor` (e.g. `1.0`, `1.1`, `2.0`).

## When to Bump DATA_VERSION

Bump `DATA_VERSION` only when the shape of the exported saved-plans JSON changes in a way that could affect restore behavior. Examples:

- Adding a new required field to every saved plan or station
- Renaming an existing field
- Changing the type of an existing field
- Restructuring nested objects

Do NOT bump it for:
- Adding optional fields that have a safe default when absent (the existing `normalizePracticePlan` function already handles this)
- UI-only changes
- Logic changes that do not affect the stored data format

## How to Add a Migration Step

When you bump `DATA_VERSION` (e.g. from `1.0` to `1.1`), add an entry to the `MIGRATIONS` array in `versionCompat.js`:

```js
var MIGRATIONS = [
  {
    from: '1.0',
    to: '1.1',
    migrate: function(data) {
      // Transform the data payload from 1.0 shape to 1.1 shape.
      // data is the saved-plans object (plan name -> serialized plan).
      // Return the transformed payload. Keep this function pure (no side effects).
      var updated = JSON.parse(JSON.stringify(data)); // deep copy to avoid mutation
      Object.keys(updated).forEach(function(name) {
        if (updated[name].newField === undefined) updated[name].newField = 'defaultValue';
      });
      return updated;
    }
  }
];
```

The migration chain is walked in order. Each step's `to` must match the next step's `from`. The chain must be contiguous from the oldest supported version to the current `DATA_VERSION`.

Also update `MIN_COMPATIBLE_DATA_VERSION` in `version.js` to the oldest version reachable through the chain (usually keep it at `1.0` unless you add a breaking boundary).

## How to Register a Breaking Boundary

A **breaking boundary** is a `DATA_VERSION` transition that is too severe to auto-migrate. Any backup from before the boundary is blocked from import rather than silently migrated.

To register one, add the target version to `BREAKING_BOUNDARIES` in `versionCompat.js`:

```js
var BREAKING_BOUNDARIES = new Set([
  '2.0'
]);
```

This tells the app: "Any backup with `dataVersion` older than `2.0` cannot be imported into an app at `2.0` or later."

Also update `MIN_COMPATIBLE_DATA_VERSION` in `version.js` to the new baseline (e.g. `2.0`) so the import check knows what the floor is.

## Worked Example: 1.x to 2.0 Breaking Change

Suppose version 2.0 completely restructures how saved plans are stored — the old shape cannot be safely converted automatically.

**Steps:**

1. In `version.js`, bump both versions and raise the minimum:
   ```js
   var APP_VERSION = '2.0';
   var DATA_VERSION = '2.0';
   var MIN_COMPATIBLE_DATA_VERSION = '2.0';
   ```

2. In `package.json`, set `"version": "2.0.0"`.

3. In `versionCompat.js`, register the breaking boundary:
   ```js
   var BREAKING_BOUNDARIES = new Set([
     '2.0'
   ]);
   ```

4. Do NOT add a migration step (there is no safe auto-migration for a breaking change).

**Result:** When a coach tries to restore a backup that was exported by version 1.x, they will see a blocking modal:

> The backup you're trying to import is from version 1.2, which is not compatible with version 2.0 of this app. This backup crosses a breaking schema boundary introduced in version 2.0 and cannot be automatically restored. You will need to re-enter your data manually.

No data is changed or partially imported.

## Worked Example: 1.0 to 1.1 Non-Breaking Change (Auto-Migrated)

Suppose version 1.1 adds an optional `equipmentNotes` field to each saved plan. Old backups simply lack this field.

**Steps:**

1. In `version.js`, bump `APP_VERSION` and `DATA_VERSION` (keep `MIN_COMPATIBLE_DATA_VERSION` at `1.0`):
   ```js
   var APP_VERSION = '1.1';
   var DATA_VERSION = '1.1';
   var MIN_COMPATIBLE_DATA_VERSION = '1.0';
   ```

2. In `package.json`, set `"version": "1.1.0"`.

3. In `versionCompat.js`, add a migration step:
   ```js
   var MIGRATIONS = [
     {
       from: '1.0',
       to: '1.1',
       migrate: function(data) {
         var updated = JSON.parse(JSON.stringify(data));
         Object.keys(updated).forEach(function(name) {
           if (updated[name].equipmentNotes === undefined) updated[name].equipmentNotes = '';
         });
         return updated;
       }
     }
   ];
   ```

**Result:** A coach restoring a v1.0 backup on a v1.1 app sees a non-blocking confirmation:

> This backup was created with an older version of the app (version 1.0). It will be automatically upgraded to version 1.1 when imported.

After they confirm, the backup is migrated and restored without any data loss.

## Checklist for Every Release

- [ ] Bump `APP_VERSION` in `version.js`
- [ ] Bump `package.json` `"version"` to match (major.minor.0)
- [ ] Bump `"version"` in `version.json` to match `APP_VERSION` (this is what deployed clients poll to detect a new release — if it is not bumped, nobody is ever prompted to update)
- [ ] Add a new entry at the **top** of the array in `changelog.js` (`version`, `date`, `type: 'major' | 'minor'`, `title`, `highlights`) — this drives both the What's-New modal and `changelog.html`
- [ ] Mirror the same entry at the top of `CHANGELOG.md`
- [ ] If the JSON payload shape changed: bump `DATA_VERSION` in `version.js`
- [ ] If auto-migratable: add a `MIGRATIONS` entry in `versionCompat.js`
- [ ] If breaking: add to `BREAKING_BOUNDARIES` and raise `MIN_COMPATIBLE_DATA_VERSION`
- [ ] Run `npm test` and confirm all tests pass
- [ ] Bump the service worker cache name in `sw.js` to embed the new `APP_VERSION` (e.g. `homerun-practice-v1.4`) — `npm test` fails if you forget

## Update Self-Check & What's New

Three pieces work together to keep coaches on the current build without ever risking their data.

**`version.json`** — a tiny file at the site root holding the released version number. It is served with `Cache-Control: no-store` (see `netlify.toml`) and is deliberately **not** precached by the service worker, so it always reflects what is actually deployed.

**The self-check** (`appUpdates.js`) — roughly two seconds after load, and again when the tab becomes visible (throttled to once every 30 minutes), the running app fetches `version.json` with `cache: 'no-store'` and compares it to `APP_VERSION`. It runs only over http/https and only when the browser reports itself online; every failure path — offline, 404, bad JSON, network error — is swallowed silently, because this app must keep working with no network at all.

**The update transition** — if the deployed version is strictly newer, the coach is offered *Update now* or *Later* (*Later* suppresses that version for the rest of the browser session). *Update now* copies the current `homerun-practice/savedplans/v1` state to `homerun-practice/savedplans/v1.backup-pre-update`, deletes every Cache Storage entry, unregisters the service workers, and reloads. **`localStorage` is never cleared** — saved practice plans survive untouched. A 4-second timer guarantees the reload happens even if a cache or service-worker promise hangs.

**What's New** — on load, `appUpdates.js` compares `APP_VERSION` with `localStorage['homerun-practice/lastSeenVersion']` and, when the app is newer, shows the highlights for the current release from `changelog.js`. The last-seen value is written when the modal opens, so no dismissal route can leave it unrecorded. A brand-new user (no saved state) has the value recorded silently and sees nothing. The footer's *What's new* link reopens it on demand.

Because the version number is read at runtime from `window.HRP_VERSION.APP_VERSION`, bumping `version.js` is the only place a release number changes in the app UI — the footer, the What's-New title, the feedback report, and the changelog page's "you are reading" line all follow automatically.
