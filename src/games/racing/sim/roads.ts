// The road network (driving-assets.md, category 5): roads as paths of points that the simulation follows for
// traffic, the "follows the road" assist, the rescue and placing things in the car's way. Plain TypeScript.
//
// Directions follow the simulation: a heading h points along (sin h, cos h), and a positive lane offset is to the
// right of the direction of travel (on the island's ring road, toward the sea).
import { GRID_FROM, LOOKUP, boxDistance, nearest, segmentGrid, type Grid } from './grid';

/** A road as a map file gives it. */
export interface RoadDef {
  /** The kind of road (driving-assets.md): a street, or a dirt track (milestone-3 E; drawn brown, no lines). */
  kind: 'street' | 'dirt';
  /** Width in metres, kerb to kerb. */
  width: number;
  /** The centre line, in order. Close points (about 1.5 m apart) follow a curve well; see `smoothPath`. */
  points: [number, number][];
  /** A loop joins its last point back to its first. */
  closed: boolean;
  /**
   * An open road can join others at its ends (milestone-3 B4): `from` is the road its first point sits on, `to`
   * the road its last point sits on. Those are junctions: traffic and "follows the road" can turn there. An open
   * end that joins nothing is a dead end, where traffic turns round.
   */
  from?: number;
  to?: number;
  /**
   * Traffic drives it one way only, forward along its points (ADR 0042: a roundabout's ring), and "follows the road"
   * goes that way too. The kid's own steering may still go either way: nothing stops it.
   */
  oneWay?: boolean;
}

/**
 * A junction on a road: at distance `s` along it, road `road` branches off. A car turning there enters the branch
 * at its start going forward (`dir` 1) or at its end going backward (`dir` -1).
 */
export interface Junction { s: number; road: number; dir: 1 | -1 }

/** A road ready for the simulation: its points with the distance along the road to each. */
export interface Road {
  def: RoadDef;
  xs: Float64Array;
  zs: Float64Array;
  /** Distance along the road at each point; for a loop, one extra entry for the way back to the start. */
  at: Float64Array;
  length: number;
  /** The box round its points: min x, min z, max x, max z. */
  box: [number, number, number, number];
  /** Its segments in squares (sim/grid.ts), for a road long enough to need them. */
  grid?: Grid;
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
  const box: Road['box'] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    box[0] = Math.min(box[0], xs[i]!); box[1] = Math.min(box[1], zs[i]!);
    box[2] = Math.max(box[2], xs[i]!); box[3] = Math.max(box[3], zs[i]!);
  }
  const grid = count - 1 >= GRID_FROM ? segmentGrid(xs, zs, count - 1, (i) => i + 1) : undefined;
  return { def, xs, zs, at, length: at[count - 1]!, box, grid };
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

/** Segment `i`'s squared distance from a point (from its start point toward the next). */
function segD2(road: Road, i: number, x: number, z: number): number {
  const { xs, zs } = road;
  const ax = xs[i]!, az = zs[i]!, dx = xs[i + 1]! - ax, dz = zs[i + 1]! - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
  const px = ax + dx * t, pz = az + dz * t;
  return (x - px) ** 2 + (z - pz) ** 2;
}

/**
 * The segment of a road nearest a point (the first of equals), or -1 for a road of one point. With `within`, one
 * further than that may be missed (and -1 comes back).
 */
function nearestSegment(road: Road, x: number, z: number, within = Infinity): number {
  if (road.grid && LOOKUP.grid) return nearest(road.grid, x, z, (i) => segD2(road, i, x, z), within).i;
  let best = Infinity, bi = -1;
  for (let i = 0; i < road.at.length - 1; i++) {
    const d2 = segD2(road, i, x, z);
    if (d2 < best) {
      best = d2;
      bi = i;
    }
  }
  return bi;
}

/** Where a point is from segment `i` of a road (or from nowhere, for -1). */
function spotOn(road: Road, index: number, i: number, x: number, z: number): RoadSpot {
  if (i < 0) return { road: index, s: 0, x: 0, z: 0, heading: Math.atan2(0, 1), offset: (x - 0) * -1 + (z - 0) * 0, dist: Infinity };
  const { xs, zs, at } = road;
  const ax = xs[i]!, az = zs[i]!, dx = xs[i + 1]! - ax, dz = zs[i + 1]! - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
  const bx = ax + dx * t, bz = az + dz * t;
  const dist = Math.sqrt((x - bx) ** 2 + (z - bz) ** 2);
  const len = Math.sqrt(len2), bfx = dx / len, bfz = dz / len;
  // Right of travel is (−fz, fx); the offset is the point's distance along it.
  const offset = (x - bx) * -bfz + (z - bz) * bfx;
  return { road: index, s: at[i]! + (at[i + 1]! - at[i]!) * t, x: bx, z: bz, heading: Math.atan2(bfx, bfz), offset, dist };
}

/** The nearest point on one road. */
export function nearestOn(road: Road, index: number, x: number, z: number): RoadSpot {
  return spotOn(road, index, nearestSegment(road, x, z), x, z);
}

/**
 * The nearest point on one road if it is within `within` metres (at most a metre more may come back, so check the
 * distance), or null. Quicker than `nearestOn` for a point far from a long road.
 */
export function nearestWithin(road: Road, index: number, x: number, z: number, within: number): RoadSpot | null {
  if (boxDistance(road.box, x, z) > within + 1) return null;
  const i = nearestSegment(road, x, z, within + 1);
  return i < 0 ? null : spotOn(road, index, i, x, z);
}

/** The nearest point on any road of the network, or undefined if there are none. */
export function nearestRoad(roads: Road[], x: number, z: number): RoadSpot | undefined {
  let best: RoadSpot | undefined;
  roads.forEach((road, i) => {
    // A road whose box is further than the nearest so far can't be nearer (the slow way looks anyway).
    if (best && LOOKUP.grid && boxDistance(road.box, x, z) > best.dist + 1e-6) return;
    const spot = best && LOOKUP.grid ? nearestWithin(road, i, x, z, best.dist) : nearestOn(road, i, x, z);
    if (spot && (!best || spot.dist < best.dist)) best = spot;
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

/**
 * A roundabout's ring (ADR 0042, `road/roundabout`): a one-way loop of radius `r` round (`x`, `z`), starting at its
 * north point and going anticlockwise seen from above (north, then west, as `circlePath`), so traffic keeping right
 * goes round it the way it should.
 */
export function ringRoad(x: number, z: number, r: number, width: number): RoadDef {
  // Close points (every 25 cm): on so tight a curve, a lane offset from a coarse path would jump back at each corner.
  const count = Math.max(24, Math.round((Math.PI * 2 * r) / 0.25));
  return { kind: 'street', width, closed: true, oneWay: true, points: circlePath(r, count).map(([px, pz]) => [x + px, z + pz]) };
}

/** Every road's junctions, from the open roads' `from` and `to`: one list per road. */
export function buildJunctions(roads: Road[]): Junction[][] {
  const out: Junction[][] = roads.map(() => []);
  roads.forEach((road, i) => {
    const pts = road.def.points;
    for (const [on, [x, z], dir] of [[road.def.from, pts[0]!, 1], [road.def.to, pts[pts.length - 1]!, -1]] as const) {
      if (on === undefined) continue;
      out[on]!.push({ s: nearestOn(roads[on]!, on, x, z).s, road: i, dir });
    }
  });
  return out;
}

/** Whether going `dist` metres from `s0` in direction `dir` passes the point `s` on the road (just past it counts). */
export function passes(road: Road, s0: number, dist: number, dir: 1 | -1, s: number): boolean {
  if (dist <= 0) return false;
  if (road.def.closed) {
    const d = wrapAlong(road, dir > 0 ? s - s0 : s0 - s);
    return d > 0 && d <= dist;
  }
  return dir > 0 ? s > s0 && s <= s0 + dist : s < s0 && s >= s0 - dist;
}
