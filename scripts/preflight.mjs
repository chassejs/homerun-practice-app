#!/usr/bin/env node
/**
 * Pre-deploy preflight — portable across the Homerun/family static sites.
 *
 * Why this exists: across six Netlify sites, deploys averaged 2.0 per work
 * session — 100 deploys for 51 sessions. The second deploy is almost always
 * "deployed, noticed something, deployed again", so every check here is a
 * thing that is cheaper to catch locally than to discover in production.
 *
 * It ADAPTS to the repo. These sites are not uniform — some have a full
 * version/changelog/service-worker system, some are a bare index.html. Each
 * check runs only if the thing it checks exists, and says so when it skips.
 * A skipped check is reported, never silently passed.
 *
 * Exit 0 = safe to deploy. Exit 1 = fix it first.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const IMAGE_BUDGET_KB = 400;
const TOTAL_BUDGET_MB = 8;

let failures = 0, warnings = 0, skipped = 0;
const ok = (m) => console.log('  ok    ' + m);
const bad = (m) => { console.log('  FAIL  ' + m); failures++; };
const warn = (m) => { console.log('  warn  ' + m); warnings++; };
const skip = (m) => { console.log('  --    ' + m + ' (not applicable here)'); skipped++; };
const has = (p) => existsSync(join(root, p));
const read = (p) => readFileSync(join(root, p), 'utf8');

console.log('preflight — ' + root.split('/').pop());

// --- 1. Tests -------------------------------------------------------------
console.log('\ntests');
let testScript = null;
if (has('package.json')) {
  try { testScript = (JSON.parse(read('package.json')).scripts || {}).test || null; } catch { /* ignore */ }
}
if (testScript && !/^echo|no test specified/i.test(testScript)) {
  try {
    const out = execFileSync('npm', ['test'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    const m = out.match(/Total: (\d+) passed, (\d+) failed/);
    ok(m ? 'npm test — ' + m[1] + ' passed, ' + m[2] + ' failed' : 'npm test passed');
  } catch (e) {
    bad('npm test failed — run it directly to see why');
  }
} else {
  skip('no test script');
}

// --- 2. Version identity --------------------------------------------------
console.log('\nversion identity');
let appVersion = null, buildId = null;
if (has('version.js')) {
  const src = read('version.js');
  // var / const / let, single or double quotes — these repos differ.
  appVersion = (src.match(/(?:var|const|let)\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || null;
  buildId = (src.match(/(?:var|const|let)\s+BUILD_ID\s*=\s*['"]([^'"]+)['"]/) || [])[1] || null;
  if (appVersion) ok('version.js APP_VERSION ' + appVersion);
  else warn('version.js present but APP_VERSION not in the expected literal shape');
} else {
  skip('no version.js');
}

if (appVersion && has('package.json')) {
  try {
    const pv = JSON.parse(read('package.json')).version;
    if (!pv) warn('package.json has no "version" field');
    else if (pv === appVersion || pv === appVersion + '.0') ok('package.json ' + pv);
    else bad('package.json is ' + pv + ' but APP_VERSION is ' + appVersion);
  } catch { warn('package.json unreadable'); }
}

if (appVersion && has('version.json')) {
  try {
    const vj = JSON.parse(read('version.json'));
    if (vj.version === appVersion) ok('version.json ' + vj.version);
    else bad('version.json is ' + vj.version + ' but APP_VERSION is ' + appVersion);
    if (buildId) {
      if (vj.buildId === buildId) ok('version.json buildId matches (' + buildId + ')');
      else bad('version.json buildId ' + vj.buildId + ' != version.js ' + buildId);
    }
  } catch { bad('version.json is not valid JSON'); }
} else if (appVersion) {
  skip('no version.json');
}

if (appVersion && has('changelog.js')) {
  const esc = appVersion.replace(/\./g, '\\.');
  if (new RegExp("version:\\s*'" + esc + "'").test(read('changelog.js'))) ok('changelog.js has an entry for ' + appVersion);
  else bad("changelog.js has no entry for " + appVersion + " — the What's-New modal will not fire");
} else if (appVersion) {
  skip('no changelog.js');
}

// --- 3. Service worker ----------------------------------------------------
console.log('\nservice worker');
if (has('sw.js')) {
  const sw = read('sw.js');
  const cacheName = (sw.match(/const CACHE\s*=\s*['"]([^'"]+)['"]/) || [])[1];
  if (!cacheName) {
    warn('sw.js has no recognisable CACHE constant — cannot check invalidation');
  } else if (buildId && cacheName.includes(buildId)) {
    // A cache-first worker whose name never changes serves a stale build forever.
    ok('cache name carries BUILD_ID (' + cacheName + ')');
  } else if (appVersion && cacheName.includes(appVersion)) {
    // No per-build id here, but the cache is at least tied to the release
    // version — good enough as long as every release bumps that version
    // (which these repos' own docs/VERSIONING.md already requires).
    ok('cache name carries APP_VERSION (' + cacheName + ')');
  } else if (buildId || appVersion) {
    bad('cache name "' + cacheName + '" is tied to neither BUILD_ID nor APP_VERSION — a deploy would NOT invalidate for returning visitors');
  } else {
    warn('cache name is "' + cacheName + '" and there is no version identity to tie it to — cannot verify invalidation');
  }
  const block = (sw.match(/(?:const|var)\s+ASSETS\s*=\s*\[([\s\S]*?)\]/) || [])[1];
  if (block) {
    const list = block.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    const gone = list.filter((p) => p !== '/' && !p.includes('${') && !has(p.replace(/^\//, '')));
    if (gone.length) gone.forEach((p) => bad('sw.js precaches a missing file: ' + p));
    else ok(list.length + ' precached assets all exist');
    if (list.includes('/version.json')) bad('/version.json is precached — it is the freshness probe and must come from the network');
    else if (has('version.json')) ok('/version.json correctly excluded from the precache');
  }
} else {
  skip('no sw.js');
}

// --- 4. Referenced files exist -------------------------------------------
console.log('\nreferenced files');
if (has('index.html')) {
  const refs = [...read('index.html').matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1]).filter((s) => !/^(https?:|data:|mailto:|tel:|#|\/\/)/.test(s));
  const gone = refs.filter((r) => !has(r.replace(/^\.\//, '').split('?')[0].split('#')[0]));
  if (gone.length) gone.forEach((m) => bad('index.html references a missing file: ' + m));
  else ok(refs.length + ' referenced files all exist');
} else {
  skip('no index.html at the repo root');
}

// --- 5. Working tree ------------------------------------------------------
console.log('\nworking tree');
try {
  const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  const tracked = status.split('\n').filter((l) => l && !l.startsWith('??'));
  if (tracked.length) warn('uncommitted tracked changes — a CLI deploy ships the working tree, not HEAD:\n' + tracked.map((l) => '          ' + l).join('\n'));
  else ok('no uncommitted tracked changes');
} catch { skip('not a git repo'); }

// --- 6. Asset budget ------------------------------------------------------
console.log('\nasset budget');
const IMG = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const SKIP = new Set(['node_modules', '.git', '.netlify', '.claude', 'source', 'builds', 'reviews']);
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(join(dir, e.name), out); }
    else out.push(join(dir, e.name));
  }
  return out;
}
let total = 0; const heavy = [];
for (const f of walk(root)) {
  const s = statSync(f).size; total += s;
  if (IMG.has(extname(f).toLowerCase()) && s > IMAGE_BUDGET_KB * 1024) heavy.push(f.replace(root + '/', '') + ' (' + Math.round(s / 1024) + ' KB)');
}
if (heavy.length) heavy.forEach((h) => warn('image over ' + IMAGE_BUDGET_KB + ' KB: ' + h + ' — check it is not larger than it renders'));
else ok('no image over ' + IMAGE_BUDGET_KB + ' KB');
const mb = total / 1024 / 1024;
if (mb > TOTAL_BUDGET_MB) warn('payload ' + mb.toFixed(1) + ' MB exceeds the ' + TOTAL_BUDGET_MB + ' MB soft budget');
else ok('payload ' + mb.toFixed(1) + ' MB (budget ' + TOTAL_BUDGET_MB + ' MB)');

// --- Verdict --------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
if (failures) {
  console.log(failures + ' failure(s), ' + warnings + ' warning(s), ' + skipped + ' skipped. DO NOT DEPLOY.');
  console.log('Fixing these now costs one deploy. Shipping them costs two.');
  process.exit(1);
}
console.log('0 failures, ' + warnings + ' warning(s), ' + skipped + ' skipped. Safe to deploy.');
process.exit(0);
