N7-Code — Build 32 Production Architecture Candidate

This build consolidates the production source without changing the locked product direction.

Architecture
- JS runtime split into seven ordered modules: core, preview, editor, tools, compat runtime, projects, main.
- Real-project hosted runtime uses N7-branded cache/path/header/message identifiers.
- Legacy MF storage keys and .mfcode project files remain read-compatible; new writes use N7 identifiers and .n7-code.
- Build-history CSS comments removed and safely superseded declarations pruned without reordering the cascade.

UX cleanup
- Library state label is IN PROJECT.
- Library action slot has fixed geometry in + / ✓ / IN PROJECT states.
- Google Fonts explicitly explains that fonts are made available to preview and must be applied in CSS.

QA included
- tests/audit.mjs: syntax, module references, duplicate functions, active legacy identifiers, CSS history, package fixture checks.
- tests/runtime-smoke.mjs: sequential browser-script structure smoke test in an isolated VM before app initialization.
- fixtures: cache-busted CSS + local font/assets, multi-page CSS ordering, ES modules + dynamic import + fetch, and a 20,000-line CSS stress file.

FULL PROJECT runtime still requires HTTPS (GitHub Pages is appropriate). file:// uses compatibility mode.
