# Open questions

Decisions waiting on the owner. Remove an item once it is answered (and record the answer in an ADR or the
relevant memory file).

_Last updated: 2026-11-14_

- **Sync security trade-offs** (flagged by an automated review, 2026-11-14, kept as ADR 0024 decided): plain `http`
  on the home network carries the sync token; the Windows app may connect to any `http:`/`https:` address (CSP);
  the gate PIN's hash syncs, so whoever can read the server's data folder could work out the 4-digit PIN. Fine
  for a home server and a PIN that only keeps young kids out; revisit if the server ever leaves the home network.
- **Family pages** (phase F, decided overnight 2026-11-14 to keep going): they live in the app's storage and
  sync; `Pictures\Coloring Book\Pages` is an inbox that empties into `Added`. Say if the Pictures folder should
  also keep a copy of every family page.
- **Sync server defaults** (phase C, picked overnight 2026-11-14 to keep going): port 8787, data in
  `/mnt/user/appdata/crayon-box-sync`, runs as 99:100. Change in the Unraid template if any of that is wrong. The
  image on ghcr.io must be public for Unraid to pull it without logging in: check the package's visibility after
  the first publish.

- **Enough colors?** The coloring screen now has 23 plus rainbow, which is all that fits at full button size on
  a 1280 × 800 screen. If the owner wants more still, it costs page size or needs a second page of colors
  (ADR 0016).
- **Default AI model** for the page maker: pick after a quality test with a few photos (ADR 0006).
- **Target laptop screen:** resolution and shape are not recorded; the 4:3 canvas layout depends on them
  (ADR 0004). The mockups assume 1280 × 800 (ADR 0016).
- **Buttons on touch-down or lift:** to settle in playtests (ADR 0003).
- **Racing game** ([ADR 0021](../adr/0021-racing-game.md), Accepted 2026-11-14): still open in it are how
  smoothly the laptop's integrated graphics draw it, which assist level new kids start on, whether a resting
  hand driving the car is a problem (those three for the prototype playtest), and whether the folder and
  registry id stay `racing` now that there are no races (kept as `racing` in the prototype, shown as
  "Driving"). Also: the prototype paints the whole car in the kid's color, where ADR 0021 says a flag on the
  car; fine with one car, to settle with the vehicle choice.
- **After the driving MVP** (see project state, milestones 3 and 5): which vehicles, how many maps and how big,
  and how the home map's private folder gets onto the device or the family's server.
- **Letter practice** ([ADR 0026](../adr/0026-letter-practice.md), built 2026-11-14): for a playtest, tracing
  tolerance (15 units for a finger, 9 for a pen), whether tracing the whole letter (ADR 0028: both ends of every
  stroke, 95 % of the letter) and tapping the check are manageable at 4, which handwriting program the kids'
  school uses (the strokes follow Zaner-Bloser; D'Nealian or another style would change `glyphs.ts`),
  whether the start dot and arrow are understood, whether Windows speech is good enough or a parent records the
  letters, a picture per letter as a reward, and whether the laptop has a pen.
- **Brush sizes:** the three dots paint 40, 80 and 130 page pixels wide (about 15, 30 and 49 px on the
  1280 × 800 screen). A guess, to check in the first playtest (2026-11-14).
- **64 px color buttons:** smaller than every other kid target since ADR 0019. Check in a playtest that the kids
  hit the color they mean; if not, fewer colors before smaller buttons (2026-11-14).
- **Search for AI pages from an idea** (ADR 0023): which search service, its key and cost. Settle before building
  that part.
- **AI model for the animal themes' built-in pages** (ADR 0022): pick with the default model test of ADR 0006.
  The clean-up step and the dev tool to turn its images into pages exist; only the model choice is missing.
