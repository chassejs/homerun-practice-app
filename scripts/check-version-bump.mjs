#!/usr/bin/env node
/* ===================================================================
   check-version-bump.mjs
   Enforces docs/VERSIONING.md: any PR that touches app source must
   also bump APP_VERSION (verified via version.json's "version" field
   actually changing — not merely the file being touched) and add a
   changelog.js / CHANGELOG.md entry.

   Run locally:  node scripts/check-version-bump.mjs [baseRef]
   Run in CI:    same, baseRef defaults to origin/main.

   Escape hatch: a genuinely internal-only change (no user-visible
   behavior difference — e.g. a refactor, added test coverage) can skip
   the bump by including a trailer in a commit message between baseRef
   and HEAD:
     Version-bump-exempt: <reason>
   The reason is required and is echoed in the check output, so the
   exemption is a deliberate, auditable decision each time — not a
   silent bypass.

   Exits 1 (with an explanation) if source changed but version.json's
   "version" field did not, and no exemption trailer is present.
   Exits 0 otherwise — including when nothing in APP_SOURCE_PATTERNS
   changed at all.
   =================================================================== */

import { execSync } from 'node:child_process';

const baseRef = process.argv[2] || 'origin/main';

// Files/dirs whose changes count as a "user-visible release" per
// docs/VERSIONING.md and therefore require a version bump (or an
// explicit exemption — see the escape hatch above).
const APP_SOURCE_PATTERNS = [
  /^index\.html$/,
  /^styles\.css$/,
  /^practice\.js$/,
  /^sw\.js$/,
  /^feedback\.js$/,
  /^appUpdates\.js$/,
  /^versionCompat\.js$/,
  /^changelog\.html$/,
  /^src\//,
  /^scripts\/sync-drills\.mjs$/,
  /^brand\//
];

const EXEMPT_TRAILER_RE = /^Version-bump-exempt:\s*(.+)$/im;

function matchesAny(file, patterns) {
  return patterns.some((re) => re.test(file));
}

function verifyBaseRef(base) {
  try {
    execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' });
  } catch {
    console.log(
      `check-version-bump: base ref "${base}" not found locally — skipping (nothing to compare against).`
    );
    process.exit(0);
  }
}

function getFileAtRef(ref, file) {
  try {
    return execSync(`git show ${ref}:${file}`, { encoding: 'utf8' });
  } catch {
    return null; // file did not exist at that ref
  }
}

function getVersionField(ref) {
  const content = getFileAtRef(ref, 'version.json');
  if (content == null) return null;
  try {
    return JSON.parse(content).version;
  } catch {
    return null;
  }
}

function findExemption(mergeBase) {
  const log = execSync(`git log --format=%B ${mergeBase}..HEAD`, { encoding: 'utf8' });
  const match = log.match(EXEMPT_TRAILER_RE);
  return match ? match[1].trim() : null;
}

verifyBaseRef(baseRef);
const mergeBase = execSync(`git merge-base ${baseRef} HEAD`, { encoding: 'utf8' }).trim();

const changed = execSync(`git diff --name-only ${mergeBase} HEAD`, { encoding: 'utf8' })
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const sourceChanges = changed.filter((f) => matchesAny(f, APP_SOURCE_PATTERNS));

if (sourceChanges.length === 0) {
  console.log('check-version-bump: no app-source files changed — no version bump required.');
  process.exit(0);
}

// The real signal is whether version.json's "version" field itself
// changed — NOT whether version.js/version.json/package.json/changelog.js
// were merely touched (a PR can edit package.json's "scripts" block, for
// example, without bumping "version", and that must not count).
const baseVersion = getVersionField(mergeBase);
const headVersion = getVersionField('HEAD');
const versionBumped = baseVersion !== headVersion;

if (versionBumped) {
  console.log(`✅ check-version-bump: version.json bumped ${String(baseVersion)} → ${String(headVersion)}.`);
  process.exit(0);
}

const exemptionReason = findExemption(mergeBase);
if (exemptionReason) {
  console.log(`✅ check-version-bump: exempted — ${exemptionReason}`);
  process.exit(0);
}

console.error('❌ check-version-bump: app-source files changed but version.json\'s "version" field did not.\n');
console.error('Changed source files:');
sourceChanges.forEach((f) => console.error(`  - ${f}`));
console.error('\nPer docs/VERSIONING.md, bump APP_VERSION for any user-visible release:');
console.error('  - version.js       (APP_VERSION)');
console.error('  - version.json     ("version", "released")');
console.error('  - package.json     ("version", keep in sync as major.minor.0)');
console.error('  - changelog.js     (new entry, newest first)');
console.error('  - CHANGELOG.md     (matching hand-maintained mirror)');
console.error(
  '\nIf this change has NO user-visible effect (pure refactor, added test coverage, etc.),\n' +
  'add a commit message trailer instead of bumping:\n' +
  '  Version-bump-exempt: <why this has no user-visible effect>'
);
console.error('\nSee docs/VERSIONING.md for the full policy.');
process.exit(1);
