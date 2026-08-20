#!/usr/bin/env node
/* ===================================================================
   check-version-bump.mjs
   Enforces docs/VERSIONING.md: any PR that touches app source must
   also bump APP_VERSION (version.js / version.json / package.json)
   and add a changelog.js / CHANGELOG.md entry.

   Run locally:  node scripts/check-version-bump.mjs [baseRef]
   Run in CI:    same, baseRef defaults to origin/main.

   Exits 1 (with an explanation) if source changed but the version
   files did not. Exits 0 otherwise — including when nothing in
   APP_SOURCE_GLOBS changed at all.
   =================================================================== */

import { execSync } from 'node:child_process';

const baseRef = process.argv[2] || 'origin/main';

// Files/dirs whose changes count as a "user-visible release" per
// docs/VERSIONING.md and therefore require a version bump.
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

// Touching any of these counts as "the version was bumped".
const VERSION_FILE_PATTERNS = [
  /^version\.js$/,
  /^version\.json$/,
  /^package\.json$/,
  /^changelog\.js$/,
  /^CHANGELOG\.md$/
];

function matchesAny(file, patterns) {
  return patterns.some((re) => re.test(file));
}

function getChangedFiles(base) {
  try {
    execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' });
  } catch {
    console.log(
      `check-version-bump: base ref "${base}" not found locally — skipping (nothing to compare against).`
    );
    process.exit(0);
  }

  const mergeBase = execSync(`git merge-base ${base} HEAD`, { encoding: 'utf8' }).trim();
  const diff = execSync(`git diff --name-only ${mergeBase} HEAD`, { encoding: 'utf8' });
  return diff.split('\n').map((l) => l.trim()).filter(Boolean);
}

const changed = getChangedFiles(baseRef);

const sourceChanges = changed.filter((f) => matchesAny(f, APP_SOURCE_PATTERNS));
const versionChanges = changed.filter((f) => matchesAny(f, VERSION_FILE_PATTERNS));

if (sourceChanges.length === 0) {
  console.log('check-version-bump: no app-source files changed — no version bump required.');
  process.exit(0);
}

if (versionChanges.length === 0) {
  console.error('❌ check-version-bump: app-source files changed but no version files were updated.\n');
  console.error('Changed source files:');
  sourceChanges.forEach((f) => console.error(`  - ${f}`));
  console.error(
    '\nPer docs/VERSIONING.md, bump APP_VERSION for any user-visible release:'
  );
  console.error('  - version.js       (APP_VERSION)');
  console.error('  - version.json     ("version", "released")');
  console.error('  - package.json     ("version", keep in sync as major.minor.0)');
  console.error('  - changelog.js     (new entry, newest first)');
  console.error('  - CHANGELOG.md     (matching hand-maintained mirror)');
  console.error('\nSee docs/VERSIONING.md for the full policy.');
  process.exit(1);
}

console.log('✅ check-version-bump: app-source changes are accompanied by a version bump.');
process.exit(0);
