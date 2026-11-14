# 0019. A bigger coloring page: the screen fills the window, color buttons at 64 px

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Supersedes: in ADR 0003 rule 2, the 80 px minimum for paint color buttons only. In ADR 0016, the 780 × 588 page,
  the 80 px swatches, and drawing every screen on a fixed 1280 × 800 frame.

## Context
The owner found the coloring page too small. The first build drew every screen on a fixed 1280 × 800 frame and
shrank the whole frame to fit the browser window, so a window with browser bars, or of another shape, made the
page smaller still, and wide screens left empty bands at the sides. On the reference screen itself the page could
not grow: the color rail of 24 swatches at 80 px took the width.

## Decision
- **The screen fills the window.** Screens are laid out on a frame the size of the window. Only when the window
  is smaller than 1280 × 800 in some direction is the frame scaled down, by just enough to fit, so controls never
  shrink below their size on the reference screen by more than that.
- **The page takes all the space the rails and tray leave**, at 4:3. On the reference screen that is about
  840 × 630 (up from 768 × 576, about 20% more area); on a larger or wider window it grows further.
- **Paint color buttons are 64 px** (token `kid-swatch`), keeping the 12 px minimum gap. The color rail is still
  three wide and eight down with all 24 always on screen (ADR 0003 rule 5). Every other kid target keeps the
  ADR 0003 sizes: 80 px picks, 88 px tools, 104 px corner buttons.
- Edge padding on the coloring screen drops from 24 px to 16 px.

## Consequences
- The page is bigger everywhere, most on wide screens.
- Swatches are smaller targets than the rest of the kid world. Playtests should check that the kids still hit the
  color they mean; if not, the next lever is fewer colors (a two-wide rail), not smaller buttons.
- Screens no longer have one fixed shape, so the mockups are a guide to arrangement rather than exact pixels.
