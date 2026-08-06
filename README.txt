MARIAN FUSEK WEBSITE — V156

LIVE
- Root /index.html, /style.css and /script.js remain unchanged from the V155 package / V139 live homepage.

STAGING — SELECTED WORKS
- Rebuilt Selected Works as a full-screen native-scroll snap exhibition.
- Five physical 100svh chapter positions give MIUNĀE, GoBaller, AIMS, Vault 111 and Side Quests a complete stable resting frame.
- The root uses CSS scroll snapping only while Selected Works intersects the viewport.
- A local one-gesture wheel guard prevents trackpad momentum from skipping a project; the browser still performs the smooth movement to the next physical snap position.
- GoBaller is straight, fully visible and receives a complete resting chapter before AIMS.
- Each project uses only its first image, preserves its real aspect ratio with object-fit: contain, and has a project-specific art-directed composition.
- Transitions use a structural split mask between adjacent physical scenes rather than a generic crossfade.
- The full-width bottom rail tracks continuous progress, shows all five chapter positions and supports direct navigation.
- Hovering the active composition adds restrained image, echo and plane depth.
- Clicking performs a measured shared-geometry morph using the actual active image and title into the existing inset rounded project-detail window.
- Closing reverses the same path and restores the exact project chapter and scroll position.
- Desktop and mobile layouts are separately tuned.
- No other homepage section was redesigned in this pass.

VALIDATION
- Verified stable resting frames for all five projects at 1280×800, 1440×900, 1728×1117 and 390×844.
- Verified a large desktop wheel gesture advances MIUNĀE → GoBaller rather than skipping to AIMS.
- Verified exit from the final project releases snap and continues to the next homepage section.
- Verified project opening, closing and exact GoBaller scroll restoration on desktop and mobile.
- Verified no horizontal overflow in the tested viewports.
- staging/staging.js and root script.js pass node --check.
- No runtime exceptions in the Selected Works desktop or mobile validation harnesses.
