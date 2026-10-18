# Coaching Page Prism Design

## Goal

Give the coaching page a pointer-following prism-glass effect over its first two typographic sections only, while preserving the static-site architecture and ordinary scrolling.

## User intent and approved scope

- The hero keeps its main coaching headline and bottom-aligned coached/accreditation details.
- The existing explanatory paragraph moves out of the hero into its own large-type section immediately after the hero; its copy remains exact and is not duplicated.
- The prism effect appears over the hero headline and the large statement, then ends before “Who this is for.”
- Later sections scroll and reveal normally without prism effects.
- The user approved a local vanilla-JavaScript adaptation of the supplied React Bits FluidGlass component, rather than adding React or a new site build system.
- The authoritative source is `/Users/marianfusek/Downloads/_MARIANFUSEK.COM/`; `staging/` is not a source or destination.

## Design

### Page structure

Keep the hero as a full-viewport section with its headline, credentials, and scroll cue. Add a standalone statement section directly after it, using the coaching page’s existing grid and section rhythm. Move the exact existing explainer copy to that section. Preserve heading semantics in the DOM and responsive readability.

### Prism effect

Create a focused local WebGL module based on the supplied FluidGlass shader and interaction behavior. It places a transparent canvas over each target text area, uses that area’s rendered text as the canvas text source, and follows pointer movement within the target only. Keep the HTML text as the accessible source of truth; the canvas is decorative and hidden from assistive technology. The effect is limited to the hero headline and explainer statement. No media source, shape morph-on-click, drag interaction, or idle drift is needed.

The module must leave the original text visible if WebGL2 is unavailable, respect reduced-motion preferences, resize with its host, and clean up animation frames, observers, event listeners, and WebGL resources. Pointer events must pass through and must not affect scrolling.

### Integration boundary

Keep the feature in the existing static site: a focused local JavaScript asset and minimal CSS, the coaching markup, and only necessary page-level integration. Do not add React, a CDN runtime, package/build tooling, a new page entry point, or change unrelated homepage/project interactions. Existing coaching line-load and section-wipe code remains the sole owner of text reveal and scroll opacity/clip paths; the prism canvas must not animate those states.

## Verification

- Confirm accessible DOM copy is unique and there is no duplicate visible text.
- Run JavaScript syntax checks and the existing repository tests.
- Verify the two targets initialize and later coaching sections do not.
- Check reduced-motion, no-WebGL, resize, and teardown paths.
- In-session visual preview is unavailable per project instructions; do not claim visual confirmation. The user should check the prism appearance and timing in their local preview.

## Out of scope

- Changing the headline or statement copy.
- Applying prism to “Who this is for” or any later section.
- Reworking credentials, navigation, packages, reviews, or site-wide motion.
