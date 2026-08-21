# Practice Planner Left-Nav Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the left column's three stacked, always-expanded accordion panels (Drill Library, Skill-Focused Plans, Roadmap) with a single tab bar (`Browse Drills` / `Skill Plans` / `Roadmap`) so the three build-methods read as clear alternatives instead of a long scroll, move Session Configuration to collapsed-by-default, and relocate the misplaced Undo/Clear Plan Actions bar into the right column's plan header.

**Architecture:** Pure DOM/CSS/JS restructuring, no new business logic. Reuses the `data-view` / `.view.active` toggle pattern already implemented in `shell.js` for the top-level Practice Planner / Help & Guide switch, applied one level deeper as `data-ptab` / `.ptab-panel.active`. All three tab panels' content (search/filter/cards, plan gallery, roadmap ladder) is already rendered unconditionally at page load today (`renderDrillCards()`, `renderPlanGallery('all')`, `renderRoadmap()` all run in `practice.js`'s init sequence regardless of accordion state) — so hiding two of three via CSS `display: none` requires zero changes to those render functions.

**Tech Stack:** Vanilla HTML/CSS/JS, no build step, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-08-20-practice-planner-left-nav-tabs-design.md](../specs/2026-08-20-practice-planner-left-nav-tabs-design.md)

## Global Constraints

- No changes to save/load/export/import/print data formats or logic (spec Non-goals).
- No changes to filtering, plan-gallery, or roadmap business logic — markup/CSS/JS restructuring only.
- Reuse the codebase's existing `data-view`/`.view.active` naming convention: new elements use `data-ptab` / `.ptab-*` prefixes, mirroring `data-view` / `.view` (shell.js).
- Per `docs/VERSIONING.md`, this is a user-visible UI/UX change and requires an `APP_VERSION` bump — this plan's final task handles it. Do not skip it or use a `Version-bump-exempt` trailer.
- `npm test` (31 existing tests) must still pass unchanged after every task — none of these changes touch anything the test suite covers, so any failure means something broke.

---

### Task 1: Build-method tab bar (Browse Drills / Skill Plans / Roadmap)

**Files:**
- Modify: `index.html:107-201` (Drill Search & Filter panel, Drill Cards List, Skill-Focused Plans panel, Roadmap panel)
- Modify: `styles.css` (new rules, add after the existing `.practice-panel-body.collapsed` rule at `styles.css:315`)
- Modify: `practice.js` (new `bindPracticeTabs()` function near `bindCollapsibles()` at `practice.js:1878-1888`; call it in the init sequence at `practice.js:2014`)

**Interfaces:**
- Consumes: nothing new — all three panels' render functions (`renderDrillCards()`, `renderPlanGallery('all')`, `renderRoadmap()`) already exist and already run unconditionally at init; this task does not touch them.
- Produces: `.ptab-btn[data-ptab="drills"|"plans"|"roadmap"]` tab buttons; `.ptab-panel#psec-drills`, `#psec-plans`, `#psec-roadmap` content panes; `bindPracticeTabs()` function, called once from the main init sequence.

- [ ] **Step 1: Replace the three accordion panels with one tabbed card in `index.html`**

Replace the entire block from the `<!-- DRILL SEARCH & FILTER -->` comment through the closing `</div>` of the `<!-- SKILL-PROGRESSION ROADMAP -->` panel (currently `index.html:107-201`) with:

```html
        <!-- BUILD METHOD TABS: three alternative ways to build a plan -->
        <div class="practice-panel ptab-card">
          <div class="ptab-bar" role="tablist" aria-label="Build a plan">
            <button type="button" class="ptab-btn active" data-ptab="drills" role="tab" aria-selected="true" aria-controls="psec-drills" id="ptab-btn-drills">Browse Drills</button>
            <button type="button" class="ptab-btn" data-ptab="plans" role="tab" aria-selected="false" aria-controls="psec-plans" id="ptab-btn-plans" tabindex="-1">Skill Plans</button>
            <button type="button" class="ptab-btn" data-ptab="roadmap" role="tab" aria-selected="false" aria-controls="psec-roadmap" id="ptab-btn-roadmap" tabindex="-1">Roadmap</button>
          </div>

          <!-- BROWSE DRILLS -->
          <div class="ptab-panel active" id="psec-drills" role="tabpanel" aria-labelledby="ptab-btn-drills">
            <div class="pdrill-search-row">
              <div class="pdrill-search-wrap">
                <span class="pdrill-search-ico" aria-hidden="true">&#128269;</span>
                <input type="search" id="pdrill-search" placeholder="Search drills by name, skill, or tags…" aria-label="Search drills by name, skill, or tags" autocomplete="off">
              </div>
              <button type="button" class="btn-secondary pdrill-clear-btn" id="pdrill-search-clear" title="Clear search" aria-label="Clear search" style="display:none">&#10005;</button>
            </div>
            <!-- Skill category chips -->
            <div class="pchips" id="pskill-chips" role="group" aria-label="Filter by skill category">
              <button type="button" class="pchip active" data-skill="">All Skills</button>
              <button type="button" class="pchip" data-skill="hitting">Hitting</button>
              <button type="button" class="pchip" data-skill="throwing">Throwing</button>
              <button type="button" class="pchip" data-skill="infield">Infield</button>
              <button type="button" class="pchip" data-skill="outfield">Outfield</button>
              <button type="button" class="pchip" data-skill="catching">Catching</button>
              <button type="button" class="pchip" data-skill="pitching">Pitching</button>
              <button type="button" class="pchip" data-skill="baserunning">Baserunning</button>
              <button type="button" class="pchip" data-skill="bunting">Bunting</button>
              <button type="button" class="pchip" data-skill="situational">Situational</button>
              <button type="button" class="pchip" data-skill="conditioning">Conditioning</button>
            </div>
            <!-- Intensity chips -->
            <div class="pchips" id="pint-chips" role="group" aria-label="Filter by intensity">
              <button type="button" class="pchip active" data-intensity="">All Intensity</button>
              <button type="button" class="pchip pchip-low" data-intensity="low">Low</button>
              <button type="button" class="pchip pchip-med" data-intensity="medium">Medium</button>
              <button type="button" class="pchip pchip-high" data-intensity="high">High</button>
            </div>
            <!-- Age + Level filters -->
            <div class="pform-two-col" style="margin-top:0.5rem">
              <div class="pfield">
                <label for="pp-age-filter">Age Range</label>
                <select id="pp-age-filter">
                  <option value="">All ages</option>
                  <option value="5-8">5–8U (T-Ball)</option>
                  <option value="8-10">8–10U (Minor)</option>
                  <option value="10-12">10–12U (Major)</option>
                  <option value="12-14">12–14U (Intermediate)</option>
                  <option value="12-15">12–15U (Advanced)</option>
                </select>
              </div>
              <div class="pfield">
                <label for="pdrill-level-filter">Level</label>
                <select id="pdrill-level-filter">
                  <option value="">All levels</option>
                  <option value="introductory">Introductory</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div class="pfield" style="display:flex;align-items:flex-end;padding-bottom:0.1rem">
                <label style="display:flex;align-items:center;gap:0.4rem;font-weight:normal;font-size:var(--text-sm);cursor:pointer;text-transform:none">
                  <input type="checkbox" id="pp-show-all-ages" style="width:15px;height:15px">
                  Show all ages
                </label>
              </div>
            </div>
            <!-- Search status + results count -->
            <div id="pdrill-status" class="pdrill-status" aria-live="polite" aria-atomic="true"></div>
            <!-- Drill cards list: was a sibling of this panel before (always visible
                 regardless of accordion state); now lives inside the Browse Drills
                 tab panel so it hides/shows together with the search controls. -->
            <div class="pdrill-cards-scroll" id="pdrill-cards" role="list" aria-label="Drill results"></div>
          </div>

          <!-- SKILL PLANS -->
          <div class="ptab-panel" id="psec-plans" role="tabpanel" aria-labelledby="ptab-btn-plans">
            <div class="pplan-tabs" id="pplan-skill-tabs" role="tablist" aria-label="Filter plans by skill"></div>
            <div class="pplan-gallery" id="pplan-gallery" role="list"></div>
          </div>

          <!-- ROADMAP -->
          <div class="ptab-panel" id="psec-roadmap" role="tabpanel" aria-labelledby="ptab-btn-roadmap">
            <div id="proadmap-container"></div>
          </div>
        </div>
```

Note what changed structurally versus the original: the `pdrill-cards-scroll` div (previously a sibling of the search/filter `.practice-panel`, always rendered regardless of that panel's collapsed state) is now nested inside `#psec-drills`, so it is part of the Browse Drills tab and hides/shows with it. The three `.practice-panel-head` accordion headers (with their chevrons) are gone, replaced by the one `.ptab-bar`. The three `practice-panel-body` classes become `ptab-panel` (ids unchanged: `psec-drills`, `psec-plans`, `psec-roadmap`, since nothing outside this block references them).

- [ ] **Step 2: Add tab bar and tab panel CSS in `styles.css`**

Insert immediately after the existing line `.practice-panel-body.collapsed { display: none; }` (`styles.css:315`):

```css

/* ---- Build-method tabs (Browse Drills / Skill Plans / Roadmap) ---- */
.ptab-bar {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  background: #f6f3ec;
}
.ptab-btn {
  flex: 1 1 0;
  background: transparent;
  color: var(--color-muted);
  border: none;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  padding: 0.6rem 0.5rem;
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
  min-height: 40px;
}
.ptab-btn:hover { background: #e5e9f0; color: var(--color-primary-dark); }
.ptab-btn.active {
  color: var(--color-primary-dark);
  border-bottom-color: var(--color-primary);
  background: var(--color-surface);
}
.ptab-panel { display: none; padding: 0.75rem 0.9rem; }
.ptab-panel.active { display: block; }
```

This overrides the global `button` element rule (`styles.css:126-136`, which sets a solid navy background/border on every button) via class selector specificity — `.ptab-btn` (one class) beats bare `button` (one element) regardless of source order, so no `!important` is needed. The `.ptab-card` wrapper is just the existing `.practice-panel` class (already applied in the HTML above) — it already provides the border, rounded corners, and `overflow: hidden` that clips the flat-topped `.ptab-bar` to match the card's rounded top corners, so no new wrapper rule is needed.

- [ ] **Step 3: Add `bindPracticeTabs()` in `practice.js` and wire it into init**

Insert immediately after the closing `}` of `bindCollapsibles()` (`practice.js:1878-1888`):

```javascript

    // ── Build-method tabs (Browse Drills / Skill Plans / Roadmap) ──────────

    function bindPracticeTabs() {
      const tabs = document.querySelectorAll('.ptab-btn');
      tabs.forEach(function (btn) {
        btn.addEventListener('click', function () {
          const target = btn.getAttribute('data-ptab');
          tabs.forEach(function (b) {
            const isActive = b === btn;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            b.tabIndex = isActive ? 0 : -1;
          });
          document.querySelectorAll('.ptab-panel').forEach(function (panel) {
            panel.classList.toggle('active', panel.id === 'psec-' + target);
          });
        });
      });
    }
```

Then in the "Main init" sequence (`practice.js:2002-2024`), add a call to it right after the existing `bindCollapsibles();` line:

```javascript
    bindCollapsibles();
    bindPracticeTabs();
```

- [ ] **Step 4: Verify in the browser**

```bash
npm test
```
Expected: `31 passed, 0 failed` (this task touches no code the suite covers, so this is a pure regression check).

Then, using the Browser pane tools (`preview_start` with the `homerun-practice-app` launch config, `read_console_messages`, `read_page`, `computer` click/screenshot):

1. Load the app. Confirm no console errors.
2. Confirm exactly one panel is visible on load: the drill search box, filter chips, and drill cards under "Browse Drills" — "Skill Plans" and "Roadmap" content must not be visible.
3. Click the "Skill Plans" tab. Confirm its content (skill sub-tabs + plan gallery) becomes visible and "Browse Drills"/"Roadmap" content hides. Confirm the clicked tab visually shows as active (bottom border) and `aria-selected="true"`; verify with `read_page` that the other two tabs report `aria-selected="false"`.
4. Click "Roadmap". Confirm its content shows and the other two hide.
5. Type text into the drill search box while on "Browse Drills", switch to "Roadmap", switch back to "Browse Drills" — confirm the typed search text is still present and results still reflect it (proves panels are hidden via CSS, not destroyed/re-rendered).
6. Click back to "Browse Drills" and confirm the drill cards list renders inside the same panel as the search controls (scrolling the panel scrolls both together, since they're now one nested structure).

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css practice.js
git commit -m "Add build-method tabs (Browse Drills / Skill Plans / Roadmap)"
```

---

### Task 2: Session Configuration starts collapsed by default

**Files:**
- Modify: `index.html:44-48` (Session Configuration accordion head/body)

**Interfaces:**
- Consumes: existing `bindCollapsibles()` (`practice.js:1878-1888`) — unchanged, still toggles `.collapsed` on click for any `.practice-panel-head`/body pair found via `data-psection`.
- Produces: nothing new — this is an initial-state-only change.

- [ ] **Step 1: Add the `collapsed` class to Session Configuration's head and body**

In `index.html`, change:

```html
          <div class="practice-panel-head" data-psection="session">
            <span>Session Configuration</span>
            <span class="pchevron">&#9660;</span>
          </div>
          <div class="practice-panel-body" id="psec-session">
```

to:

```html
          <div class="practice-panel-head collapsed" data-psection="session">
            <span>Session Configuration</span>
            <span class="pchevron">&#9660;</span>
          </div>
          <div class="practice-panel-body collapsed" id="psec-session">
```

Both the head and body need the class: `.practice-panel-head.collapsed .pchevron` (`styles.css:313`) rotates the chevron to point right, and `.practice-panel-body.collapsed` (`styles.css:315`) is what actually hides the field inputs. `bindCollapsibles()`'s click handler already does `body.classList.toggle('collapsed')` and mirrors it onto the head, so this only sets the correct *initial* state to match — the toggle behavior itself needs no code change.

- [ ] **Step 2: Verify in the browser**

1. Load the app. Confirm Session Configuration renders collapsed (chevron pointing right, no team name/date/theme/etc. fields visible) while the Time Budget bar below it is fully visible as before.
2. Click the Session Configuration header. Confirm it expands and all fields (team name, date, theme, location, start time, duration, notes) are present and functional exactly as before.
3. Click it again. Confirm it re-collapses.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Session Configuration starts collapsed by default"
```

---

### Task 3: Relocate Plan Actions (Undo/Clear) to the right column

**Files:**
- Modify: `index.html` — the `<!-- PLAN ACTIONS -->` block (original lines 203-207; Task 1 shifts line numbers below its edit, so locate this by its HTML comment, not the line number)
- Modify: `index.html` — the `.practice-plan-hdr-actions` block (original lines 217-224; same caveat — locate by the `practice-plan-hdr-actions` class, not the line number)
- Modify: `styles.css` — the `.practice-plan-actions` / `.btn-sm` rule (original lines 653-660; Task 1's CSS insertion earlier in the file shifts this — locate by the `.practice-plan-actions` selector, not the line number) — remove the now-dead `.practice-plan-actions` rule, keep `.btn-sm`, add a dark-header-appropriate override so Clear Plan keeps a visually distinct destructive treatment

**Interfaces:**
- Consumes: existing `bindPracticeButtons()` (`practice.js:1977-1989`) — unchanged. It looks up `pp-btn-undo`/`pp-btn-clear` purely by `getElementById`, so relocating their markup requires zero JS changes; the ids are the only contract and they don't change.
- Produces: nothing new — DOM relocation plus one CSS override.

- [ ] **Step 1: Remove the Plan Actions block from the left column**

In `index.html`, delete this block entirely (it sits immediately before `</div><!-- /.practice-left -->`; find it by the `<!-- PLAN ACTIONS -->` comment — Task 1's edit above shifts its exact line number):

```html
        <!-- PLAN ACTIONS -->
        <div class="practice-plan-actions">
          <button type="button" class="btn-secondary" id="pp-btn-undo" disabled>&#8617; Undo Last</button>
          <button type="button" class="btn-secondary btn-danger" id="pp-btn-clear">Clear Plan</button>
        </div>
```

- [ ] **Step 2: Add Undo/Clear into the right column's plan header**

In `index.html`, change the `.practice-plan-hdr-actions` block (find it by that class name — Task 1's edit above shifts its exact line number from the original 217-224):

```html
              <div class="practice-plan-hdr-actions no-print">
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-save" title="Save plan to browser storage">Save</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-load" title="Load a saved plan">Load</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-export" title="Download all saved plans as a JSON file">Export</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-import" title="Import saved plans from a JSON file">Import</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-print" title="Print or save as PDF">Print / PDF</button>
                <input type="file" id="pp-file-import" accept="application/json,.json" hidden>
              </div>
```

to:

```html
              <div class="practice-plan-hdr-actions no-print">
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-undo" disabled>&#8617; Undo Last</button>
                <button type="button" class="btn-secondary btn-sm btn-danger" id="pp-btn-clear">Clear Plan</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-save" title="Save plan to browser storage">Save</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-load" title="Load a saved plan">Load</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-export" title="Download all saved plans as a JSON file">Export</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-import" title="Import saved plans from a JSON file">Import</button>
                <button type="button" class="btn-secondary btn-sm" id="pp-btn-print" title="Print or save as PDF">Print / PDF</button>
                <input type="file" id="pp-file-import" accept="application/json,.json" hidden>
              </div>
```

Undo/Clear now come first (editing actions), followed by the existing file actions (Save/Load/Export/Import/Print), matching a natural left-to-right "edit → file" reading order. Both buttons keep their original ids (`pp-btn-undo`, `pp-btn-clear`), disabled state, and icon/label text unchanged — only their DOM location and an added `btn-sm` class (to match the sizing of their new neighbors) change.

- [ ] **Step 3: Update `styles.css`**

Replace (find it by the `.practice-plan-actions` selector — Task 1's CSS insertion earlier in the file shifts its exact line number from the original 653-660):

```css
/* ---- Plan builder action buttons ---- */
.practice-plan-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}
.btn-sm { padding: 0.25rem 0.65rem; font-size: var(--text-sm); min-height: 30px; }
```

with:

```css
.btn-sm { padding: 0.25rem 0.65rem; font-size: var(--text-sm); min-height: 30px; }

/* Clear Plan keeps a distinct destructive look even inside the dark navy
   plan header, where .btn-danger's default white/red styling (meant for
   a light background) would otherwise be overridden by the more specific
   .practice-plan-hdr-actions button rule (equal specificity, later in
   source order, so it would win outright without this). */
.practice-plan-hdr-actions button.btn-danger {
  background: rgba(163, 48, 31, 0.35);
  border-color: #ffb3ab;
  color: #ffe1de;
}
.practice-plan-hdr-actions button.btn-danger:hover {
  background: rgba(163, 48, 31, 0.55);
}
```

The old `.practice-plan-actions` rule is deleted outright (nothing in the markup uses that class anymore after Step 1); `.btn-sm` is kept as-is since `pp-btn-save`/`pp-btn-load`/etc. still use it.

- [ ] **Step 4: Verify in the browser**

```bash
npm test
```
Expected: `31 passed, 0 failed`.

Then, using the Browser pane tools:

1. Load the app. Confirm the left column no longer has any button bar below the tabs.
2. Confirm the right column's plan header now shows, in order: Undo Last (disabled), Clear Plan, Save, Load, Export, Import, Print / PDF.
3. Zoom or screenshot the header and confirm Clear Plan is visually distinguishable (reddish tint) from the other buttons on the dark navy background — not just blending in as another neutral button.
4. Add a drill to the plan (from the Browse Drills tab). Confirm "Undo Last" becomes enabled. Click it — confirm the added drill is removed (existing `popUndo` behavior, unchanged).
5. Add a drill again, click "Clear Plan", confirm the existing clear-confirmation behavior and resulting empty-plan state are unchanged from before.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "Move Plan Actions (Undo/Clear) into the right column plan header"
```

---

### Task 4: Full manual regression pass

**Files:** none (verification only).

**Interfaces:** none — this task validates the combined output of Tasks 1-3 together.

- [ ] **Step 1: Run the automated suite one more time**

```bash
npm test
```
Expected: `31 passed, 0 failed`.

- [ ] **Step 2: Full desktop walkthrough in the browser**

Using the Browser pane tools, starting from a fresh page load:

1. Session Configuration is collapsed; expand it, fill in a team name, confirm it persists into the plan header/meta line as before.
2. Browse Drills tab is active by default. Search for a drill (e.g. "tee"), apply a skill filter chip, confirm results narrow correctly, click **+ Add** on a result, confirm it appears in the right-column plan.
3. Switch to Skill Plans tab, click a plan card, confirm it loads into the plan builder (existing behavior, `pplan-gallery` click handler unchanged).
4. Switch to Roadmap tab, click a populated stage card, confirm it loads into the plan builder too.
5. Switch back to Browse Drills — confirm the earlier search text and filter chip selection are still applied exactly as left.
6. Use Undo Last / Clear Plan from their new location in the right column header; confirm both behave exactly as before relocation.
7. Click Save, then Load, and confirm the saved-plans modal opens and lists the plan correctly (existing modal logic, untouched).
8. Click Print / PDF, confirm the print preview still renders the full plan correctly (print output is driven by `#practice-print-root`, entirely separate from the restructured left column — see spec).

- [ ] **Step 3: Mobile walkthrough**

Using `resize_window` to drop below the existing 960px breakpoint (e.g. to the `mobile` preset):

1. Confirm `.practice-layout` stacks to a single column as before.
2. Confirm the tab bar and active tab panel render full-width with no horizontal overflow.
3. Repeat a subset of Step 2 (switch tabs, add a drill, use Undo) to confirm nothing breaks at mobile width.

- [ ] **Step 4: Accessibility spot-check**

Using `read_page`:

1. Confirm the tab bar reports `role="tablist"` with an `aria-label`.
2. Confirm each tab button reports `role="tab"`, correct `aria-selected` (only the active one `true`), and `aria-controls` pointing at the matching panel id.
3. Confirm each panel reports `role="tabpanel"` and `aria-labelledby` pointing back at its tab button's id.

No commit for this task — it's verification-only. If anything fails, fix it as part of whichever of Tasks 1-3 owns the broken piece, and re-run this task's checklist from the top before proceeding.

---

### Task 5: Bump APP_VERSION and add a changelog entry

**Files:**
- Modify: `version.js` (`APP_VERSION`)
- Modify: `version.json` (`version`, `released`)
- Modify: `package.json` (`version`)
- Modify: `changelog.js` (new entry, newest first)
- Modify: `CHANGELOG.md` (matching hand-maintained mirror)

**Interfaces:**
- Consumes: nothing from Tasks 1-4.
- Produces: `APP_VERSION` bumped to `1.2` everywhere it's recorded, verified consistent by the existing test suite's "app version constants" section (`tests/versionCompat.test.js:242-298`).

Per `docs/VERSIONING.md`, this whole feature is a UI/UX change and must bump `APP_VERSION` — unlike the internal-refactor PR that legitimately used a `Version-bump-exempt` trailer, this one is squarely what that policy exists for.

- [ ] **Step 1: Bump `version.js`**

In `version.js`, change:
```javascript
  var APP_VERSION = '1.1';
```
to:
```javascript
  var APP_VERSION = '1.2';
```

- [ ] **Step 2: Bump `version.json`**

Replace the file's contents with (using today's actual date at execution time in place of the date below):
```json
{
  "version": "1.2",
  "released": "YYYY-MM-DD"
}
```

- [ ] **Step 3: Bump `package.json`**

In `package.json`, change:
```json
  "version": "1.1.0",
```
to:
```json
  "version": "1.2.0",
```

- [ ] **Step 4: Add the changelog entry in `changelog.js`**

In `changelog.js`, insert a new entry at the top of the returned array (immediately after `return [` and before the existing `1.1` entry):

```javascript
    {
      version: '1.2',
      date: 'YYYY-MM-DD',
      type: 'minor',
      title: 'Drill library navigation redesign',
      highlights: [
        'Browse Drills, Skill Plans, and Roadmap are now tabs instead of stacked sections — no more scrolling past the entire drill library to find a pre-built plan or the skill roadmap.',
        'Session Configuration now starts collapsed to get out of the way once you\'ve filled it in.',
        'Undo Last and Clear Plan moved next to Save/Load/Export/Import/Print, where the rest of the plan controls live.'
      ]
    },
```

(Use the same real date as `version.json`'s `released` field.)

- [ ] **Step 5: Mirror the entry in `CHANGELOG.md`**

Insert immediately above the existing `## v1.1 —` line:

```markdown
## v1.2 — YYYY-MM-DD (minor) — Drill library navigation redesign

- Browse Drills, Skill Plans, and Roadmap are now tabs instead of stacked sections — no more scrolling past the entire drill library to find a pre-built plan or the skill roadmap.
- Session Configuration now starts collapsed to get out of the way once you've filled it in.
- Undo Last and Clear Plan moved next to Save/Load/Export/Import/Print, where the rest of the plan controls live.

```

(Same real date as above.)

- [ ] **Step 6: Verify**

```bash
npm test
```
Expected: `31 passed, 0 failed`, specifically including the "app version constants" tests (`version.js APP_VERSION is a major.minor string`, `package.json version matches APP_VERSION`, `version.json version matches APP_VERSION`, `changelog.js newest entry is the current release`, `changelog.js entries are well-formed and ordered newest-first`) — these fail loudly if any of the four files above drift from each other.

Then in the browser: reload the app, confirm the footer's version label reads `1.2`, and confirm the "What's New in v1.2" modal (or `changelog.html`) shows the three highlights above.

- [ ] **Step 7: Commit**

```bash
git add version.js version.json package.json changelog.js CHANGELOG.md
git commit -m "Bump to v1.2: Practice Planner left-nav tabs"
```
