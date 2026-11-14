# 0007. Artwork storage, autosave and kid profiles

- Status: Proposed
- Date: 2026-11-14

## Context
Artwork must never be lost, must be easy for parents to find and back up, and each kid should see their own
pictures.

## Decision
- **Kid profiles:** each kid has a color and a picture symbol (star, heart, ...) instead of a name, plus their own
  coloring-mode setting (free coloring by default, or stay in the lines). The family has several kids, so the
  page picker and gallery start with a big kid-picker; profiles are shared across all games (ADR 0012).
- **Storage:** `Pictures\Coloring Book\Art\<kid>\<page>-<yyyy-mm-dd-hhmm>\` holding
  `paint.png` (paint layer, for continuing), `final.png` (flattened picture with lines, for viewing and sharing),
  and `art.json` (page id, created and updated times).
- **Autosave:** 1 second after the last action, and when leaving the page. Writes go to a temp file, then rename,
  so a crash never corrupts a picture.
- **Gallery:** newest first, big tiles. Tap = keep coloring. Starting a page that already has a picture in progress
  continues it; a fresh copy is available from the gallery.
- **Deleting** pictures only in the parent area.

## Consequences
- Pictures are ordinary PNG files that OneDrive or any backup picks up automatically.
- Disk use is small (roughly 0.3–1 MB per picture).
