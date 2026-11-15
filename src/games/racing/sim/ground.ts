// Ground features that shape where the car can go (milestone-3 phase B4): guarded stretches of road (a bridge over
// water, a tunnel through a hill), hills the car slides round, and sand. Plain TypeScript, no three.js.
import { buildLand, onLand, type Land } from './land';
import type { GuardDef, HillDef } from './map';
import { nearestOn, type Road, type RoadSpot } from './roads';

/** A guarded stretch, placed: from `s0` to `s1` metres along its road. */
export interface Guard { kind: GuardDef['kind']; road: number; s0: number; s1: number }

export function buildGuards(defs: GuardDef[] | undefined, roads: Road[]): Guard[] {
  return (defs ?? []).map((g) => {
    const length = roads[g.road]!.length;
    return { kind: g.kind, road: g.road, s0: Math.min(g.from, g.to) * length, s1: Math.max(g.from, g.to) * length };
  });
}

/**
 * The guarded stretch a point is on, and where on its road: within the road's width (plus 2 m) and between the
 * stretch's ends, or up to `margin` metres past them. Null when it is on none.
 */
export function guardAt(guards: Guard[], roads: Road[], x: number, z: number, margin = 0): { guard: Guard; spot: RoadSpot } | null {
  for (const guard of guards) {
    const road = roads[guard.road]!;
    const spot = nearestOn(road, guard.road, x, z);
    if (spot.dist <= road.def.width / 2 + 2 && spot.s >= guard.s0 - margin && spot.s <= guard.s1 + margin) return { guard, spot };
  }
  return null;
}

/** How far into a hill's base a point is, grown by `pad` metres: below 1 is inside. */
export function hillReach(h: HillDef, x: number, z: number, pad = 0): number {
  return ((x - h.x) / (h.rx + pad)) ** 2 + ((z - h.z) / (h.rz + pad)) ** 2;
}

/** The hill's height at a point: a smooth dome, 0 at its edge. */
export function hillHeight(h: HillDef, x: number, z: number): number {
  return h.height * Math.sqrt(Math.max(0, 1 - hillReach(h, x, z)));
}

/** The map's sandy places, ready to ask whether a point is on one. */
export function buildSand(outlines: [number, number][][] | undefined): Land[] {
  return (outlines ?? []).map((outline) => buildLand({ outline, beach: 0 }));
}

export function onSand(sand: Land[], x: number, z: number): boolean {
  return sand.some((s) => onLand(s, x, z));
}
