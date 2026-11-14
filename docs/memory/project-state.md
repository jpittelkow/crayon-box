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
   interface. Runs locally only: the Vite dev server, or a local container on the dev machine. Never hosted
   online. Used to test with the kids early. Art made here is throwaway.
2. **Installer:** Tauri 2 + NSIS, kiosk lock, file storage, signed in-app updates, AI page maker.
3. **Racing game** (ADR 0012): second game module, needs its own ADR first.
4. **Sync between devices** (asked by the owner on 2026-11-14, "maybe a later milestone"): settings, profiles and
   maybe pictures saved to a server. Not designed yet; needs its own ADR, and changes ADR 0014 (nothing hosted
   online) and ADR 0018 (names and photos stay on the device). See [open questions](open-questions.md).

Built in this order (owner's decision, 2026-11-14). The racing game is last because it needs an ADR, 3D models
and a lot of design. Deferred: printing and export (ADR 0010).

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
- `src/shell/`: app shell (ADR 0012): kid picker with the lock, home screen (skipped with one game), game
  registry, guards against escape hatches (ADR 0003 rule 4), profiles and shell settings.
- `src/parent/`: gate (ADR 0008), parent area, kid editor, photo cropping. Loaded only when the gate opens.
- `src/storage/`: storage interface (ADR 0007) with an IndexedDB backend and an in-memory one for tests.
- `src/ui/`: Crayon Box tokens as CSS custom properties, kid components, icons, the palette, and the parent
  world kit with bundled fonts (ADR 0016).
- `src/games/coloring/`: the game (lazy-loaded): `game.ts` (start, library, My pictures), `session.ts` (the
  coloring screen), `engine/` (ADR 0004), `pictures.ts`, `pages.ts`, `parentSections.ts` (its parent screens).
- `pages/`: three original CC0 placeholder pages in the ADR 0005 format.

## Milestone 1: what is left (ADR 0014 "In")
- The theme strip on the page library (ADR 0016); only three pages exist so far.
- The rendered page check in CI (open shapes, tiny regions; ADR 0005). Only the page.json/license part exists.
- The local container (Dockerfile) for a steadier copy (ADR 0014).
- Sounds (none exist yet; the app is silent, and there is no Sounds setting).
- Optional PIN instead of number words at the gate (ADR 0008).
- The ~48 real built-in pages (see open questions).
- The design system and mockup artifacts still show 80 px swatches, no names, and the old page flow; they need
  updating to ADRs 0017–0019.
