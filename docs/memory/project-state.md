# Project state

_Last updated: 2026-11-14_

## Phase
Milestone 1 (web app) started on 2026-11-14. `npm run dev` opens the kid picker; a kid picks one of three
placeholder pages and can fill, paint, erase, undo, start over and switch the coloring mode. Pictures autosave to
IndexedDB. Unit tests (Vitest) and browser tests (Playwright, touch emulation) pass locally; a CI workflow runs
them but has not run on GitHub yet (nothing committed).

## Milestones (defined in ADR 0014)
1. **Web app:** a stepping stone. Coloring game in a browser (Edge), browser storage behind the storage
   interface. Runs locally only: the Vite dev server, or a local container on the dev machine. Never hosted
   online. Used to test with the kids early. Art made here is throwaway.
2. **Installer:** Tauri 2 + NSIS, kiosk lock, file storage, signed in-app updates, AI page maker.
3. **Racing game** (ADR 0012): second game module, needs its own ADR first.

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
- `src/shell/`: app shell (ADR 0012): kid picker, home screen (skipped with one game), game registry, guards
  against escape hatches (ADR 0003 rule 4), default profiles.
- `src/storage/`: storage interface (ADR 0007) with an IndexedDB backend and an in-memory one for tests.
- `src/ui/`: Crayon Box tokens as CSS custom properties, kid components, icons and the palette (ADR 0016).
- `src/games/coloring/`: the game (lazy-loaded), `engine/` (ADR 0004: canvases, region worker, undo),
  `pictures.ts` (art.json, paint.png, prev.png), `pages.ts` (bundles `pages/`).
- `pages/`: three original CC0 placeholder pages in the ADR 0005 format.

## Milestone 1: what is left (ADR 0014 "In")
- Parent gate and parent area with basic settings and page hiding (ADR 0008). Until then the three default
  profiles (star, heart, moon) are seeded on first run and can't be changed.
- Gallery (ADR 0007), the theme strip on the page picker (ADR 0016), the lock button on the shell screens.
- The rendered page check in CI (open shapes, tiny regions; ADR 0005). Only the page.json/license part exists.
- The local container (Dockerfile) for a steadier copy (ADR 0014).
- Sounds (none exist yet; the app is silent), and bundled fonts plus `CREDITS.md` once the parent world needs
  text (ADR 0016).
- The ~48 real built-in pages (see open questions).
