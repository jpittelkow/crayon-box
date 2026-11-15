// The road network (driving-assets.md, category 5): roads as paths of points that the simulation follows for
// traffic, the "follows the road" assist, the rescue and placing things in the car's way. Plain TypeScript.
//
// Directions follow the simulation: a heading h points along (sin h, cos h), and a positive lane offset is to the
// right of the direction of travel (on the island's ring road, toward the sea).

/** A road as a map file gives it. */
export interface RoadDef {
  /** The kind of road (driving-assets.md): only `street` so far. */
  kind: 'street';
  /** Width in metres, kerb to kerb. */
  width: number;
  /** The centre line, in order. Close points (about 1.5 m apart) follow a curve well; see `smoothPath`. */
  points: [number, number][];
  /** A loop joins its last point back to its first. Traffic needs loops until junctions exist. */
  closed: boolean;
}

/** A road ready for the simulation: its points with the distance along the road to each. */
export interface Road {
  def: RoadDef;
  xs: Float64Array;
  zs: Float64Array;
  /** Distance along the road at each point; for a loop, one extra entry for the way back to the start. */
  at: Float64Array;
  length: number;
}

/** Where a point is relative to a road. */
export interface RoadSpot {
  road: number;
  /** Distance along the road. */
  s: number;
  /** The nearest point on the centre line. */
  x: number;
  z: number;
  /** The road's heading there. */
  heading: number;
  /** Signed distance from the centre line: positive is right of the road's direction. */
  offset: number;
  /** Plain distance from the centre line. */
  dist: number;
}

export function buildRoad(def: RoadDef): Road {
  const n = def.points.length;
  const count = def.closed ? n + 1 : n;
  const xs = new Float64Array(count), zs = new Float64Array(count), at = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const [x, z] = def.points[i % n]!;
    xs[i] = x;
    zs[i] = z;
    at[i] = i === 0 ? 0 : at[i - 1]! + Math.hypot(x - xs[i - 1]!, z - zs[i - 1]!);
  }
  return { def, xs, zs, at, length: at[count - 1]! };
}

/** Wraps a distance into a loop's length; clamps it on an open road. */
export function wrapAlong(road: Road, s: number): number {
  if (road.def.closed) return ((s % road.length) + road.length) % road.length;
  return Math.min(road.length, Math.max(0, s));
}

/** The point `offset` metres to the right of the centre line, `s` metres along the road, and the road's heading. */
export function pointAt(road: Road, s: number, offset = 0): { x: number; z: number; heading: number } {
  s = wrapAlong(road, s);
  const { xs, zs, at } = road;
  let lo = 0, hi = at.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const seg = at[hi]! - at[lo]! || 1;
  const t = (s - at[lo]!) / seg;
  const dx = xs[hi]! - xs[lo]!, dz = zs[hi]! - zs[lo]!;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len, fz = dz / len;
  // Right of (fx, fz) is (-fz, fx) turned the simulation's way: (−cos h, sin h) for h = atan2(fx, fz).
  return { x: xs[lo]! + dx * t - fz * offset, z: zs[lo]! + dz * t + fx * offset, heading: Math.atan2(fx, fz) };
}

/** The nearest point on one road. */
export function nearestOn(road: Road, index: number, x: number, z: number): RoadSpot {
  const { xs, zs, at } = road;
  let best = Infinity, bs = 0, bx = 0, bz = 0, bfx = 0, bfz = 1;
  for (let i = 0; i < at.length - 1; i++) {
    const ax = xs[i]!, az = zs[i]!, dx = xs[i + 1]! - ax, dz = zs[i + 1]! - az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t, pz = az + dz * t;
    const d2 = (x - px) ** 2 + (z - pz) ** 2;
    if (d2 < best) {
      best = d2;
      bs = at[i]! + (at[i + 1]! - at[i]!) * t;
      bx = px;
      bz = pz;
      const len = Math.sqrt(len2);
      bfx = dx / len;
      bfz = dz / len;
    }
  }
  const dist = Math.sqrt(best);
  // Right of travel is (−fz, fx); the offset is the point's distance along it.
  const offset = (x - bx) * -bfz + (z - bz) * bfx;
  return { road: index, s: bs, x: bx, z: bz, heading: Math.atan2(bfx, bfz), offset, dist };
}

/** The nearest point on any road of the network, or undefined if there are none. */
export function nearestRoad(roads: Road[], x: number, z: number): RoadSpot | undefined {
  let best: RoadSpot | undefined;
  roads.forEach((road, i) => {
    const spot = nearestOn(road, i, x, z);
    if (!best || spot.dist < best.dist) best = spot;
  });
  return best;
}

/**
 * A smooth path through a few control points (a Catmull-Rom curve), sampled about every `spacing` metres. For
 * map files: a road is drawn as a handful of points and smoothed here.
 */
export function smoothPath(control: [number, number][], closed: boolean, spacing = 1.5): [number, number][] {
  const n = control.length;
  const get = (i: number) => control[closed ? ((i % n) + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  const out: [number, number][] = [];
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const steps = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / spacing));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(control[n - 1]!);
  return out;
}

/** Points around a circle of radius `r`, starting at (0, r) and going the way the simulation's headings turn left. */
export function circlePath(r: number, count = 160): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return [Math.sin(a) * r, Math.cos(a) * r] as [number, number];
  });
}
