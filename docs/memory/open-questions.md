# Open questions

Decisions waiting on the owner. Remove an item once it is answered (and record the answer in an ADR or the
relevant memory file).

_Last updated: 2026-11-15_

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
- **Default AI models** for the page maker (ADR 0029: server settings `AI_IMAGE_MODEL`, `AI_DRAW_MODEL`): pick after
  a quality test with a few photos and ideas. Starting with `google/gemini-2.5-flash-image` and `google/gemini-2.5-flash`.
- **Target laptop screen:** resolution and shape are not recorded; the 4:3 canvas layout depends on them
  (ADR 0004). The mockups assume 1280 × 800 (ADR 0016).
- **Buttons on touch-down or lift:** to settle in playtests (ADR 0003).
- **Racing game** ([ADR 0021](../adr/0021-racing-game.md), Accepted 2026-11-14): still open in it are how
  smoothly the laptop's integrated graphics draw it, which assist level new kids start on, whether a resting
  hand driving the car is a problem (those three for the prototype playtest), and whether the folder and
  registry id stay `racing` now that there are no races (kept as `racing` in the prototype, shown as
  "Driving"). Also: the prototype paints the whole car in the kid's color, where ADR 0021 says a flag on the
  car; fine with one car, to settle with the vehicle choice.
- **Driving: the joystick and traffic company** ([ADR 0036](../adr/0036-driving-screen-is-a-joystick.md),
  [ADR 0031](../adr/0031-driving-to-a-spot-and-traffic-company.md)): the screen became a joystick after the playtest
  of 2026-11-15. Watch whether the kids find backing up, and what a resting hand low on the screen does (backs up
  slowly); then accept 0031's traffic part.
- **New sound files for the driving game's set pieces** (milestone-3 B6): landing, car wash, bridge planks play
  stand-ins from existing files. Making real ones needs the owner's OK to download CC0 packs or pay for AI
  takes, and ffmpeg on the dev machine (2026-11-15).
- **Driving game, milestone 3** ([milestone-3.md](../milestone-3.md), decisions table): which vehicles and maps.
  Decided 2026-11-15: map picker tiles, vehicle picker plus a garage on each map, vehicles built in code; the
  island redrawn as layout A (a loop and a shortcut, with junctions); the kid's colour mixed (paint on the car
  and monster truck, a flag on vehicles with a look of their own); sounds as files (ADR 0032). Milestone 5: how the home map's private folder
  gets onto the device.
- **Letter practice** ([ADR 0026](../adr/0026-letter-practice.md), built 2026-11-14): for a playtest, tracing
  tolerance (10 units for a finger, 9 for a pen, ends within 6; tightened 2026-11-15), whether tracing the whole letter (ADR 0028: both ends of every
  stroke, 98 % of the letter) and tapping the check are manageable at 4, which handwriting program the kids'
  school uses (the strokes follow Zaner-Bloser; D'Nealian or another style would change `glyphs.ts`),
  whether the start dot and arrow are understood, whether Windows speech is good enough or a parent records the
  letters, a picture per letter as a reward, and whether the laptop has a pen.
- **Brush sizes:** the three dots paint 40, 80 and 130 page pixels wide (about 15, 30 and 49 px on the
  1280 × 800 screen). A guess, to check in the first playtest (2026-11-14).
- **64 px color buttons:** smaller than every other kid target since ADR 0019. Check in a playtest that the kids
  hit the color they mean; if not, fewer colors before smaller buttons (2026-11-14).
- **Sounds by ear** ([ADR 0032](../adr/0032-sounds-as-files.md), built and merged 2026-11-15). All that's left is
  listening on the laptop; any swap is a `tools/sounds/picks.json` change plus `prepare.mjs`:
  - **Narrator:** any of Matilda's clips to redo (before 2026-12-31, when ElevenLabs retires her).
  - **Siren, tyre squeal, brake squeak:** take 1 ships; the other takes are kept outside the repo.
  - **Engine loops** were cut by a heuristic from each take's idle; check none sounds strained at a standstill.
  - **Seed Audio's terms:** shipped on BytePlus's
    [General Terms for AI Services](https://docs.byteplus.com/en/docs/legal/AI-Services-terms) (the user owns the
    output). Only the ModelArk *Playground* terms bar publishing, and the API was used. The owner may want to
    confirm.
- **Search for AI pages from an idea** (ADR 0023): which search service, its key and cost. Settle before building
  that part.
- **iPad version** ([ADR 0030](../adr/0030-ipad-home-screen-web-app.md), a draft the owner is keeping for later,
  2026-11-14): accept or not; which iPad and Pencil model the family has (hover needs an M2 iPad Pro or later).
  The family's server can have HTTPS, which the ADR requires (owner, 2026-11-14).
- **Coloring buttons a kid can work out** (playtest, 2026-11-15): a kid didn't know what any coloring button does.
  Needs a design without text (ADR 0003), for example a short demo when a button is pressed and held. Also wanted:
  a colour wheel next to the swatches.
- **AI pages freeze on the laptop** (playtest, 2026-11-15): the card shows but its buttons don't answer. Not seen in
  the browser on the dev machine. Next: which buttons, and whether typing in the idea box works there.
