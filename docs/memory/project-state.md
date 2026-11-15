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
   **Next up** (owner, 2026-11-14): milestone 1 is paused with only the animal themes left;
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
   Letters screen. Off until a parent turns on
   "Show Letters" under Settings, Games. Not yet playtested with the kids or tried with a real pen. Since
   2026-11-14 the whole letter must be traced and the kid taps a check to finish
   ([ADR 0028](../adr/0028-letter-tracing-whole-letter-and-confirm.md)), and the strokes follow how US schools
   teach print letters (Zaner-Bloser).
   **Later** (asked by the owner 2026-11-14; nothing designed yet): **writing words**, a next level after single
   letters (tracing short words letter by letter). Needs its own ADR.

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
  the tests mostly use the old ring, `maps/ring.ts`); fourteen vehicles (`look/vehicles.ts`, `look/fleet.ts`) and roads are point paths (`sim/roads.ts`, drawn by `look/roads.ts`); toys,
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
  clean-up step for AI-made pages is built (`cleanup.ts`, dev tool `tools/clean-page.html`). Left: the four
  animal themes (Farm and pets, Wild animals, Under the sea, Outside), made with an AI image model and cleaned up;
  needs a model picked (open questions).
- **D. Polish:** done 2026-11-14: sounds with a Settings switch (`shell/sound.ts`; files since ADR 0032),
  the optional gate PIN (stored as a hash), the reduce-motion check (browser test), and the two-finger undo limit
  fixed (each stroke draws on its own layer until the finger lifts). The design system artifact was matched to
  ADRs 0017–0025 and the code on 2026-11-14 (`kid-swatch` token, names and photos, start screen, theme strip,
  driving tile and horn, gate PIN, parent nav). The mockup canvas was matched the same day (18 boards, 6 of them new:
  coloring start, driving, kid editor, parent Driving, add from an idea, family sync).
A and B can run in parallel; D fits anywhere.
