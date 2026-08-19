/* ===================================================================
   Homerun Practice — versionCompat.js
   Backup/restore compatibility logic.

   Depends on window.HRP_VERSION (loaded from version.js before this).

   ADDING A NEW MIGRATION:
     Push an entry onto MIGRATIONS: { from: "X.Y", to: "X.Z", migrate(data) }
     The migrate function receives the inner data payload and must return
     the transformed payload. Keep migrations pure (no side effects).

   REGISTERING A BREAKING BOUNDARY:
     Add the target DATA_VERSION to BREAKING_BOUNDARIES. Any backup whose
     dataVersion is older than that target AND cannot be reached through
     the migration chain without crossing this boundary will be blocked.
     See docs/VERSIONING.md for a worked 1.x → 2.0 example.
   =================================================================== */

window.HRP_VERSION_COMPAT = (function () {
  'use strict';

  // ---------------------------------------------------------------
  // Migration chain — ordered list of step-by-step schema upgrades.
  // Each entry transforms a data payload from `from` to `to`.
  // Currently empty because 1.0 is the baseline; add entries here
  // when DATA_VERSION is bumped in a future release.
  // ---------------------------------------------------------------
  var MIGRATIONS = [
    // Currently empty because 1.0 is this app's baseline; add entries here
    // when DATA_VERSION is bumped in a future release.
  ];

  // ---------------------------------------------------------------
  // Breaking boundaries — DATA_VERSION values that cannot be reached
  // automatically from older versions. Import is blocked when the
  // imported file's dataVersion is older than any entry in this set
  // and the migration chain cannot bridge the gap.
  // ---------------------------------------------------------------
  var BREAKING_BOUNDARIES = new Set([
    // Example: '2.0'  — add when a 2.0 release has a breaking schema change
  ]);

  // ---------------------------------------------------------------
  // compareVersions(a, b)
  // Returns -1 if a < b, 0 if a === b, 1 if a > b.
  // Handles "major.minor" semver-style strings (e.g. "1.0", "2.3").
  // ---------------------------------------------------------------
  function parseVer(v) {
    var parts = String(v || '0.0').split('.');
    return { major: parseInt(parts[0], 10) || 0, minor: parseInt(parts[1], 10) || 0 };
  }

  function compareVersions(a, b) {
    var av = parseVer(a), bv = parseVer(b);
    if (av.major !== bv.major) return av.major < bv.major ? -1 : 1;
    if (av.minor !== bv.minor) return av.minor < bv.minor ? -1 : 1;
    return 0;
  }

  // ---------------------------------------------------------------
  // buildMigrationPath(fromVersion, toVersion)
  // Returns an ordered array of MIGRATIONS entries that, when applied
  // in sequence, upgrade a payload from fromVersion to toVersion.
  // Returns null if no path exists.
  // ---------------------------------------------------------------
  function buildMigrationPath(fromVersion, toVersion) {
    if (compareVersions(fromVersion, toVersion) === 0) return [];
    var path = [];
    var current = fromVersion;
    // Walk the MIGRATIONS array in order until we reach toVersion.
    // This assumes the chain is linear and ordered oldest-first.
    for (var i = 0; i < MIGRATIONS.length; i++) {
      var step = MIGRATIONS[i];
      if (compareVersions(current, step.from) === 0) {
        path.push(step);
        current = step.to;
        if (compareVersions(current, toVersion) === 0) return path;
      }
    }
    return null; // no complete path found
  }

  // ---------------------------------------------------------------
  // isImportCompatible(importedDataVersion)
  // Returns { status, message } where status is one of:
  //   "compatible"  — same version, import directly
  //   "migratable"  — older but upgradeable, run migrations then import
  //   "incompatible" — cannot import, block with message
  // ---------------------------------------------------------------
  function isImportCompatible(importedDataVersion) {
    var v = window.HRP_VERSION;
    var currentDataVersion = v.DATA_VERSION;
    var cmp = compareVersions(importedDataVersion, currentDataVersion);

    // Exact match — import directly.
    if (cmp === 0) {
      return { status: 'compatible', message: null };
    }

    // Imported version is NEWER than the app's current DATA_VERSION.
    // We cannot safely restore a file from a future version.
    if (cmp > 0) {
      return {
        status: 'incompatible',
        message:
          'The backup you\'re trying to import is from version ' + importedDataVersion +
          ', which is not compatible with version ' + currentDataVersion + ' of this app. ' +
          'Please update the app to the latest version and try again.'
      };
    }

    // Imported version is OLDER. Check for a breaking boundary first.
    // A breaking boundary blocks import even if a migration chain exists,
    // because the schema change is too severe to auto-migrate safely.
    var sortedBoundaries = Array.from(BREAKING_BOUNDARIES).sort(compareVersions);
    for (var b = 0; b < sortedBoundaries.length; b++) {
      var boundary = sortedBoundaries[b];
      // If the boundary sits between the imported version and current version,
      // and the imported version is older than the boundary, block it.
      if (
        compareVersions(importedDataVersion, boundary) < 0 &&
        compareVersions(boundary, currentDataVersion) <= 0
      ) {
        return {
          status: 'incompatible',
          message:
            'The backup you\'re trying to import is from version ' + importedDataVersion +
            ', which is not compatible with version ' + currentDataVersion + ' of this app. ' +
            'This backup crosses a breaking schema boundary introduced in version ' + boundary + ' ' +
            'and cannot be automatically restored. ' +
            'You will need to re-enter your data manually.'
        };
      }
    }

    // Check for a complete migration path.
    var path = buildMigrationPath(importedDataVersion, currentDataVersion);
    if (path !== null) {
      return {
        status: 'migratable',
        message:
          'This backup was created with an older version of the app (version ' + importedDataVersion + '). ' +
          'It will be automatically upgraded to version ' + currentDataVersion + ' when imported.',
        migrationPath: path
      };
    }

    // No migration path and no known breaking boundary — still incompatible.
    return {
      status: 'incompatible',
      message:
        'The backup you\'re trying to import is from version ' + importedDataVersion +
        ', which is not compatible with version ' + currentDataVersion + ' of this app. ' +
        'No upgrade path is available for this version combination.'
    };
  }

  // ---------------------------------------------------------------
  // applyMigrations(data, migrationPath)
  // Runs each migration step in order and returns the upgraded payload.
  // ---------------------------------------------------------------
  function applyMigrations(data, migrationPath) {
    var result = data;
    for (var i = 0; i < migrationPath.length; i++) {
      result = migrationPath[i].migrate(result);
    }
    return result;
  }

  return {
    compareVersions: compareVersions,
    isImportCompatible: isImportCompatible,
    applyMigrations: applyMigrations,
    // Exposed for tests only
    _MIGRATIONS: MIGRATIONS,
    _BREAKING_BOUNDARIES: BREAKING_BOUNDARIES,
    _buildMigrationPath: buildMigrationPath
  };
}());
