# Project state

_Last updated: 2026-11-23_

**What is next:** the ordered [to-do list](../todo.md) (agreed with the owner 2026-11-15, brought up to date 2026-11-16).

## Phase
**A draft of 0.12.0 is built, not published** (2026-11-23, tag `v0.12.0`): six more driving vehicles and a
helicopter pad on the island (ADR 0048, PR #79). Installed copies are not offered it until the owner publishes the
draft on GitHub; the release checklist's hand checks were not run.
**Latest published release: 0.11.0** (published 2026-11-21, on the owner's word, without the release checklist's hand
checks): Kitchen's cupcake with a start screen to pick what to make, and home screen tiles that are pictures of
the games (ADR 0047, PR #78). Not yet installed, heard or playtested.
Before it: 0.10.0 (the same day and the same way: the Kitchen game with a pizza and speech, Letters and Kitchen
shown by default, ADR 0045, PR #76), 0.9.0 (2026-11-16, the overnight build of to-do sections 2, 4 and 5, PRs #59 to #74, none of it
playtested yet), 0.8.1 (the Outside theme), 0.8.0, 0.7.0 (milestone 3).
Milestone 1 (web app) in progress. `npm run dev` opens the kid picker. A kid starts a new picture from the page
library or continues one from My pictures (ADR 0017), and can fill, paint, erase, undo, start over and switch the
coloring mode. The page fills the window (ADR 0019). Holding the lock on the kid picker for a second opens the
parent gate, then the parent area: kids with names and photos (ADR 0018), starting mode, the show-names setting,
Pictures (restore, delete) and Page library (hide pages). Unit and browser tests pass locally. The first part is
committed (`e89cdd4`); CI has not run on GitHub yet (not pushed).

## Milestones (defined in ADR 0014)
1. **Web app:** a stepping stone. Coloring game in a browser (Edge), browser storage behind the storage
   interface. Runs from the Vite dev server on the dev machine only (no container, ADR 0020). Never hosted
   online. Used to test with the kids early. Art made here is throwaway.
2. **Installer:** Tauri 2 + NSIS, kiosk lock, file storage, signed in-app updates, AI page maker.
   **Next up** (owner, 2026-11-14): milestone 1's page themes are all in (Outside added 2026-11-15); the coloring buttons and colour wheel were built 2026-11-16 ([ADR 0038](../adr/0038-coloring-buttons-a-kid-can-work-out.md), Accepted; plan phases B to F, PRs #61, #64, #67), waiting on a kid playtest;
   milestone 2 is planned in eight phases in [milestone-2.md](../milestone-2.md) (A Tauri window, B files, C sync,
   D kiosk lock, E updates, F family pages, G AI page maker, H family release). **Phase A done 2026-11-14**
   (`src-tauri/`, the `windows-installer` CI job): the installer ran on Windows. A `v*` tag drafts a release
   with the unsigned installer (`release.yml`). **Phase B (files) merged 2026-11-14** (PR #3):
   unit- and browser-tested, not yet tried in the installed app. **Phase E (updates) merged 2026-11-14** (PR #5),
   ahead of C and D (owner's call); signed draft release 0.2.1 made, the update itself not yet tried.
   **Overnight 2026-11-14** (owner's plan: the letters fix, then D, C, F, H, then a published release), all
   merged: D kiosk lock (PR #8), C1 sync server (PR #9, image `ghcr.io/jpittelkow/crayon-box-sync`, public), C2
   sync client (PR #10), F family pages (PR #11), H the [release checklist](../release-checklist.md) (PR #12).
   Release 0.3.0 has all of it. **G (AI page maker) built 2026-11-14 through the family server** ([ADR 0029](../adr/0029-ai-pages-through-the-family-server.md)); a parent picks the model in the app, with family favorites on the server ([ADR 0033](../adr/0033-pick-the-ai-model-in-the-app.md), built 2026-11-15, app 0.5.0 and server 1.2.0). The photo prompt was tuned on family photos and a parent can ask for two pages from two models to choose from ([ADR 0034](../adr/0034-photo-prompt-and-two-to-choose-from.md)); `server/tools/ai-samples.ts` compares prompts and models.
   **Left in milestone 2:** the model test (now done by picking models in the app), and the checklist on
   Windows. The in-app update was tested by the owner (2026-11-15). The sync server runs on the family's Unraid
   machine with AI pages on (2026-11-15).
   Next with the owner: the racing game's maps, vehicle choice and customizing (the main focus after that). The
   sound design choices are done and built (2026-11-15, ADR 0032).
3. **Racing game** (ADR 0012): second game module. Its design is [ADR 0021](../adr/0021-racing-game.md),
   **Accepted** on 2026-11-14: a small 3D island to roam, no races, traffic that drives alongside, things to
   knock around, puddles and a flood, touch to go plus arrow and WASD keys, three.js. **Step 1, the prototype,
   is built (2026-11-14)**: one island in `src/games/racing/`, off until a parent turns on "Show Driving" under
   Settings, Games; it then shows on the home screen. Not yet playtested with the kids. Since 2026-11-14 it has
   the polished toy look and an engine voice per vehicle ([ADR 0025](../adr/0025-driving-game-toy-look-and-engine-sounds.md));
   traffic is a school bus, a police car (flashing lamps) and a monster truck. Frame rate on the family laptop
   not measured yet.
   **Planned 2026-11-15 in [milestone-3.md](../milestone-3.md)**: A samples and laptop check, B the MVP (island
   finished, world as data, vehicle picker), C an ADR for vehicles and maps, D vehicles (own horn each, garage),
   E two or three bigger maps with a map picker, F ready for the kids. Phase A1 built 2026-11-15: a fire truck three
   ways in `spikes/vehicle-sources/` (in code, Kenney CC0 kit, AI-made with TRELLIS.2); the owner chose
   **built in code** the same day. Asset categories and catalog: [driving-assets.md](../driving-assets.md). A2 (laptop check) not started.
   **A third, very large map** (a highway round a big building site; asked by the owner 2026-11-15) is planned in
   [highway-map-plan.md](../highway-map-plan.md): about 1 km across, engine work first. The owner chose
   **layout B** (2026-11-15): a figure of eight that crosses over itself, so roads on two levels are built
   before the map. The owner's choices are in [ADR 0040](../adr/0040-driving-very-large-map-highway-and-building-site.md) (Proposed, 2026-11-15); when it starts is
   open. **Built 2026-11-16:** its engine work, phases 1 and 2 (`sim/grid.ts`, toys asleep, traffic near the kid,
   drawing only what is near; a 1 km stand-in `maps/stress.ts` steps in about 0.55 ms), and the pieces every map
   draws on: targets ([ADR 0041](../adr/0041-driving-targets-to-collect-and-hit.md)), mud, ford, show-only lights,
   roundabout and harbour ([ADR 0042](../adr/0042-driving-more-set-pieces.md)), maps from a folder
   ([ADR 0043](../adr/0043-driving-maps-from-a-folder.md)), and the dev map editor and viewer. The map itself is
   not started. **Built 2026-11-23, in the 0.12.0 draft:** six more vehicles the
   owner picked (forklift, road roller, loader, street sweeper, mail van, quad bike; twenty in all) and a helicopter
   pad on the island ([ADR 0048](../adr/0048-driving-six-more-vehicles-and-a-helicopter-pad.md)).
5. **Home map** (asked by the owner 2026-11-14, its own milestone, after the driving game's MVP): a driving map
   of the family's own area, made from real map and terrain data, with the roads, the family's house and a few
   neighbours' houses. It must never be committed: it lives in a folder kept out of the repo that can be dropped
   on the family's server. Not designed yet; the [privacy rule](../../CLAUDE.md) means the repo only ever holds
   the code that loads such a folder, never the map, the place's name or any address.
4. **Sync between devices:** [ADR 0024](../adr/0024-family-sync-server.md), Accepted 2026-11-14. A small
   self-hosted server on the family's Unraid machine (image published from this repo); the device stays the
   working copy and syncs in the background; Windows first. Order: storage groundwork (**done 2026-11-14**, see
   the code map), then the server and sync client right after the installer's file storage. **Server and client
   built 2026-11-14** (milestone 2 phase C); running on Unraid since 2026-11-15, a device paired.
6. **Letter practice** (asked by the owner 2026-11-14): a third game module (ADR 0012) where a kid traces big
   letters with a finger or a stylus. Design: [ADR 0026](../adr/0026-letter-practice.md), **Accepted**
   2026-11-14 (mockups on the canvas, boards 19–24). **Built 2026-11-14** in the web app: practice and the game
   path, capitals, small letters and numbers, start dots, arrows and the finger, stroke order, pen palm
   rejection, the app's narrator (shipped clips since 2026-11-15, ADR 0032) or a parent's recordings, the parent
   Letters screen. Shown on the home screen by default since 2026-11-21
   ([ADR 0045](../adr/0045-every-game-shows-by-default.md); on the branch `kitchen/pizza`). Not yet playtested with the kids or tried with a real pen. Since
   2026-11-14 the whole letter must be traced and the kid taps a check to finish
   ([ADR 0028](../adr/0028-letter-tracing-whole-letter-and-confirm.md)), and the strokes follow how US schools
   teach print letters (Zaner-Bloser). **Built 2026-11-16** under [ADR 0037](../adr/0037-letters-sound-tips-and-how-to.md)
   (Accepted), plan phases B to E: the name on open and a name/sound setting, a drawing sound and stroke chime,
   eight praise words, a hint ladder (`hints.ts`), a first-time how-to on `L`, easy-first game path, and a
   lines-and-shapes set (PRs #60, #63, #66). Not playtested.
   **Writing words** (asked by the owner 2026-11-14), the next level after single letters: researched and
   drafted 2026-11-15 as [ADR 0039](../adr/0039-writing-words.md) (Accepted 2026-11-15 with every recommendation), from
   [research/words-learning.md](../research/words-learning.md). Its 84 narrator lines (`ONLY=words` in
   `tools/sounds/generate.mjs`) shipped 2026-11-16 as take 1, both slow takes (`SLOW_TAKES` picks), not yet
   listened to. **Built 2026-11-16:** the Words tile, the kid's name and 24 words with AI-made pictures, one big
   letter at a time into boxes, the slow word, one check, word stars (PRs #70, #71) and family words
   (#73: up to 10 per family, each with an optional recording and photo, one file per word). Not playtested.

7. **Kitchen** (asked by the owner 2026-11-21: the kids want hands-on "make a thing" games): a fourth game module
   where a kid makes food step by step with their fingers, pizza first, then cupcake, birthday cake, ice cream and
   cookie as recipes on the same verbs. Design: [ADR 0044](../adr/0044-kitchen-make-it-game-pizza-first.md),
   **Proposed** 2026-11-21; phases, the narrator lines and the owner's choices K1 to K12 are in
   [kitchen-plan.md](../kitchen-plan.md). Mockups: boards 25 to 34 on the canvas (2026-11-21). **Built
   2026-11-21** on the branch `kitchen/pizza` (plan phase B and the look from C): the whole pizza, stand-in sounds,
   saved as it is made; shown on the home screen by default (ADR 0045), which now wraps to a second row after
   three tiles. It speaks since 2026-11-21 (`voice.ts`: names, step lines, moments; take 1
   of all 93 lines shipped as `voice/food-*`, `cook-*`, `wash-*`). No shelf, idle hand or parent screen yet; not
   seen on the laptop or played by a kid. Its narrator batch (93 lines, `ONLY=kitchen` in `generate.mjs`) was made
   2026-11-21: 279 takes on the laptop in `C:\tmp\gen3\kitchen`; take 1 of each is in the app, none listened to.
   **The cupcake, the second recipe, was built 2026-11-21** (released in 0.11.0): a
   wrapper, batter poured by a held finger, the oven, frosting, sprinkles, toppers, bites; and a start screen to
   pick pizza or cupcake. **Home screen tiles:** two options mocked up the same day (boards 35 and 36 on the
   canvas); the owner picked B, and it is built and in 0.11.0
   ([ADR 0047](../adr/0047-home-tiles-are-pictures-of-the-games.md)): each tile is a little picture of its game
   (`src/ui/tiles.ts`), big and two across with four games or fewer.
   The other ideas offered the same day (car wash, vehicle workshop, robot or monster, garden, building site)
   are not planned.

Built in this order (owner's decision, 2026-11-14). The racing game comes after the installer because it needs
3D models and a lot of design; only its prototype came early. Deferred: printing and export (ADR 0010).

## Status of decisions
- ADRs 0001–0009 and 0011–0016 are **Accepted** (the owner accepted 0002–0016 on 2026-11-14); 0010 is
  Deferred. From now on a change to any of them is a new ADR that supersedes it (ADR 0001).
- The look is ADR 0016: a design system called Crayon Box. It and the mockup canvas are artifacts,
  linked from the [ADR index](../adr/README.md). The canvas has 12 screens and was redrawn on 2026-11-14 to match
  the revised ADRs. The owner reviewed it the same day, asked for more colors and a per-picture coloring mode
  (both now in the mockups and ADRs 0003, 0004, 0007, 0016), and said it is otherwise about ready for an MVP.
- The mockups assume a 1280 × 800 screen; the family laptop is 1920 × 1080 (owner, 2026-11-15) and the app
  works fine on it as is.

## Code map
- `src-tauri/`: the Windows shell (ADR 0002, milestone 2 phase A): Tauri 2 config, a `main.rs` that only opens the
  window, the core-only capability, and the icons (made from `icons/source.svg` with `npx tauri icon`). Built only
  by CI's `windows-installer` job, which keeps the NSIS installer as a run artifact. `src/shell/platform.ts`
  (`inTauri`) is how web code tells the Windows app from a browser.
- `spikes/engine-bakeoff/`: throwaway test for ADR 0021, not part of the app, with its own `package.json`: the
  same driving scene drawn by three.js and by Babylon.js. Run with `npm --prefix spikes/engine-bakeoff run dev`
  (port 5180). Kept as the record behind ADR 0021's library comparison; the app does not use it. Its
  simulation and shapes were copied into `src/games/racing/` and have moved on since.
- `src/shell/`: app shell (ADR 0012): kid picker with the lock, home screen (skipped with one game), game
  registry, guards against escape hatches (ADR 0003 rule 4), profiles (one folder per kid, `kids/<id>/`) and
  shell settings.
- `src/parent/`: gate (ADR 0008), parent area, kid editor, photo cropping. Loaded only when the gate opens.
- `src/storage/`: storage interface (ADR 0007) with an IndexedDB backend and an in-memory one for tests.
  Sync-ready (ADR 0024): every item has a change record (`modified`, `deleted`, `rev`) in a `meta` store;
  `local/` at the top of a namespace is device-only; the backend has the sync client's hooks (`changes`,
  `applyRemote`, `markSynced`); `ids.ts` makes cross-device ids and the device id. No sync client or server yet.
  `files.ts` is the installed app's backend: one file per item under `items\`, temp file then rename, and an
  `index.json` with each item's kind and change record; reopening mends what a crash left.
- `server/`: the family sync server (ADR 0024): Node 24, no dependencies, `node:sqlite`; API in `server/src/api.ts`
  (shared with the client), Dockerfile, Unraid template, `server.yml` publishes the image. `src/sync/`: the client
  (`engine.ts` conflict rules, `service.ts` background rounds), Parent area › Family sync.
- `src/shell/kiosk.ts` + `src-tauri/src/kiosk.rs`: the kiosk lock (ADR 0014): keyboard hook, full screen, Quit;
  Parent area › This laptop. Device-only settings go under `local/`.
- `src/games/coloring/family.ts`, `catalog.ts`, `importPage.ts`, `folderImport.ts`, `addPages.ts`: family pages
  (phase F), kept in the game's storage so they sync; Parent area › Add pages; the Pages folder inbox.
- `src/shell/tauriFiles.ts`: the Windows app's files (phase B), loaded only in Tauri: the storage backend's file
  system, and `FinishedPictures` (`Pictures\Coloring Book\Art\<kid id>\<page>-<started>.png`), which games and
  parent sections get as an optional `finished` in their context. What the page may touch is listed in
  `src-tauri/capabilities/default.json` (only `store\` in local app data and `Pictures\Coloring Book`).
- `src/ui/`: Crayon Box tokens as CSS custom properties, kid components, icons, the palette, and the parent
  world kit with bundled fonts (ADR 0016).
- `src/games/coloring/`: the game (lazy-loaded): `game.ts` (start, library, My pictures), `session.ts` (the
  coloring screen), `engine/` (ADR 0004), `pictures.ts`, `pages.ts`, `parentSections.ts` (its parent screens).
- `src/games/racing/` (ADR 0021, 0025, 0031): `sim/` is plain TypeScript (the world with vehicle kinds and sizes,
  driving to a touched spot, traffic modes CRUISE/JOIN/ALONG/LEAVE, `World.steer`; input; camera, tree rules and
  `groundPoint` (picture to ground) in `view.ts`) with unit tests; the world comes from a map (`sim/map.ts`: land as an
  outline in `sim/land.ts`, roads with junctions, zones, bridges and tunnels, hills and sand in `sim/ground.ts`;
  the maps are `maps/island.ts` (layout A, grown) and `maps/site.ts` (the building site), listed in `maps/index.ts`;
  the tests mostly use the old ring, `maps/ring.ts`); twenty vehicles (`look/vehicles.ts`, `look/fleet.ts`, `look/fleetMore.ts`) and roads are point paths (`sim/roads.ts`, drawn by `look/roads.ts`); toys,
  scenery and decor are registered by id (`sim/assets/` definitions, `look/toys.ts` and `look/scenery.ts` looks;
  dev gallery at `/tools/driving-gallery.html`); `look/` builds the toy-look vehicles, island, trees
  and props in three.js, baked to one mesh per material; `render.ts` batches and draws them and loads with the
  game; `game.ts` (screen, touch and keys, loop), `settings.ts` (per-kid assist and last vehicle, sounds), the vehicle picker in `game.ts` with tile pictures from `look/thumbs.ts`, `parentSection.ts`,
  `sound.ts` (an engine loop per vehicle kind in `ENGINES`, effect files in `EFFECTS`, ADR 0032). Games can
  start hidden (`GameEntry.startsHidden`) and a parent shows or hides each one under Settings, Games
  (`ShellSettings.games`).
- `spikes/realism/`: the four-look grading samples behind ADR 0025 (`node spikes/realism/shoot.mjs`).
- `src/games/letters/` (ADR 0026): `glyphs.ts` (the 62 letters and numbers as strokes, arrows), `trace.ts` (the
  checker, no DOM), `progress.ts` (stars, the game path, prefs and settings, recordings under `voice/`),
  `game.ts` (start, practice, path and tracing screens), `voice.ts` (narrator clips, praise, a parent's
  recordings), `parentSection.ts`. Unit tests in `letters.test.ts`, browser tests in `tests/e2e/letters.spec.ts`.
- `src/games/kitchen/` (ADR 0044; adding a thing to make: [recipes/kitchen.md](../recipes/kitchen.md)): `recipe.ts`
  (a recipe is steps, each with a verb; ovals for a thing that isn't round) and `recipes/pizza.ts`, `cupcake.ts`
  (data); `make/made.ts` (the thing being made as plain data, `readMade`) and `make/verbs.ts` (the eight verbs,
  `next`, `sample`; no DOM); `look/art.ts` (the art as data, raw and baked colours), `look/kit.ts` (the oven, bites,
  pieces) and one look a recipe (`look/pizza.ts`, `look/cupcake.ts`); `game.ts` (the start screen with a tile a
  recipe, the counter, fingers, timers), `voice.ts` (the narrator's lines), `store.ts`
  (`kids/<id>/making/<recipe>.json`), `sounds.ts` (stand-ins). Unit tests in `kitchen.test.ts` and
  `cupcake.test.ts`, browser tests in `tests/e2e/kitchen.spec.ts`.
- Sounds (ADR 0032): every sound is a file in `assets/sounds/` (`sounds.json` lists each one's source and
  license), loaded through `src/shell/soundFiles.ts`. `tools/sounds/` remakes them: `generate.mjs` (AI clips, run
  inside the sync container) and `prepare.mjs` (trim, level, cut loops; needs ffmpeg) from `picks.json`.
- `pages/`: three original CC0 placeholder pages in the ADR 0005 format.

## Milestone 1: remaining phases (agreed with the owner 2026-11-14)
- **A. Playtest and fixes:** prep done 2026-11-14: [playtest guide](../playtest.md) and
  `scripts/playtest.cmd` (Edge app window, ADR 0020). **Waiting on the owner** to run the playtest; findings then
  get fixed or recorded (swatch size, brush sizes, touch-down or lift).
- **B. Page pipeline:** done 2026-11-14: [page guide](../../pages/README.md), the rendered page check in CI
  (`tests/e2e/pages.spec.ts`, ADR 0005), the theme strip and blank page. Still open for C: who draws the pages.
- **C. The real page library:** sources in [ADR 0022](../adr/0022-where-built-in-pages-come-from.md). Drawn as
  SVG and done 2026-11-14: Race cars, Things that go, Shapes, Yummy food (six pages each), plus the fish. The
  clean-up step for AI-made pages is built (`cleanup.ts`, dev tool `tools/clean-page.html`). Animal pages done
  2026-11-15: Dinosaurs (a new ninth theme), Wild animals and Farm and pets (six each) and four more Under the sea
  pages, made with GPT-5 Image Mini and cleaned up with `tools/clean-pages.mjs` (ADR 0022). Outside done
  2026-11-15 (tree with a swing, flowers, sun, house, rainbow, butterfly): every page theme is in.
- **D. Polish:** done 2026-11-14: sounds with a Settings switch (`shell/sound.ts`; files since ADR 0032),
  the optional gate PIN (stored as a hash), the reduce-motion check (browser test), and the two-finger undo limit
  fixed (each stroke draws on its own layer until the finger lifts). The design system artifact was matched to
  ADRs 0017–0025 and the code on 2026-11-14 (`kid-swatch` token, names and photos, start screen, theme strip,
  driving tile and horn, gate PIN, parent nav). The mockup canvas was matched the same day (18 boards, 6 of them new:
  coloring start, driving, kid editor, parent Driving, add from an idea, family sync).
A and B can run in parallel; D fits anywhere.
