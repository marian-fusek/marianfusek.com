MARIAN FUSEK WEBSITE — V155

LIVE
- Root /index.html, /style.css and /script.js remain byte-for-byte unchanged from V154 / the V139 live homepage.

STAGING — SELECTED WORKS 100%
- Rebuilt Selected Works as a native-scroll, pinned full-screen sequence.
- Removed the global wheel interception and delayed synthetic scrolling from staging. The browser now owns the scroll position.
- Each project receives the whole viewport and uses only its first image.
- Five distinct art-directed compositions adapt the image, title, discipline and description to the project rather than forcing one card template.
- Two recycled visual slots handle transitions, keeping only the current and next projects active at full visual weight.
- Project transitions use continuous cross-resolution, directional image movement, a light graphic seam and a project-specific stage graphic system.
- The bottom progress instrument spans the viewport, fills continuously with scroll, marks all five chapters and supports direct project navigation.
- Hovering the active composition adds restrained multi-layer depth; clicking opens the existing project detail through a shared-element expansion into an inset rounded window.
- Closing reverses to the exact project chapter and scroll position.
- Desktop and touch/mobile have separately tuned compositions.
- Remaining homepage sections were not redesigned in this pass.

PERFORMANCE / QA
- Native entry from hero into Selected Works: ~16.67 ms average frame time, 16.8 ms p95 in the Chromium validation run; no entry long task.
- Settled desktop sequence: ~17.66 ms average frame time, 16.8 ms p95.
- Settled mobile sequence: ~16.67 ms average frame time, 16.7 ms p95.
- Verified at 1280×800, 1440×1000, 1728×1117 and 390×844.
- Verified continuous progress, marker navigation, real pointer click, project opening, project closing and exact scroll restoration.
- /staging/staging.js and root /script.js pass node --check.
- No runtime exceptions in desktop or mobile render validation.
