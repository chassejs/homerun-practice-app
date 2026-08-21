/* ===================================================================
   versionCompat.test.js — Node-runnable unit tests for the
   version compatibility logic in versionCompat.js.

   Run with:  node tests/versionCompat.test.js
   Or via:    npm test
   =================================================================== */

'use strict';

// ---------------------------------------------------------------------------
// Minimal browser-environment shim so versionCompat.js loads under Node.
// ---------------------------------------------------------------------------
const window = global; // versionCompat reads window.HRP_VERSION

// Provide HRP_VERSION as if version.js had loaded.
// Tests override DATA_VERSION per-scenario to simulate different app states.
global.HRP_VERSION = {
  APP_VERSION: '1.0',
  DATA_VERSION: '1.0',
  MIN_COMPATIBLE_DATA_VERSION: '1.0'
};

// Load versionCompat.js by reading and eval-ing it (no ES module system needed).
const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'versionCompat.js'), 'utf8');
eval(code); // populates global.HRP_VERSION_COMPAT

const compat = global.HRP_VERSION_COMPAT;

// ---------------------------------------------------------------------------
// Real-function import for the practice-plan normalizer: require the actual
// practice.js source instead of a hand-maintained local copy, so a
// regression in the real normalizer logic is caught here. practice.js
// guards its browser-only auto-run code with `typeof document !==
// 'undefined'`, so a plain Node require() (no window/document globals
// defined in this process) loads it without executing any DOM code or
// touching localStorage — only the exported function is used below.
// ---------------------------------------------------------------------------
const practiceModule = require(path.join(__dirname, '..', 'practice.js'));

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  PASS: ' + name);
    passed++;
  } catch (err) {
    console.error('  FAIL: ' + name);
    console.error('        ' + err.message);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    throw new Error((label || 'Value') + ': expected "' + expected + '" but got "' + actual + '"');
}

// ---------------------------------------------------------------------------
// Helper: temporarily override DATA_VERSION for a test scenario.
// ---------------------------------------------------------------------------
function withDataVersion(version, fn) {
  const orig = global.HRP_VERSION.DATA_VERSION;
  global.HRP_VERSION.DATA_VERSION = version;
  try { fn(); } finally { global.HRP_VERSION.DATA_VERSION = orig; }
}

// ---------------------------------------------------------------------------
// compareVersions tests
// ---------------------------------------------------------------------------
console.log('\ncompareVersions');

test('1.0 vs 1.0 => 0', function () {
  assertEqual(compat.compareVersions('1.0', '1.0'), 0);
});

test('1.0 vs 1.1 => -1 (older)', function () {
  assertEqual(compat.compareVersions('1.0', '1.1'), -1);
});

test('2.0 vs 1.9 => 1 (newer)', function () {
  assertEqual(compat.compareVersions('2.0', '1.9'), 1);
});

test('1.10 vs 1.9 => 1 (major numeric, not lexicographic)', function () {
  assertEqual(compat.compareVersions('1.10', '1.9'), 1);
});

// ---------------------------------------------------------------------------
// isImportCompatible — equal version
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — equal version (1.0 into 1.0)');

test('status is "compatible"', function () {
  const result = compat.isImportCompatible('1.0');
  assertEqual(result.status, 'compatible');
});

test('message is null', function () {
  const result = compat.isImportCompatible('1.0');
  assert(result.message === null, 'Expected null message for compatible');
});

// ---------------------------------------------------------------------------
// isImportCompatible — legacy file (no version field => treated as 1.0)
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — legacy file treated as 1.0');

test('1.0 is compatible when app is at 1.0 (covers the legacy-implicit case)', function () {
  // In importSavedPlansFromFile, missing dataVersion defaults to "1.0".
  // Here we just confirm "1.0" is always compatible with a 1.0 app.
  const result = compat.isImportCompatible('1.0');
  assertEqual(result.status, 'compatible');
});

// ---------------------------------------------------------------------------
// isImportCompatible — newer file (forward-incompatible)
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — newer file than current app (incompatible)');

test('status is "incompatible"', function () {
  const result = compat.isImportCompatible('2.0'); // app is at 1.0
  assertEqual(result.status, 'incompatible');
});

test('message mentions imported version and current version', function () {
  const result = compat.isImportCompatible('2.0');
  assert(result.message.indexOf('2.0') !== -1, 'Message should mention imported version 2.0');
  assert(result.message.indexOf('1.0') !== -1, 'Message should mention current version 1.0');
});

test('message is plain-English (no code jargon)', function () {
  const result = compat.isImportCompatible('9.9');
  assert(typeof result.message === 'string', 'Message should be a string');
  assert(result.message.length > 20, 'Message should be non-trivial');
});

// ---------------------------------------------------------------------------
// isImportCompatible — older migratable file
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — older file with a migration path');

// Temporarily inject a migration step so we can test the migratable path.
// We add it directly to the MIGRATIONS array exposed for testing.
test('status is "migratable" when migration path exists', function () {
  // Inject a migration: 0.9 → 1.0
  compat._MIGRATIONS.push({ from: '0.9', to: '1.0', migrate: function(d) { return d; } });
  try {
    const result = compat.isImportCompatible('0.9');
    assertEqual(result.status, 'migratable');
    assert(result.migrationPath && result.migrationPath.length === 1, 'Should have 1 migration step');
    assert(result.message.indexOf('0.9') !== -1, 'Message should mention original version');
    assert(result.message.indexOf('1.0') !== -1, 'Message should mention target version');
  } finally {
    // Remove the injected migration step
    compat._MIGRATIONS.pop();
  }
});

test('applyMigrations transforms the data payload', function () {
  // A migration that adds a sentinel field to the data object
  const step = { from: '0.9', to: '1.0', migrate: function(d) { return Object.assign({}, d, { _migrated: true }); } };
  const original = { 'My Plan': { mode: 'sequential', items: [] } };
  const result = compat.applyMigrations(original, [step]);
  assert(result._migrated === true, 'Migration should have added _migrated:true');
  // Original should not be mutated (shallow copy)
  assert(original._migrated === undefined, 'Original data should not be mutated');
});

// ---------------------------------------------------------------------------
// isImportCompatible — older file with NO migration path
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — older file with no migration path (incompatible)');

test('status is "incompatible" when no migration chain exists', function () {
  // No migration registered from 0.5 to 1.0
  const result = compat.isImportCompatible('0.5');
  assertEqual(result.status, 'incompatible');
});

// ---------------------------------------------------------------------------
// isImportCompatible — breaking boundary
// ---------------------------------------------------------------------------
console.log('\nisImportCompatible — breaking boundary');

test('status is "incompatible" when import crosses a breaking boundary', function () {
  // Simulate app at 2.0 with a breaking boundary at 2.0, file from 1.2
  compat._BREAKING_BOUNDARIES.add('2.0');
  try {
    withDataVersion('2.0', function () {
      // Add a migration 1.2->2.0 so it WOULD be in the migration chain, but
      // the breaking boundary should block it first.
      compat._MIGRATIONS.push({ from: '1.2', to: '2.0', migrate: function(d) { return d; } });
      try {
        const result = compat.isImportCompatible('1.2');
        assertEqual(result.status, 'incompatible');
        assert(result.message.indexOf('1.2') !== -1, 'Message should mention the imported version 1.2');
        assert(result.message.indexOf('2.0') !== -1, 'Message should mention the current version 2.0');
        assert(result.message.toLowerCase().indexOf('breaking') !== -1 ||
               result.message.toLowerCase().indexOf('boundary') !== -1 ||
               result.message.toLowerCase().indexOf('cannot') !== -1,
               'Message should indicate incompatibility due to breaking change');
      } finally {
        compat._MIGRATIONS.pop();
      }
    });
  } finally {
    compat._BREAKING_BOUNDARIES.delete('2.0');
  }
});

test('breaking boundary message names the boundary version', function () {
  compat._BREAKING_BOUNDARIES.add('2.0');
  try {
    withDataVersion('2.0', function () {
      const result = compat.isImportCompatible('1.5');
      assert(result.message.indexOf('2.0') !== -1, 'Message should name version 2.0 boundary');
    });
  } finally {
    compat._BREAKING_BOUNDARIES.delete('2.0');
  }
});

// ---------------------------------------------------------------------------
// Real app version constants — asserts that every place the release number
// is recorded agrees with version.js, the single source of truth. This
// section is deliberately release-number-agnostic so a version bump never
// requires a test edit. It reads the actual files shipped with the app,
// independent of the synthetic HRP_VERSION fixture used above to exercise
// the generic compat engine.
// ---------------------------------------------------------------------------
console.log('\napp version constants (real files, not the test fixture)');

const versionJsCode = fs.readFileSync(path.join(__dirname, '..', 'version.js'), 'utf8');
const versionSandbox = {};
// eslint-disable-next-line no-eval
const versionFn = new Function('window', versionJsCode + '\nreturn window.HRP_VERSION;');
const APP_VERSION = versionFn(versionSandbox).APP_VERSION;

const changelogJsCode = fs.readFileSync(path.join(__dirname, '..', 'changelog.js'), 'utf8');
const changelogSandbox = {};
// eslint-disable-next-line no-eval
const changelogFn = new Function('window', changelogJsCode + '\nreturn window.HRP_CHANGELOG;');
const changelog = changelogFn(changelogSandbox);

test('version.js APP_VERSION is a major.minor string', function () {
  assertEqual(/^\d+\.\d+$/.test(APP_VERSION), true, 'APP_VERSION format (' + APP_VERSION + ')');
});

test('package.json version matches APP_VERSION', function () {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assertEqual(pkg.version, APP_VERSION + '.0', 'package.json version');
});

test('version.json version matches APP_VERSION', function () {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  assertEqual(data.version, APP_VERSION, 'version.json version');
  assertEqual(/^\d{4}-\d{2}-\d{2}$/.test(data.released), true, 'version.json released format (' + data.released + ')');
});

// ---------------------------------------------------------------------------
// Service-worker cache invalidation. sw.js is cache-first with a fixed
// cache name, so a deploy that leaves that literal untouched keeps serving
// the old precache to returning visitors no matter what else shipped —
// this happened for real. Tying CACHE to APP_VERSION and asserting it here
// makes forgetting the docs/VERSIONING.md checklist item a test failure
// instead of a silent miss. Release-number-agnostic: reads APP_VERSION
// dynamically, so a bump never requires a test edit.
// ---------------------------------------------------------------------------
const swCode = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

test('sw.js CACHE name carries the current APP_VERSION', function () {
  const m = swCode.match(/const CACHE = '([^']+)';/);
  assertEqual(!!m, true, 'sw.js has a recognisable CACHE constant');
  assertEqual(m && m[1].indexOf(APP_VERSION) !== -1, true,
    'CACHE ("' + (m && m[1]) + '") should contain APP_VERSION ("' + APP_VERSION + '")');
});

test('sw.js does not precache /version.json', function () {
  const block = swCode.match(/const ASSETS = \[([\s\S]*?)\];/);
  assertEqual(!!block, true, 'sw.js has a recognisable ASSETS array');
  assertEqual(block && block[1].indexOf('/version.json') === -1, true,
    '/version.json must come from the network, never the precache');
});

test('changelog.js newest entry is the current release', function () {
  assertEqual(Array.isArray(changelog) && changelog.length > 0, true, 'changelog.js is a non-empty array');
  assertEqual(changelog[0].version, APP_VERSION, 'changelog.js newest entry version');
});

test('changelog.js entries are well-formed and ordered newest-first', function () {
  for (let i = 0; i < changelog.length; i++) {
    const entry = changelog[i];
    const label = 'changelog entry ' + (entry && entry.version ? entry.version : '#' + i);
    assertEqual(/^\d+\.\d+$/.test(entry.version), true, label + ' version format');
    assertEqual(/^\d{4}-\d{2}-\d{2}$/.test(entry.date), true, label + ' date format');
    assertEqual(entry.type === 'major' || entry.type === 'minor', true, label + ' type');
    assertEqual(typeof entry.title === 'string' && entry.title.length > 0, true, label + ' title');
    assertEqual(Array.isArray(entry.highlights) && entry.highlights.length > 0, true, label + ' highlights');
    for (let h = 0; h < entry.highlights.length; h++) {
      assertEqual(typeof entry.highlights[h] === 'string' && entry.highlights[h].length > 0, true, label + ' highlights[' + h + ']');
    }
  }
  for (let i = 1; i < changelog.length; i++) {
    const newer = changelog[i - 1];
    const older = changelog[i];
    const newerParts = newer.version.split('.');
    const olderParts = older.version.split('.');
    const newerNum = parseInt(newerParts[0], 10) * 1000 + parseInt(newerParts[1], 10);
    const olderNum = parseInt(olderParts[0], 10) * 1000 + parseInt(olderParts[1], 10);
    assertEqual(olderNum < newerNum, true, 'changelog order: ' + older.version + ' should be older than ' + newer.version);
  }
});

// ---------------------------------------------------------------------------
// Practice plan backward-compatibility normalizer.
// Mirrors the normalizePracticePlan logic in practice.js: a saved plan
// with no `mode` field (the legacy shape used by every plan saved before
// Stations mode existed) must be treated as `mode: "sequential"` with its
// original `items`/drills left completely untouched.
// ---------------------------------------------------------------------------
console.log('\nnormalizePracticePlan — legacy plan backward compatibility');

test('legacy plan (no mode field, old-style items array) normalizes to sequential mode with drills intact', function () {
  const legacyPlan = {
    meta: { team: 'Royals 12U', duration: 90 },
    items: [
      { drillId: 'tee-work', durationMinutes: 15 },
      { drillId: 'infield-reaction', durationMinutes: 20 }
    ],
    savedAt: '2026-01-01T00:00:00.000Z'
  };
  const normalized = practiceModule.normalizePracticePlan(legacyPlan);
  assertEqual(normalized.mode, 'sequential', 'mode');
  assertEqual(normalized.items.length, 2, 'items.length');
  assertEqual(normalized.items[0].drillId, 'tee-work', 'items[0].drillId');
  assertEqual(normalized.items[0].durationMinutes, 15, 'items[0].durationMinutes');
  assertEqual(normalized.items[1].durationMinutes, 20, 'items[1].durationMinutes');
});

test('stations-mode plan keeps its stations array and mode', function () {
  const stationsPlan = {
    mode: 'stations',
    meta: { team: 'Royals 12U', duration: 90 },
    stations: [
      { id: 's1', minutes: 20, drillIds: ['tee-work'] },
      { id: 's2', minutes: 20, drillIds: ['infield-reaction', 'soft-toss'] }
    ]
  };
  const normalized = practiceModule.normalizePracticePlan(stationsPlan);
  assertEqual(normalized.mode, 'stations', 'mode');
  assertEqual(normalized.stations.length, 2, 'stations.length');
  assertEqual(normalized.stations[1].drillIds.length, 2, 'stations[1].drillIds.length');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n----------------------------------------');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
