#!/usr/bin/env node
/**
 * sync-drills.mjs — KB → lineup-app drill data sync
 * ====================================================
 * Source of truth: /Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/*.md
 * Output target:  src/drills-data.js (IIFE that assigns window.DRILLS_DATA)
 *
 * Usage:
 *   node scripts/sync-drills.mjs            # full sync
 *   node scripts/sync-drills.mjs --dry-run  # print counts, write nothing
 *
 * The KB is NEVER modified by this script; it is read-only source of truth.
 * Re-running against an unchanged KB produces a byte-identical output file.
 *
 * The KB stores drills in two markdown shapes and this script handles both:
 *   1. "Concept" format — inline bold sections: **Setup:**, **Coaching cues:**,
 *      **Common faults:** (bullets). No `summary` frontmatter, no numbered steps.
 *   2. "Long" format — `summary:` frontmatter plus heading sections:
 *      `## Setup`, `## Execution` (numbered list), `## Coaching Points`,
 *      `## Common Faults` (markdown table).
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const KB_ROOT   = '/Users/jschasse/knowledge-base/youth-baseball-canada';
const DRILLS_DIR = join(KB_ROOT, 'wiki', 'drills');
const PLANS_FILE = join(DRILLS_DIR, 'standard-plans.md');
const OUT_DIR    = join(REPO_ROOT, 'src');
const OUT_FILE   = join(OUT_DIR, 'drills-data.js');

const DRY_RUN = process.argv.includes('--dry-run');

// Skip files that are not individual drill records
const SKIP_STEMS = new Set(['index', 'standard-plans']);

// ── YAML frontmatter parser (no external deps) ─────────────────────────────
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return [{}, text];
  const end = text.indexOf('\n---', 3);
  if (end === -1) return [{}, text];
  const yamlBlock = text.slice(3, end).trim();
  const body = text.slice(end + 4).trim();
  const fm = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      // Inline YAML list: [item1, item2]
      fm[key] = val.slice(1, -1).split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      const num = Number(val);
      fm[key] = val === '' ? '' : (!isNaN(num) && val !== '' ? num : val.replace(/^["']|["']$/g, ''));
    }
  }
  return [fm, body];
}

// ── Section helpers ────────────────────────────────────────────────────────

// Collect the lines belonging to a `## Heading` (or ### / #) section, stopping
// at the next heading of the same or higher level. Returns an array of raw lines.
function headingSection(body, headingRegex) {
  const lines = body.split('\n');
  const out = [];
  let inSection = false;
  let sectionLevel = 0;
  for (const line of lines) {
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      if (!inSection && headingRegex.test(hm[2].trim())) {
        inSection = true;
        sectionLevel = level;
        continue;
      }
      if (inSection && level <= sectionLevel) break; // next sibling/parent heading
    }
    if (inSection) out.push(line);
  }
  return out;
}

// ── Body extractors ────────────────────────────────────────────────────────
function extractPurpose(body) {
  // First paragraph after the h1 heading is the purpose/summary
  const lines = body.split('\n');
  let pastHeading = false;
  const purposeLines = [];
  for (const line of lines) {
    if (!pastHeading && line.startsWith('# ')) { pastHeading = true; continue; }
    if (!pastHeading) continue;
    if (line.startsWith('**') || line.startsWith('#')) break; // stop at first section
    if (line.trim()) purposeLines.push(line.trim());
  }
  return purposeLines.join(' ').trim();
}

function extractSetup(body) {
  // Format 1: inline bold "**Setup:** ..."
  const m = body.match(/\*\*Setup:\*\*\s*(.+?)(?=\n\n|\n\*\*|\n#|$)/s);
  if (m) return m[1].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

  // Format 2: "## Setup" heading section — take the first non-blockquote,
  // non-callout paragraph(s) of prose.
  const section = headingSection(body, /^setup$/i);
  if (section.length) {
    const para = [];
    for (const raw of section) {
      const line = raw.trim();
      if (!line) { if (para.length) break; else continue; } // stop at first blank after prose
      if (line.startsWith('>')) continue;                   // skip blockquote callouts
      if (line.startsWith('|')) continue;                   // skip tables
      if (line.startsWith('-') || line.startsWith('*')) { para.push(line.replace(/^[-*]\s*/, '')); continue; }
      para.push(line);
    }
    if (para.length) return para.join(' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  }
  return '';
}

function extractCues(body) {
  // Quoted string after **Coaching cues:**
  const m = body.match(/\*\*Coaching cues[^:]*:\*\*\s*"([^"]+)"/);
  if (m) return m[1];
  // Fallback: first bullet under that heading
  const m2 = body.match(/\*\*Coaching cues[^:]*:\*\*\s*\n[-*]\s*(.+)/);
  if (m2) return m2[1].trim();
  return '';
}

function extractExecutionSteps(body) {
  // Numbered list items are execution steps
  const steps = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*(\d+)\.\s+(.+)/);
    if (m) steps.push(m[2].trim());
  }
  return steps;
}

function extractCommonFaults(body) {
  const faults = [];

  // Format 1: inline bold "**Common faults:**" followed by bullets
  let inFaults = false;
  for (const line of body.split('\n')) {
    if (/\*\*Common faults[^:]*:\*\*/.test(line)) { inFaults = true; continue; }
    if (inFaults) {
      if (/^\*\*/.test(line.trim()) || /^#/.test(line.trim())) break;
      const m = line.match(/^[-*]\s+(.+)/);
      if (m) faults.push(m[1].trim());
    }
  }
  if (faults.length) return faults;

  // Format 2: "## Common Faults" heading section — bullets or a markdown table.
  const section = headingSection(body, /^common faults$/i);
  let headerSeen = false;
  for (const raw of section) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('|')) {
      // Markdown table row. Skip the header row and the separator row.
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
      if (!cells.length) continue;
      const first = cells[0].toLowerCase();
      if (!headerSeen && first === 'fault') { headerSeen = true; continue; } // header row
      if (/^[-:\s]+$/.test(cells[0])) continue;                              // separator row
      if (first === 'fault') continue;
      faults.push(cells[0]);
    } else {
      const m = line.match(/^[-*]\s+(.+)/);
      if (m) faults.push(m[1].trim());
    }
  }
  return faults;
}

// ── Drill loader ───────────────────────────────────────────────────────────
const REQUIRED_FIELDS = ['title', 'skill', 'age_min', 'age_max', 'equipment', 'duration_min', 'reps', 'intensity'];

function loadDrills() {
  const errors = [];
  const drills = [];

  const files = readdirSync(DRILLS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort(); // deterministic order

  for (const file of files) {
    const stem = file.replace(/\.md$/, '');
    if (SKIP_STEMS.has(stem)) continue;

    const text = readFileSync(join(DRILLS_DIR, file), 'utf-8');
    const [fm, body] = parseFrontmatter(text);

    // Validate required fields
    const missing = REQUIRED_FIELDS.filter(f => !(f in fm));
    if (missing.length) {
      errors.push(`  ERROR: ${file} — missing required frontmatter fields: ${missing.join(', ')}`);
      continue;
    }

    const skill = Array.isArray(fm.skill) ? fm.skill[0] : fm.skill;
    const equipment = Array.isArray(fm.equipment) ? fm.equipment : (fm.equipment ? [fm.equipment] : []);
    const reps = String(fm.reps);
    const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []);
    const pathway = Array.isArray(fm.pathway) ? fm.pathway : (fm.pathway ? [fm.pathway] : []);

    drills.push({
      id:             stem,                                           // slug is stable id
      title:          String(fm.title),
      category:       skill,                                          // normalized field name
      skill:          skill,                                          // kept for compat with builder
      purpose:        fm.summary ? String(fm.summary) : extractPurpose(body),
      setup:          fm.briefing ? String(fm.briefing) : extractSetup(body),
      coachingCues:   fm.cues ? String(fm.cues) : extractCues(body),
      executionSteps: extractExecutionSteps(body),
      commonFaults:   extractCommonFaults(body),
      equipment:      equipment,
      ageMin:         Number(fm.age_min),
      ageMax:         Number(fm.age_max),
      durationMinutes: Number(fm.duration_min),
      reps:           reps,
      intensity:      String(fm.intensity),
      tags:           tags,
      pathway:        pathway,
      source:         `wiki/drills/${file}`,                         // KB-relative path
    });
  }

  if (errors.length) {
    console.error('\nSync FAILED — fix the following before re-running:\n' + errors.join('\n'));
    process.exit(1);
  }

  // Stable sort by id so output is deterministic regardless of filesystem order
  drills.sort((a, b) => a.id.localeCompare(b.id));
  return drills;
}

// ── Standard plans loader ──────────────────────────────────────────────────
function loadStandardPlans(drillIndex) {
  let text;
  try { text = readFileSync(PLANS_FILE, 'utf-8'); }
  catch { console.warn('  Warning: standard-plans.md not found — no plans emitted'); return []; }

  const plans = [];
  let current = null;
  let inCodeBlock = false;

  for (const line of text.split('\n')) {
    const stripped = line.trim();
    if (stripped.startsWith('```') || stripped.startsWith("'''")) {
      inCodeBlock = !inCodeBlock; continue;
    }
    if (inCodeBlock) continue;

    if (stripped.startsWith('PLAN:')) {
      if (current) finalizePlan(current, drillIndex, plans);
      current = { id: stripped.slice(5).trim(), label: '', skill: '', age: '', drills: [],
        notes: '', skillCategory: '', difficultyRange: '', ageRange: '', totalDuration: '' };
    } else if (current) {
      const fieldMap = {
        'label:':            'label',
        'skill:':            'skill',
        'age:':              'age',
        'notes:':            'notes',
        'skill_category:':   'skillCategory',
        'difficulty_range:': 'difficultyRange',
        'age_range:':        'ageRange',
        'total_duration:':   'totalDuration',
      };
      let matched = false;
      for (const [prefix, prop] of Object.entries(fieldMap)) {
        if (stripped.startsWith(prefix)) {
          current[prop] = stripped.slice(prefix.length).trim();
          matched = true; break;
        }
      }
      if (!matched && stripped.startsWith('drills:')) {
        current.drills = stripped.slice(7).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
  }
  if (current) finalizePlan(current, drillIndex, plans);
  return plans;
}

function finalizePlan(p, drillIndex, plans) {
  const resolved = [];
  for (const slug of p.drills) {
    if (drillIndex[slug]) resolved.push(slug);
    else console.warn(`  Warning: Plan '${p.id}': drill '${slug}' not in KB — skipped`);
  }
  const totalMin = resolved.reduce((s, slug) => s + (drillIndex[slug]?.durationMinutes || 0), 0);
  plans.push({
    id:              p.id,
    label:           p.label,
    skill:           p.skill,
    skillCategory:   p.skillCategory,
    difficultyRange: p.difficultyRange,
    ageRange:        p.ageRange,
    totalDuration:   p.totalDuration,
    age:             p.age,
    drills:          resolved,
    notes:           p.notes,
    totalMin,
  });
}

// ── Output emitter ─────────────────────────────────────────────────────────
function emitOutput(drills, plans) {
  // Deterministic JSON: stable key ordering via JSON.stringify with replacer
  const payload = {
    drills,
    plans,
    generatedAt: '(build-time)',  // static string keeps output deterministic
    drillCount:  drills.length,
    planCount:   plans.length,
  };

  // Use a sorted-keys replacer for deterministic JSON key order
  function sortedStringify(obj) {
    return JSON.stringify(obj, (_, v) => {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
      }
      return v;
    }, 2);
  }

  // Emit as a plain JS file assigning a global; no module system needed since
  // the app is vanilla JS loaded via <script> tags on a static Netlify host.
  const js = `/* AUTO-GENERATED by scripts/sync-drills.mjs — DO NOT EDIT BY HAND.
 * Re-run: npm run sync:drills
 * Source of truth: /Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/
 * ${drills.length} drills, ${plans.length} practice plans.
 */
window.DRILLS_DATA = ${sortedStringify(payload)};
`;
  return js;
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log(`Loading drills from ${DRILLS_DIR} …`);
const drills = loadDrills();
console.log(`  ${drills.length} drills loaded from KB`);

const drillIndex = Object.fromEntries(drills.map(d => [d.id, d]));

console.log(`Loading standard plans from ${PLANS_FILE} …`);
const plans = loadStandardPlans(drillIndex);
console.log(`  ${plans.length} standard plans loaded`);

const js = emitOutput(drills, plans);

if (DRY_RUN) {
  console.log('\n-- Dry run: would write', OUT_FILE);
  console.log(`   ${drills.length} drills, ${plans.length} plans, ${js.length} bytes`);
  console.log('   First drill id:', drills[0]?.id);
  console.log('   Last drill id: ', drills[drills.length - 1]?.id);
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, js, 'utf-8');
console.log(`\nSync complete: ${OUT_FILE}`);
console.log(`  ${drills.length} drills, ${plans.length} plans written.`);
