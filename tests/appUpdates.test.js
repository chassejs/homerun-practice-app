/* ===================================================================
   appUpdates.test.js — Node-runnable unit tests for the update-check
   logic in appUpdates.js: the mechanism that verifies, on load, that
   the app is running the latest published version.

   Run with:  node tests/appUpdates.test.js
   Or via:    npm test
   =================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');

const window = global; // appUpdates.js reads/writes window.* and bare globals

// ---------------------------------------------------------------------------
// Minimal browser-environment shims. appUpdates.js guards all DOM-only code
// (initFooter, the modal `build` callbacks, the auto-run `start()` call at
// the bottom of the file) behind `typeof document !== 'undefined'`, so
// leaving `document` undefined here is deliberate: it loads the module
// without any DOM, and none of the update-check logic under test needs it.
// ---------------------------------------------------------------------------
global.location = { protocol: 'https:' };
// Node 21+ ships a built-in read-only `navigator` global, so a plain
// assignment throws ("only a getter"). Redefine it as a normal writable
// property so tests can freely swap it (e.g. to simulate offline).
Object.defineProperty(global, 'navigator', {
  value: { onLine: true },
  writable: true,
  configurable: true
});

function makeMemoryStorage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}

// versionCompat.js must load first — appUpdates.js's compareVersions
// delegates to window.HRP_VERSION_COMPAT.compareVersions rather than
// reimplementing it, exactly as index.html loads them (version.js,
// versionCompat.js, ..., appUpdates.js deferred last).
global.HRP_VERSION = { APP_VERSION: '1.0', DATA_VERSION: '1.0', MIN_COMPATIBLE_DATA_VERSION: '1.0' };
const versionCompatCode = fs.readFileSync(path.join(__dirname, '..', 'versionCompat.js'), 'utf8');
eval(versionCompatCode); // populates global.HRP_VERSION_COMPAT

const appUpdatesCode = fs.readFileSync(path.join(__dirname, '..', 'appUpdates.js'), 'utf8');
eval(appUpdatesCode); // populates global.HRP_APP_UPDATES (no auto-run: document is undefined)

const updates = global.HRP_APP_UPDATES;

// ---------------------------------------------------------------------------
// Minimal sequential async-capable test harness. Tests here share mutable
// globals (fetch, HRP_VERSION, sessionStorage, HRP_MODAL), so they MUST run
// one at a time, in order — a "fire everything, then await Promise.all"
// harness would let a later test's setup mutate a global while an earlier
// test's checkForUpdate() promise chain is still resolving.
// ---------------------------------------------------------------------------
const queue = [];
let passed = 0, failed = 0;

function section(title) {
  queue.push({ header: title });
}

function test(name, fn) {
  queue.push({ name: name, fn: fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    throw new Error((label || 'Value') + ': expected "' + expected + '" but got "' + actual + '"');
}

// Waits for a full macrotask turn. Node drains the ENTIRE microtask queue
// (including microtasks newly enqueued while draining) before running the
// next macrotask, so one setImmediate reliably waits out checkForUpdate's
// whole fetch().then().then().catch() chain regardless of its depth.
function flushAsync() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

// ---------------------------------------------------------------------------
// compareVersions must delegate to versionCompat.js, not reimplement it.
// appUpdates.js and versionCompat.js used to each carry their own
// hand-rolled compareVersions — this is exactly the drift risk that let
// the two silently diverge. Proven by swapping in a sentinel spy: if this
// still passes after a refactor, delegation is intact.
// ---------------------------------------------------------------------------
section('compareVersions (delegates to versionCompat.js, does not reimplement it)');

test('delegates to window.HRP_VERSION_COMPAT.compareVersions', function () {
  const original = global.HRP_VERSION_COMPAT.compareVersions;
  let calledWith = null;
  global.HRP_VERSION_COMPAT.compareVersions = function (a, b) {
    calledWith = [a, b];
    return 42; // sentinel value no real comparison could produce
  };
  try {
    const result = updates.compareVersions('1.0', '1.1');
    assertEqual(result, 42, 'return value');
    assert(calledWith && calledWith[0] === '1.0' && calledWith[1] === '1.1', 'called with the same arguments');
  } finally {
    global.HRP_VERSION_COMPAT.compareVersions = original;
  }
});

test('falls back to a safe 0 (no update prompt) if versionCompat is unavailable', function () {
  const original = global.HRP_VERSION_COMPAT;
  global.HRP_VERSION_COMPAT = undefined;
  try {
    assertEqual(updates.compareVersions('1.0', '2.0'), 0);
  } finally {
    global.HRP_VERSION_COMPAT = original;
  }
});

// ---------------------------------------------------------------------------
// checkForUpdate — this is the actual "does the app verify it's running the
// latest version on load" mechanism: it fetches version.json (never cached
// by the service worker) and prompts the user when it's ahead of the
// version baked into the currently-loaded, possibly-cached JS.
// ---------------------------------------------------------------------------
section('checkForUpdate — update-available modal');

test('shows the update modal when version.json reports a newer version', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.0' };
  global.sessionStorage = makeMemoryStorage();
  let openedWith = null;
  global.HRP_MODAL = { open: function (cfg) { openedWith = cfg; } };
  global.fetch = function () {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.1' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assert(openedWith !== null, 'HRP_MODAL.open should have been called');
  assertEqual(openedWith.title, 'Update available', 'modal title');
});

test('does NOT show the modal when version.json matches the running version', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.1' };
  global.sessionStorage = makeMemoryStorage();
  let opened = false;
  global.HRP_MODAL = { open: function () { opened = true; } };
  global.fetch = function () {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.1' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assertEqual(opened, false, 'modal should not open when already up to date');
});

test('does NOT show the modal when version.json reports an older version', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.1' };
  global.sessionStorage = makeMemoryStorage();
  let opened = false;
  global.HRP_MODAL = { open: function () { opened = true; } };
  global.fetch = function () {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.0' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assertEqual(opened, false, 'modal should not open for an older/rolled-back remote version');
});

test('does not re-show the modal for a version the user already deferred with "Later"', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.0' };
  global.sessionStorage = makeMemoryStorage();
  global.sessionStorage.setItem('homerun-practice/updateDeferred', '1.1');
  let opened = false;
  global.HRP_MODAL = { open: function () { opened = true; } };
  global.fetch = function () {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.1' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assertEqual(opened, false, 'a deferred version should not re-prompt in the same session');
});

test('skips the check entirely while offline', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.0' };
  const restoreNavigator = global.navigator;
  global.navigator = { onLine: false };
  let fetchCalled = false;
  global.fetch = function () {
    fetchCalled = true;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ version: '1.1' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  global.navigator = restoreNavigator;
  assertEqual(fetchCalled, false, 'fetch should not be called while offline');
});

test('does nothing if version.json is unreachable (network failure)', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.0' };
  global.sessionStorage = makeMemoryStorage();
  let opened = false;
  global.HRP_MODAL = { open: function () { opened = true; } };
  global.fetch = function () { return Promise.reject(new Error('network down')); };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assertEqual(opened, false, 'a failed fetch must not throw or open the modal');
});

test('does nothing if version.json responds with a non-OK HTTP status', async function () {
  global.HRP_VERSION = { APP_VERSION: '1.0' };
  global.sessionStorage = makeMemoryStorage();
  let opened = false;
  global.HRP_MODAL = { open: function () { opened = true; } };
  global.fetch = function () {
    return Promise.resolve({ ok: false, json: () => Promise.resolve({ version: '1.1' }) });
  };

  updates.checkForUpdate({ force: true });
  await flushAsync();

  assertEqual(opened, false, 'a non-OK response must not open the modal');
});

// ---------------------------------------------------------------------------
// Runner — executes the queue strictly in order (see harness note above).
// ---------------------------------------------------------------------------
async function runAll() {
  for (const item of queue) {
    if (item.header) {
      console.log('\n' + item.header);
      continue;
    }
    try {
      await item.fn();
      console.log('  PASS: ' + item.name);
      passed++;
    } catch (err) {
      console.error('  FAIL: ' + item.name);
      console.error('        ' + err.message);
      failed++;
    }
  }

  console.log('\n----------------------------------------');
  console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All tests passed.');
  }
}

runAll();
