Your previous icon design was rejected by the user after review. Quote from
the user: "the proposed icons are not accepted. it should include a baseball
bat, ball and a clipboard. The ones proposed were not adequate and more
confusing than anything." The revised design below fixes this by adding a
clearly separate bat-and-ball badge (crossed bats behind a baseball, the
same visual language as the existing `brand/crest.png` team crest) instead
of a single ball awkwardly merged into the clipboard's corner.

**Same constraint as before: you have NO shell access this turn.** Do not
attempt to run `rsvg-convert`, `git`, `file`, or any other command. Use ONLY
the Write tool.

Overwrite `brand/icon-source.svg` with EXACTLY this content (byte-for-byte —
do not reformat, reindent, or modify the design):

```svg
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="512" height="512" rx="112" ry="112" fill="#ffffff"/>
  <rect x="226" y="86" width="60" height="36" rx="10" fill="none" stroke="#062448" stroke-width="17" stroke-linejoin="round"/>
  <rect x="96" y="110" width="320" height="320" rx="24" fill="#ffffff" stroke="#062448" stroke-width="18" stroke-linejoin="round"/>
  <line x1="130" y1="172" x2="330" y2="172" stroke="#062448" stroke-width="15" stroke-linecap="round"/>
  <line x1="130" y1="208" x2="330" y2="208" stroke="#062448" stroke-width="15" stroke-linecap="round"/>
  <line x1="130" y1="244" x2="260" y2="244" stroke="#062448" stroke-width="15" stroke-linecap="round"/>
  <line x1="330" y1="415" x2="430" y2="315" stroke="#062448" stroke-width="17" stroke-linecap="round"/>
  <line x1="430" y1="415" x2="330" y2="315" stroke="#062448" stroke-width="17" stroke-linecap="round"/>
  <circle cx="330" cy="415" r="12" fill="#062448"/>
  <circle cx="430" cy="415" r="12" fill="#062448"/>
  <circle cx="380" cy="350" r="44" fill="#ffffff" stroke="#062448" stroke-width="14"/>
  <path d="M 345 317 A 44 44 0 0 0 345 383" fill="none" stroke="#a3301f" stroke-width="7" stroke-linecap="round"/>
  <path d="M 415 317 A 44 44 0 0 1 415 383" fill="none" stroke="#a3301f" stroke-width="7" stroke-linecap="round"/>
</svg>
```

Do not touch any other file. Do not attempt to rasterize it — the reviewer
will do that outside this session. Report back only that the file was
overwritten.
