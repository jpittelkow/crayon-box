# Project state

_Last updated: 2026-11-14_

## Phase
Design done, no code yet. The repo holds the README, ADRs 0001–0015, and the memory and journal docs.

## Milestones (defined in ADR 0014)
1. **Web app:** coloring game in a browser (Edge), browser storage behind the storage interface. Used to test
   with the kids early. Art made here is throwaway.
2. **Installer:** Tauri 2 + NSIS, kiosk lock, file storage, signed in-app updates, AI page maker.
3. **Racing game** (ADR 0012): second game module, needs its own ADR first.

Milestone 1 is first. The order of 2 and 3 is not decided (see [open-questions.md](open-questions.md)).
Deferred: printing and export (ADR 0010).

## Status of decisions
- ADR 0001 is Accepted; 0010 is Deferred; all others are **Proposed** and waiting on the owner's go-ahead.
- The Proposed ADRs were revised on 2026-11-14 after a review (see the journal entry for that day).
- Screen mockups exist as an artifact, linked from the [ADR index](../adr/README.md). They were made before the
  review, so they may not match the revised parent gate (ADR 0008) or lock-button placement.

## Next step
Scaffold the web app (Vite + TypeScript, `src/games/coloring/`, app shell per ADR 0012) and build the coloring
engine (ADR 0004) with a handful of placeholder pages and the tests from ADR 0015.
