## Goal
Replace the Homerun Practice app icon (favicon, apple-touch-icon, and PWA
manifest icons) with a new design that reflects what this app actually does —
build a timed baseball practice plan — rather than the current generic
maple-leaf/home-plate crest, which is the shared parent-org (Homerun Baseball
Ottawa) brand mark and carries no "practice planning" meaning of its own.
Grok Imagine was considered per the task instructions but is not reachable
in this session (grok.com requires interactive sign-in, which we cannot do
on the user's behalf); the user explicitly chose the fallback of an in-house
vector icon design instead, matching the existing brand's navy/red line-art
style. The new design (clipboard with checklist lines, overlapped by a
baseball) has already been drafted, previewed at all three target
resolutions, and approved during planning — this stage packages that SVG
source into the required PNG assets and wires them into the app in place of
the old files, with no other application behavior changed.

## Constraints
- Do not change any file other than the three app-icon PNGs
  (`brand/icon-32.png`, `brand/icon-180.png`, `brand/icon-512.png`) plus
  adding the new `brand/icon-source.svg` for future edits. `brand/crest.png`,
  `brand/mark.png`, and `brand/wordmark.png` are separate org-branding assets
  used elsewhere on the page (e.g. the header logo) and must NOT be touched.
- `manifest.json`, `index.html`, `changelog.html`, and `sw.js` already
  reference `brand/icon-32.png` / `icon-180.png` / `icon-512.png` by those
  exact filenames — keep the filenames identical so no other file needs to
  change.
- Output PNGs must exactly match their current pixel dimensions:
  `icon-32.png` = 32x32, `icon-180.png` = 180x180, `icon-512.png` = 512x512,
  all 8-bit RGBA PNG with transparency support preserved (background is
  opaque white in this design, but the format must stay RGBA to match the
  existing files and the `"purpose": "any maskable"` manifest entry for the
  512 icon).
- Use only `rsvg-convert` (already installed via Homebrew in this session)
  to rasterize the SVG — no other new dependencies.
- Preserve the existing brand palette: navy `#062448` (matches
  `--brand-navy` in `styles.css`) for line art, red `#a3301f` (matches
  `--brand-red`) used sparingly for the baseball stitching accent, white
  background consistent with the current icon style.
- No code changes are needed elsewhere in the repo — this is an asset swap.

## Step-by-Step Implementation Plan
1. Place the approved SVG source at `brand/icon-source.svg` in the repo (256
   viewBox units of margin/design already tuned so the icon reads clearly at
   32px, 180px, and 512px — see the SVG content below).
2. Render three PNGs from that SVG with `rsvg-convert`, at exactly 32x32,
   180x180, and 512x512, and overwrite `brand/icon-32.png`,
   `brand/icon-180.png`, `brand/icon-512.png` respectively.
3. Verify each output file's dimensions and color mode with `file` (or
   `sips -g pixelWidth -g pixelHeight -g format`) and confirm they match the
   sizes above.
4. Confirm no other tracked file changed (`git status --short` should show
   only the three PNGs modified and `brand/icon-source.svg` added).

### SVG source to render (write exactly this to `brand/icon-source.svg`):
```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="#ffffff"/>
  <rect x="216" y="118" width="80" height="46" rx="12" fill="none" stroke="#062448" stroke-width="18" stroke-linejoin="round"/>
  <rect x="128" y="140" width="256" height="300" rx="22" fill="#ffffff" stroke="#062448" stroke-width="20" stroke-linejoin="round"/>
  <line x1="168" y1="222" x2="344" y2="222" stroke="#062448" stroke-width="16" stroke-linecap="round"/>
  <line x1="168" y1="266" x2="344" y2="266" stroke="#062448" stroke-width="16" stroke-linecap="round"/>
  <line x1="168" y1="310" x2="300" y2="310" stroke="#062448" stroke-width="16" stroke-linecap="round"/>
  <circle cx="356" cy="382" r="76" fill="#ffffff" stroke="#062448" stroke-width="18"/>
  <path d="M 310 336 A 76 76 0 0 0 310 428" fill="none" stroke="#a3301f" stroke-width="9" stroke-linecap="round"/>
  <path d="M 402 336 A 76 76 0 0 1 402 428" fill="none" stroke="#a3301f" stroke-width="9" stroke-linecap="round"/>
</svg>
```

Exact commands (run from repo root):
```bash
rsvg-convert -w 32  -h 32  brand/icon-source.svg -o brand/icon-32.png
rsvg-convert -w 180 -h 180 brand/icon-source.svg -o brand/icon-180.png
rsvg-convert -w 512 -h 512 brand/icon-source.svg -o brand/icon-512.png
```

## File List
- `brand/icon-source.svg` — new: vector source for the app icon (clipboard +
  baseball design), kept in the repo so the icon can be re-rendered/edited
  later without regenerating from scratch.
- `brand/icon-32.png` — modified: rasterized from `icon-source.svg` at
  32x32 (browser favicon).
- `brand/icon-180.png` — modified: rasterized from `icon-source.svg` at
  180x180 (iOS apple-touch-icon / home-screen icon).
- `brand/icon-512.png` — modified: rasterized from `icon-source.svg` at
  512x512 (PWA manifest icon, `purpose: any maskable`).

## Acceptance Criteria
1. `brand/icon-32.png` is a 32x32 PNG, `brand/icon-180.png` is a 180x180
   PNG, `brand/icon-512.png` is a 512x512 PNG (verified with `file` or
   `sips`).
2. All three PNGs visibly show the new clipboard-plus-baseball design (navy
   line art, red stitching accent, white background) and not the old
   maple-leaf/home-plate crest.
3. `brand/icon-source.svg` exists in the repo and matches the SVG source
   above.
4. `manifest.json`, `index.html`, `changelog.html`, and `sw.js` are
   byte-for-byte unchanged (`git diff` shows no hunks in these files) — the
   filename contract is preserved so no other file needed edits.
5. `brand/crest.png`, `brand/mark.png`, and `brand/wordmark.png` are
   unchanged (`git diff` shows no hunks for these files).
6. At 32px the icon is still legible as a distinct shape (clipboard outline
   + circular baseball), not a blurred mass — confirmed visually.
