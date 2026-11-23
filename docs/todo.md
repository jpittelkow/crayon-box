# To-do

The one ordered list of what is left, agreed with the owner on 2026-11-15 and brought up to date on 2026-11-16
after the overnight build (the old sections 2, 4 and 5 were built, PRs #59 to #74). Work top to bottom; a later
part can start early only when it doesn't depend on an earlier one. Tick items off by deleting them (history goes
in the [journal](journal/README.md)); details live in the linked plans and ADRs.

New maps come last on purpose: every piece a map is made from now exists (targets, set pieces, tiles, the editor,
loading a map from a folder), but more vehicles come first.

## 1. Look, listen and playtest what was built overnight
Nothing built on 2026-11-16 has been heard, seen on the laptop or played by a kid. The owner's choices it raised
are in [open questions](memory/open-questions.md).
- **Releases 0.10.0 and 0.11.0 are published** (both 2026-11-21. 0.10.0: Kitchen, and Letters and Kitchen shown
  by default. 0.11.0: Kitchen's cupcake and start screen, and home tiles that are pictures of the games).
  Installed copies offer 0.11.0 at their next check. The [release checklist](release-checklist.md)'s hand checks
  were not run for either: do them on the laptop as it updates (the update itself, the kiosk lock, files), and
  listen to Kitchen's narrator lines. A parent can hide Kitchen under Settings, Games if it isn't ready for the
  kids.
- **Release 0.9.0** (coloring buttons and wheel; letters sound, tips, how-to and shapes; writing words; driving
  targets, set pieces and folder maps). The release checklist's hand checks on the laptop have not been run.
- **On the laptop:** the Windows display scale (at 125 % the colour wheel stays hidden); drop
  `maps/examples/test-loop.json` into the maps folder and check it shows; measure the driving frame rate
  (`tools/driving-frames.html`, highway plan phase 1's budgets).
- **Listen:** the stand-in sounds (coloring buttons, the letters drawing sound and chime, targets, mud, ford,
  fountain, waves, ship's horn) and the words clips; pick stretched or plain for each slow word (`SLOW_TAKES` in
  `src/games/letters/words.ts`).
- **A kid playtest:** coloring names, badge, demos and wheel; the letters hint ladder's timings, the how-to and
  shapes; writing a name and a word; stars, stacks, mud, the ford, the roundabout and the harbour.
- **Look:** the word pictures for pin, tap, red and run; the island's reshaped bay.
- **The six vehicles and the helicopter pad of 2026-11-23** ([ADR 0048](adr/0048-driving-six-more-vehicles-and-a-helicopter-pad.md)),
  look at each in the game, listen to its engine, horn and the rotor (all
  stand-ins), and see whether a kid finds the last picker pages and the helicopter.

## 2. Coloring: after the playtest
- The undo icon checked with a kid (plan phase F); revisit modes on the kid screen (C8).
- The design system's `tokens.json` and the mockup canvas: add the wheel's 12 colours and the new bucket, brush
  and undo icons (both are artifacts, see gotchas).
- The wheel's own colour names ("Coral.") need narrator lines **before 2026-12-31** if wanted; today each segment
  says the nearest plain colour word.

## 3. Driving: more vehicles
- **Six more are built** (2026-11-23, the owner's picks, [ADR 0048](adr/0048-driving-six-more-vehicles-and-a-helicopter-pad.md)):
  forklift, road roller, loader, street sweeper, mail van, quad bike; and a helicopter pad on the island. Not
  released yet.
- **Ideas not picked** (for a later round): crane, taxi, camper van, a big lorry (may be too long for the island's
  bends). A twenty-first vehicle needs the swap tray to page first: twenty fill it.
- **Steering feel** (optional, from [milestone-3.md](milestone-3.md)): a steering wheel shown on screen and a
  per-kid steering sensitivity in the parent Driving screen.

## 4. Driving: what the map pieces still lack
All five items of the old section 4 are built: [ADR 0041](adr/0041-driving-targets-to-collect-and-hit.md)
(targets), [0042](adr/0042-driving-more-set-pieces.md) (mud, ford, lights, roundabout, harbour),
[0043](adr/0043-driving-maps-from-a-folder.md) (maps from a folder), map tiles
([highway-map-plan.md](highway-map-plan.md) phases 1 and 2), and the editor and viewer
(`tools/map-editor.html`, `tools/driving-map.html`). Left:
- The editor can't draw bridges, tunnels or a harbour's sail route (numbers only), place single trees or toys,
  or make districts and overpasses (not in the map format yet: highway plan phases 5 and 7).
- The highway plan's stricter map tests (phase 5), including "no place further than 45 m from a road" (D6):
  `maps/check.ts` has `farFromRoad`; the island has 27 cells too far, the building site 59.
- Landmarks (drawn simpler far away) wait for the first landmark asset.
- Maps from the folder synced from the family server; today a file is dropped on the device by hand.

## 5. Letters: after the playtest
- Plan phase F (fade the guide, then draw beside it), after the playtest (D10).
- Writing words, the later steps of [ADR 0039](adr/0039-writing-words.md): "build it" with letter tiles (W10,
  after the first playtest), less help on a word done before, "write it your way" (its own ADR). Their narrator
  lines are already made.
- **Narrator deadline:** every line the letters and coloring plans need is shipped; any new line (wheel colour
  names, a word the family wants said, the Kitchen game's lines in section 7) must be made before the voice
  retires on 2026-12-31.

## 6. More maps (last)
- **A very large map: a highway round a big building site.** [highway-map-plan.md](highway-map-plan.md), layout
  B ([picture](design/highway-layout-b.svg)),
  [ADR 0040](adr/0040-driving-very-large-map-highway-and-building-site.md) (Proposed). Phases 1 and 2 are built
  (2026-11-16: a 1 km stand-in steps in about 0.55 ms on the dev machine). **Next:** the owner says when it
  starts (D10); then phase 7 (roads on two levels on a small test map), phases 3 to 5, then the map.
- **New maps** made with the editor: ideas are a town (streets in blocks, a fire station garage, a park) and the
  countryside (a farm, a river with fords and a bridge, a flooded field). Which ones: the owner's pick.
- **The home map** (milestone 5): a map of the family's own area from real map and terrain data, with the house
  and a few neighbours'. Built only in the private folder, never committed ([privacy rule](../CLAUDE.md)); it
  loads through the maps folder (ADR 0043). Needs a short design first: where the data comes from.

## 7. Kitchen: a new game (asked 2026-11-21, not yet placed in the order)
The kids asked for hands-on "make a thing" games; the owner picked a Kitchen game with pizza first.
[ADR 0044](adr/0044-kitchen-make-it-game-pizza-first.md) (Proposed), [kitchen-plan.md](kitchen-plan.md).
- **Built 2026-11-21 and released in 0.10.0:** a whole pizza can be made, with the look and stand-in sounds. It and Letters show on the home screen by default
  ([ADR 0045](adr/0045-every-game-shows-by-default.md), the owner's choice). Built on the plan's defaults for the
  rest of K1 to K12, which the owner can still overrule.
- **Its narrator batch was made 2026-11-21** (93 lines, 279 takes, no errors; plan phase A) and **take 1 of every
  line ships**; the game speaks (names, step lines, "It's ready!", an ending). Any redo or added line has to be
  made before the voice retires on 2026-12-31.
- **Look, listen and play:** the owner tries it in the web app and says which lines need another take
  (`C:\tmp\gen3\audition.html` has all three); then a kid.
- **The cupcake is built** (2026-11-21, released in 0.11.0): the second recipe, with a start screen to pick pizza
  or cupcake, and a [recipe doc](recipes/kitchen.md) for the next one.
- **Home screen tiles are pictures of the games** (the owner's pick of option B,
  [ADR 0047](adr/0047-home-tiles-are-pictures-of-the-games.md)): built 2026-11-21, released in 0.11.0.
- Then: the idle hand (the rest of phase C), the shelf and the parent screen (D), and more recipes (F: birthday
  cake, ice cream, cookie).

## 8. A Linux version (asked 2026-11-21, not yet placed in the order)
For a touch laptop or PC. [ADR 0046](adr/0046-linux-version.md) (Proposed), [linux-plan.md](linux-plan.md) with
the owner's choices L1 to L10. A trial build ran on 2026-11-21 (`spikes/linux-trial/`): the app builds and runs
under WebKitGTK.
- **Phase A is built** on the branch `linux/phase-a` (2026-11-21): the faults the trial found are fixed, the Linux
  bundle settings are in, and CI has a `linux-appimage` job with a smoke run beside `windows-installer`. Checked
  in WSL; **the job has not run on GitHub yet**: the first pull request shows whether it holds there.
- **Phase B, the gate (next, the owner):** try the AppImage from that pull request's run on the real laptop: the
  driving game's speed, touch, pen, sound. Go or no-go for everything after it.
- Then: what differs in the app (C), the kids' session and the Linux setup guide (D), releases and in-app updates
  from GitHub as on Windows (E), and the first Linux release with its checklist (F).

## Parked (not planned)
- iPad version ([ADR 0030](adr/0030-ipad-home-screen-web-app.md), a draft kept for later).
- Printing and export (ADR 0010, Deferred).
- Real sound files for the driving stand-ins (set pieces, targets, the new vehicles' engines and horns): the
  stand-ins are fine for now (owner, 2026-11-15).
- The design system artifact's 3D section (the rules are in [driving-assets.md](driving-assets.md) for now).
