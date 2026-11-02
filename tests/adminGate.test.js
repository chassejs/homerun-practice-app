/* ===================================================================
   adminGate.test.js — Node-runnable tests for the local admin portal:
   bootstrap admin/admin, hashed multi-admin accounts, password changes,
   and feedback-comment triage.

   Run with:  node tests/adminGate.test.js
   Or via:    npm test
   =================================================================== */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const window = global;
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok    ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL  ' + name);
    console.error(err && err.stack ? err.stack : err);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + '\n      expected: ' + JSON.stringify(expected) + '\n      actual:   ' + JSON.stringify(actual));
  }
}

function memoryStorage() {
  const store = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); return true; },
    removeItem: (k) => { delete store[k]; },
    _store: store
  };
}

const adminCode = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const feedbackCode = fs.readFileSync(path.join(__dirname, '..', 'feedback.js'), 'utf8');
eval(feedbackCode);
eval(adminCode);
const admin = global.HRP_ADMIN;
const feedback = global.HRP_FEEDBACK;

console.log('admin gate');

test('bootstrap account is username admin and password admin', function () {
  assertEqual(admin.DEFAULT_ADMIN_USERNAME, 'admin', 'DEFAULT_ADMIN_USERNAME');
  assertEqual(admin.DEFAULT_ADMIN_PASSWORD, 'admin', 'DEFAULT_ADMIN_PASSWORD');
});

test('sha256 matches Node crypto for short, long, and non-ASCII text', function () {
  ['', 'admin', 'abc', 'a'.repeat(120), 'café', 'パスワード'].forEach(function (sample) {
    const expected = crypto.createHash('sha256').update(sample, 'utf8').digest('hex');
    assertEqual(admin.sha256(sample), expected, 'sha256(' + JSON.stringify(sample).slice(0, 24) + ')');
  });
});

test('unlock accepts admin/admin and rejects a wrong username or password', function () {
  const gate = admin.createGate(memoryStorage(), memoryStorage());
  assertEqual(gate.usingDefaultPassword(), true, 'starts on the bootstrap account');
  assertEqual(gate.listUsers().join(','), 'admin', 'only the bootstrap admin is listed');
  assertEqual(gate.isUnlocked(), false, 'starts locked');
  assertEqual(gate.unlock('admin', 'wrong'), false, 'wrong password');
  assertEqual(gate.unlock('coach', 'admin'), false, 'unknown username');
  assertEqual(gate.isUnlocked(), false, 'still locked after a miss');
  assertEqual(gate.unlock(' admin ', 'admin'), true, 'bootstrap username and password');
  assertEqual(gate.currentUser(), 'admin', 'session user');
  assertEqual(gate.checkPassword('admin', ''), false, 'empty password');
});

test('a signed-in admin can change any listed user password, stored as a hash', function () {
  const local = memoryStorage();
  const gate = admin.createGate(local, memoryStorage());
  assertEqual(gate.changeUserPassword('admin', 'practice', 'practice').error, 'locked', 'must be signed in');
  gate.unlock('admin', 'admin');
  const short = gate.changeUserPassword('admin', 'abc', 'abc');
  assertEqual(short.ok, false, 'short password rejected');
  assertEqual(short.error, 'short', 'short error code');
  const mismatch = gate.changeUserPassword('admin', 'practice', 'planner');
  assertEqual(mismatch.error, 'mismatch', 'mismatch error code');
  assertEqual(gate.changeUserPassword('missing', 'practice', 'practice').error, 'unknown', 'unknown user');
  const changed = gate.changeUserPassword('admin', 'practice', 'practice');
  assertEqual(changed.ok, true, 'change succeeds');
  assertEqual(gate.usingDefaultPassword(), false, 'no longer the bootstrap password');
  assertEqual(gate.unlock('admin', 'admin'), false, 'old password no longer works');
  assertEqual(gate.unlock('admin', 'practice'), true, 'new password works');
  const stored = JSON.parse(local.getItem('homerun-practice/admin/users'));
  assertEqual(stored.admin, admin.sha256('practice'), 'stored value is the hash');
  assertEqual(JSON.stringify(stored).indexOf('practice'), -1, 'password is not stored in plaintext');
});

test('setting the only admin password back to admin restores the bootstrap account', function () {
  const local = memoryStorage();
  const gate = admin.createGate(local, memoryStorage());
  gate.unlock('admin', 'admin');
  gate.changeUserPassword('admin', 'practice', 'practice');
  const back = gate.changeUserPassword('admin', 'admin', 'admin');
  assertEqual(back.ok, true, 'reset to admin');
  assertEqual(gate.usingDefaultPassword(), true, 'bootstrap restored');
  assertEqual(local.getItem('homerun-practice/admin/users'), null, 'custom user record removed');
  assertEqual(gate.checkPassword('admin', 'admin'), true, 'admin/admin works again');
});

test('an admin can create another admin who can sign in', function () {
  const local = memoryStorage();
  const gate = admin.createGate(local, memoryStorage());
  assertEqual(gate.createUser('coach', 'practice', 'practice').error, 'locked', 'create requires sign-in');
  gate.unlock('admin', 'admin');
  assertEqual(gate.createUser('bad name', 'practice', 'practice').error, 'username', 'spaces rejected');
  assertEqual(gate.createUser('admin', 'practice', 'practice').error, 'taken', 'bootstrap name is taken');
  const created = gate.createUser('Coach.Mac', 'practice', 'practice');
  assertEqual(created.ok, true, 'create succeeds');
  assertEqual(created.username, 'coach.mac', 'username is normalized');
  assertEqual(gate.listUsers().join(','), 'admin,coach.mac', 'both admins are listed');
  assertEqual(gate.checkPassword('admin', 'admin'), true, 'original admin password unchanged');
  assertEqual(gate.unlock('coach.mac', 'practice'), true, 'new admin can sign in');
  const stored = JSON.parse(local.getItem('homerun-practice/admin/users'));
  assertEqual(stored['coach.mac'], admin.sha256('practice'), 'new password is hashed');
  assertEqual(stored.admin, admin.sha256('admin'), 'bootstrap admin hash is stored once others exist');
  assertEqual(JSON.stringify(stored).indexOf('practice'), -1, 'new password is not plaintext');
});

test('a signed-in admin can change another listed user password', function () {
  const gate = admin.createGate(memoryStorage(), memoryStorage());
  gate.unlock('admin', 'admin');
  gate.createUser('coach', 'practice', 'practice');
  const changed = gate.changeUserPassword('coach', 'diamond', 'diamond');
  assertEqual(changed.ok, true, 'change other user');
  assertEqual(gate.checkPassword('coach', 'practice'), false, 'old password retired');
  assertEqual(gate.checkPassword('coach', 'diamond'), true, 'new password works');
  assertEqual(gate.checkPassword('admin', 'admin'), true, 'admin password untouched');
});

test('a full storage rejects a new admin and keeps the bootstrap login', function () {
  const local = memoryStorage();
  local.setItem = function () { return false; };
  const gate = admin.createGate(local, memoryStorage());
  gate.unlock('admin', 'admin');
  const result = gate.createUser('coach', 'practice', 'practice');
  assertEqual(result.ok, false, 'storage failure');
  assertEqual(result.error, 'storage', 'storage error code');
  assertEqual(gate.checkPassword('admin', 'admin'), true, 'bootstrap still works');
  assertEqual(gate.listUsers().join(','), 'admin', 'no partial user');
});

test('a legacy single password hash still signs in as admin', function () {
  const local = memoryStorage();
  local.setItem('homerun-practice/admin/password-hash', admin.sha256('practice'));
  const gate = admin.createGate(local, memoryStorage());
  assertEqual(gate.usingDefaultPassword(), false, 'legacy hash counts as a saved password');
  assertEqual(gate.unlock('admin', 'admin'), false, 'bootstrap password no longer matches');
  assertEqual(gate.unlock('admin', 'practice'), true, 'legacy password still works');
});

test('sign out locks the portal again', function () {
  const gate = admin.createGate(memoryStorage(), memoryStorage());
  gate.unlock('admin', 'admin');
  gate.lock();
  assertEqual(gate.isUnlocked(), false, 'locked after sign out');
  assertEqual(gate.currentUser(), '', 'no session user');
});

test('feedback comments can be recorded and triaged', function () {
  const store = memoryStorage();
  assertEqual(feedback.listComments(store).length, 0, 'empty inbox');
  assertEqual(feedback.recordComment({ details: '   ' }, store).error, 'details', 'blank comment rejected');
  const first = feedback.recordComment({
    rating: 4,
    category: 'bug',
    categoryLabel: 'Bug — something is broken',
    details: 'The time budget bar overlaps the drills.'
  }, store);
  assertEqual(first.ok, true, 'first comment saved');
  assertEqual(first.comment.status, 'new', 'starts new');
  store._store['homerun-practice/feedback/inbox/v1'] = JSON.stringify([
    first.comment,
    {
      id: 'older',
      createdAt: '2026-08-01T12:00:00.000Z',
      rating: 0,
      category: 'feature',
      categoryLabel: 'Feature request',
      details: 'Add a rain plan.',
      status: 'new',
      version: '1.7'
    }
  ]);
  const listed = feedback.listComments(store);
  assertEqual(listed[0].id, first.comment.id, 'newest comment first');
  assertEqual(listed[1].details, 'Add a rain plan.', 'older comment kept');
  assertEqual(feedback.setCommentStatus(first.comment.id, 'reviewed', store).ok, true, 'mark reviewed');
  assertEqual(feedback.listComments(store)[0].status, 'reviewed', 'status saved');
  assertEqual(feedback.setCommentStatus(first.comment.id, 'resolved', store).ok, true, 'mark resolved');
  assertEqual(feedback.setCommentStatus(first.comment.id, 'new', store).ok, true, 'reopen');
  assertEqual(feedback.setCommentStatus('missing', 'new', store).error, 'unknown', 'unknown comment');
  assertEqual(feedback.setCommentStatus(first.comment.id, 'archived', store).error, 'status', 'unknown status');
  const raw = store.getItem('homerun-practice/feedback/inbox/v1');
  assertEqual(raw.indexOf('The time budget bar overlaps the drills.') !== -1, true, 'comment text is stored');
});

test('the page wires the admin portal and the last-updated date', function () {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const changelog = fs.readFileSync(path.join(root, 'changelog.js'), 'utf8');
  const released = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8')).released;
  const stamp = html.match(/<time id="app-updated-label" datetime="([^"]+)">([^<]*)<\/time>/);
  assertEqual(html.indexOf('id="view-admin"') !== -1, true, 'admin view');
  assertEqual(html.indexOf('id="footer-admin"') !== -1, true, 'footer admin link');
  assertEqual(html.indexOf('id="admin-username"') !== -1, true, 'username field');
  assertEqual(html.indexOf('id="admin-feedback-list"') !== -1, true, 'feedback list');
  assertEqual(html.indexOf('id="admin-user-list"') !== -1, true, 'admin user list');
  assertEqual(html.indexOf('id="admin-create-form"') !== -1, true, 'create admin form');
  assertEqual(html.indexOf('src="admin.js"') !== -1, true, 'admin.js loaded');
  const feedbackSrc = fs.readFileSync(path.join(root, 'feedback.js'), 'utf8');
  assertEqual(feedbackSrc.indexOf('recordComment({') !== -1, true, 'feedback form records a local copy');
  assertEqual(sw.indexOf("'/admin.js'") !== -1, true, 'service worker precaches admin.js');
  assertEqual(!!stamp, true, 'last-updated time element');
  assertEqual(stamp && stamp[1], released, 'datetime matches version.json');
  assertEqual(stamp && stamp[2], admin.formatReleaseDate(released), 'visible date text');
  assertEqual(changelog.indexOf("date: '" + released + "'") !== -1, true, 'changelog records the same date');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
