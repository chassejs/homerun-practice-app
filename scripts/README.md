# Scripts

## sync-drills.mjs

**The knowledge base is the single source of truth for all drill content.**

This script reads drill Markdown files from:

  `/Users/jschasse/knowledge-base/youth-baseball-canada/wiki/drills/*.md`

It validates each file's YAML frontmatter, normalizes the data into a
consistent schema, and writes `src/drills-data.js` — a plain JS file that
assigns `window.DRILLS_DATA` for use by the app at runtime.

### When to re-run

Re-run whenever drills are added, updated, or removed in the KB:

```
npm run sync:drills
```

The sync also runs automatically as a prebuild step (`npm run build`), so
Netlify deploys always reflect the current KB snapshot.

### Determinism

Running the sync twice against an unchanged KB produces a byte-identical
`src/drills-data.js` (stable sort by drill id, sorted JSON key order,
no timestamps in the generated content). A clean `git diff` after re-running
confirms no drift.

### What is NOT hand-edited

`src/drills-data.js` must never be edited by hand. All content changes belong
in the KB at the path above.

### Stage fallback

Every drill record in the output has a `stage` of `introductory`,
`beginner`, `intermediate`, or `advanced`. When the KB file supplies an
explicit `stage:` frontmatter value, that value is used. Otherwise the
script computes one from `ageMin` and `intensity` (first match wins):

| ageMin range | intensity | computed stage |
|---|---|---|
| ≤ 8 | any | `introductory` |
| 9–10 | low / medium | `beginner` |
| 9–10 | high | `intermediate` |
| 11–12 | any | `intermediate` |
| ≥ 13 | any | `advanced` |

Plans without an explicit `stage:` line get one derived from their
`difficultyRange` text (`Beginner` / `Beginner–Intermediate` → `beginner`,
`Intermediate` / `Intermediate–Advanced` → `intermediate`, `Advanced` →
`advanced`; anything else defaults to `beginner`).

Each run logs a summary so KB tagging progress is visible over time, for
example:

```
Stage tagging: 0 explicit, 368 computed via fallback (of 368 drills)
```
