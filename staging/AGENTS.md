# Marian Fusek portfolio — project instructions

This is a hand-built static portfolio site. The working files are:

- `index.html` — page structure and content
- `style.css` — all visual styling, responsive rules, layout, masks, wipes, and cursor presentation
- `script.js` — interaction state, smooth scrolling, scroll-driven sections, project details, overlays, media, and animation timing
- `media/` — local images and videos grouped by project

The user normally previews `staging/index.html` directly or through a local server. Preserve that workflow. Do not create a second competing `index.html`, staging folder, or alternate preview entry point.

## Working relationship and response style

- The user is a designer, not a developer. Make the requested change directly and report the result briefly.
- Do not give a long explanation instead of implementing a requested fix.
- If the user asks “answer first,” answer the question before changing anything.
- If the request is clear, do not ask unnecessary clarifying questions.
- When a request is ambiguous in a way that could materially change the design, ask one short question before editing.
- Treat screenshots and visual references as precise layout requirements, not loose inspiration.
- Preserve existing work unless the user explicitly asks to revert, remove, replace, or start from scratch.
- Never add unrequested copy, descriptions, controls, rounded corners, backgrounds, panels, or visual effects.

## Editing and debugging discipline

Before editing:

1. Inspect the current `index.html`, `style.css`, and `script.js`.
2. Search for every rule, class, listener, and state involved in the requested behavior.
3. Identify the current owner of layout, visibility, transform, opacity, clipping, and scroll progress.
4. Remove or replace obsolete competing rules rather than layering another override on top.
5. Make the smallest clean change that gives one source of truth for the behavior.

After editing:

- Check `git diff` and `git diff --check`.
- Run `node --check script.js` after JavaScript changes.
- Confirm the cache-busting query strings in `index.html` point to the edited assets.
- If a visual behavior is changed, test both forward and reverse scrolling, fast and slow scrolling, resize, refresh, project open, project close, and Escape where applicable.
- Verify that an interaction is not being controlled simultaneously by CSS, scroll code, an overlay, and a second animation system.
- Do not report “fixed” without checking the actual current code path.

## Product vocabulary

Use these terms consistently:

- **HP / hero** — the first viewport with the MF monogram/name, top menu, role block, and large background treatment.
- **MF / monogram** — the top-left compact Marian Fusek mark.
- **expanded name** — the full “MARIAN FUSEK” wordmark state of the hero name.
- **Recent Works** — the project slideshow section after the hero.
- **project info** — the title, description, tag/type, and progress information paired with the current project.
- **mask** — the fixed visible boundary/window that reveals a media element. The mask must not scale when the media inside it scales.
- **wipe in** — a clip reveal into a stable final position. It must not slide the element into position unless explicitly requested.
- **wipe out** — a clip removal out of the viewport. On forward/downward reading it normally exits toward the top; on reverse/upward reading it exits toward the bottom.
- **top wipe** — text reveals from top to bottom.
- **bottom wipe out** — text/content leaves by wiping toward the bottom.
- **project detail / overlay** — the project-specific view layered over the HP, with its own content and scrolling. It must behave as a proper page-like view while open.
- **services** — the numbered “What I do” section after Recent Works.
- **body text** — the small grey project-detail copy style used for explanatory paragraphs.

## Typography shorthand

The user may refer to these sizes without repeating the definition:

- **1** — Recent Works / primary section label size.
- **2** — project title size beside Recent Works.
- **2G** — the same size as 2, but grey (project descriptions and similar secondary copy).
- **3** — project-detail metadata label size (`Year`, `Role`, `Type`, `Team`, `Deliverables`).
- **3G** — the grey value beneath a 3 label.
- **tag** — a separate style for project type/tag copy. It should visually match the slideshow description unless the user asks for a distinct adjustment.
- Keep descriptions in normal sentence case unless the user explicitly requests capitals/all caps.
- Do not distort type to force a fit. Adjust size, available width, gap, or responsive layout while preserving normal proportions.
- The typography system should use shared variables/classes, not one-off random sizes.

## Naming and copy conventions

- Use `MIUNĀE` with the macron when referring to the project title.
- Use `GoBaller` in display copy; use `GOBALLER` only where an all-caps visual asset or explicit request requires it.
- Use `AIMS` in display copy.
- Preserve exact user-provided punctuation, arrows, capitalization, and line breaks.
- Project order on the homepage is currently MIUNĀE, GoBaller, AIMS unless the user changes it.
- Project numbering is project-specific and should update with the active slide when present.
- Do not add a fourth project when the user says there are three.

## Hero rules

- The MF monogram/name is aligned to the left padding and bottom rhythm of the hero.
- The expanded name should remain within the viewport and should not push the final `K` off-screen.
- Hover behavior belongs to the name hit area only, not the whole bottom panel or page.
- Hover must register when entering from every side of the visible name.
- The name’s variable font-weight behavior is intentional: follow the latest explicit direction from the user about which area is lighter/heavier.
- On initial load, follow the latest explicit direction about whether the name is expanded or collapsed; do not reintroduce an old initial animation accidentally.
- The right role block (for example “Brand, UI, AI & Visual Designer”) must align to the requested hero baseline and must not be independently repositioned by unrelated overlay/project-detail code.
- Hero video/media must not remove the established background color or hide the bottom hero objects.

## Recent Works / homepage project slideshow

- The viewport/section choreography is intentional: hero first, then an empty/background transition, then Recent Works, then the project media states.
- Keep the section ownership isolated. Recent Works should not begin while hero content is still visibly active unless explicitly requested.
- The current project media uses a stable mask. Animate the image/video inside it; never scale or move the mask as a side effect of media scaling.
- Preserve aspect ratio. Do not use `object-fit: cover` when the user asks to see the full image; use a fitting strategy that preserves the requested AR.
- Project media reveal directions follow the current explicit sequence. Do not resurrect an old direction sequence after the user changes it.
- The progress bar is functional scroll state, not decoration. Keep its tracking synchronized with the active project and place it on the requested vertical baseline (usually alongside description/type information).
- Keep its width, thickness, color, and alignment in shared variables so later changes do not require multiple overrides.
- Project title, description, tag, and progress bar should enter/leave as a coordinated info group without independent clipping that causes cut-off text.
- Text should reveal from the correct side based on direction of travel. Forward/downward entry is normally a top wipe; reverse/upward entry is normally a bottom wipe-out/reveal.
- Do not replay wipe-out repeatedly on every wheel event. Use a single section state/transition owner with guarded direction changes.
- If a transition is automatic rather than scroll-scrubbed, let it finish at the defined slower timing before releasing the next state.

## Project details / overlays

- Opening a project is an overlay/new view, not a second unrelated page. Keep the underlying HP state stable.
- The overlay must have its own scroll container/state and must not create an unwanted second visible scrollbar or horizontal jump.
- Preserve the scroll position where the project was opened. Closing should return to that exact state without jumping through hero or resetting unrelated text positions.
- Opening and closing use the agreed two-wipe choreography: clear the relevant stage, then reveal the new view/content. Closing is the reverse: wipe out the overlay content first, then reveal the underlying page.
- The first closing wipe must remove all project-detail content, including X, media, text, and galleries; only the persistent MF element may remain when requested.
- Do not add a second X or a second menu-reappearance layer. X visibility and cursor snapping must have one owner.
- While an overlay is open, hide the homepage menu when requested, show X in the top-right, and ensure cursor hover states remain visible against the overlay background.
- Escape and clicking X should use the same close path. Closing mid-animation should reverse from the current visual state rather than jump to a completed/maximized state.
- Project detail content should wipe in as it enters the viewport. The polished left/right gallery companion text is an exception only when the user explicitly says to preserve its existing behavior.
- Use shared body/metadata/title styles; do not duplicate the same text in overlay and homepage just to animate it.

## Media and gallery rules

- Resolve media paths from the actual `media/` folders before editing. Do not invent filenames.
- If a JPG and MP4 share a base filename and the user says to prefer video, do not load the JPG duplicate.
- Videos that are requested to loop should loop natively and remain muted unless audio is explicitly requested.
- Preserve image/video aspect ratio and avoid cropping unless the user specifically asks for cropping.
- For horizontal galleries, keep rows independently moving in the requested directions and preserve equal spacing between items.
- For stacked/vertical galleries, use a real gallery container with explicit spacing. Do not leave invisible masks, placeholder heights, or old scroll spacers above/below it.
- Mobile must remain usable: no tiny cascading cards, no accidental horizontal overflow, and no important content hidden by desktop-only widths.
- Responsive behavior should be fluid for desktop down through tablet/mobile breakpoints; do not create an unnecessary special tablet composition.

## Layout and grid language

- The site uses a 12-column mental grid, named A–L from left to right.
- When the user says `A-C`, `D-F`, `G-I`, `J-L`, or similar, align the visible edge of the element/mask to that column span.
- “Aligned to the image” means aligned to the visible mask edge, not an internal image crop or an invisible wrapper.
- “Same vertical line” means use the same actual grid anchor, not a visually similar percentage calculated in a second container.
- Keep page padding consistent with the header/MF padding unless the user explicitly requests a different inset.
- Preserve right-edge padding and never let content grow beyond the viewport.
- Use parent grid/flex layout for alignment. Avoid per-element transforms used only to compensate for another element’s wrong wrapper.

## Cursor rules

- The cursor dot is custom and must not be replaced by the browser cursor over interactive regions.
- Cursor states include the default dot, project `OPEN` state, project name state, X state, and video `EXPAND`/`MINIMIZE` state.
- The cursor hit target must be the actual interactive area and must update when the active project changes.
- The expanded cursor circle is the only part whose opacity is adjusted when requested; keep text opacity independent.
- Difference/blend-mode behavior is intentional, but always verify contrast against white, black, image, and overlay backgrounds.
- X hover must show the circle/contrast state and remain clickable.

## What “clean” means for this project

- One source of truth for each state: hero, Recent Works, services, overlay open/close, cursor, and media.
- No duplicate event listeners, animation loops, timers, CSS classes, or DOM layers for the same behavior.
- No dead WebGL/shader/mask code after a feature is removed.
- No stale autoplay or replay logic after the user disables it.
- No invisible spacer/mask elements left behind after a gallery/section is removed.
- Do not solve a positioning bug by pushing one side while breaking the other side. Use the shared parent geometry.
- Prefer explicit classes and CSS custom properties over inline style fragments repeated in JavaScript.
- Keep animation timing constants centralized and document what scroll progress each state owns.

## Preview and verification checklist

For visual changes, verify at minimum:

1. Fresh page load.
2. Slow forward scroll.
3. Fast forward scroll.
4. Slow reverse scroll.
5. Fast reverse scroll.
6. Entering/leaving each project.
7. Escape and X close paths.
8. Resize from desktop to tablet/mobile widths.
9. Media loading failures and missing optional files.
10. No horizontal overflow, clipped right edge, duplicate text, flicker, or visible browser scrollbar when the user asked it hidden.

When reporting a fix, state what was changed and what was verified. Keep the report short unless the user asks for an explanation.
