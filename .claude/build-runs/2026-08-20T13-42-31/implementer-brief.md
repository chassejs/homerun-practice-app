# Implementer Brief: Homerun Practice app icon replacement

## Goal
Replace the Homerun Practice app icon (favicon, apple-touch-icon, and PWA
manifest icons) with a new design that reflects what this app does — build a
timed baseball practice plan — instead of the current generic
maple-leaf/home-plate crest. The exact SVG design has already been approved;
your job is purely mechanical: write the SVG file and rasterize it into the
three existing PNG filenames with `rsvg-convert` (already installed on this
machine via Homebrew — confirm with `which rsvg-convert` if you want, but do
not install anything).

## Constraints
- Do NOT change any file other than these four:
  - `brand/icon-source.svg` (new file)
  - `brand/icon-32.png` (overwrite)
  - `brand/icon-180.png` (overwrite)
  - `brand/icon-512.png` (overwrite)
- Do NOT touch `brand/crest.png`, `brand/mark.png`, `brand/wordmark.png`,
  `manifest.json`, `index.html`, `changelog.html`, `sw.js`, or any other file.
  Those already reference the icon files by the exact filenames above, so no
  other file needs to change.
- Output PNGs must be exactly 32x32, 180x180, and 512x512 pixels
  respectively, RGBA.
- Use only `rsvg-convert` to rasterize. No other new dependencies.

## Step-by-Step Implementation Plan
1. Create `brand/icon-source.svg` with EXACTLY this content (byte-for-byte,
   do not modify the design):

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

2. Run these exact three commands from the repo root to overwrite the icon
   PNGs:

```bash
rsvg-convert -w 32  -h 32  brand/icon-source.svg -o brand/icon-32.png
rsvg-convert -w 180 -h 180 brand/icon-source.svg -o brand/icon-180.png
rsvg-convert -w 512 -h 512 brand/icon-source.svg -o brand/icon-512.png
```

3. Verify each output PNG's dimensions with `file brand/icon-32.png
   brand/icon-180.png brand/icon-512.png` and confirm 32x32 / 180x180 /
   512x512 respectively.

4. Run `git status --short` and confirm only the four files listed above
   show as changed/new — nothing else.

## Acceptance Criteria
1. `brand/icon-32.png` is 32x32 PNG.
2. `brand/icon-180.png` is 180x180 PNG.
3. `brand/icon-512.png` is 512x512 PNG.
4. `brand/icon-source.svg` exists and matches the SVG content above exactly.
5. No other tracked file is modified.
6. All three PNGs render the new clipboard+baseball design (navy line art,
   red stitching accent, white background), not the old maple-leaf crest.
