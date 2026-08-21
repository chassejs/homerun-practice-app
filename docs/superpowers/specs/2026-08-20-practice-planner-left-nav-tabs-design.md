# Practice Planner: Left-Column Navigation Redesign (Build-Method Tabs)

Date: 2026-08-20
Status: Approved for implementation

## Problem

The left column of the Practice Planner (`.practice-left`, fixed 380px)
stacks four independently-collapsible accordion panels top to bottom:

1. **Session Configuration** — team name, date, theme, location, time,
   duration, notes.
2. **Time Budget bar** — live readout, not collapsible.
3. **Drill Library** — search box, Skill/Intensity/Age/Level filter chips,
   and up to 368 drill cards.
4. **Skill-Focused Plans** — a skill sub-tab row + gallery of ~40 pre-built
   plan cards.
5. **Roadmap** — 10 skill categories, each rendering a 4-stage ladder of
   plan cards.
6. **Plan Actions** — "Undo Last" / "Clear Plan" buttons, tacked on at the
   very bottom below Roadmap.

All panels default to expanded, toggle independently, and have no memory
across visits. Nothing signals that Drill Library, Skill-Focused Plans, and
Roadmap are three **alternative ways to build the same plan** — a coach who
wants a pre-built plan has to scroll past the entire 368-drill library
first just to discover Skill-Focused Plans exists below it, and past that
again to reach Roadmap. Plan Actions (which act on the plan in the right
column) sit at the bottom of an unrelated left-column scroll, disconnected
from the plan they control.

## Goals

- Make the three build-methods (browse individual drills / load a
  pre-built plan / follow a skill-progression roadmap) read as clear,
  one-click alternatives instead of a long stacked scroll.
- Reduce how much a coach has to scroll through to reach any one
  build-method, on both desktop and — especially — mobile, where the
  single-column layout makes today's full stack the longest.
- Fix the misplaced Plan Actions bar by moving it next to the plan
  controls it actually acts on.
- Do this as a pure navigation/layout change: no changes to filtering,
  gallery, or roadmap business logic.

## Non-goals

- Redesigning the internals of any of the three panels (search/filter
  logic, plan gallery, roadmap ladder rendering) — those are unchanged.
- Keyboard arrow-key tab navigation (nice-to-have, not required — matches
  the existing top-level nav, which is also click/tap-only today).
- Persisting the last-used tab across sessions (out of scope for this
  pass; Browse Drills is always the default on load).
- Any change to save/load/export/import/print data formats.

## Design overview

Reuses the `data-view` / `.view.active` toggle pattern already implemented
in [shell.js](../../../shell.js) for the top-level Practice Planner / Help
& Guide switch — no new interaction paradigm, just the same mechanism one
level deeper.

### Left column, top to bottom (after)

1. **Session Configuration** — same panel, same fields, same
   `practice-panel-head` accordion mechanism (`bindCollapsibles()`
   unchanged) — only the **default state changes from expanded to
   collapsed**.
2. **Time Budget bar** — unchanged.
3. **NEW: build-method tab bar** — three tabs, replacing the three
   separate accordion headers previously on Drill Library, Skill-Focused
   Plans, and Roadmap:
   - `Browse Drills`
   - `Skill Plans`
   - `Roadmap`
4. **Tab content pane** — exactly one of the three panels below renders at
   a time; the other two are hidden via CSS (`display: none` on the
   inactive `.ptab-panel`), not destroyed, so search text, active filter
   chips, and scroll position are preserved when switching back:
   - *Browse Drills* → today's search box + Skill/Intensity/Age/Level
     filter chips + drill card list, unchanged internals.
   - *Skill Plans* → today's skill sub-tab row + plan gallery, unchanged
     internals.
   - *Roadmap* → today's per-skill-category 4-stage ladder, unchanged
     internals.

   Default active tab on load: **Browse Drills** (matches current
   behavior, where the drill library is what's visible first today).

5. **Plan Actions removed from the left column entirely.** "Undo Last" and
   "Clear Plan" move into the right column's Practice Plan header, next to
   the existing Save / Load / Export / Import / Print / PDF controls.

## Markup changes (`index.html`)

- Wrap the tab bar in `role="tablist" aria-label="Build a plan"`; each tab
  button gets `role="tab"`, `aria-selected`, `aria-controls` pointing at
  its panel's id, and a stable `id` for the panel's `aria-labelledby` —
  the same ARIA shape already used for the Skill-Focused Plans skill
  sub-tabs (`#pplan-skill-tabs`, `role="tablist"`).
- Each of the three former `.practice-panel` sections (Drill Library,
  Skill-Focused Plans, Roadmap) drops its `.practice-panel-head`
  accordion header and becomes a `.ptab-panel` with `role="tabpanel"`,
  hidden by default except Browse Drills.
- The Drill Library search row, filter chips, and card list move inside
  the `Browse Drills` `.ptab-panel` unchanged; same for the other two.
- `.practice-plan-actions` (Undo/Clear) moves from the bottom of
  `.practice-left` into the existing Practice Plan header markup on the
  right (`.practice-right` header row containing Save/Load/etc.).
- Session Configuration's `practice-panel-body` starts with the
  `collapsed` class already used elsewhere for the same purpose.

## Behavior changes (`practice.js`)

- `bindCollapsibles()` — unchanged, still runs for Session Configuration
  (its `data-psection="session"` head/body pair still exists). The
  `data-psection` bindings for `drills`, `plans`, and `roadmap` are
  removed since those are no longer accordions.
- New `bindPracticeTabs()` — binds the three new `data-ptab` buttons:
  clicking one toggles `.active` on the clicked button and its
  `aria-selected`, and toggles `.active` (shown) / hidden on the matching
  `.ptab-panel`, mirroring `shell.js`'s existing `showView()`.
- Undo/Clear button element lookups (`getElementById('pp-btn-undo')` /
  `getElementById('pp-btn-clear')`) and their click bindings are unchanged
  — only their DOM location moves, not their ids or the code that wires
  them.

## Style changes (`styles.css`)

- New `.ptab-bar` / `.ptab-btn` / `.ptab-btn.active` rules, visually
  consistent with the existing `.nav-btn` / `.nav-btn.active` header nav
  (same active-state treatment, scaled to the left column's width).
- New `.ptab-panel` / `.ptab-panel.active` rules (`display: none` /
  `display: block`), replacing `.practice-panel-body.collapsed` for the
  three panels that convert from accordion to tab.
- Session Configuration keeps its existing `.practice-panel-head` /
  `.practice-panel-body.collapsed` styling untouched — only the initial
  HTML state changes, not the CSS.
- Plan Actions buttons restyled to sit inline in the Practice Plan header
  row rather than as a full-width bottom bar, consistent with the other
  header buttons (Save/Load/etc.) already there.

## Mobile

No new breakpoint logic needed. `.practice-layout` already collapses to a
single column under the existing breakpoint
([styles.css:1010](../../../styles.css)); the tab bar and single-panel
content pane stack the same way the accordions did, but a coach now
scrolls through only one build-method's content at a time instead of all
three stacked — the biggest win on mobile, where the full stack is the
longest scroll today.

## Accessibility

- Tab bar: `role="tablist"`, tabs get `role="tab"` + `aria-selected` +
  `aria-controls`; panels get `role="tabpanel"` + `aria-labelledby`.
- Session Configuration's existing accordion semantics are unchanged.

## Testing

No new business logic is introduced (pure DOM/CSS restructuring of
existing, unchanged panels), so this stays outside `tests/` — the
existing 31-test suite is unaffected and should continue passing as-is.

Manual verification in the browser (via the `run` skill / preview):

- All three tabs switch correctly; only the active panel's content is
  visible at a time.
- Search text and active filter chips in Browse Drills survive switching
  to another tab and back.
- Skill Plans' internal sub-tab selection survives switching away and
  back, same for Roadmap's scroll position.
- Session Configuration starts collapsed, still expands/collapses on
  click, and its field values are unaffected.
- Undo Last / Clear Plan work correctly from their new location in the
  right column, including the existing disabled-state behavior for Undo
  when there's no history.
- Mobile width (`resize_window` to the existing breakpoint and narrower):
  tabs and panels stack correctly, no horizontal overflow.
- Print/PDF output is unaffected: printing already hides the entire live
  page (`body * { visibility: hidden }`) and renders only the dedicated
  `#practice-print-root` built from plan data
  ([styles.css:1028-1029](../../../styles.css)), so moving Plan Actions or
  restructuring the left column has no bearing on what prints.
