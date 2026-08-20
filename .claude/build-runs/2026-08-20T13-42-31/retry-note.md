Your previous attempt was cancelled before any file was written (this
matches a known issue: your headless shell tool is unavailable in this
environment, and any `Bash(...)` call silently cancels the turn).

**New constraint: you have NO shell access this turn.** Do not attempt to
run `rsvg-convert`, `git`, `file`, or any other command — every such attempt
will cancel the turn again with nothing accomplished. Use ONLY the Write
tool for this turn.

Do exactly this and nothing else:

Create the file `brand/icon-source.svg` with EXACTLY this content
(byte-for-byte — do not reformat, reindent, or modify the design):

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

Do not touch any other file. Do not attempt to rasterize it — that step
will be done by the reviewer outside this session. Report back only that
the file was written.
