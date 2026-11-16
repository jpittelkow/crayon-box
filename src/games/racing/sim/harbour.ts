// A harbour (ADR 0042, `setpiece/harbour`): a stretch of road along the shore as a stone quay. Its sea side is a low
// edge with bollards, a guard on that side only (as a bridge's rail): the car slides along it and never drives into
// the sea. Boats are moored along it and bob; one of them now and then sails out to sea and comes back. The kid's
// horn in the harbour is answered by a ship's horn. Traffic drives the quay as any road. Plain TypeScript.
import type { Guard } from './ground';
import { onLand, type Land } from './land';
import { buildRoad, pointAt, smoothPath, type Road } from './roads';
import type { Zone } from './sim';

/**
 * A map puts the shore this far past the road's edge along a quay, in metres: the low edge with the bollards stands
 * on that stone. The quay's face is drawn further out (`QUAY_FACE`), over the sand the land's edge is drawn with.
 */
export const QUAY_EDGE = 2;
export const QUAY_FACE = QUAY_EDGE + 2.5;
/** Boats are moored this far apart along the quay, in metres, their middles this far out from the quay's face. */
export const BERTH_GAP = 7.5;
export const BERTH_OUT = 2.3;
/**
 * The sailing boat: how often it goes out (seconds from one trip's start to the next) and its speed, m/s. Slow
 * enough to watch, and often enough that a kid who waits by the quay sees it go and come back.
 */
export const SAIL = { every: 60, speed: 4 };
/** The ship's horn answers this long after the kid's horn, and not again for this long. */
export const SHIP_HORN = { delay: 0.7, rest: 3 };
/** The kid's horn is heard by the harbour this far past the zone's edge, metres. */
export const HARBOUR_HEARS = 10;

/** A boat of a harbour: where it is moored, where it is now, and whether it is the one that sails out. */
export interface Boat {
  /** The harbour zone it belongs to (an index into `World.zones`). */
  zone: number;
  berth: { x: number; z: number; heading: number };
  x: number; z: number; heading: number;
  /** How far it sits below the water line now, and how far it rolls (radians): it bobs. */
  y: number; roll: number;
  /** The sailing boat's trip: a closed path from its berth out to sea and back; null for one that stays moored. */
  trip: Road | null;
}

/**
 * The quay of a harbour zone on a road: its stretch of road (the zone's radius each way along it), with a guard on
 * the sea side only. The sea side is the side the land ends on.
 */
export function quayGuard(zone: Zone, roads: Road[], land: Land): Guard | null {
  if (zone.road === undefined || zone.s === undefined) return null;
  const road = roads[zone.road]!, out = road.def.width / 2 + QUAY_EDGE + 1.5;
  const wet = (side: 1 | -1) => [-0.5, 0, 0.5].filter((k) => {
    const p = pointAt(road, zone.s! + k * zone.r, side * out);
    return !onLand(land, p.x, p.z);
  }).length;
  const side = wet(1) >= wet(-1) ? 1 : -1;
  return { kind: 'quay', road: zone.road, s0: zone.s - zone.r, s1: zone.s + zone.r, side };
}

/**
 * The boats moored along a quay (of harbour zone `index`), one every BERTH_GAP metres, lying alongside it on the
 * water. The last one along the road (furthest along it) is the one that sails, if the zone has a way out to sea
 * (`sail`).
 */
export function harbourBoats(index: number, guard: Guard, roads: Road[], sail?: [number, number][]): Boat[] {
  const road = roads[guard.road]!, side = guard.side ?? 1;
  const out = side * (road.def.width / 2 + QUAY_FACE + BERTH_OUT);
  // Clear of the quay's ends, where the shore turns away from the road.
  const count = Math.max(1, Math.floor((guard.s1 - guard.s0 - 10) / BERTH_GAP) + 1);
  const first = (guard.s0 + guard.s1) / 2 - ((count - 1) * BERTH_GAP) / 2;
  return Array.from({ length: count }, (_, i): Boat => {
    const p = pointAt(road, first + i * BERTH_GAP, out);
    const berth = { x: p.x, z: p.z, heading: p.heading };
    const trip = i === count - 1 && sail?.length ? buildRoad({ kind: 'street', width: 1, closed: true, points: smoothPath([[p.x, p.z], ...sail], true, 1.5) }) : null;
    return { zone: index, berth, x: p.x, z: p.z, heading: p.heading, y: 0, roll: 0, trip };
  });
}

/** Where a sailing boat is on its trip at a time: null while it is moored, else how far along its path. */
export function tripAt(trip: Road, time: number): number | null {
  const sailing = trip.length / SAIL.speed;
  // Each trip starts SAIL.every seconds after the last, the first a little after the game starts.
  const t = (((time - 12) % SAIL.every) + SAIL.every) % SAIL.every;
  return time >= 12 && t < sailing ? t * SAIL.speed : null;
}

/**
 * Moves the boats on (`time` is the world's): every boat bobs and rolls a little, each on its own beat; the sailing
 * boat follows its trip, turning to face the way it goes, and when it is home turns back to lie along the quay.
 */
export function stepBoats(boats: Boat[], time: number, dt: number): void {
  boats.forEach((b, i) => {
    b.y = Math.sin(time * 1.3 + i * 1.7) * 0.08;
    b.roll = Math.sin(time * 0.9 + i * 2.3) * 0.05;
    const along = b.trip ? tripAt(b.trip, time) : null;
    let want = b.berth.heading;
    if (b.trip && along !== null) {
      const p = pointAt(b.trip, along);
      b.x = p.x;
      b.z = p.z;
      want = p.heading;
    } else {
      b.x = b.berth.x;
      b.z = b.berth.z;
    }
    const turn = Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading));
    b.heading += Math.max(-1.5 * dt, Math.min(1.5 * dt, turn));
  });
}
