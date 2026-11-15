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
- **Racing game:** [ADR 0021](../adr/0021-racing-game.md) is Proposed; the owner has answered the main questions
  but not yet accepted it. Still open in it: three.js or Babylon.js (compared for the owner 2026-11-14, no
  answer yet; the ADR says three.js), how smoothly the laptop's integrated graphics draw it, which assist level
  new kids start on, whether a resting hand driving the car is a problem (those three for the prototype
  playtest), and whether the folder and registry id stay `racing` now that there are no races.
- **Brush sizes:** the three dots paint 40, 80 and 130 page pixels wide (about 15, 30 and 49 px on the
  1280 × 800 screen). A guess, to check in the first playtest (2026-11-14).
- **64 px color buttons:** smaller than every other kid target since ADR 0019. Check in a playtest that the kids
  hit the color they mean; if not, fewer colors before smaller buttons (2026-11-14).
- **Search for AI pages from an idea** (ADR 0023): which search service, its key and cost. Settle before building
  that part.
- **AI model for the animal themes' built-in pages** (ADR 0022): pick with the default model test of ADR 0006.
