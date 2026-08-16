# Grid Reel

Photo grid animator. Upload up to 6 images, pick from 15 motion presets, tune
timing/spacing, export a self-contained HTML embed. No backend, no build step,
no dependencies — three static files.

## Run locally
Open `index.html` directly, or serve it:
```
python3 -m http.server 8000
```

## Deploy to GitHub Pages (marianfusek.com)
Two easy options:

**A — subfolder on your existing site repo**
Drop these 3 files into e.g. `tools/grid-reel/` in your marianfusek.com repo,
commit, push. It'll be live at `marianfusek.com/tools/grid-reel/`.

**B — its own repo + subdomain**
New repo → push these files → enable Pages (Settings → Pages → deploy from
`main` branch, root) → add a CNAME record at your DNS (Forpsi) pointing
`grid.marianfusek.com` (or whatever) at `<username>.github.io` → add a
`CNAME` file to the repo containing that subdomain.

## How export works
Uploaded images are never sent anywhere — everything runs client-side in the
browser (FileReader → data URLs). "Export embed" bakes the current preset,
images (as base64), and a ~40-line playback engine into one standalone HTML
file you can paste into a Squarespace code block or host anywhere.

## Adding your own preset
Open `script.js`, add an object to the `PRESETS` array with an `id`, `name`,
`category`, `desc`, and a `render(t, i, n, k)` function returning a style
object (`transform`, `opacity`, `filter`, `clipPath`, `zIndex`). `t` is loop
phase 0–1 and must be seamless at the wrap (use integer multiples of `t` in
any `sin`/`cos`). `k.amp` and `k.stag` are the Intensity/Stagger sliders.
