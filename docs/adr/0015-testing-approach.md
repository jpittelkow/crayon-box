# 0015. Testing approach

- Status: Proposed
- Date: 2026-11-14

## Context
The coloring engine has fiddly logic (regions, fills, clip masks, the undo memory cap, image cleanup) where a
small mistake shows up as paint leaking through a line or a lost picture. The kid screens depend on touch rules
(ADR 0003) that are easy to break without noticing. Because all app logic is web technology (ADR 0002), most of
it can be tested in a browser without the installer.

## Decision
- **Unit tests (Vitest)** for the pure logic: region labeling, bucket fill, stay-in-the-lines clipping, undo
  history and its memory cap (ADR 0004), the import cleanup and the page check (ADR 0005), and the storage
  interface (ADR 0007). They run on small fixture images kept in the repo.
- **Browser tests (Playwright, Chromium with touch emulation)** for a handful of whole flows:
  pick a kid → pick a page → paint → leave → the picture is in the gallery; reopen and restore the previous
  version; open the parent gate; two fingers painting at once.
- **CI** runs the unit tests, the browser tests and the page check on every pull request.
- **By hand on the laptop**, from a written checklist, before a draft release is published (ADR 0009): the
  installer, an in-app update from the previous version, the kiosk lock and keyboard hook, and the laptop setup
  steps (ADR 0014). These can't be tested in a browser.
- **Playtests with the kids** are the real test of the interaction rules. What was learned goes in the journal,
  following the privacy rule in `CLAUDE.md`.

## Consequences
- Engine bugs are caught before a kid finds them.
- Test images and test profiles must follow the privacy rule too: symbols, not names, and no family photos.
- The manual checklist adds a few minutes to each release.
