// Region map (ADR 0004): the page's outlines become a wall mask, and every enclosed area gets a region id.
// Pure functions on typed arrays, so they run in the worker and in unit tests alike.

export const INK_RGB = [0x23, 0x20, 0x1c] as const;

/** A pixel is a wall when it is darker than this (0..255, after alpha). */
export const WALL_DARKNESS = 128;

export interface Regions {
  width: number;
  height: number;
  /** One id per pixel: 0 for a wall, 1..count for regions. */
  labels: Int32Array;
  count: number;
  /** Per region id: minX, minY, maxX, maxY (inclusive). Index `id * 4`. Entry 0 is unused. */
  bboxes: Int32Array;
  /** Pixel count per region id. */
  areas: Int32Array;
}

export interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 255 where the region (plus its growth under the outlines) is, 0 elsewhere. Row-major, `width * height`. */
  alpha: Uint8Array;
}

/**
 * Splits a rendered page into walls and the visible line layer. Works for both black-on-transparent (SVG) and
 * black-on-white (PNG) pages: darkness decides, so white paper becomes transparent on the line layer.
 */
export function wallsFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): { walls: Uint8Array; lines: Uint8ClampedArray<ArrayBuffer> } {
  const n = width * height;
  const walls = new Uint8Array(n);
  const lines = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const lum = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
    const darkness = ((255 - lum) * rgba[o + 3]) / 255;
    if (darkness > WALL_DARKNESS) walls[i] = 1;
    lines[o] = INK_RGB[0];
    lines[o + 1] = INK_RGB[1];
    lines[o + 2] = INK_RGB[2];
    lines[o + 3] = darkness;
  }
  return { walls, lines };
}

/** Connected-component labeling (4-connected) with union-find. */
export function labelRegions(walls: Uint8Array, width: number, height: number): Regions {
  const n = width * height;
  const labels = new Int32Array(n);
  let parent = new Int32Array(1024);
  let next = 1;

  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      if (ra < rb) parent[rb] = ra;
      else parent[ra] = rb;
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (walls[i]) continue;
      const left = x > 0 ? labels[i - 1] : 0;
      const up = y > 0 ? labels[i - width] : 0;
      if (left && up) {
        labels[i] = left;
        if (left !== up) union(left, up);
      } else if (left || up) {
        labels[i] = left || up;
      } else {
        if (next >= parent.length) {
          const grown = new Int32Array(parent.length * 2);
          grown.set(parent);
          parent = grown;
        }
        parent[next] = next;
        labels[i] = next++;
      }
    }
  }

  // Second pass: resolve to consecutive ids and collect bounding boxes and areas.
  const remap = new Int32Array(next);
  let count = 0;
  for (let l = 1; l < next; l++) {
    const r = find(l);
    if (r === l) remap[l] = ++count;
  }
  for (let l = 1; l < next; l++) remap[l] = remap[find(l)];

  const bboxes = new Int32Array((count + 1) * 4);
  for (let id = 1; id <= count; id++) {
    bboxes[id * 4] = width;
    bboxes[id * 4 + 1] = height;
    bboxes[id * 4 + 2] = -1;
    bboxes[id * 4 + 3] = -1;
  }
  const areas = new Int32Array(count + 1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const l = labels[i];
      if (!l) continue;
      const id = remap[l];
      labels[i] = id;
      areas[id]++;
      const b = id * 4;
      if (x < bboxes[b]) bboxes[b] = x;
      if (y < bboxes[b + 1]) bboxes[b + 1] = y;
      if (x > bboxes[b + 2]) bboxes[b + 2] = x;
      if (y > bboxes[b + 3]) bboxes[b + 3] = y;
    }
  }

  return { width, height, labels, count, bboxes, areas };
}

/** How far a tap on a line looks for a region (ADR 0004). */
export const NEAREST_REGION_PX = 8;

/**
 * The region under (x, y). On a line, the nearest region within `maxDist` pixels; 0 if there is none (a tap in the
 * middle of a very thick line).
 */
export function regionAt(regions: Regions, x: number, y: number, maxDist = NEAREST_REGION_PX): number {
  const { width, height, labels } = regions;
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx >= 0 && cy >= 0 && cx < width && cy < height) {
    const id = labels[cy * width + cx];
    if (id) return id;
  }
  let best = 0;
  let bestD = maxDist * maxDist + 1;
  for (let dy = -maxDist; dy <= maxDist; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= height) continue;
    for (let dx = -maxDist; dx <= maxDist; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= width) continue;
      const d = dx * dx + dy * dy;
      if (d >= bestD) continue;
      const id = labels[py * width + px];
      if (id) {
        best = id;
        bestD = d;
      }
    }
  }
  return best;
}

/** How far a fill or a stay-in-the-lines stroke grows under the outlines, so no white halo shows (ADR 0004). */
export const GROW_PX = 2;

/**
 * The pixels a fill of region `id` covers: the region itself plus wall pixels within `grow` pixels of it. Growth
 * only ever goes into walls, so it can't leak into a neighbouring region.
 */
export function regionMask(regions: Regions, id: number, grow = GROW_PX): Mask {
  const { width, height, labels, bboxes } = regions;
  if (id < 1 || id > regions.count) throw new Error(`No region ${id}`);
  const x0 = Math.max(0, bboxes[id * 4] - grow);
  const y0 = Math.max(0, bboxes[id * 4 + 1] - grow);
  const x1 = Math.min(width - 1, bboxes[id * 4 + 2] + grow);
  const y1 = Math.min(height - 1, bboxes[id * 4 + 3] + grow);
  const mw = x1 - x0 + 1;
  const mh = y1 - y0 + 1;

  const inside = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    const row = (y + y0) * width + x0;
    for (let x = 0; x < mw; x++) if (labels[row + x] === id) inside[y * mw + x] = 1;
  }

  // Square dilation, separable: horizontal pass then vertical pass.
  const horiz = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const lo = Math.max(0, x - grow);
      const hi = Math.min(mw - 1, x + grow);
      for (let k = lo; k <= hi; k++) {
        if (inside[y * mw + k]) {
          horiz[y * mw + x] = 1;
          break;
        }
      }
    }
  }
  const alpha = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) {
    for (let x = 0; x < mw; x++) {
      const i = y * mw + x;
      if (inside[i]) {
        alpha[i] = 255;
        continue;
      }
      if (labels[(y + y0) * width + x + x0] !== 0) continue; // another region: never grow into it
      const lo = Math.max(0, y - grow);
      const hi = Math.min(mh - 1, y + grow);
      for (let k = lo; k <= hi; k++) {
        if (horiz[k * mw + x]) {
          alpha[i] = 255;
          break;
        }
      }
    }
  }
  return { x: x0, y: y0, width: mw, height: mh, alpha };
}
