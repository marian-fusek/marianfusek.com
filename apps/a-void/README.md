# A‑Void landing page

Designed for:
`marianfusek.com/apps/a-void`

## Files
- `index.html`
- `styles.css`
- `script.js`
- `assets/`

No build step is required. Open `index.html` directly or serve the folder from any static host.

## Before publishing
1. In `script.js`, set `CONFIG.appStoreURL` to the final App Store URL.
2. Confirm these site routes exist or update the footer links:
   - `/apps/a-void/privacy`
   - `/apps/a-void/support`
   - `/apps/a-void/terms`
3. The page loads General Sans from Fontshare. No font files are bundled.
4. Replace or add App Store screenshots in `assets/` if you want the final gallery to use the full approved screenshot set.

## Motion
The hero uses a lightweight JavaScript gravitational field. `prefers-reduced-motion` disables continuous movement and keeps the composition static.
