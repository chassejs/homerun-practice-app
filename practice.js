/* ===================================================================
   Homerun Practice — practice.js
   Practice Planner: drill library, search/filter, plan builder,
   skill-focused plans, save/load, export/import, print. No network calls.
   Drill data loaded from src/drills-data.js (window.DRILLS_DATA).
   =================================================================== */

(function () {
  'use strict';

  // ── Guard: wait for DOM and drill data ──────────────────────────────────
  // Only auto-run in a real browser; under Node (tests) `document` is
  // undefined and we want require()'ing this file (for normalizePracticePlan)
  // to be side-effect-free.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPractice);
    } else {
      initPractice();
    }
  }

  // Backward-compatible normalizer: any saved plan object (old or new
  // shape) is passed through here before being loaded into in-memory state.
  // Plans saved before Stations mode existed have no `mode` field and must
  // default to 'sequential' with their `items` array untouched — this
  // function never mutates the input.
  //
  // Lives at the outer IIFE scope (rather than inside initPractice()'s
  // closure) so it is a pure function of its arguments and can be exported
  // for the Node test suite to exercise directly, instead of the test file
  // maintaining a hand-copied duplicate that could drift from the real
  // logic. `defaultMeta` lets callers inject the live planMeta defaults;
  // it's optional so the function also works standalone (e.g. in tests).
  function normalizePracticePlan(plan, defaultMeta) {
    const p = plan && typeof plan === 'object' ? plan : {};
    const baseMeta = defaultMeta || {};
    // Fallback id generator for stations missing an id — does not need to
    // coordinate with the live stationIdCounter since ids only need to be
    // unique within the returned plan, not across the whole app session.
    let fallbackIdCounter = 0;
    function fallbackStationId() {
      fallbackIdCounter += 1;
      return 'station-' + Date.now().toString(36) + '-' + fallbackIdCounter;
    }
    if (p.mode === 'stations' && Array.isArray(p.stations)) {
      return {
        meta: Object.assign({}, baseMeta, p.meta || {}),
        mode: 'stations',
        stations: p.stations.map(function (s) {
          return {
            id: s.id || fallbackStationId(),
            minutes: typeof s.minutes === 'number' ? s.minutes : 15,
            drillIds: Array.isArray(s.drillIds) ? s.drillIds.slice() : []
          };
        }),
        items: Array.isArray(p.items) ? p.items : [], // preserved even if unused, in case the user toggles back
        savedAt: p.savedAt || null
      };
    }
    // Legacy / sequential — leave `items` exactly as saved.
    return {
      meta: Object.assign({}, baseMeta, p.meta || {}),
      mode: 'sequential',
      items: Array.isArray(p.items) ? p.items : [],
      stations: Array.isArray(p.stations) ? p.stations : [],
      savedAt: p.savedAt || null
    };
  }

  // Export for the Node test suite so tests exercise the real function
  // instead of a hand-maintained copy (guarded so <script> loading in the
  // browser, where `module` is undefined, is unaffected).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports.normalizePracticePlan = normalizePracticePlan;
  }

  function initPractice() {
    // Drill data injected by src/drills-data.js as window.DRILLS_DATA
    if (!window.DRILLS_DATA || !Array.isArray(window.DRILLS_DATA.drills)) {
      console.error('Practice: DRILLS_DATA not loaded — run npm run sync:drills');
      return;
    }

    const ALL_DRILLS = window.DRILLS_DATA.drills;
    const ALL_PLANS  = window.DRILLS_DATA.plans || [];

    // Index plans by id for quick lookup
    const PLAN_INDEX = {};
    ALL_PLANS.forEach(function (p) { PLAN_INDEX[p.id] = p; });

    // Index drills by id for quick lookup
    const DRILL_INDEX = {};
    ALL_DRILLS.forEach(function (d) { DRILL_INDEX[d.id] = d; });

    // ── Constants ──────────────────────────────────────────────────────────
    const SKILL_ORDER = [
      'full-practice', 'hitting', 'throwing', 'infield', 'outfield', 'catching',
      'pitching', 'baserunning', 'bunting', 'situational', 'conditioning'
    ];

    const STORAGE_KEY_PLAN  = 'homerun-practice/plan/v1';
    const STORAGE_KEY_PLANS = 'homerun-practice/savedplans/v1';

    // ── State ──────────────────────────────────────────────────────────────
    let filterSkill     = '';    // '' = all
    let filterIntensity = '';    // '' = all
    let filterAge       = '';    // '' = all
    let filterLevel     = '';    // '' = all
    let showAllAges     = false;
    let searchQuery     = '';

    const STAGE_LABELS = {
      introductory: 'Introductory',
      beginner:     'Beginner',
      intermediate: 'Intermediate',
      advanced:     'Advanced'
    };

    // Practice plan: array of { drillId, durationMinutes (user-editable) }
    let planItems  = [];
    let planMeta   = { team: '', date: '', theme: '', location: '', start: '16:00', duration: 90, notes: '' };
    let undoStack  = [];   // each entry is a deep-copy of planItems before a change

    // ── Stations mode state ───────────────────────────────────────────────
    // mode: 'sequential' (legacy/default, per-drill time) or 'stations'
    // (per-station time; drills inside a station carry no individual time).
    // stations: [{ id, minutes, drillIds: [drillId, ...] }]
    let planMode = 'sequential';
    let stations = [];
    let stationIdCounter = 0;
    // Tracks which station the user most recently interacted with, so the
    // drill-library "+" button targets that station instead of always
    // Station 1. Kept clamped to a valid index whenever stations change.
    let activeStationIndex = 0;

    function newStationId() {
      stationIdCounter += 1;
      return 'station-' + stationIdCounter;
    }

    function makeDefaultStations(count) {
      const arr = [];
      for (let i = 0; i < count; i++) arr.push({ id: newStationId(), minutes: 15, drillIds: [] });
      return arr;
    }

    function getStationTotalDuration() {
      return stations.reduce(function (s, st) { return s + (st.minutes || 0); }, 0);
    }

    function allStationDrillIds() {
      const set = new Set();
      stations.forEach(function (st) { st.drillIds.forEach(function (id) { set.add(id); }); });
      return set;
    }

    // ── Data-access helpers ────────────────────────────────────────────────

    function getDrillById(id) {
      return DRILL_INDEX[id] || null;
    }

    function filterDrills() {
      const q = searchQuery.toLowerCase().trim();
      return ALL_DRILLS.filter(function (d) {
        // Skill filter
        if (filterSkill && d.category !== filterSkill) return false;
        // Intensity filter
        if (filterIntensity && d.intensity !== filterIntensity) return false;
        // Level / stage filter
        if (filterLevel && d.stage !== filterLevel) return false;
        // Age filter
        if (!showAllAges && filterAge) {
          const parts = filterAge.split('-');
          const lo = parseInt(parts[0], 10);
          const hi = parseInt(parts[1], 10) || 99;
          // Drill must overlap the selected age band
          if (d.ageMax < lo || d.ageMin > hi) return false;
        }
        // Text search across all meaningful drill content. Many KB drills are
        // in the "concept" format (no `summary` frontmatter → empty purpose),
        // so setup / coaching cues / common faults are included here to keep
        // their rich content searchable.
        if (q) {
          const hay = [
            d.title, d.category, d.purpose || '', d.skill || '',
            (d.tags || []).join(' '), (d.equipment || []).join(' '),
            d.setup || '', d.coachingCues || '', (d.commonFaults || []).join(' '),
            d.progressionNotes || '', d.ageNotes || ''
          ].join(' ').toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });
    }

    function getTotalDuration() {
      if (planMode === 'stations') return getStationTotalDuration();
      return planItems.reduce(function (s, item) { return s + (item.durationMinutes || 0); }, 0);
    }

    function planDrillIds() {
      if (planMode === 'stations') return allStationDrillIds();
      return new Set(planItems.map(function (item) { return item.drillId; }));
    }

    // ── Undo helpers ───────────────────────────────────────────────────────

    function pushUndo() {
      undoStack.push(JSON.parse(JSON.stringify(planItems)));
      if (undoStack.length > 20) undoStack.shift();
      updateUndoBtn();
    }

    function popUndo() {
      if (!undoStack.length) return;
      planItems = undoStack.pop();
      updateUndoBtn();
      renderPlanItems();
      updateBudget();
    }

    function updateUndoBtn() {
      const btn = document.getElementById('pp-btn-undo');
      if (btn) btn.disabled = undoStack.length === 0;
    }

    // ── Rendering: drill cards ─────────────────────────────────────────────

    function renderDrillCards() {
      const container = document.getElementById('pdrill-cards');
      const statusEl  = document.getElementById('pdrill-status');
      if (!container) return;

      const filtered = filterDrills();
      const inPlan   = planDrillIds();

      container.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'pdrill-empty';
        empty.textContent = 'No drills match your filters. Try clearing the search or choosing different categories.';
        container.appendChild(empty);
        if (statusEl) statusEl.textContent = 'No results.';
        return;
      }

      if (statusEl) {
        statusEl.textContent = filtered.length + ' drill' + (filtered.length !== 1 ? 's' : '') +
          ' of ' + ALL_DRILLS.length;
      }

      const frag = document.createDocumentFragment();
      filtered.forEach(function (drill) {
        const card = buildDrillCard(drill, inPlan.has(drill.id));
        frag.appendChild(card);
      });
      container.appendChild(frag);
    }

    function buildDrillCard(drill, isInPlan) {
      const card = document.createElement('div');
      card.className = 'pdrill-card' + (isInPlan ? ' in-plan' : '');
      card.setAttribute('role', 'listitem');
      card.setAttribute('data-drill-id', drill.id);
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', drill.title + ' — click to view detail');
      card.setAttribute('title', 'Click to view drill details');

      // Text area
      const text = document.createElement('div');
      text.className = 'pdrill-card-text';

      const name = document.createElement('div');
      name.className = 'pdrill-card-name';
      name.textContent = drill.title;
      text.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'pdrill-card-meta';
      meta.textContent = drill.durationMinutes + ' min · ' + drill.ageMin + '–' + drill.ageMax + 'U';
      text.appendChild(meta);

      const badges = document.createElement('div');
      badges.className = 'pdrill-card-badges';
      badges.appendChild(makeBadge('pbadge-skill', drill.category));
      badges.appendChild(makeBadge('pbadge-' + intensityClass(drill.intensity), drill.intensity));
      if (drill.stage) {
        badges.appendChild(makeBadge('pbadge-stage-' + drill.stage, STAGE_LABELS[drill.stage] || drill.stage));
      }
      text.appendChild(badges);

      card.appendChild(text);

      // Add button
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'pdrill-add-btn';
      addBtn.setAttribute('aria-label', (isInPlan ? 'Remove ' : 'Add ') + drill.title + ' to plan');
      addBtn.innerHTML = isInPlan ? '&#10003;' : '+';
      addBtn.addEventListener('click', function (e) {
        e.stopPropagation(); // don't open detail modal
        toggleDrillInPlan(drill.id);
      });
      card.appendChild(addBtn);

      // Click body = open detail
      card.addEventListener('click', function () { openDrillDetail(drill.id); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrillDetail(drill.id); }
      });

      return card;
    }

    function makeBadge(cls, text) {
      const b = document.createElement('span');
      b.className = 'pbadge ' + cls;
      b.textContent = text;
      return b;
    }

    function intensityClass(intensity) {
      if (intensity === 'low') return 'low';
      if (intensity === 'medium' || intensity === 'med') return 'med';
      if (intensity === 'high') return 'high';
      return 'low';
    }

    // ── Drill detail modal ─────────────────────────────────────────────────

    // Track the element focused before the modal opened so focus can be
    // restored on close (accessibility).
    let detailPrevFocus = null;

    function openDrillDetail(drillId) {
      const drill = getDrillById(drillId);
      if (!drill) return;

      const overlay = document.getElementById('drill-detail-overlay');
      const box     = document.getElementById('drill-detail-box');
      if (!overlay || !box) return;

      detailPrevFocus = document.activeElement;
      box.innerHTML = '';

      // Header
      const header = document.createElement('div');
      header.className = 'drill-detail-header';

      const titleGroup = document.createElement('div');
      const titleEl = document.createElement('h2');
      titleEl.id = 'drill-detail-title';
      titleEl.className = 'drill-detail-title';
      titleEl.textContent = drill.title;
      titleGroup.appendChild(titleEl);

      const bdgs = document.createElement('div');
      bdgs.className = 'drill-detail-badges';
      bdgs.appendChild(makeBadge('pbadge-skill', drill.category));
      bdgs.appendChild(makeBadge('pbadge-' + intensityClass(drill.intensity), drill.intensity + ' intensity'));
      if (drill.stage) {
        bdgs.appendChild(makeBadge('pbadge-stage-' + drill.stage, STAGE_LABELS[drill.stage] || drill.stage));
      }
      bdgs.appendChild(makeBadge('pbadge-low', drill.ageMin + '–' + drill.ageMax + 'U'));
      bdgs.appendChild(makeBadge('pbadge-med', drill.durationMinutes + ' min'));
      titleGroup.appendChild(bdgs);
      header.appendChild(titleGroup);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'drill-detail-close';
      closeBtn.setAttribute('aria-label', 'Close drill detail');
      closeBtn.innerHTML = '&#10005;';
      closeBtn.addEventListener('click', closeDrillDetail);
      header.appendChild(closeBtn);
      box.appendChild(header);

      // Purpose
      if (drill.purpose) {
        box.appendChild(detailSection('Purpose', drill.purpose));
      }

      // Setup / briefing
      if (drill.setup) {
        box.appendChild(detailSection('Setup', drill.setup));
      }

      // Coaching cues
      if (drill.coachingCues) {
        const sec = document.createElement('div');
        sec.className = 'drill-detail-section';
        const t = document.createElement('div');
        t.className = 'drill-detail-section-title';
        t.textContent = 'Coaching Cues';
        const cue = document.createElement('p');
        cue.className = 'drill-detail-cue';
        cue.textContent = '“' + drill.coachingCues + '”';
        sec.appendChild(t);
        sec.appendChild(cue);
        box.appendChild(sec);
      }

      // Execution steps
      if (drill.executionSteps && drill.executionSteps.length) {
        const sec = document.createElement('div');
        sec.className = 'drill-detail-section';
        const t = document.createElement('div');
        t.className = 'drill-detail-section-title';
        t.textContent = 'Execution Steps';
        const ol = document.createElement('ol');
        drill.executionSteps.forEach(function (step) {
          const li = document.createElement('li');
          li.textContent = step;
          ol.appendChild(li);
        });
        sec.appendChild(t);
        sec.appendChild(ol);
        box.appendChild(sec);
      }

      // Common faults
      if (drill.commonFaults && drill.commonFaults.length) {
        const sec = document.createElement('div');
        sec.className = 'drill-detail-section';
        const t = document.createElement('div');
        t.className = 'drill-detail-section-title';
        t.textContent = 'Common Faults';
        const ul = document.createElement('ul');
        drill.commonFaults.forEach(function (fault) {
          const li = document.createElement('li');
          li.textContent = fault;
          ul.appendChild(li);
        });
        sec.appendChild(t);
        sec.appendChild(ul);
        box.appendChild(sec);
      }

      // Equipment
      if (drill.equipment && drill.equipment.length) {
        const sec = document.createElement('div');
        sec.className = 'drill-detail-section';
        const t = document.createElement('div');
        t.className = 'drill-detail-section-title';
        t.textContent = 'Equipment';
        const eq = document.createElement('div');
        eq.className = 'drill-detail-equipment';
        drill.equipment.forEach(function (item) {
          const span = document.createElement('span');
          span.className = 'drill-detail-equip-item';
          span.textContent = item;
          eq.appendChild(span);
        });
        sec.appendChild(t);
        sec.appendChild(eq);
        box.appendChild(sec);
      }

      // Tags
      if (drill.tags && drill.tags.length) {
        const sec = document.createElement('div');
        sec.className = 'drill-detail-section';
        const t = document.createElement('div');
        t.className = 'drill-detail-section-title';
        t.textContent = 'Tags';
        const eq = document.createElement('div');
        eq.className = 'drill-detail-equipment';
        drill.tags.forEach(function (tag) {
          const span = document.createElement('span');
          span.className = 'drill-detail-equip-item';
          span.textContent = tag;
          eq.appendChild(span);
        });
        sec.appendChild(t);
        sec.appendChild(eq);
        box.appendChild(sec);
      }

      // How to progress
      if (drill.progressionNotes) {
        box.appendChild(detailSection('How to progress', drill.progressionNotes));
      }

      // Prerequisites (clickable chips that open that drill's detail)
      const prereqs = drill.prerequisites || [];
      if (prereqs.length) {
        const chips = [];
        prereqs.forEach(function (slug) {
          const pre = getDrillById(slug);
          if (pre) chips.push(pre);
        });
        if (chips.length) {
          const sec = document.createElement('div');
          sec.className = 'drill-detail-section';
          const t = document.createElement('div');
          t.className = 'drill-detail-section-title';
          t.textContent = 'Prerequisites';
          const row = document.createElement('div');
          row.className = 'drill-detail-equipment';
          chips.forEach(function (pre) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'drill-detail-prereq-chip';
            chip.textContent = pre.title;
            chip.setAttribute('aria-label', 'Open drill: ' + pre.title);
            chip.addEventListener('click', function () { openDrillDetail(pre.id); });
            row.appendChild(chip);
          });
          sec.appendChild(t);
          sec.appendChild(row);
          box.appendChild(sec);
        }
      }

      // Footer: source + add-to-plan button
      const footer = document.createElement('div');
      footer.className = 'drill-detail-footer';

      const sourceNote = document.createElement('span');
      sourceNote.style.cssText = 'font-size:var(--text-xs);color:var(--color-muted);flex:1';
      sourceNote.textContent = 'Source: ' + drill.source;
      footer.appendChild(sourceNote);

      const inPlan = planDrillIds().has(drill.id);
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = inPlan ? 'btn-secondary' : '';
      addBtn.textContent = inPlan ? 'Remove from Plan' : '+ Add to Plan';
      addBtn.addEventListener('click', function () {
        toggleDrillInPlan(drill.id);
        closeDrillDetail();
      });
      footer.appendChild(addBtn);

      const closeBtn2 = document.createElement('button');
      closeBtn2.type = 'button';
      closeBtn2.className = 'btn-secondary';
      closeBtn2.textContent = 'Close';
      closeBtn2.addEventListener('click', closeDrillDetail);
      footer.appendChild(closeBtn2);

      box.appendChild(footer);

      overlay.classList.remove('hidden');
      closeBtn.focus();

      // Trap focus inside modal
      overlay.addEventListener('keydown', trapDetailFocus);
    }

    function detailSection(title, content) {
      const sec = document.createElement('div');
      sec.className = 'drill-detail-section';
      const t = document.createElement('div');
      t.className = 'drill-detail-section-title';
      t.textContent = title;
      const p = document.createElement('p');
      p.textContent = content;
      sec.appendChild(t);
      sec.appendChild(p);
      return sec;
    }

    function closeDrillDetail() {
      const overlay = document.getElementById('drill-detail-overlay');
      if (overlay) {
        overlay.classList.add('hidden');
        overlay.removeEventListener('keydown', trapDetailFocus);
      }
      // Restore focus to the element (drill card) that opened the modal.
      if (detailPrevFocus && typeof detailPrevFocus.focus === 'function') {
        try { detailPrevFocus.focus(); } catch (e) { /* element may be gone */ }
      }
      detailPrevFocus = null;
    }

    function trapDetailFocus(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDrillDetail();
        return;
      }
      // Simple focus trap: keep Tab focus within the modal box.
      if (e.key !== 'Tab') return;
      const box = document.getElementById('drill-detail-box');
      if (!box) return;
      const focusable = box.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }

    // ── Plan management ────────────────────────────────────────────────────

    function toggleDrillInPlan(drillId) {
      if (planMode === 'stations') {
        toggleDrillInStations(drillId);
        return;
      }
      pushUndo();
      const idx = planItems.findIndex(function (item) { return item.drillId === drillId; });
      if (idx !== -1) {
        planItems.splice(idx, 1);
        showToast('Drill removed from plan');
      } else {
        const drill = getDrillById(drillId);
        if (!drill) return;
        planItems.push({ drillId: drillId, durationMinutes: drill.durationMinutes });
        showToast(drill.title + ' added to plan');
      }
      renderDrillCards();
      renderPlanItems();
      updateBudget();
    }

    // In Stations mode, the drill-library "+" button toggles the drill's
    // membership in the user's most-recently-interacted-with station
    // (activeStationIndex) — NOT a search/remove across every station, since
    // a drill is now allowed to appear in multiple stations at once.
    // Fine-grained per-station assignment is also available via each
    // station's own drill picker in the Stations panel.
    function toggleDrillInStations(drillId) {
      if (!stations.length) return;
      pushUndo();
      const target = stations[activeStationIndex];
      const idx = target.drillIds.indexOf(drillId);
      if (idx !== -1) {
        target.drillIds.splice(idx, 1);
        showToast('Drill removed from ' + stationLabel(activeStationIndex));
      } else {
        const drill = getDrillById(drillId);
        if (!drill) return;
        target.drillIds.push(drillId);
        showToast(drill.title + ' added to ' + stationLabel(activeStationIndex));
      }
      renderDrillCards();
      renderStations();
      updateBudget();
    }

    function stationLabel(idx) { return 'Station ' + (idx + 1); }

    function loadPlanFromTemplate(plan) {
      if (!plan || !Array.isArray(plan.drills)) return;
      pushUndo();
      if (plan.totalMin) {
        planMeta.duration = plan.totalMin;
        syncMetaInputs();
      }
      planItems = plan.drills
        .map(function (slug) {
          const drill = getDrillById(slug);
          return drill ? { drillId: slug, durationMinutes: drill.durationMinutes } : null;
        })
        .filter(Boolean);
      renderDrillCards();
      renderPlanItems();
      updateBudget();
      showToast('“' + plan.label + '” loaded (' + planItems.length + ' drills)');
    }

    function movePlanItem(idx, dir) {
      const target = idx + dir;
      if (target < 0 || target >= planItems.length) return;
      pushUndo();
      const tmp = planItems[idx];
      planItems[idx] = planItems[target];
      planItems[target] = tmp;
      renderPlanItems();
    }

    function removePlanItem(idx) {
      pushUndo();
      planItems.splice(idx, 1);
      renderDrillCards();
      renderPlanItems();
      updateBudget();
    }

    function clearPlan() {
      if (!planHasContent()) return;
      if (!confirm('Clear the entire practice plan? This cannot be undone.')) return;
      undoStack = [];
      planItems = [];
      stations.forEach(function (st) { st.drillIds = []; });
      updateUndoBtn();
      renderDrillCards();
      renderModeUI();
      updateBudget();
      showToast('Plan cleared');
    }

    // ── Rendering: plan items ──────────────────────────────────────────────

    function renderPlanItems() {
      const container = document.getElementById('practice-plan-items');
      if (!container) return;

      container.innerHTML = '';

      if (!planItems.length) {
        const empty = document.createElement('div');
        empty.className = 'ppempty';
        empty.id = 'ppempty';
        empty.innerHTML = '<p>No drills added yet.</p>' +
          '<p class="hint">Search the Drill Library on the left and click <strong>+ Add</strong> to build your plan.</p>';
        container.appendChild(empty);
        updateFooter(0, 0);
        return;
      }

      const frag = document.createDocumentFragment();
      planItems.forEach(function (item, idx) {
        const drill = getDrillById(item.drillId);
        if (!drill) return;

        const row = document.createElement('div');
        row.className = 'pplan-item';
        row.setAttribute('role', 'listitem');

        // Drag handle visual (no-op — arrows used for reordering)
        const numLabel = document.createElement('span');
        numLabel.style.cssText = 'font-size:var(--text-xs);color:var(--color-muted);min-width:1.4rem;text-align:right;flex-shrink:0';
        numLabel.textContent = (idx + 1) + '.';
        row.appendChild(numLabel);

        // Body
        const body = document.createElement('div');
        body.className = 'pplan-item-body';

        const name = document.createElement('div');
        name.className = 'pplan-item-name';
        name.textContent = drill.title;
        body.appendChild(name);

        const meta = document.createElement('div');
        meta.className = 'pplan-item-meta';
        meta.textContent = drill.category + ' · ' + drill.intensity + ' intensity';
        body.appendChild(meta);

        row.appendChild(body);

        // Controls: duration input + move + remove
        const controls = document.createElement('div');
        controls.className = 'pplan-item-controls';

        // Editable duration
        const durInput = document.createElement('input');
        durInput.type = 'number';
        durInput.className = 'pplan-item-dur';
        durInput.min = '1';
        durInput.max = '120';
        durInput.value = String(item.durationMinutes);
        durInput.setAttribute('aria-label', 'Duration for ' + drill.title + ' in minutes');
        durInput.addEventListener('change', function () {
          const val = parseInt(durInput.value, 10);
          if (!isNaN(val) && val > 0) {
            planItems[idx].durationMinutes = val;
            updateBudget();
            updateFooter(getTotalDuration(), planItems.length);
          } else {
            // Reject invalid input: restore the last good value.
            durInput.value = String(planItems[idx].durationMinutes);
          }
        });
        controls.appendChild(durInput);

        const durLbl = document.createElement('span');
        durLbl.className = 'pplan-item-dur-lbl';
        durLbl.textContent = 'min';
        controls.appendChild(durLbl);

        // Move up
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'pplan-item-move-btn';
        upBtn.innerHTML = '&#8593;';
        upBtn.setAttribute('aria-label', 'Move ' + drill.title + ' up');
        upBtn.disabled = idx === 0;
        upBtn.addEventListener('click', function () { movePlanItem(idx, -1); });
        controls.appendChild(upBtn);

        // Move down
        const dnBtn = document.createElement('button');
        dnBtn.type = 'button';
        dnBtn.className = 'pplan-item-move-btn';
        dnBtn.innerHTML = '&#8595;';
        dnBtn.setAttribute('aria-label', 'Move ' + drill.title + ' down');
        dnBtn.disabled = idx === planItems.length - 1;
        dnBtn.addEventListener('click', function () { movePlanItem(idx, 1); });
        controls.appendChild(dnBtn);

        // Remove
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'pplan-item-remove-btn';
        removeBtn.innerHTML = '&#10005;';
        removeBtn.setAttribute('aria-label', 'Remove ' + drill.title + ' from plan');
        removeBtn.addEventListener('click', function () { removePlanItem(idx); });
        controls.appendChild(removeBtn);

        row.appendChild(controls);
        frag.appendChild(row);
      });
      container.appendChild(frag);

      const total = getTotalDuration();
      updateFooter(total, planItems.length);
    }

    function updateFooter(total, count) {
      const totalEl = document.getElementById('ppfooter-total');
      const countEl = document.getElementById('ppfooter-count');
      if (totalEl) totalEl.textContent = total + ' min';
      if (countEl) countEl.textContent = count + ' drill' + (count !== 1 ? 's' : '');
    }

    // ── Mode toggle (Sequential vs Stations) ────────────────────────────────

    function setPlanMode(mode, opts) {
      const silent = opts && opts.silent;
      if (mode === planMode) return;
      // When switching INTO stations mode with existing sequential drills,
      // move them into Station 1 so the user doesn't lose work — this is the
      // "preserve already-entered drills" behavior called for by the plan.
      if (mode === 'stations') {
        if (!stations.length) stations = makeDefaultStations(Number(document.getElementById('pp-station-count') ? document.getElementById('pp-station-count').value : 2) || 2);
        if (planItems.length && !silent) {
          stations[0].drillIds = stations[0].drillIds.concat(planItems.map(function (it) { return it.drillId; }));
          showToast('Existing drills moved into Station 1');
        }
      } else if (mode === 'sequential') {
        // Switching back: if sequential list is empty but stations hold
        // drills, pull them into a single ordered list so nothing is lost.
        if (!planItems.length && stations.length) {
          const ids = [];
          stations.forEach(function (st) { st.drillIds.forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); }); });
          planItems = ids.map(function (id) {
            const d = getDrillById(id);
            return d ? { drillId: id, durationMinutes: d.durationMinutes } : null;
          }).filter(Boolean);
        }
      }
      planMode = mode;
      renderModeUI();
      renderDrillCards();
      updateBudget();
    }

    function renderModeUI() {
      const wrap = document.getElementById('pstations-wrap');
      const seqList = document.getElementById('practice-plan-items');
      const seqRadio = document.getElementById('pp-mode-sequential');
      const stRadio  = document.getElementById('pp-mode-stations');
      if (wrap) wrap.classList.toggle('hidden', planMode !== 'stations');
      if (seqList) seqList.classList.toggle('hidden', planMode === 'stations');
      if (seqRadio) seqRadio.checked = planMode === 'sequential';
      if (stRadio)  stRadio.checked  = planMode === 'stations';
      if (planMode === 'stations') {
        renderStations();
      } else {
        renderPlanItems();
      }
    }

    function bindModeToggle() {
      const seqRadio = document.getElementById('pp-mode-sequential');
      const stRadio  = document.getElementById('pp-mode-stations');
      if (seqRadio) seqRadio.addEventListener('change', function () { if (seqRadio.checked) setPlanMode('sequential'); });
      if (stRadio)  stRadio.addEventListener('change', function () { if (stRadio.checked) setPlanMode('stations'); });
    }

    // ── Stations UI ──────────────────────────────────────────────────────────

    function setStationCount(count) {
      count = Math.max(1, Math.min(10, count || 1));
      if (count > stations.length) {
        while (stations.length < count) stations.push({ id: newStationId(), minutes: 15, drillIds: [] });
      } else if (count < stations.length) {
        // Trim from the end; warn if the removed stations had drills.
        const removed = stations.slice(count);
        const hadDrills = removed.some(function (st) { return st.drillIds.length > 0; });
        if (hadDrills && !confirm('Reducing the station count will remove ' + removed.length + ' station(s) and their assigned drills. Continue?')) {
          const countInput = document.getElementById('pp-station-count');
          if (countInput) countInput.value = String(stations.length);
          return;
        }
        stations = stations.slice(0, count);
      }
      // Clamp the active-station pointer so it stays valid after add/remove.
      if (activeStationIndex >= stations.length) activeStationIndex = Math.max(0, stations.length - 1);
      renderStations();
      updateBudget();
    }

    function bindStationCount() {
      const input = document.getElementById('pp-station-count');
      if (!input) return;
      input.addEventListener('change', function () {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1) { input.value = String(stations.length || 1); return; }
        setStationCount(val);
      });
    }

    function moveStation(idx, dir) {
      const target = idx + dir;
      if (target < 0 || target >= stations.length) return;
      const tmp = stations[idx];
      stations[idx] = stations[target];
      stations[target] = tmp;
      renderStations();
    }

    function removeStation(idx) {
      if (stations.length <= 1) { showToast('A plan needs at least one station'); return; }
      stations.splice(idx, 1);
      // Clamp the active-station pointer so it stays valid after removal.
      if (activeStationIndex >= stations.length) activeStationIndex = Math.max(0, stations.length - 1);
      const countInput = document.getElementById('pp-station-count');
      if (countInput) countInput.value = String(stations.length);
      renderStations();
      updateBudget();
    }

    function removeDrillFromStation(stIdx, drillIdx) {
      stations[stIdx].drillIds.splice(drillIdx, 1);
      renderStations();
      renderDrillCards();
      updateBudget();
    }

    function moveDrillWithinStation(stIdx, drillIdx, dir) {
      const list = stations[stIdx].drillIds;
      const target = drillIdx + dir;
      if (target < 0 || target >= list.length) return;
      const tmp = list[drillIdx];
      list[drillIdx] = list[target];
      list[target] = tmp;
      renderStations();
    }

    function addDrillToStationViaPicker(stIdx, drillId) {
      if (!drillId) return;
      // A drill CAN appear in multiple stations across the plan — only guard
      // against adding the exact same drill twice to the SAME station.
      activeStationIndex = stIdx; // the user just interacted with this station
      if (stations[stIdx].drillIds.indexOf(drillId) === -1) {
        stations[stIdx].drillIds.push(drillId);
      }
      renderStations();
      renderDrillCards();
      updateBudget();
    }

    function renderStations() {
      const list = document.getElementById('pstations-list');
      if (!list) return;
      list.innerHTML = '';

      const frag = document.createDocumentFragment();
      stations.forEach(function (station, stIdx) {
        const block = document.createElement('div');
        block.className = 'pstation-block';
        block.setAttribute('role', 'listitem');

        // Header: label + time allocation + reorder/remove
        const head = document.createElement('div');
        head.className = 'pstation-head';

        const label = document.createElement('span');
        label.className = 'pstation-label';
        label.textContent = stationLabel(stIdx);
        head.appendChild(label);

        const timeWrap = document.createElement('span');
        timeWrap.className = 'pstation-time-wrap';
        const timeInput = document.createElement('input');
        timeInput.type = 'number';
        timeInput.className = 'pstation-time-input';
        timeInput.min = '1';
        timeInput.max = '120';
        timeInput.value = String(station.minutes);
        timeInput.setAttribute('aria-label', 'Time allocation for ' + stationLabel(stIdx) + ' in minutes');
        timeInput.addEventListener('change', function () {
          const val = parseInt(timeInput.value, 10);
          if (!isNaN(val) && val > 0) {
            station.minutes = val;
            updateBudget();
          } else {
            timeInput.value = String(station.minutes);
          }
        });
        timeWrap.appendChild(timeInput);
        const timeLbl = document.createElement('span');
        timeLbl.className = 'pstation-time-lbl';
        timeLbl.textContent = 'min';
        timeWrap.appendChild(timeLbl);
        head.appendChild(timeWrap);

        const headBtns = document.createElement('span');
        headBtns.className = 'pstation-head-btns';
        const upBtn = document.createElement('button');
        upBtn.type = 'button'; upBtn.className = 'pplan-item-move-btn'; upBtn.innerHTML = '&#8593;';
        upBtn.setAttribute('aria-label', 'Move ' + stationLabel(stIdx) + ' up');
        upBtn.disabled = stIdx === 0;
        upBtn.addEventListener('click', function () { moveStation(stIdx, -1); });
        headBtns.appendChild(upBtn);
        const dnBtn = document.createElement('button');
        dnBtn.type = 'button'; dnBtn.className = 'pplan-item-move-btn'; dnBtn.innerHTML = '&#8595;';
        dnBtn.setAttribute('aria-label', 'Move ' + stationLabel(stIdx) + ' down');
        dnBtn.disabled = stIdx === stations.length - 1;
        dnBtn.addEventListener('click', function () { moveStation(stIdx, 1); });
        headBtns.appendChild(dnBtn);
        const rmBtn = document.createElement('button');
        rmBtn.type = 'button'; rmBtn.className = 'pplan-item-remove-btn'; rmBtn.innerHTML = '&#10005;';
        rmBtn.setAttribute('aria-label', 'Remove ' + stationLabel(stIdx));
        rmBtn.addEventListener('click', function () { removeStation(stIdx); });
        headBtns.appendChild(rmBtn);
        head.appendChild(headBtns);

        block.appendChild(head);

        // Drill picker — adds a drill to this station (no per-drill time field)
        const picker = document.createElement('select');
        picker.className = 'pstation-drill-picker';
        picker.setAttribute('aria-label', 'Add a drill to ' + stationLabel(stIdx));
        const placeholderOpt = document.createElement('option');
        placeholderOpt.value = ''; placeholderOpt.textContent = '+ Add drill to this station…';
        picker.appendChild(placeholderOpt);
        ALL_DRILLS.forEach(function (d) {
          const opt = document.createElement('option');
          opt.value = d.id; opt.textContent = d.title;
          picker.appendChild(opt);
        });
        picker.addEventListener('change', function () {
          addDrillToStationViaPicker(stIdx, picker.value);
          picker.value = '';
        });
        block.appendChild(picker);

        // Drill list within this station — no individual time field by design
        const drillList = document.createElement('div');
        drillList.className = 'pstation-drill-list';
        if (!station.drillIds.length) {
          const empty = document.createElement('div');
          empty.className = 'pstation-empty hint';
          empty.textContent = 'No drills assigned yet.';
          drillList.appendChild(empty);
        }
        station.drillIds.forEach(function (drillId, drillIdx) {
          const drill = getDrillById(drillId);
          if (!drill) return;
          const row = document.createElement('div');
          row.className = 'pstation-drill-row';
          const name = document.createElement('span');
          name.className = 'pstation-drill-name';
          name.textContent = drill.title;
          row.appendChild(name);
          const meta = document.createElement('span');
          meta.className = 'pstation-drill-meta';
          meta.textContent = drill.category;
          row.appendChild(meta);
          const upDBtn = document.createElement('button');
          upDBtn.type = 'button'; upDBtn.className = 'pplan-item-move-btn'; upDBtn.innerHTML = '&#8593;';
          upDBtn.setAttribute('aria-label', 'Move ' + drill.title + ' up within station');
          upDBtn.disabled = drillIdx === 0;
          upDBtn.addEventListener('click', function () { moveDrillWithinStation(stIdx, drillIdx, -1); });
          row.appendChild(upDBtn);
          const dnDBtn = document.createElement('button');
          dnDBtn.type = 'button'; dnDBtn.className = 'pplan-item-move-btn'; dnDBtn.innerHTML = '&#8595;';
          dnDBtn.setAttribute('aria-label', 'Move ' + drill.title + ' down within station');
          dnDBtn.disabled = drillIdx === station.drillIds.length - 1;
          dnDBtn.addEventListener('click', function () { moveDrillWithinStation(stIdx, drillIdx, 1); });
          row.appendChild(dnDBtn);
          const rmDBtn = document.createElement('button');
          rmDBtn.type = 'button'; rmDBtn.className = 'pplan-item-remove-btn'; rmDBtn.innerHTML = '&#10005;';
          rmDBtn.setAttribute('aria-label', 'Remove ' + drill.title + ' from station');
          rmDBtn.addEventListener('click', function () { removeDrillFromStation(stIdx, drillIdx); });
          row.appendChild(rmDBtn);
          drillList.appendChild(row);
        });
        block.appendChild(drillList);

        frag.appendChild(block);
      });
      list.appendChild(frag);

      const total = getStationTotalDuration();
      const count = stations.reduce(function (s, st) { return s + st.drillIds.length; }, 0);
      updateFooter(total, count);
    }

    // ── Budget bar ─────────────────────────────────────────────────────────

    function updateBudget() {
      const total    = getTotalDuration();
      const budget   = planMeta.duration || 90;
      const pct      = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
      const bar      = document.getElementById('pbudget-bar');
      const fraction = document.getElementById('pbudget-fraction');
      const left     = document.getElementById('pbudget-left');
      const right    = document.getElementById('pbudget-right');

      if (bar) {
        bar.style.width = pct + '%';
        bar.className = 'pbudget-fill ' + (
          pct >= 100 ? 'pbudget-over' : pct >= 85 ? 'pbudget-warn' : 'pbudget-ok'
        );
      }
      if (fraction) fraction.textContent = total + ' / ' + budget + ' min';
      if (left) left.textContent = total + ' min used';
      if (right) right.textContent = Math.max(0, budget - total) + ' min remaining';

      updateFooter(total, planItems.length);
    }

    // ── Skill-focused plans gallery ────────────────────────────────────────

    function renderPlanGallery(activeSkill) {
      const tabsEl   = document.getElementById('pplan-skill-tabs');
      const galleryEl = document.getElementById('pplan-gallery');
      if (!tabsEl || !galleryEl) return;

      // Build tabs from available plan skills
      const skills = ['all'];
      SKILL_ORDER.forEach(function (sk) {
        if (ALL_PLANS.some(function (p) { return p.skill === sk; })) skills.push(sk);
      });

      tabsEl.innerHTML = '';
      skills.forEach(function (sk) {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'pplan-tab' + (sk === (activeSkill || 'all') ? ' active' : '');
        tab.textContent = sk === 'all' ? 'All' : capitalize(sk);
        tab.setAttribute('aria-label', 'Show ' + (sk === 'all' ? 'all plans' : sk + ' plans'));
        tab.addEventListener('click', function () { renderPlanGallery(sk); });
        tabsEl.appendChild(tab);
      });

      const filtered = ALL_PLANS.filter(function (p) {
        return (!activeSkill || activeSkill === 'all') ? true : p.skill === activeSkill;
      });

      galleryEl.innerHTML = '';
      if (!filtered.length) {
        const msg = document.createElement('p');
        msg.className = 'hint';
        msg.textContent = 'No plans for this skill category.';
        galleryEl.appendChild(msg);
        return;
      }

      filtered.forEach(function (plan) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'pplan-card';
        card.setAttribute('role', 'listitem');
        card.setAttribute('aria-label', 'Load plan: ' + plan.label);

        const label = document.createElement('div');
        label.className = 'pplan-card-label';
        label.textContent = plan.label;
        card.appendChild(label);

        const badges = document.createElement('div');
        badges.className = 'pplan-card-badges';
        if (plan.skillCategory || plan.skill) {
          badges.appendChild(makePlanBadge('pplan-badge-skill', plan.skillCategory || plan.skill));
        }
        if (plan.difficultyRange) {
          badges.appendChild(makePlanBadge('pplan-badge-diff', plan.difficultyRange));
        }
        if (plan.ageRange || plan.age) {
          badges.appendChild(makePlanBadge('pplan-badge-age', plan.ageRange || plan.age));
        }
        if (plan.totalDuration || plan.totalMin) {
          badges.appendChild(makePlanBadge('pplan-badge-dur', plan.totalDuration || (plan.totalMin + ' min')));
        }
        card.appendChild(badges);

        if (plan.notes) {
          const meta = document.createElement('div');
          meta.className = 'pplan-card-meta';
          meta.textContent = plan.notes;
          card.appendChild(meta);
        }

        card.addEventListener('click', function () { loadPlanFromTemplate(plan); });
        galleryEl.appendChild(card);
      });
    }

    function makePlanBadge(cls, text) {
      const b = document.createElement('span');
      b.className = 'pplan-badge ' + cls;
      b.textContent = text;
      return b;
    }

    function capitalize(s) {
      return s ? s.split('-').map(function (w) {
        return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
      }).join(' ') : s;
    }

    // ── Skill-progression roadmap ──────────────────────────────────────────

    const ROADMAP_STAGES = [
      { id: 'introductory', label: 'Introductory', age: '5–8U' },
      { id: 'beginner',     label: 'Beginner',     age: '8–10U' },
      { id: 'intermediate', label: 'Intermediate', age: '10–12U' },
      { id: 'advanced',     label: 'Advanced',     age: '12–15U' }
    ];

    function renderRoadmap() {
      const container = document.getElementById('proadmap-container');
      if (!container) return;

      const skills = SKILL_ORDER.filter(function (sk) { return sk !== 'full-practice'; });

      container.innerHTML = '';
      skills.forEach(function (skill) {
        const row = document.createElement('div');
        row.className = 'proadmap-skill';

        const heading = document.createElement('h4');
        heading.className = 'proadmap-skill-title';
        heading.textContent = capitalize(skill);
        row.appendChild(heading);

        const stagesEl = document.createElement('div');
        stagesEl.className = 'proadmap-stages';

        ROADMAP_STAGES.forEach(function (stage) {
          const cell = document.createElement('div');
          cell.className = 'proadmap-stage';

          const head = document.createElement('div');
          head.className = 'proadmap-stage-head';
          const name = document.createElement('span');
          name.className = 'proadmap-stage-name';
          name.textContent = stage.label;
          const age = document.createElement('span');
          age.className = 'proadmap-stage-age';
          age.textContent = stage.age;
          head.appendChild(name);
          head.appendChild(age);
          cell.appendChild(head);

          const matches = ALL_PLANS.filter(function (p) {
            return p.skill === skill && p.stage === stage.id;
          });

          if (matches.length) {
            matches.forEach(function (plan) {
              const card = document.createElement('button');
              card.type = 'button';
              card.className = 'pplan-card';
              card.setAttribute('aria-label', 'Load plan: ' + plan.label);

              const label = document.createElement('div');
              label.className = 'pplan-card-label';
              label.textContent = plan.label;
              card.appendChild(label);

              const badges = document.createElement('div');
              badges.className = 'pplan-card-badges';
              if (plan.ageRange || plan.age) {
                badges.appendChild(makePlanBadge('pplan-badge-age', plan.ageRange || plan.age));
              }
              badges.appendChild(makePlanBadge('pplan-badge-skill', (plan.drills ? plan.drills.length : 0) + ' drills'));
              if (plan.totalDuration || plan.totalMin) {
                badges.appendChild(makePlanBadge('pplan-badge-dur', plan.totalDuration || (plan.totalMin + ' min')));
              }
              card.appendChild(badges);

              card.addEventListener('click', function () { loadPlanFromTemplate(plan); });
              cell.appendChild(card);
            });
          } else {
            const empty = document.createElement('div');
            empty.className = 'proadmap-card-empty';
            empty.textContent = 'Coming soon';
            cell.appendChild(empty);
          }

          stagesEl.appendChild(cell);
        });

        row.appendChild(stagesEl);
        container.appendChild(row);
      });
    }

    // ── Save / Load ────────────────────────────────────────────────────────

    function serializePlan() {
      if (planMode === 'stations') {
        return {
          meta:      planMeta,
          mode:      'stations',
          stationCount: stations.length,
          stations:  stations.map(function (s) { return { id: s.id, minutes: s.minutes, drillIds: s.drillIds.slice() }; }),
          items:     [], // unused in stations mode, kept empty for shape consistency
          savedAt:   new Date().toISOString(),
        };
      }
      // Legacy/sequential shape — unchanged from the pre-2.1 format so older
      // app builds (and the backward-compat reader) keep working.
      return {
        meta:      planMeta,
        mode:      'sequential',
        items:     planItems,
        savedAt:   new Date().toISOString(),
      };
    }

    function planHasContent() {
      return planMode === 'stations' ? stations.some(function (s) { return s.drillIds.length > 0; }) : planItems.length > 0;
    }

    function savePlan() {
      if (!planHasContent()) { showToast('Nothing to save — add drills first'); return; }
      const name = prompt('Name this plan (leave blank to overwrite "My Plan"):') || 'My Plan';
      const saved = loadSavedPlans();
      saved[name] = serializePlan();
      try {
        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(saved));
        showToast('“' + name + '” saved');
      } catch (e) {
        alert('Could not save — browser storage may be full.');
      }
    }

    function loadSavedPlans() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY_PLANS);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { return {}; }
    }

    function openLoadModal() {
      const saved = loadSavedPlans();
      const keys  = Object.keys(saved);

      const overlay = document.getElementById('modal-overlay');
      const box     = document.getElementById('modal-box');
      if (!overlay || !box) return;

      box.innerHTML = '';

      const title = document.createElement('h3');
      title.id = 'modal-title';
      title.textContent = 'Load Saved Plan';
      box.appendChild(title);

      if (!keys.length) {
        const msg = document.createElement('p');
        msg.textContent = 'No saved plans found.';
        box.appendChild(msg);
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-secondary';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', closeLoadModal);
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.appendChild(closeBtn);
        box.appendChild(actions);
        overlay.classList.remove('hidden');
        return;
      }

      const list = document.createElement('div');
      list.className = 'saved-plan-list';

      keys.forEach(function (key) {
        const plan = saved[key];
        const item = document.createElement('div');
        item.className = 'saved-plan-item';

        const nameEl = document.createElement('span');
        nameEl.className = 'saved-plan-name';
        nameEl.textContent = key;

        const normalizedForMeta = normalizePracticePlan(plan, planMeta);
        const metaEl = document.createElement('span');
        metaEl.className = 'saved-plan-meta';
        let drillCount, total, modeLabel;
        if (normalizedForMeta.mode === 'stations') {
          drillCount = normalizedForMeta.stations.reduce(function (s, st) { return s + st.drillIds.length; }, 0);
          total = normalizedForMeta.stations.reduce(function (s, st) { return s + (st.minutes || 0); }, 0);
          modeLabel = normalizedForMeta.stations.length + ' station' + (normalizedForMeta.stations.length !== 1 ? 's' : '');
        } else {
          drillCount = normalizedForMeta.items.length;
          total = normalizedForMeta.items.reduce(function (s, it) { return s + (it.durationMinutes || 0); }, 0);
          modeLabel = 'Sequential';
        }
        metaEl.textContent = modeLabel + ' · ' + drillCount + ' drill' + (drillCount !== 1 ? 's' : '') + ' · ' + total + ' min';
        if (plan.savedAt) {
          metaEl.textContent += ' · ' + new Date(plan.savedAt).toLocaleDateString();
        }

        const btnWrap = document.createElement('div');
        btnWrap.style.display = 'flex';
        btnWrap.style.gap = '0.3rem';

        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'btn-sm';
        loadBtn.textContent = 'Load';
        loadBtn.addEventListener('click', function () {
          pushUndo();
          const normalized = normalizePracticePlan(plan, planMeta);
          planMeta = normalized.meta;
          if (normalized.mode === 'stations') {
            stations = JSON.parse(JSON.stringify(normalized.stations));
            planItems = [];
            planMode = 'stations';
            const countInput = document.getElementById('pp-station-count');
            if (countInput) countInput.value = String(stations.length);
          } else {
            planItems = JSON.parse(JSON.stringify(normalized.items));
            stations = [];
            planMode = 'sequential';
          }
          syncMetaInputs();
          renderModeUI();
          renderDrillCards();
          updateBudget();
          updatePlanHeader();
          closeLoadModal();
          showToast('“' + key + '” loaded');
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-secondary btn-sm';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', function () {
          if (!confirm('Delete saved plan "' + key + '"?')) return;
          const updated = loadSavedPlans();
          delete updated[key];
          try {
            localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(updated));
          } catch (e) { /* storage write failure is non-fatal for a delete */ }
          item.remove();
          if (!Object.keys(updated).length) closeLoadModal();
        });

        btnWrap.appendChild(loadBtn);
        btnWrap.appendChild(delBtn);

        item.appendChild(nameEl);
        item.appendChild(metaEl);
        item.appendChild(btnWrap);
        list.appendChild(item);
      });

      box.appendChild(list);

      const actions = document.createElement('div');
      actions.className = 'modal-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', closeLoadModal);
      actions.appendChild(cancelBtn);
      box.appendChild(actions);

      overlay.classList.remove('hidden');
    }

    function closeLoadModal() {
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.add('hidden');
      const box = document.getElementById('modal-box');
      if (box) box.innerHTML = '';
    }

    // ── Export / Import saved plans ───────────────────────────────────────
    // Lets a coach carry their saved plans between browsers/devices as a
    // JSON file — the practice-planner equivalent of the lineup app's
    // Back up / Restore. Wrapped with the same dataVersion envelope that
    // versionCompat.js understands, so a future schema change can migrate
    // or block an old export the same way lineup backups are handled.

    function exportSavedPlans() {
      const saved = loadSavedPlans();
      const names = Object.keys(saved);
      if (!names.length) { showToast('No saved plans to export'); return; }

      const dataVersion = (window.HRP_VERSION && window.HRP_VERSION.DATA_VERSION) || '1.0';
      const payload = {
        app: 'homerun-practice',
        dataVersion: dataVersion,
        exportedAt: new Date().toISOString(),
        plans: saved
      };

      let blob, url;
      try {
        blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        url = URL.createObjectURL(blob);
      } catch (e) {
        alert('Could not prepare the export file.');
        return;
      }

      const d = new Date();
      const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'homerun-practice-plans-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

      showToast(names.length + ' plan' + (names.length !== 1 ? 's' : '') + ' exported');
    }

    function mergeImportedPlans(importedPlans) {
      const existing = loadSavedPlans();
      const names = Object.keys(importedPlans);
      const overwrites = names.filter(function (n) { return Object.prototype.hasOwnProperty.call(existing, n); });
      let msg = 'Import ' + names.length + ' plan' + (names.length !== 1 ? 's' : '') + '?';
      if (overwrites.length) {
        msg += ' ' + overwrites.length + ' existing plan' + (overwrites.length !== 1 ? 's share' : ' shares') +
          ' a name with an imported plan and will be overwritten.';
      }
      if (!confirm(msg)) return;

      const merged = Object.assign({}, existing, importedPlans);
      try {
        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(merged));
        showToast(names.length + ' plan' + (names.length !== 1 ? 's' : '') + ' imported');
      } catch (e) {
        alert('Could not save the imported plans — browser storage may be full.');
        return;
      }
      // Refresh the Load modal in place if it's open so the new plans appear.
      if (!document.getElementById('modal-overlay').classList.contains('hidden')) {
        openLoadModal();
      }
    }

    function importSavedPlansFromFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        let data;
        try {
          data = JSON.parse(String(reader.result));
        } catch (e) {
          alert('That file is not valid JSON.');
          return;
        }
        if (!data || typeof data !== 'object' || !data.plans || typeof data.plans !== 'object') {
          alert('That file does not look like a Homerun Practice export.');
          return;
        }

        const importedDataVersion = data.dataVersion || '1.0';
        const compat = window.HRP_VERSION_COMPAT;
        const result = compat ? compat.isImportCompatible(importedDataVersion) : { status: 'compatible' };

        if (result.status === 'incompatible') {
          alert(result.message || 'This export is not compatible with this version of the app.');
          return;
        }

        let plans = data.plans;
        if (result.status === 'migratable' && compat) {
          plans = compat.applyMigrations(plans, result.migrationPath);
        }

        // Normalize every incoming plan so a legacy shape (or a shape from a
        // future minor version) never crashes the loader.
        const normalized = {};
        Object.keys(plans).forEach(function (name) {
          normalized[name] = normalizePracticePlan(plans[name], planMeta);
        });

        mergeImportedPlans(normalized);
      };
      reader.onerror = function () {
        alert('Could not read that file.');
      };
      reader.readAsText(file);
    }

    function bindExportImport() {
      const exportBtn = document.getElementById('pp-btn-export');
      const importBtn = document.getElementById('pp-btn-import');
      const fileInput = document.getElementById('pp-file-import');
      if (exportBtn) exportBtn.addEventListener('click', exportSavedPlans);
      if (importBtn && fileInput) {
        importBtn.addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
          const file = fileInput.files && fileInput.files[0];
          importSavedPlansFromFile(file);
          fileInput.value = '';
        });
      }
    }

    // ── Print ──────────────────────────────────────────────────────────────

    function printPlan() {
      if (!planHasContent()) { showToast('Nothing to print — add drills first'); return; }

      const root = document.getElementById('practice-print-root');
      if (!root) return;
      root.innerHTML = '';

      // Header
      const hdr = document.createElement('div');
      hdr.className = 'pp-print-header';
      const hdrTitle = document.createElement('h2');
      hdrTitle.textContent = (planMeta.team ? planMeta.team + ' — ' : '') + 'Practice Plan' +
        (planMeta.theme ? ': ' + planMeta.theme : '');
      hdr.appendChild(hdrTitle);

      const hdrMeta = document.createElement('p');
      hdrMeta.className = 'pp-print-meta';
      const metaParts = [];
      if (planMeta.date)     metaParts.push(planMeta.date);
      if (planMeta.start)    metaParts.push('Start: ' + planMeta.start);
      if (planMeta.duration) metaParts.push('Duration: ' + planMeta.duration + ' min');
      if (planMeta.location) metaParts.push(planMeta.location);
      hdrMeta.textContent = metaParts.join(' · ');
      hdr.appendChild(hdrMeta);
      root.appendChild(hdr);

      if (planMode === 'stations') {
        // STATIONS MODE: one section per station — station-level time shown
        // once, drills listed underneath with no individual time value.
        const tblTitle = document.createElement('div');
        tblTitle.className = 'pp-print-section-title';
        tblTitle.textContent = 'Practice Stations';
        root.appendChild(tblTitle);

        stations.forEach(function (station, stIdx) {
          const block = document.createElement('div');
          block.className = 'pp-print-drill-block';
          const name = document.createElement('div');
          name.className = 'pp-print-drill-name';
          name.textContent = stationLabel(stIdx) + ' (' + station.minutes + ' min)';
          block.appendChild(name);
          const ul = document.createElement('ul');
          station.drillIds.forEach(function (drillId) {
            const drill = getDrillById(drillId);
            if (!drill) return;
            const li = document.createElement('li');
            li.textContent = drill.title + ' — ' + drill.category;
            ul.appendChild(li);
          });
          block.appendChild(ul);
          root.appendChild(block);
        });

        const totalP = document.createElement('p');
        totalP.style.fontWeight = '700';
        totalP.textContent = 'Total: ' + getTotalDuration() + ' min';
        root.appendChild(totalP);
      } else {
      // Timeline table
      const tblTitle = document.createElement('div');
      tblTitle.className = 'pp-print-section-title';
      tblTitle.textContent = 'Practice Timeline';
      root.appendChild(tblTitle);

      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      ['Time', 'Drill', 'Skill', 'Duration', 'Intensity'].forEach(function (col) {
        const th = document.createElement('th');
        th.textContent = col;
        headRow.appendChild(th);
      });
      thead.appendChild(headRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      let cursor = -1;
      if (planMeta.start && /^\d{1,2}:\d{2}$/.test(planMeta.start)) {
        const [h, m] = planMeta.start.split(':').map(Number);
        cursor = h * 60 + m;
      }

      planItems.forEach(function (item) {
        const drill = getDrillById(item.drillId);
        if (!drill) return;
        const tr = document.createElement('tr');
        const timeStr = cursor >= 0 ? formatMinutes(cursor) : '';
        [timeStr, drill.title, drill.category, item.durationMinutes + ' min', drill.intensity].forEach(function (v) {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
        if (cursor >= 0) cursor += item.durationMinutes;
      });

      // Total row
      const totalRow = document.createElement('tr');
      const totalLabel = document.createElement('td');
      totalLabel.colSpan = 3;
      totalLabel.style.fontWeight = '700';
      totalLabel.textContent = 'Total';
      const totalDur = document.createElement('td');
      totalDur.style.fontWeight = '700';
      totalDur.textContent = getTotalDuration() + ' min';
      const totalBlank = document.createElement('td');
      totalRow.appendChild(totalLabel);
      totalRow.appendChild(totalDur);
      totalRow.appendChild(totalBlank);
      tbody.appendChild(totalRow);
      table.appendChild(tbody);
      root.appendChild(table);

      // Drill details
      const detailTitle = document.createElement('div');
      detailTitle.className = 'pp-print-section-title';
      detailTitle.textContent = 'Drill Details';
      root.appendChild(detailTitle);

      planItems.forEach(function (item) {
        const drill = getDrillById(item.drillId);
        if (!drill) return;

        const block = document.createElement('div');
        block.className = 'pp-print-drill-block';

        const name = document.createElement('div');
        name.className = 'pp-print-drill-name';
        name.textContent = drill.title + ' (' + item.durationMinutes + ' min)';
        block.appendChild(name);

        if (drill.purpose) {
          const p = document.createElement('div');
          p.className = 'pp-print-drill-detail';
          p.textContent = drill.purpose;
          block.appendChild(p);
        }
        if (drill.setup) {
          const p = document.createElement('div');
          p.className = 'pp-print-drill-detail';
          p.textContent = 'Setup: ' + drill.setup;
          block.appendChild(p);
        }
        if (drill.coachingCues) {
          const p = document.createElement('div');
          p.className = 'pp-print-cue';
          p.textContent = '“' + drill.coachingCues + '”';
          block.appendChild(p);
        }
        if (drill.equipment && drill.equipment.length) {
          const p = document.createElement('div');
          p.className = 'pp-print-drill-detail';
          p.textContent = 'Equipment: ' + drill.equipment.join(', ');
          block.appendChild(p);
        }

        root.appendChild(block);
      });
      } // end sequential-mode branch

      // Coach's notes
      if (planMeta.notes) {
        const notesTitle = document.createElement('div');
        notesTitle.className = 'pp-print-section-title';
        notesTitle.textContent = "Coach's Notes";
        root.appendChild(notesTitle);
        const notesBox = document.createElement('div');
        notesBox.className = 'pp-print-notes';
        notesBox.textContent = planMeta.notes;
        root.appendChild(notesBox);
      }

      root.style.display = 'block';
      window.print();
    }

    function formatMinutes(totalMin) {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return hh + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    }

    // ── Meta form sync ─────────────────────────────────────────────────────

    function syncMetaInputs() {
      setVal('pp-team',     planMeta.team);
      setVal('pp-date',     planMeta.date);
      setVal('pp-theme',    planMeta.theme);
      setVal('pp-location', planMeta.location);
      setVal('pp-start',    planMeta.start);
      setVal('pp-duration', String(planMeta.duration));
      setVal('pp-notes',    planMeta.notes);
    }

    function setVal(id, val) {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'SELECT') {
        const strVal = String(val || '');
        const hasMatch = Array.from(el.options).some(function (o) { return o.value === strVal; });
        if (!hasMatch && strVal) {
          let custom = el.querySelector('option[data-custom]');
          if (!custom) {
            custom = document.createElement('option');
            custom.setAttribute('data-custom', '');
            el.appendChild(custom);
          }
          custom.value = strVal;
          custom.textContent = strVal + ' min';
        }
        el.value = strVal;
        return;
      }
      el.value = val || '';
    }

    function bindMetaInputs() {
      function bind(id, key, isNum) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
          planMeta[key] = isNum ? (parseInt(el.value, 10) || 90) : el.value;
          if (key === 'duration') updateBudget();
          updatePlanHeader();
        });
      }
      bind('pp-team',     'team');
      bind('pp-date',     'date');
      bind('pp-theme',    'theme');
      bind('pp-location', 'location');
      bind('pp-start',    'start');
      bind('pp-duration', 'duration', true);
      bind('pp-notes',    'notes');
    }

    function updatePlanHeader() {
      const h3 = document.getElementById('practice-plan-h3');
      const meta = document.getElementById('practice-plan-meta');
      if (h3) {
        h3.textContent = planMeta.theme ? 'Practice Plan: ' + planMeta.theme : 'Practice Plan';
      }
      if (meta) {
        const parts = [];
        if (planMeta.team)     parts.push(planMeta.team);
        if (planMeta.date)     parts.push(planMeta.date);
        if (planMeta.location) parts.push(planMeta.location);
        if (planMeta.start)    parts.push('Start: ' + planMeta.start);
        meta.textContent = parts.join(' · ');
      }
    }

    // ── Collapsible panels ─────────────────────────────────────────────────

    function bindCollapsibles() {
      document.querySelectorAll('.practice-panel-head').forEach(function (head) {
        const sectionId = 'psec-' + head.getAttribute('data-psection');
        const body = document.getElementById(sectionId);
        if (!body) return;
        head.addEventListener('click', function () {
          const collapsed = body.classList.toggle('collapsed');
          head.classList.toggle('collapsed', collapsed);
        });
      });
    }

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

    // ── Filter chip binding ────────────────────────────────────────────────

    function bindChips(groupId, dataAttr, onChange) {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.pchip').forEach(function (chip) {
        chip.addEventListener('click', function () {
          group.querySelectorAll('.pchip').forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          onChange(chip.getAttribute(dataAttr) || '');
        });
      });
    }

    // ── Search binding ─────────────────────────────────────────────────────

    function bindSearch() {
      const input   = document.getElementById('pdrill-search');
      const clearBtn = document.getElementById('pdrill-search-clear');
      if (!input) return;

      input.addEventListener('input', function () {
        searchQuery = input.value;
        if (clearBtn) clearBtn.style.display = input.value ? '' : 'none';
        renderDrillCards();
      });

      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          input.value = '';
          searchQuery = '';
          clearBtn.style.display = 'none';
          renderDrillCards();
          input.focus();
        });
      }
    }

    // ── Age filter ─────────────────────────────────────────────────────────

    function bindAgeFilter() {
      const sel = document.getElementById('pp-age-filter');
      const chk = document.getElementById('pp-show-all-ages');
      if (sel) sel.addEventListener('change', function () {
        filterAge = sel.value;
        renderDrillCards();
      });
      if (chk) chk.addEventListener('change', function () {
        showAllAges = chk.checked;
        if (sel) sel.disabled = showAllAges;
        renderDrillCards();
      });
    }

    function bindLevelFilter() {
      const sel = document.getElementById('pdrill-level-filter');
      if (sel) sel.addEventListener('change', function () {
        filterLevel = sel.value;
        renderDrillCards();
      });
    }

    // ── Toast ──────────────────────────────────────────────────────────────

    let toastTimer;
    function showToast(msg) {
      const toast = document.getElementById('pp-toast');
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
    }

    // ── Overlay dismiss ────────────────────────────────────────────────────

    function bindOverlayDismiss() {
      const detailOverlay = document.getElementById('drill-detail-overlay');
      if (detailOverlay) {
        detailOverlay.addEventListener('click', function (e) {
          if (e.target === detailOverlay) closeDrillDetail();
        });
      }
    }

    // ── Initialise ─────────────────────────────────────────────────────────

    function bindPracticeButtons() {
      const undoBtn  = document.getElementById('pp-btn-undo');
      const clearBtn = document.getElementById('pp-btn-clear');
      const saveBtn  = document.getElementById('pp-btn-save');
      const loadBtn  = document.getElementById('pp-btn-load');
      const printBtn = document.getElementById('pp-btn-print');

      if (undoBtn)  undoBtn.addEventListener('click', popUndo);
      if (clearBtn) clearBtn.addEventListener('click', clearPlan);
      if (saveBtn)  saveBtn.addEventListener('click', savePlan);
      if (loadBtn)  loadBtn.addEventListener('click', openLoadModal);
      if (printBtn) printBtn.addEventListener('click', printPlan);
    }

    // Default today's date in the session config
    function setDefaultDate() {
      const dateInput = document.getElementById('pp-date');
      if (!dateInput || dateInput.value) return;
      const d = new Date();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      dateInput.value = d.getFullYear() + '-' + mm + '-' + dd;
      planMeta.date = dateInput.value;
    }

    // Main init
    bindSearch();
    bindAgeFilter();
    bindLevelFilter();
    bindChips('pskill-chips', 'data-skill', function (val) {
      filterSkill = val;
      renderDrillCards();
    });
    bindChips('pint-chips', 'data-intensity', function (val) {
      filterIntensity = val;
      renderDrillCards();
    });
    bindCollapsibles();
    bindPracticeTabs();
    bindMetaInputs();
    bindPracticeButtons();
    bindExportImport();
    bindModeToggle();
    bindStationCount();
    bindOverlayDismiss();
    setDefaultDate();
    renderDrillCards();
    renderPlanItems();
    updateBudget();
    renderPlanGallery('all');
    renderRoadmap();
    updateUndoBtn();
  }
})();
