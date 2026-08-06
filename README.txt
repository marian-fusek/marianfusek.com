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
