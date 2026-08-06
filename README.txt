MARIAN FUSEK WEBSITE — V158

LIVE
- Root /index.html, /style.css and /script.js remain unchanged from the current live homepage.

STAGING — SELECTED WORKS
- Rebuilt V157's Selected Works behavior as a genuinely native continuous page sequence.
- Removed all wheel interception, momentum absorption, keyboard interception, scroll-end settling and automatic nearest-project scrolling.
- Trackpad, mouse wheel, keyboard and touch scrolling now remain fully owned by the browser with no resistance or forced chapter movement.
- The five sticky project scenes still exchange at clear scroll milestones, but the exchange is driven only by the user's actual page position.
- GoBaller remains a complete stable composition and is no longer advanced by an intercepted gesture.
- Every project image is measured after loading and fitted inside its assigned art-directed area using its true natural aspect ratio.
- Rounded corners and shadows now follow the actual visible image rectangle rather than a generic full-size media box.
- Removed the image-as-background fallback that could visually create a second generic rectangle behind the real image.
- The bottom progress line is the only inertial element. It follows page progress with a restrained short lag and no bounce, reverse pull or effect on scrolling.
- Marker clicks remain explicit navigation actions and smoothly move to the chosen project.
- After Side Quests, the sticky sequence releases naturally into the following homepage section.
- Project opening/closing behavior and all non-Selected-Works homepage sections remain unchanged.

FILES CHANGED
- /staging/staging.js
- /staging/staging.css
- /README.txt

VALIDATION
- JavaScript syntax verified with Node.
- Confirmed the V157 wheel listener, settle routine, smooth auto-advance logic and keyboard interception are absent from the new Selected Works controller.
- Confirmed no scroll-snap behavior is enabled on the exhibition or chapters.


V159 — Selected Works polish
- Timeline fill now holds at project milestones.
- Removed image backing/padding; only true image bounds and corners remain.
- Corrected Vault copy to: Whatever I could find in old Figma files.
- Removed the hero-to-work background seam and transition line artifacts.
- Restored full-screen square project overlays.
- Unified source image/title morph into final overlay positions with monochrome-to-color handoff.
- Optically aligned oversized project headlines with supporting copy.

V160 — RECENT WORKS STACK
- Replaced the previous five-project timeline with a three-project stacked-card story.
- Sequence: empty background arrival, centered Recent Works intro, MIUNĀE, GoBaller, AIMS, then natural release into Guidance.
- Cards occupy nearly the full viewport with a small outer margin and rounded image bounds.
- Each incoming card rises from below and stacks over the previous card.
- Covered cards scale down by a maximum of 5% and soften slightly without disappearing abruptly.
- Removed Vault 111 and Side Quests from the Recent Works sequence.
- Project cards retain keyboard and pointer opening behavior.
- Project details open full-screen with a clean fade and subtle scale-up; outer rounded overlay removed.
