# Project state

_Last updated: 2026-11-14_

## Phase
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
3. **Racing game** (ADR 0012): second game module. Its design is [ADR 0021](../adr/0021-racing-game.md),
   **Accepted** on 2026-11-14: a small 3D island to roam, no races, traffic that drives alongside, things to
   knock around, puddles and a flood, touch to go plus arrow and WASD keys, three.js. **Step 1, the prototype,
   is built (2026-11-14)**: one island in `src/games/racing/`, off until a parent turns on "Show Driving" under
   Settings, Games; it then shows on the home screen. Not yet playtested with the kids.
   **After the MVP** (asked by the owner 2026-11-14, "think through all of this after the mvp is done"; nothing
   designed yet): a choice of vehicles (monster trucks, school buses, emergency vehicles with working lights, and
   more); two or three maps, much bigger than the prototype's island, with more of the same things and more
   water. Needs a new ADR, since ADR 0021 has one small island and a few cars.
5. **Home map** (asked by the owner 2026-11-14, its own milestone, after the driving game's MVP): a driving map
   of the family's own area, made from real map and terrain data, with the roads, the family's house and a few
   neighbours' houses. It must never be committed: it lives in a folder kept out of the repo that can be dropped
   on the family's server. Not designed yet; the [privacy rule](../../CLAUDE.md) means the repo only ever holds
   the code that loads such a folder, never the map, the place's name or any address.
4. **Sync between devices:** [ADR 0024](../adr/0024-family-sync-server.md), Accepted 2026-11-14. A small
   self-hosted server on the family's Unraid machine (image published from this repo); the device stays the
   working copy and syncs in the background; Windows first. Order: storage groundwork (**done 2026-11-14**, see
   the code map), then the server and sync client right after the installer's file storage.

Built in this order (owner's decision, 2026-11-14). The racing game comes after the installer because it needs
3D models and a lot of design; only its prototype came early. Deferred: printing and export (ADR 0010).

## Status of decisions
- ADRs 0001–0009 and 0011–0016 are **Accepted** (the owner accepted 0002–0016 on 2026-11-14); 0010 is
  Deferred. From now on a change to any of them is a new ADR that supersedes it (ADR 0001).
- The look is ADR 0016: a design system called Crayon Box. It and the mockup canvas are artifacts,
  linked from the [ADR index](../adr/README.md). The canvas has 12 screens and was redrawn on 2026-11-14 to match
  the revised ADRs. The owner reviewed it the same day, asked for more colors and a per-picture coloring mode
  (both now in the mockups and ADRs 0003, 0004, 0007, 0016), and said it is otherwise about ready for an MVP.
- The mockups assume a 1280 × 800 screen; the real laptop's screen is still an
  [open question](open-questions.md).

## Code map
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
- `src/ui/`: Crayon Box tokens as CSS custom properties, kid components, icons, the palette, and the parent
  world kit with bundled fonts (ADR 0016).
- `src/games/coloring/`: the game (lazy-loaded): `game.ts` (start, library, My pictures), `session.ts` (the
  coloring screen), `engine/` (ADR 0004), `pictures.ts`, `pages.ts`, `parentSections.ts` (its parent screens).
- `src/games/racing/` (ADR 0021 prototype): `sim/` is plain TypeScript (the world, input, scene data, shapes)
  with unit tests; `render.ts` is the only three.js file and loads when the game opens; `game.ts` (screen,
  touch and keys, loop), `settings.ts` (per-kid assist, sounds), `parentSection.ts`, `sound.ts` (made by the
  browser, no files). Games can start hidden (`GameEntry.startsHidden`) and a parent shows or hides each one
  under Settings, Games (`ShellSettings.games`).
- `pages/`: three original CC0 placeholder pages in the ADR 0005 format.

## Milestone 1: remaining phases (agreed with the owner 2026-11-14)
- **A. Playtest and fixes:** prep done 2026-11-14: [playtest guide](../playtest.md) and
  `scripts/playtest.cmd` (Edge app window, ADR 0020). **Waiting on the owner** to run the playtest; findings then
  get fixed or recorded (swatch size, brush sizes, touch-down or lift).
- **B. Page pipeline:** done 2026-11-14: [page guide](../../pages/README.md), the rendered page check in CI
  (`tests/e2e/pages.spec.ts`, ADR 0005), the theme strip and blank page. Still open for C: who draws the pages.
- **C. The real page library:** about 48 pages in 8 themes, in batches, each through the check. Sources decided
  in [ADR 0022](../adr/0022-where-built-in-pages-come-from.md): SVG drawn by Claude for Race cars, Things that go,
  Shapes and Yummy food; AI-made (with the clean-up step) for the animal themes. Race cars done 2026-11-14
  (6 pages). Next SVG batch: Things that go. The shapes placeholder stays as a real Shapes page.
- **D. Polish:** sounds with a Settings switch, optional gate PIN, reduce-motion check, design system and mockups
  updated to ADRs 0017–0020, optionally the two-finger undo limit.
A and B can run in parallel; D fits anywhere.
