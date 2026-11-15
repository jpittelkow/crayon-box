// The page check (ADR 0005): finds open shapes and very small areas in a page's line art. Runs in CI on every
// built-in page (tests/e2e/pages.spec.ts) on the same region map the app uses.
import { labelRegions } from './regions';

/** Gaps up to this wide count as mistakes in the line art, not openings (ADR 0005). */
export const GAP_PX = 6;

/** Areas smaller than this share of the page are reported (ADR 0005: 0.2%, about 79 x 79 px). */
export const SMALL_REGION_SHARE = 0.002;

/**
 * Areas below this many pixels are ignored: line junctions and sharp corners leave specks a kid can't tap anyway,
 * and closing gaps can cut such specks off a corner without anything being wrong.
 */
export const SPECK_PX = 400;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageCheckResult {
  /** Number of areas a kid can fill (specks left out). */
  regions: number;
  /** Areas that closing small gaps splits in two or more: the shape around them is open. Each is a failure. */
  openShapes: Box[];
  /** Areas smaller than SMALL_REGION_SHARE of the page: a warning, since eyes and details are small on purpose. */
  smallRegions: Box[];
}

export interface PageCheckOptions {
  gap?: number;
  speck?: number;
  smallShare?: number;
}

/** Grows walls by `r` (square), treating outside the image as `outside`. */
function morph(src: Uint8Array, width: number, height: number, r: number, grow: boolean): Uint8Array {
  // Dilation keeps a pixel set if any neighbour is set; erosion keeps it only if all are. Out of bounds counts as
  // not-wall for dilation and as wall for erosion, so lines that run off the page edge stay closed there.
  const horiz = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = grow ? 0 : 1;
      for (let k = x - r; k <= x + r; k++) {
        const s = k < 0 || k >= width ? (grow ? 0 : 1) : src[y * width + k];
        if (grow ? s : !s) {
          v = grow ? 1 : 0;
          break;
        }
      }
      horiz[y * width + x] = v;
    }
  }
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = grow ? 0 : 1;
      for (let k = y - r; k <= y + r; k++) {
        const s = k < 0 || k >= height ? (grow ? 0 : 1) : horiz[k * width + x];
        if (grow ? s : !s) {
          v = grow ? 1 : 0;
          break;
        }
      }
      out[y * width + x] = v;
    }
  }
  return out;
}

/** Morphological closing of the walls: shuts gaps up to `gap` px wide and leaves line widths as they were. */
export function closeGaps(walls: Uint8Array, width: number, height: number, gap = GAP_PX): Uint8Array {
  const r = Math.ceil(gap / 2);
  return morph(morph(walls, width, height, r, true), width, height, r, false);
}

export function checkPage(walls: Uint8Array, width: number, height: number, opts: PageCheckOptions = {}): PageCheckResult {
  const gap = opts.gap ?? GAP_PX;
  const speck = opts.speck ?? SPECK_PX;
  const small = (opts.smallShare ?? SMALL_REGION_SHARE) * width * height;

  const before = labelRegions(walls, width, height);
  const after = labelRegions(closeGaps(walls, width, height, gap), width, height);

  // For each area of the page as drawn, which real areas does it become once small gaps are closed?
  const pieces = new Map<number, Set<number>>();
  for (let i = 0; i < before.labels.length; i++) {
    const a = before.labels[i];
    const b = after.labels[i];
    if (!a || !b || after.areas[b] < speck) continue;
    let set = pieces.get(a);
    if (!set) pieces.set(a, (set = new Set()));
    set.add(b);
  }

  const box = (id: number): Box => {
    const o = id * 4;
    const [x0, y0, x1, y1] = [before.bboxes[o], before.bboxes[o + 1], before.bboxes[o + 2], before.bboxes[o + 3]];
    return { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  };

  const openShapes: Box[] = [];
  const smallRegions: Box[] = [];
  let regions = 0;
  for (let id = 1; id <= before.count; id++) {
    const area = before.areas[id];
    if (area < speck) continue;
    regions++;
    if ((pieces.get(id)?.size ?? 0) > 1) openShapes.push(box(id));
    if (area < small) smallRegions.push(box(id));
  }
  return { regions, openShapes, smallRegions };
}
