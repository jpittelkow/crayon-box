// The map in squares (docs/highway-map-plan.md, phase 2: "map tiles"), so the simulation only looks at what is near.
// A grid lists, for each square, the things whose box overlaps it: road and shoreline segments (in small squares,
// they are many), and trees, toys, waters and zones (in squares of about 50 m). Nearest-road, the shore, bumping
// trees, knocking toys and finding water or a zone then look in the squares round a point, not at everything on the
// map. The answers are exactly the old ones, ties and order included (sim/grid.test.ts checks them against the slow
// way on thousands of random points, and a minute of driving step by step). Plain TypeScript.

/** Squares for road and shoreline segments, in metres: a segment is about 1.5 m, so a square holds a few. */
export const SEG_SQUARE = 12.5;
/** Squares for trees, toys, waters and zones, in metres. */
export const THING_SQUARE = 50;
/** A road or shoreline with fewer segments than this is quick enough to look through whole. */
export const GRID_FROM = 32;

/**
 * Whether lookups use the grids. Off only in tests, to run the old, slow way and compare; everything is built the
 * same either way.
 */
export const LOOKUP = { grid: true };

/** A grid over a rectangle: square `k`'s things are `items[start[k]]` to `items[start[k + 1] - 1]`, in rising order. */
export interface Grid {
  minX: number; minZ: number; size: number; nx: number; nz: number;
  start: Int32Array; items: Int32Array;
}

/** Boxes are grown by this much (metres), so rounding can't leave a thing out of a square it touches. */
const PAD = 1e-3;

/**
 * A grid of `count` things, each listed in every square its box overlaps. `box(i, out)` writes thing `i`'s box as
 * min x, min z, max x, max z into `out`.
 */
export function buildGrid(count: number, size: number, box: (i: number, out: Float64Array) => void): Grid {
  const boxes = new Float64Array(count * 4), one = new Float64Array(4);
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    box(i, one);
    const x0 = one[0]! - PAD, z0 = one[1]! - PAD, x1 = one[2]! + PAD, z1 = one[3]! + PAD;
    boxes[i * 4] = x0; boxes[i * 4 + 1] = z0; boxes[i * 4 + 2] = x1; boxes[i * 4 + 3] = z1;
    if (x0 < minX) minX = x0;
    if (z0 < minZ) minZ = z0;
    if (x1 > maxX) maxX = x1;
    if (z1 > maxZ) maxZ = z1;
  }
  if (!count) minX = minZ = maxX = maxZ = 0;
  const nx = Math.max(1, Math.floor((maxX - minX) / size) + 1), nz = Math.max(1, Math.floor((maxZ - minZ) / size) + 1);
  const span = (i: number) => [
    Math.floor((boxes[i * 4]! - minX) / size), Math.floor((boxes[i * 4 + 1]! - minZ) / size),
    Math.min(nx - 1, Math.floor((boxes[i * 4 + 2]! - minX) / size)), Math.min(nz - 1, Math.floor((boxes[i * 4 + 3]! - minZ) / size)),
  ] as const;
  const start = new Int32Array(nx * nz + 1);
  for (let i = 0; i < count; i++) {
    const [a, b, c, d] = span(i);
    for (let z = b; z <= d; z++) for (let x = a; x <= c; x++) start[z * nx + x + 1]!++;
  }
  for (let k = 0; k < nx * nz; k++) start[k + 1]! += start[k]!;
  const items = new Int32Array(start[nx * nz]!), fill = start.slice(0, nx * nz);
  for (let i = 0; i < count; i++) {
    const [a, b, c, d] = span(i);
    for (let z = b; z <= d; z++) for (let x = a; x <= c; x++) items[fill[z * nx + x]!++] = i;
  }
  return { minX, minZ, size, nx, nz, start, items };
}

/** The square a point is in, or -1 outside the grid. */
export function squareAt(g: Grid, x: number, z: number): number {
  const cx = Math.floor((x - g.minX) / g.size), cz = Math.floor((z - g.minZ) / g.size);
  return cx < 0 || cz < 0 || cx >= g.nx || cz >= g.nz ? -1 : cz * g.nx + cx;
}

/**
 * The things listed in the squares a box overlaps, each once, in rising order. `seen` is a scratch list with a
 * slot per thing (it is left as it was found).
 */
export function inBox(g: Grid, x0: number, z0: number, x1: number, z1: number, seen: Uint8Array, out: number[] = []): number[] {
  out.length = 0;
  const a = Math.max(0, Math.floor((x0 - g.minX) / g.size)), b = Math.max(0, Math.floor((z0 - g.minZ) / g.size));
  const c = Math.min(g.nx - 1, Math.floor((x1 - g.minX) / g.size)), d = Math.min(g.nz - 1, Math.floor((z1 - g.minZ) / g.size));
  for (let z = b; z <= d; z++) {
    for (let x = a; x <= c; x++) {
      const k = z * g.nx + x;
      for (let j = g.start[k]!; j < g.start[k + 1]!; j++) {
        const i = g.items[j]!;
        if (seen[i]) continue;
        seen[i] = 1;
        out.push(i);
      }
    }
  }
  for (const i of out) seen[i] = 0;
  // One square's list is already in order; several are merged.
  if (a !== c || b !== d) out.sort((p, q) => p - q);
  return out;
}

/**
 * The thing nearest a point, by `d2(i)` (its squared distance), looking out square by square from the point and
 * stopping once nothing further out could be nearer. A tie goes to the lower index, as a plain loop with `<` does.
 * Things further than `within` metres may be missed (then -1 comes back if nothing nearer was found).
 */
export function nearest(g: Grid, x: number, z: number, d2: (i: number) => number, within = Infinity): { i: number; d2: number } {
  const { nx, nz, size, start, items } = g;
  const cx = Math.floor((x - g.minX) / size), cz = Math.floor((z - g.minZ) / size);
  let best = Infinity, bi = -1;
  const first = Math.max(0, -cx, cx - (nx - 1), -cz, cz - (nz - 1));
  const last = Math.max(cx, nx - 1 - cx, cz, nz - 1 - cz);
  const visit = (sx: number, sz: number) => {
    const k = sz * nx + sx;
    for (let j = start[k]!; j < start[k + 1]!; j++) {
      const i = items[j]!, d = d2(i);
      if (d < best || (d === best && i < bi)) {
        best = d;
        bi = i;
      }
    }
  };
  for (let k = first; k <= last; k++) {
    if (k > 0) {
      // Everything not yet looked at is outside the block of squares round the point's own, k - 1 deep.
      const left = x - (g.minX + (cx - k + 1) * size), right = g.minX + (cx + k) * size - x;
      const below = z - (g.minZ + (cz - k + 1) * size), above = g.minZ + (cz + k) * size - z;
      const bound = Math.max(0, Math.min(left, right, below, above));
      if (bound > within || best < bound * bound) break;
    }
    const x0 = Math.max(0, cx - k), x1 = Math.min(nx - 1, cx + k);
    if (cz - k >= 0 && cz - k < nz) for (let sx = x0; sx <= x1; sx++) visit(sx, cz - k);
    if (k > 0 && cz + k >= 0 && cz + k < nz) for (let sx = x0; sx <= x1; sx++) visit(sx, cz + k);
    const z0 = Math.max(0, cz - k + 1), z1 = Math.min(nz - 1, cz + k - 1);
    if (k > 0 && cx - k >= 0 && cx - k < nx) for (let sz = z0; sz <= z1; sz++) visit(cx - k, sz);
    if (k > 0 && cx + k >= 0 && cx + k < nx) for (let sz = z0; sz <= z1; sz++) visit(cx + k, sz);
  }
  return { i: bi, d2: best };
}

/** A grid of segments along a path of points (`xs`, `zs`): segment `i` joins point `i` to the one `next(i)` gives. */
export function segmentGrid(xs: Float64Array, zs: Float64Array, count: number, other: (i: number) => number, size = SEG_SQUARE): Grid {
  return buildGrid(count, size, (i, out) => {
    const j = other(i);
    out[0] = Math.min(xs[i]!, xs[j]!); out[1] = Math.min(zs[i]!, zs[j]!);
    out[2] = Math.max(xs[i]!, xs[j]!); out[3] = Math.max(zs[i]!, zs[j]!);
  });
}

/** Round things (a centre and a radius) in squares. */
export function roundGrid<T>(things: readonly T[], size: number, place: (t: T) => { x: number; z: number; r: number }): Grid {
  return buildGrid(things.length, size, (i, out) => {
    const { x, z, r } = place(things[i]!);
    out[0] = x - r; out[1] = z - r; out[2] = x + r; out[3] = z + r;
  });
}

/** A list's grid, with the list's length when it was built. */
interface Squared { n: number; grid: Grid; seen: Uint8Array }
const squared = new WeakMap<object, Squared>();

/**
 * The things of a list (each a centre and a radius, as `place` gives them) whose box overlaps a box, in rising
 * order. The list's grid of 50 m squares is made the first time and again whenever the list is replaced or changes
 * length; a thing must not move after it is listed (trees, toys at home, waters and zones never do).
 */
export function thingsIn<T>(list: readonly T[], place: (t: T) => { x: number; z: number; r: number },
  x0: number, z0: number, x1: number, z1: number): number[] {
  let s = squared.get(list);
  if (!s || s.n !== list.length) {
    s = { n: list.length, grid: roundGrid(list, THING_SQUARE, place), seen: new Uint8Array(list.length) };
    squared.set(list, s);
  }
  return inBox(s.grid, x0, z0, x1, z1, s.seen);
}

/** How far a point is from a box (0 inside it). */
export function boxDistance(box: readonly [number, number, number, number], x: number, z: number): number {
  const dx = Math.max(box[0] - x, 0, x - box[2]), dz = Math.max(box[1] - z, 0, z - box[3]);
  return Math.hypot(dx, dz);
}
