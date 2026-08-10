N7-Code — Build 31

Core stability / performance build.

This build focuses only on four previously-open issues:
- canonical viewport sizing so the top bar/workspace/footer cannot drift outside the browser viewport;
- HTML entry-page isolation inside real folder projects so switching pages cannot reuse the previous page runtime/styles;
- precise curated-library detection (PROJECT is shown only for dependencies actually referenced by the project);
- large-file editor virtualization for very large HTML/CSS/JS files, reducing line-number and syntax-paint work to the visible viewport.

Large-file mode is automatic. The UI and editing model do not change.

For FULL PROJECT runtime testing, serve N7-Code over HTTPS (for example GitHub Pages) so the included service worker can control the virtual project runtime. Double-click/file:// remains LOCAL COMPAT mode.
