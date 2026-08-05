V142 — STAGING-ONLY CAPTURED GUIDANCE SEQUENCE

- Live root index.html remains byte-for-byte identical to V139.
- Prototype remains at /staging/index.html.
- Replaces the incorrect 260vh sticky-scroll implementation.
- Guidance is now one real viewport high.
- When Guidance reaches the viewport, wheel, trackpad, keyboard and touch input are captured.
- The page position stays fixed while input draws the bottom line and drives the 01 → 02 transition.
- Native page scrolling is released only after the sequence reaches either boundary and receives a deliberate additional scroll.
- Existing Guidance title animation, overlays and contextual OPEN cursor are preserved.
- Root index SHA-256 remains unchanged from V139.
