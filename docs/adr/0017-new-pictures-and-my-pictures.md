# 0017. New pictures from the page library, old ones from My pictures

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Supersedes: in ADR 0007, "Starting a page that already has a picture in progress continues it; a fresh copy is
  available from the gallery". In ADR 0016, "A started page shows the kid's coloring on its tile".

## Context
In the first web build, opening a page that a kid had already started continued that picture, as ADR 0007 said.
The owner tried it and wants pages to be colorable again and again: a kid should be able to color the same fish
as many times as they like, and still go back to an older picture to keep working on it. ADR 0007 left open where
a "fresh copy" would come from, and the mockups had no place for it.

## Decision
- The coloring game starts on a screen with two big paper tiles:
  - **New picture**: opens the page library. Tapping a page always starts a new picture of it.
  - **My pictures**: the kid's own pictures, newest first, each tile showing the picture as it is now. Tapping
    one continues it, and keeps its previous version first (ADR 0007).
- When a kid has no pictures yet, the My pictures tile is not shown and the game opens straight on the page
  library (no disabled controls, ADR 0016 rule 6).
- Library tiles show the blank page only. They no longer show a kid's coloring.
- Back from the coloring screen returns to where the picture was opened from (the library or My pictures). Back
  from those returns to the start screen; back from the start screen returns to the kid picker.
- A new picture is only stored once something is painted on it, so opening a page and leaving at once adds
  nothing to My pictures.
- Tiles follow ADR 0016: three across, two down, the sixth a "more" arrow when there are more.

## Consequences
- The open question about a "fresh copy" is answered: every page tap is a fresh copy.
- A kid's pictures grow without limit; deleting stays in the parent area (ADR 0007, 0008).
- The start screen adds one tap before the library once a kid has pictures.
