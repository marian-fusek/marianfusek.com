/* ==========================================================================
   Grid Reel — photo grid animation tool
   Vanilla JS, no build step. Everything below is one self-contained engine.
   ========================================================================== */

/* ---------- tiny helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap01 = (x) => x - Math.floor(x);
const lerp = (a, b, t) => a + (b - a) * t;

/* ==========================================================================
   1. BENTO LAYOUTS — cell placement per image count (1-6)
   ========================================================================== */
const LAYOUTS = {
  1: { rows: 1, cells: [{ c: 1, cs: 2, r: 1, rs: 1 }] },
  2: { rows: 1, cells: [{ c: 1, r: 1 }, { c: 2, r: 1 }] },
  3: { rows: 2, cells: [{ c: 1, r: 1, rs: 2 }, { c: 2, r: 1 }, { c: 2, r: 2 }] },
  4: { rows: 2, cells: [{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 2 }, { c: 2, r: 2 }] },
  5: { rows: 3, cells: [{ c: 1, r: 1, rs: 2 }, { c: 2, r: 1 }, { c: 2, r: 2 }, { c: 1, r: 3 }, { c: 2, r: 3 }] },
  6: { rows: 3, cells: [{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 1, r: 2, accent: true }, { c: 2, r: 2 }, { c: 1, r: 3 }, { c: 2, r: 3 }] }
};

/* ==========================================================================
   2. PRESETS — each render(t, i, n, k) returns a style object for tile i.
      t = loop phase 0..1 (seamless). k = { amp, stag } tuning knobs.
   ========================================================================== */
const PRESETS = [
  {
    id: "spotlight-zoom", name: "Spotlight Zoom", category: "Spotlight & Focus",
    desc: "Tiles take turns filling the frame.",
    render(t, i, n, k) {
      const active = Math.floor(t * n) % n;
      const isActive = i === active;
      return {
        transform: `scale(${isActive ? 1 + 0.07 * k.amp : 1 - 0.05 * k.amp})`,
        opacity: isActive ? 1 : 0.35,
        zIndex: isActive ? 2 : 1
      };
    }
  },
  {
    id: "center-stage", name: "Center Stage", category: "Spotlight & Focus",
    desc: "One image at a time takes the spotlight.",
    render(t, i, n, k) {
      const active = Math.floor(t * n) % n;
      const local = wrap01(t * n - Math.floor(t * n));
      const isActive = i === active;
      let op = isActive ? 1 : 0;
      if (isActive && local < 0.15) op = local / 0.15;
      if (isActive && local > 0.85) op = (1 - local) / 0.15;
      return {
        transform: `scale(${isActive ? 1 : 0.9})`,
        opacity: clamp(op, 0, 1),
        zIndex: isActive ? 2 : 1
      };
    }
  },
  {
    id: "focus-shift", name: "Focus Shift", category: "Spotlight & Focus",
    desc: "Thumbnails take turns expanding into focus.",
    render(t, i, n, k) {
      const active = Math.floor(t * n) % n;
      const isActive = i === active;
      const dx = isActive ? 0 : (i % 2 === 0 ? -5 : 5) * k.amp;
      return {
        transform: `scale(${isActive ? 1.1 : 0.88}) translateX(${dx}px)`,
        opacity: isActive ? 1 : 0.5,
        zIndex: isActive ? 3 : 1
      };
    }
  },
  {
    id: "pop-grid", name: "Pop Grid", category: "Grid Motion",
    desc: "Tiles pop in and out on their own offset cycles.",
    render(t, i, n, k) {
      const phase = wrap01(t * 2 + (i / n) * k.stag);
      const s = (Math.sin(phase * Math.PI * 2) + 1) / 2;
      return {
        transform: `scale(${0.86 + 0.16 * k.amp * s})`,
        opacity: 0.5 + 0.5 * s
      };
    }
  },
  {
    id: "flip-grid", name: "Flip Grid", category: "Grid Motion",
    desc: "Tiles flip between two states in a ripple.",
    render(t, i, n, k) {
      const phase = wrap01(t + (i / n) * k.stag * 0.6);
      const angle = Math.sin(phase * Math.PI * 2) * 26 * k.amp;
      const dim = 1 - 0.18 * Math.abs(Math.sin(phase * Math.PI * 2));
      return {
        transform: `perspective(800px) rotateY(${angle}deg)`,
        filter: `brightness(${dim})`
      };
    }
  },
  {
    id: "cascade-reveal", name: "Cascade Reveal", category: "Grid Motion",
    desc: "Grid cells wipe open in a staggered cascade.",
    render(t, i, n, k) {
      const delay = (i / n) * k.stag * 0.35;
      const local = wrap01(t - delay);
      const reveal = (Math.sin(local * Math.PI * 2) + 1) / 2 * 100;
      return { clipPath: `inset(${100 - reveal}% 0 0 0)` };
    }
  },
  {
    id: "mosaic-shuffle", name: "Mosaic Shuffle", category: "Grid Motion",
    desc: "Tiles gently swap places across the loop.",
    render(t, i, n, k) {
      const s = Math.sin(t * Math.PI * 2);
      const dir = i % 2 === 0 ? 1 : -1;
      return {
        transform: `translate(${s * 18 * k.amp * dir}px, ${s * 6 * k.amp}px)`,
        opacity: 0.85 + 0.15 * Math.cos(t * Math.PI * 4)
      };
    }
  },
  {
    id: "domino-flip", name: "Domino Flip", category: "Grid Motion",
    desc: "A flip wave topples through the grid in order.",
    render(t, i, n, k) {
      const delay = (i / n) * k.stag * 0.7;
      const local = wrap01(t - delay);
      const angle = -60 * k.amp * Math.max(0, Math.sin(local * Math.PI));
      return {
        transform: `perspective(700px) rotateX(${angle}deg)`,
        opacity: 1 - 0.35 * Math.max(0, Math.sin(local * Math.PI))
      };
    }
  },
  {
    id: "deck-peel", name: "Deck Peel", category: "Depth & Stack",
    desc: "A stacked deck where the front card peels away.",
    render(t, i, n, k) {
      const active = Math.floor(t * n) % n;
      const local = wrap01(t * n - Math.floor(t * n));
      const order = (i - active + n) % n;
      const rot = order * 2.5 * k.amp - (n * 2.5 * k.amp) / 2;
      const ty = order * 3;
      let tx = 0, extraRot = 0, op = 1;
      if (order === 0 && local > 0.55) {
        const p = (local - 0.55) / 0.45;
        tx = p * 70 * k.amp;
        extraRot = p * 18;
        op = 1 - p * 0.7;
      }
      return {
        transform: `translate(${tx}px, ${ty}px) rotate(${rot + extraRot}deg)`,
        opacity: op,
        zIndex: n - order
      };
    }
  },
  {
    id: "stack-fan", name: "Stack Fan", category: "Depth & Stack",
    desc: "Images fan out from a stack, then collapse back.",
    render(t, i, n, k) {
      const fan = (Math.sin(t * Math.PI * 2) + 1) / 2;
      const off = i - (n - 1) / 2;
      return {
        transform: `translate(${off * 16 * k.amp * fan}px, ${-Math.abs(off) * 7 * k.amp * fan}px) rotate(${off * 11 * k.amp * fan}deg)`,
        zIndex: 10 - Math.abs(off)
      };
    }
  },
  {
    id: "tilt-carousel", name: "Tilt Carousel", category: "Depth & Stack",
    desc: "The whole grid rocks like a slow 3D carousel.",
    render(t, i, n, k) {
      const phase = t + i * k.stag * 0.05;
      const angle = Math.sin(phase * Math.PI * 2) * 9 * k.amp;
      const dir = i % 2 === 0 ? 1 : -1;
      const tx = Math.sin(phase * Math.PI * 2) * 7 * k.amp * dir;
      return { transform: `perspective(1000px) rotateY(${angle}deg) translateX(${tx}px) scale(1.02)` };
    }
  },
  {
    id: "ripple-wave", name: "Ripple Wave", category: "Flow & Wave",
    desc: "A scale ripple radiates outward from the center.",
    render(t, i, n, k) {
      const dist = Math.abs(i - (n - 1) / 2);
      const phase = wrap01(t - dist * k.stag * 0.14);
      const s = (Math.sin(phase * Math.PI * 2) + 1) / 2;
      return {
        transform: `scale(${1 + 0.09 * k.amp * s})`,
        opacity: 0.7 + 0.3 * s
      };
    }
  },
  {
    id: "marquee-drift", name: "Marquee Drift", category: "Flow & Wave",
    desc: "Rows drift side to side in alternating directions.",
    render(t, i, n, k) {
      const dir = i % 2 === 0 ? 1 : -1;
      const dx = Math.sin(t * Math.PI * 2) * 12 * k.amp * dir;
      return { transform: `translateX(${dx}px)` };
    }
  },
  {
    id: "kaleido-pulse", name: "Kaleido Pulse", category: "Flow & Wave",
    desc: "Alternating tiles mirror and pulse in symmetry.",
    render(t, i, n, k) {
      const phase = wrap01(t * 2 + (i / n) * k.stag * 0.5);
      const s = (Math.sin(phase * Math.PI * 2) + 1) / 2;
      const mirror = i % 2 === 0 ? 1 : -1;
      return { transform: `scaleX(${mirror}) scale(${1 + 0.06 * k.amp * s})` };
    }
  },
  {
    id: "parallax-ambient", name: "Parallax Ambient", category: "Ambient",
    desc: "A slow, quiet drift and zoom — ambient background feel.",
    render(t, i, n, k) {
      const phase = t + i * 0.07;
      const scale = 1.04 + 0.025 * k.amp * Math.sin(phase * Math.PI * 2);
      const dy = Math.sin(phase * Math.PI * 2) * 5 * k.amp;
      return { transform: `scale(${scale}) translateY(${dy}px)` };
    }
  }
];

const PRESET_BY_ID = Object.fromEntries(PRESETS.map(p => [p.id, p]));
const CATEGORIES = [...new Set(PRESETS.map(p => p.category))];

/* ==========================================================================
   3. STATE
   ========================================================================== */
const state = {
  images: [null, null, null, null, null, null], // {src, name}
  activePreset: "pop-grid",
  ratio: "1:1",
  loopDuration: 8,
  bg: "#0c0c0c",
  padding: 6,
  radius: 3,
  gap: 3,
  amp: 1,       // intensity multiplier, 0.5-1.5
  stag: 1,      // stagger multiplier, 0-2
  playing: true,
  scrubT: 0,     // 0-1, used when paused
  startTime: performance.now()
};

/* ==========================================================================
   4. DOM refs
   ========================================================================== */
const $ = (sel) => document.querySelector(sel);
const presetListEl = $("#presetList");
const gridRoot = $("#gridRoot");
const frame = $("#frame");
const slotsEl = $("#slots");
const scrubEl = $("#scrub");
const timeLabel = $("#timeLabel");
const playBtn = $("#playBtn");
const fileInput = $("#hiddenFileInput");
const activePresetTitle = $("#activePresetTitle");

let activeSlotIndex = null;

/* ==========================================================================
   5. BUILD PRESET LIST UI
   ========================================================================== */
function buildPresetList() {
  presetListEl.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const h = document.createElement("div");
    h.className = "panel-section-title";
    h.textContent = cat;
    presetListEl.appendChild(h);

    const group = document.createElement("div");
    group.className = "preset-category";
    PRESETS.filter(p => p.category === cat).forEach(p => {
      const btn = document.createElement("button");
      btn.className = "preset-item" + (p.id === state.activePreset ? " active" : "");
      btn.dataset.id = p.id;
      btn.innerHTML = `<div class="name">${p.name}</div><div class="desc">${p.desc}</div>`;
      btn.addEventListener("click", () => {
        state.activePreset = p.id;
        document.querySelectorAll(".preset-item").forEach(el => el.classList.remove("active"));
        btn.classList.add("active");
        activePresetTitle.textContent = p.name.toUpperCase();
        rebuildTiles();
      });
      group.appendChild(btn);
    });
    presetListEl.appendChild(group);
  });
}

/* ==========================================================================
   6. GRID TILES — rebuilt when image count or preset layout changes
   ========================================================================== */
let tileEls = [];

function activeCount() {
  const c = state.images.filter(Boolean).length;
  return clamp(c, 1, 6);
}

function rebuildTiles() {
  const n = activeCount();
  const layout = LAYOUTS[n];
  gridRoot.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  gridRoot.innerHTML = "";
  tileEls = [];

  for (let i = 0; i < n; i++) {
    const cell = layout.cells[i];
    const img = state.images[i];
    const tile = document.createElement("div");
    tile.className = "tile" + (img ? "" : " empty");
    tile.style.gridColumn = `${cell.c} / span ${cell.cs || 1}`;
    tile.style.gridRow = `${cell.r} / span ${cell.rs || 1}`;
    if (cell.accent) {
      tile.style.alignSelf = "center";
      tile.style.justifySelf = "center";
      tile.style.width = "58%";
      tile.style.height = "58%";
    }
    if (img) {
      const im = document.createElement("img");
      im.src = img.src;
      tile.appendChild(im);
    } else {
      tile.textContent = `slot ${i + 1}`;
    }
    gridRoot.appendChild(tile);
    tileEls.push(tile);
  }
  applyStyleVars();
}

function applyStyleVars() {
  frame.style.setProperty("--frame-bg", state.bg);
  gridRoot.style.setProperty("--pad", state.padding + "%");
  gridRoot.style.setProperty("--gap", state.gap + "%");
  gridRoot.style.setProperty("--tile-radius", state.radius + "%");
}

/* ==========================================================================
   7. RENDER LOOP
   ========================================================================== */
function render(t) {
  const preset = PRESET_BY_ID[state.activePreset];
  const n = tileEls.length;
  const k = { amp: state.amp, stag: state.stag };
  for (let i = 0; i < n; i++) {
    const style = preset.render(t, i, n, k);
    const el = tileEls[i];
    el.style.transform = style.transform || "";
    el.style.opacity = style.opacity === undefined ? "" : style.opacity;
    el.style.filter = style.filter || "";
    el.style.clipPath = style.clipPath || "";
    el.style.zIndex = style.zIndex === undefined ? "" : style.zIndex;
  }
  scrubEl.value = t * 1000;
  timeLabel.textContent = `${(t * state.loopDuration).toFixed(1)}s / ${state.loopDuration.toFixed(1)}s`;
}

function loop(now) {
  if (state.playing) {
    const elapsed = ((now - state.startTime) / 1000) % state.loopDuration;
    state.scrubT = elapsed / state.loopDuration;
  }
  render(state.scrubT);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ==========================================================================
   8. TRANSPORT
   ========================================================================== */
playBtn.addEventListener("click", () => {
  state.playing = !state.playing;
  if (state.playing) {
    state.startTime = performance.now() - state.scrubT * state.loopDuration * 1000;
  }
  playBtn.innerHTML = state.playing ? ICON_PAUSE : ICON_PLAY;
});

$("#restartBtn").addEventListener("click", () => {
  state.scrubT = 0;
  state.startTime = performance.now();
});

scrubEl.addEventListener("input", () => {
  state.playing = false;
  playBtn.innerHTML = ICON_PLAY;
  state.scrubT = clamp(scrubEl.value / 1000, 0, 1);
});

const ICON_PLAY = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l10-5.5z"/></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z"/></svg>`;

/* ==========================================================================
   9. ASPECT RATIO
   ========================================================================== */
const RATIOS = { "16:9": 16 / 9, "4:3": 4 / 3, "1:1": 1, "4:5": 4 / 5, "9:16": 9 / 16 };
function applyRatio() {
  const r = RATIOS[state.ratio];
  const maxH = Math.min(window.innerHeight * 0.78, 720);
  const maxW = document.querySelector(".stage-wrap").clientWidth * 0.92;
  let h = maxH, w = h * r;
  if (w > maxW) { w = maxW; h = w / r; }
  frame.style.width = w + "px";
  frame.style.height = h + "px";
}
document.querySelectorAll(".ratio-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".ratio-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.ratio = btn.dataset.ratio;
    applyRatio();
  });
});
window.addEventListener("resize", applyRatio);

/* ==========================================================================
   10. MEDIA SLOTS — upload, drag/drop, remove
   ========================================================================== */
function buildSlots() {
  slotsEl.innerHTML = "";
  state.images.forEach((img, idx) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.innerHTML = img
      ? `<img class="slot-thumb" src="${img.src}" />
         <div class="slot-info"><div class="label">Slot ${idx + 1}</div><div class="sub">${img.name}</div></div>
         <button class="slot-remove" title="Remove">&times;</button>`
      : `<div class="slot-thumb placeholder">+</div>
         <div class="slot-info"><div class="label">Slot ${idx + 1}</div><div class="sub">Click or drop image</div></div>`;

    slot.addEventListener("click", (e) => {
      if (e.target.closest(".slot-remove")) return;
      activeSlotIndex = idx;
      fileInput.click();
    });
    if (img) {
      slot.querySelector(".slot-remove").addEventListener("click", (e) => {
        e.stopPropagation();
        state.images[idx] = null;
        buildSlots();
        rebuildTiles();
      });
    }
    ["dragover", "dragleave", "drop"].forEach(evt => {
      slot.addEventListener(evt, (e) => {
        e.preventDefault();
        if (evt === "dragover") slot.classList.add("drag-over");
        if (evt === "dragleave") slot.classList.remove("drag-over");
        if (evt === "drop") {
          slot.classList.remove("drag-over");
          const file = e.dataTransfer.files[0];
          if (file) loadFileToSlot(file, idx);
        }
      });
    });
    slotsEl.appendChild(slot);
  });
}

function loadFileToSlot(file, idx) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.images[idx] = { src: reader.result, name: file.name };
    buildSlots();
    rebuildTiles();
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file && activeSlotIndex !== null) loadFileToSlot(file, activeSlotIndex);
  fileInput.value = "";
});

$("#clearImagesBtn").addEventListener("click", () => {
  state.images = [null, null, null, null, null, null];
  buildSlots();
  rebuildTiles();
});

/* ==========================================================================
   11. CONTROLS — timing + look
   ========================================================================== */
function bindRange(id, key, valueEl, fmt = (v) => v) {
  const el = $(id);
  el.addEventListener("input", () => {
    state[key] = parseFloat(el.value);
    if (valueEl) $(valueEl).textContent = fmt(state[key]);
    applyStyleVars();
  });
}
bindRange("#paddingRange", "padding", "#paddingVal", v => v + "%");
bindRange("#radiusRange", "radius", "#radiusVal", v => v + "%");
bindRange("#gapRange", "gap", "#gapVal", v => v + "%");
bindRange("#ampRange", "amp", "#ampVal", v => Math.round(v * 100) + "%");
bindRange("#stagRange", "stag", "#stagVal", v => Math.round(v * 100) + "%");

$("#bgColor").addEventListener("input", (e) => {
  state.bg = e.target.value;
  $("#bgHex").value = e.target.value;
  applyStyleVars();
});
$("#bgHex").addEventListener("change", (e) => {
  state.bg = e.target.value;
  $("#bgColor").value = e.target.value;
  applyStyleVars();
});

document.querySelectorAll(".chip[data-loop]").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".chip[data-loop]").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    state.loopDuration = parseFloat(chip.dataset.loop);
    state.startTime = performance.now() - state.scrubT * state.loopDuration * 1000;
    $("#loopVal").textContent = state.loopDuration.toFixed(1) + "s";
  });
});

/* ==========================================================================
   12. EXPORT — standalone self-contained HTML embed
   ========================================================================== */
$("#exportBtn").addEventListener("click", () => {
  const n = activeCount();
  if (n === 0 || state.images.every(i => !i)) {
    alert("Add at least one image before exporting.");
    return;
  }
  const preset = PRESET_BY_ID[state.activePreset];
  const layout = LAYOUTS[n];
  const imgs = state.images.slice(0, n).map(i => i ? i.src : "");

  const html = buildExportHTML({
    imgs, layout, renderFn: preset.render.toString(),
    loopDuration: state.loopDuration, bg: state.bg,
    padding: state.padding, radius: state.radius, gap: state.gap,
    amp: state.amp, stag: state.stag, ratio: state.ratio
  });

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grid-reel-${preset.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
});

function buildExportHTML({ imgs, layout, renderFn, loopDuration, bg, padding, radius, gap, amp, stag, ratio }) {
  const cellsJSON = JSON.stringify(layout.cells);
  const imgsJSON = JSON.stringify(imgs);
  const ratioParts = ratio.split(":").map(Number);
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Grid Reel Embed</title>
<style>
  html,body{margin:0;background:transparent;}
  .gr-frame{position:relative;width:100%;max-width:640px;aspect-ratio:${ratioParts[0]}/${ratioParts[1]};background:${bg};border-radius:4px;overflow:hidden;margin:0 auto;}
  .gr-grid{position:absolute;inset:0;padding:${padding}%;display:grid;gap:${gap}%;grid-auto-rows:1fr;}
  .gr-tile{position:relative;overflow:hidden;border-radius:${radius}%;}
  .gr-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}
</style></head>
<body>
<div class="gr-frame"><div class="gr-grid" id="grGrid"></div></div>
<script>
(function(){
  var cells = ${cellsJSON};
  var imgs = ${imgsJSON};
  var loopDuration = ${loopDuration};
  var k = { amp: ${amp}, stag: ${stag} };
  var render = ${renderFn};
  var grid = document.getElementById('grGrid');
  var rows = Math.max.apply(null, cells.map(function(c){return (c.r||1)+(c.rs||1)-1;}));
  grid.style.gridTemplateRows = 'repeat('+rows+', 1fr)';
  grid.style.gridTemplateColumns = '1fr 1fr';
  var tiles = imgs.map(function(src, i){
    var cell = cells[i];
    var tile = document.createElement('div');
    tile.className = 'gr-tile';
    tile.style.gridColumn = cell.c + ' / span ' + (cell.cs||1);
    tile.style.gridRow = cell.r + ' / span ' + (cell.rs||1);
    if (cell.accent) { tile.style.alignSelf='center'; tile.style.justifySelf='center'; tile.style.width='58%'; tile.style.height='58%'; }
    var im = document.createElement('img'); im.src = src; tile.appendChild(im);
    grid.appendChild(tile);
    return tile;
  });
  var start = performance.now();
  function loop(now){
    var t = ((now-start)/1000 % loopDuration) / loopDuration;
    var n = tiles.length;
    for (var i=0;i<n;i++){
      var s = render(t, i, n, k);
      var el = tiles[i];
      el.style.transform = s.transform || '';
      el.style.opacity = s.opacity===undefined ? '' : s.opacity;
      el.style.filter = s.filter || '';
      el.style.clipPath = s.clipPath || '';
      el.style.zIndex = s.zIndex===undefined ? '' : s.zIndex;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
<\/script>
</body></html>`;
}

/* ==========================================================================
   13. INIT
   ========================================================================== */
buildPresetList();
buildSlots();
rebuildTiles();
applyRatio();
activePresetTitle.textContent = PRESET_BY_ID[state.activePreset].name.toUpperCase();
playBtn.innerHTML = ICON_PAUSE;
