# Open questions

Decisions waiting on the owner. Remove an item once it is answered (and record the answer in an ADR or the
relevant memory file).

_Last updated: 2026-11-14_

- **Enough colors?** The coloring screen now has 23 plus rainbow, which is all that fits at full button size on
  a 1280 × 800 screen. If the owner wants more still, it costs page size or needs a second page of colors
  (ADR 0016).
- **Default AI model** for the page maker: pick after a quality test with a few photos (ADR 0006).
- **Target laptop screen:** resolution and shape are not recorded; the 4:3 canvas layout depends on them
  (ADR 0004). The mockups assume 1280 × 800 (ADR 0016).
- **Buttons on touch-down or lift:** to settle in playtests (ADR 0003).
- **Racing game** needs its own ADR before work starts (ADR 0012), including how it is drawn: the owner expects
  3D models and a lot of design.
- **Built-in page art:** who or what draws the ~48 original v1 pages (ADR 0005)? ADR 0011 now allows AI-made
  pages under conditions.
- **Brush sizes:** the three dots paint 40, 80 and 130 page pixels wide (about 15, 30 and 49 px on the
  1280 × 800 screen). A guess, to check in the first playtest (2026-11-14).
- **64 px color buttons:** smaller than every other kid target since ADR 0019. Check in a playtest that the kids
  hit the color they mean; if not, fewer colors before smaller buttons (2026-11-14).
- **Sync between devices** (milestone 4, see project state): where the server runs, what syncs (settings only,
  or pictures too), and whether kids' names and photos may leave the device. The owner earlier dropped a
  home-server container for the web app (ADR 0014).
