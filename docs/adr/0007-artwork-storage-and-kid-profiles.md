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
- **Storage is split in two**, so autosave never fights OneDrive (the Pictures folder is often synced, and sync
  can lock a file in the middle of a save):
  - *Working copy*, in the app's data folder: `art\<kid>\<picture>\` holding `paint.png` (paint layer, for
    continuing), `prev.png` (the previous version, see below) and `art.json` (page id from ADR 0005, created and
    updated times). The gallery reads from here.
  - *Finished picture*, for parents: `Pictures\Coloring Book\Art\<kid>\<page>-<yyyy-mm-dd-hhmmss>.png`, the
    flattened picture with lines. It is written when the kid leaves the page or the app quits, and overwritten
    each time that picture is changed. The Pictures folder is looked up from Windows.
  - `<kid>` is the profile's symbol name (`star`, `heart`), never a real name.
- **Autosave:** 1 second after the last action, and when leaving the page. It writes only `paint.png`, encoded
  off the main thread so painting never stutters. Writes go to a temp file, then rename, so a crash never
  corrupts a picture.
- **Previous version:** when a picture is reopened, the app first copies its paint layer to `prev.png`. The
  parent area's gallery offers *Restore previous version*. This covers what undo can't: undo history ends when
  the page is closed, so without it a kid who picks a sibling's profile, or scribbles over a finished picture,
  would destroy it for good. One previous version is kept per picture.
- **Gallery:** newest first, big tiles. Tap = keep coloring. Starting a page that already has a picture in progress
  continues it; a fresh copy is available from the gallery.
- **Deleting** pictures only in the parent area. It removes the working copy and the finished picture.
- **Web milestone (ADR 0014):** both parts live in browser storage behind the same storage interface.

## Consequences
- Finished pictures are ordinary PNG files that OneDrive or any backup picks up automatically.
- The working copies are not in Pictures, so a backup of Pictures alone keeps every finished picture but not the
  ability to keep coloring it.
- Disk use is small (roughly 0.3–1 MB per file, up to three files per picture).
