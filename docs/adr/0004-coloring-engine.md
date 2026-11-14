# 0004. Coloring engine: layers, fill, stay-in-lines, undo

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14

## Context
Kids need tap-to-fill, finger painting, an eraser, and a switch on each picture between "stay in the lines" and
"free coloring". Black outlines must never get painted over.

## Decision
- **Layers** (stacked canvases, 2048 × 1536 internal resolution, scaled to fit):
  1. paper (white), 2. paint layer (all coloring), 3. line layer (the page's outlines, always on top).
  The page is 4:3. On a wider screen the spare width holds the color and tool bars. The target laptop's
  resolution and shape still need recording to settle that layout.
- **Region map:** when a page opens, its outlines are thresholded into a wall mask, and every enclosed area gets a
  region id (connected-component labeling). Computed once per page and cached.
- **Bucket:** fills the whole region under the finger on the paint layer, then grows 2 px under the outlines so
  no white halo shows. Tapping exactly on a line picks the nearest region within 8 px.
- **Brush / eraser:** round strokes on the paint layer using coalesced pointer events for smooth lines. Each
  active touch draws its own stroke (ADR 0003). Rainbow color cycles hue along the stroke. Eraser uses
  `destination-out` on the paint layer only.
- **Stay in the lines:** the region under each stroke's starting point becomes that stroke's clip mask; the stroke
  only paints pixels in that region. A stroke that starts on a line uses the nearest region within 8 px, like the
  bucket. Free coloring paints anywhere.
- **The mode belongs to the picture** (decided by the owner, 2026-11-14). Two picture buttons on the coloring
  screen switch between free coloring and stay in the lines at any time (ADR 0016). The choice is saved with the
  picture (ADR 0007) and only affects strokes made after the switch; paint already on the page is untouched. A
  new picture starts in the kid's starting mode, which is **free coloring** unless a parent changes it
  (ADR 0007).
- **Undo:** each action (one stroke, one fill, one "start over") stores the "before" pixels of its bounding box
  only, run-length compressed. History is capped at 20 steps or about 150 MB per page session, whichever comes
  first; the oldest step is dropped. The memory cap matters because a full-page action is about 12.6 MB
  uncompressed. "Start over" is one undo step.
- Heavy work (region labeling, fills) runs in a Web Worker so the UI never freezes.

## Consequences
- Outlines are always crisp and untouchable.
- Pages must have closed shapes for the bucket to work well; the page pipeline (ADR 0005/0006) closes small gaps.
