# Project state

_Last updated: 2026-11-14_

## Phase
Design done, no code yet. The repo holds only the README and ADRs 0001–0014.

## Roadmap (from the ADRs)
1. **Web app** (ADR 0014 phase 1): coloring game in a browser (Edge), IndexedDB storage behind the storage
   interface, Fullscreen API. Used to test with the kids early.
2. **Windows installer** (ADR 0002, 0009, 0014 phase 2): Tauri 2 + NSIS, file storage under
   `Pictures\Coloring Book\`, kiosk lock + keyboard hook, signed in-app updates from GitHub Releases.
3. **Racing game** (ADR 0012): second game module, needs its own ADR first.
4. Deferred: printing and export (ADR 0010).

## Status of decisions
- ADR 0001 is Accepted; 0010 is Deferred; all others are **Proposed** and waiting on the owner's go-ahead.
- Screen mockups exist as an artifact, linked from the [ADR index](../adr/README.md).

## Next step
Scaffold the web app (Vite + TypeScript, `src/games/coloring/`, app shell per ADR 0012) and build the coloring
engine (ADR 0004) with a handful of placeholder pages.
