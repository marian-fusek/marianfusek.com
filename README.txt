MARIAN FUSEK WEBSITE — V153

LIVE
- Root /index.html, /style.css and /script.js remain byte-for-byte identical to V139.

STAGING
- /staging/index.html is the only redesigned experience.
- Rebuilt homepage into a full-screen stage system with quiet numbered wayfinding instead of large standalone section headers.
- INDEX now uses adaptive rows: the active project becomes a large outer window, neighboring rows yield space, and preview media preserves each image's real aspect ratio.
- Guidance now uses a deterministic 76/24 focus transfer: the active chapter gains spatial authority while the inactive chapter collapses and its typography scales down.
- AFTER HOURS now uses the same adaptive-window grammar as INDEX without exposing the original strip corners; icons use a slightly tighter iOS squircle and preview imagery is rounded.
- ART now enters directly as a full-screen stage with no section separator or framed gallery stroke; footer continues without a divider.
- All staging typography is Geist regular/system weights; Geist Mono is no longer used in the staging UI.
- Hero accents use nested real Á / Ů glyph overlays, preserving the original glyph position while fading only.
- Hero grid is constrained to the hero and dissolves before INDEX.
- OPEN cursor remains a filled difference-blended circle on INDEX, Guidance and ART.
- XP particles have stronger visibility.

VALIDATION
- staging.js passes node --check.
- Desktop hover states were rendered and reviewed for INDEX, Guidance, AFTER HOURS and ART.
- Mobile stage layouts were rendered at 390px with no horizontal overflow.
