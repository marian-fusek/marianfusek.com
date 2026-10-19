# Coaching Page Prism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the supplied FluidGlass-style prism effect to the coaching hero headline and the following statement, with no prism on later sections.

**Architecture:** Preserve the static site and semantic HTML. Move the existing intro copy into a large-type statement section after the hero, and mount a focused local WebGL/vanilla-JS prism on exactly those two text targets. Leave existing scroll reveal ownership in `script.js` unchanged except for initialization of the new effect.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, WebGL2, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-18-coaching-prism-design.md`

## Global Constraints

- Edit the authoritative repository root only; do not read from or write to `staging/`.
- Do not add React, a CDN dependency, a package/build system, or a second page entry point.
- Preserve exact intro copy and accessible DOM text; canvas output is decorative.
- Keep prism behavior to the hero headline and statement; later sections have no prism.
- Keep the existing coaching reveal/scroll code as the sole owner of opacity, clip-path, and scroll transitions.
- Respect reduced motion and provide a readable fallback when WebGL2 is unavailable.

## Review Focus

- Browser lacks WebGL2: original text remains visible and unobstructed.
- Reduced-motion preference: prism motion is disabled while content remains readable.
- Narrow viewport or resize: canvas and text texture stay aligned to the host.
- Fast scroll/unload: observers and animation frames are cleaned up without affecting later sections.
- Pointer leaves the two hosts: prism stops following and does not intercept links or scroll input.

---

### Task 1: Establish structure and behavior tests

**Files:**
- Create: `tests/coaching-prism.test.mjs`
- Modify: `coaching.html`

**Interfaces:**
- Produces exactly two `[data-prism-text]` targets: the main hero title and the statement copy.
- Produces `#coaching-statement` between `#coaching-top` and `#coaching-for`.

- [ ] **Step 1: Write failing tests** asserting the exact statement copy appears once in `#coaching-statement`, is absent from the hero, the hero credentials remain, and exactly the title and statement have prism targets.
- [ ] **Step 2: Run `node --test tests/coaching-prism.test.mjs` and confirm the assertions fail because the statement section and prism targets do not yet exist.**
- [ ] **Step 3: Update `coaching.html`** by moving the exact paragraph into a large-type statement section after the hero, adding the two prism target markers, and pointing the hero scroll cue at the new section. Keep the existing coaching nav link to `#coaching-for`.
- [ ] **Step 4: Re-run the focused test and confirm it passes; run `git diff --check`.**

### Task 2: Implement the local prism renderer

**Files:**
- Create: `fluid-glass.js`
- Create: `fluid-glass.css`
- Create/modify: `tests/coaching-prism.test.mjs`

**Interfaces:**
- `mountFluidGlass(target: HTMLElement): () => void` initializes one canvas and returns its cleanup function.
- Page bootstrap selects `[data-prism-text]` targets only; initialization of one target must not affect another.

- [ ] **Step 1: Add failing tests** for two-target-only initialization, WebGL2 fallback, and reduced-motion handling through small exported/testable setup helpers or source-level DOM contract assertions.
- [ ] **Step 2: Run the focused test and confirm it fails for the missing renderer/contract.**
- [ ] **Step 3: Implement `fluid-glass.js`** using the supplied FluidGlass prism/refraction shader and follow interaction, with no idle drift, click morphing, or media source. Derive text texture from each target’s actual rendered lines and font; keep semantic text in the DOM and canvas `aria-hidden`. Respect reduced motion, resize, pointer leave, and resource cleanup.
- [ ] **Step 4: Add minimal `fluid-glass.css`** for a transparent, pointer-pass-through canvas layer that tracks its target and cannot alter layout.
- [ ] **Step 5: Run focused tests and `node --check fluid-glass.js`; confirm both pass.**

### Task 3: Integrate, tune layout, and verify

**Files:**
- Modify: `coaching.html`
- Modify: `style.css`
- Modify: `script.js`
- Modify: `tests/coaching-prism.test.mjs`

**Interfaces:**
- Coaching page loads the local prism module and stylesheet with cache-busting versions.
- The new statement uses the existing 12-column page grid and is included in existing coaching section scroll reveals.

- [ ] **Step 1: Add failing integration assertions** for stylesheet/module inclusion, the new statement’s existing reveal class, and no prism targets after `#coaching-for`.
- [ ] **Step 2: Run the focused test and confirm the integration assertions fail before wiring.**
- [ ] **Step 3: Add focused CSS** for the statement typography and grid placement; add the prism CSS/module to `coaching.html`; update `script.js` only if module initialization cannot be owned by the module itself. Do not give the prism a second scroll opacity/clip-path owner.
- [ ] **Step 4: Run `node --test tests/coaching-prism.test.mjs`, `node --test`, `node --check script.js`, `node --check fluid-glass.js`, and `git diff --check`; verify asset cache-busters match.**
- [ ] **Step 5: Review source diffs for duplicate text, targets beyond the intended two sections, listeners without cleanup, and changes to unrelated interactions.**

## Execution note

Implement natively in this session. The repository’s project instructions state that a visual preview is unavailable; report this limitation and ask the user to verify prism appearance, timing, scroll, and responsive alignment in their local preview.
