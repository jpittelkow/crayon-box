# 0010. Printing and export

- Status: Deferred (not in v1, per Jeff 2026-11-14)
- Date: 2026-11-14

## Context
Parents want to print finished pictures for the fridge, print blank pages for crayons, and share pictures.

## Decision (when picked up)
- Printing is in the parent area: a picture from the gallery, or a blank page from the library.
- The app renders a print-only view (picture scaled to fit, landscape, no UI) and opens the Windows print dialog.
- Export is free: every finished picture is already a PNG in `Pictures\Coloring Book\Art` (ADR 0007).
  "Open folder" opens it in File Explorer.

## Consequences
- Works with any printer Windows knows about; no printer setup in the app.
