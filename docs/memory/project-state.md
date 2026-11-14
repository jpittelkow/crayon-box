# Project state

_Last updated: 2026-11-14_

## Phase
Design done, no code yet. The repo holds the README, ADRs 0001–0016, and the memory and journal docs.

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

## Next step
Scaffold the web app (Vite + TypeScript, `src/games/coloring/`, app shell per ADR 0012) and build the coloring
engine (ADR 0004) with a handful of placeholder pages and the tests from ADR 0015. Kid screens are built from
the Crayon Box tokens and components (ADR 0016).
