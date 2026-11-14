# 0004. Coloring engine: layers, fill, stay-in-lines, undo

- Status: Proposed
- Date: 2026-11-14

## Context
Kids need tap-to-fill, finger painting, an eraser, and a parent switch between "stay in the lines" and
"free coloring". Black outlines must never get painted over.

## Decision
- **Layers** (stacked canvases, 2048 × 1536 internal resolution, scaled to fit):
  1. paper (white), 2. paint layer (all coloring), 3. line layer (the page's outlines, always on top).
- **Region map:** when a page opens, its outlines are thresholded into a wall mask, and every enclosed area gets a
  region id (connected-component labeling). Computed once per page and cached.
- **Bucket:** fills the whole region under the finger on the paint layer, then grows 2 px under the outlines so
  no white halo shows. Tapping exactly on a line picks the nearest region within 8 px.
- **Brush / eraser:** round strokes on the paint layer using coalesced pointer events for smooth lines.
  Rainbow color cycles hue along the stroke. Eraser uses `destination-out` on the paint layer only.
- **Stay in the lines:** the region id under the first touch becomes a clip mask; the stroke only paints pixels in
  that region. Free coloring paints anywhere. **Free coloring is the default**; stay-in-the-lines is a per-kid option (ADR 0007).
- **Undo:** each action stores the "before" pixels of its bounding box only; up to 50 steps per page session.
  "Start over" is one undo step.
- Heavy work (region labeling, fills) runs in a Web Worker so the UI never freezes.

## Consequences
- Outlines are always crisp and untouchable.
- Pages must have closed shapes for the bucket to work well; the page pipeline (ADR 0005/0006) closes small gaps.
