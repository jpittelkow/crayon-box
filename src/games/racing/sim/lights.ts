// Traffic lights (ADR 0042, `setpiece/traffic-lights`): a junction's lights, for show. They cycle red, amber and
// green for the road the zone sits on ("main") and the road joining it there ("cross"). Traffic may wait at red; the
// kid's car never does: nothing here touches it, and its own way turns green as it comes near. Plain TypeScript.
import { nearestOn, pointAt, type Junction, type Road } from './roads';
import type { Zone } from './sim';

/** Which of a junction's two ways a car is on: along the zone's road, or along the road joining it. */
export type Way = 'main' | 'cross';
export type Lamp = 'green' | 'amber' | 'red';

/**
 * The cycle, in seconds: main green, main amber, all red, cross green, cross amber, all red. Twenty seconds round,
 * so a kid circling a loop sees it change.
 */
export const LIGHT_PHASES = [7, 2, 1, 7, 2, 1] as const;
/** For the kid's car, coming near: the other way's amber and the all-red are this short, then its own way is green. */
export const HURRY = { amber: 0.8, red: 0.4 };
/**
 * The kid's car closer than this, heading for the lights (or inside them), has its way turned green: far enough
 * that at full speed (17 m/s) it is green well before the car gets there.
 */
export const LIGHTS_NEAR = 50;

/**
 * One junction's lights: its zone, the phase it is in and for how long, the main road's heading there, and the
 * main road and the joining road (by index; none when the zone isn't at a junction).
 */
export interface Light { zone: number; phase: number; t: number; heading: number; road: number; cross?: number }

/** A pole of the lights, standing beside a road: where, the way its lamps show, and which way they face. */
export interface Post { x: number; z: number; zone: number; way: Way; facing: number }

/** The lamp a way shows in a phase. */
export function lampFor(phase: number, way: Way): Lamp {
  const green = way === 'main' ? 0 : 3;
  return phase === green ? 'green' : phase === green + 1 ? 'amber' : 'red';
}

/** The way a car heading `heading` is going through lights whose main road runs along `main`. */
export function wayOf(main: number, heading: number): Way {
  return Math.abs(Math.cos(heading - main)) > 0.7 ? 'main' : 'cross';
}

/**
 * The way a car at (x, z) comes through the lights: along whichever of the two roads it is nearer; in the junction
 * itself, where both are near, by the way it faces.
 */
export function wayAt(light: Light, roads: Road[], x: number, z: number, heading: number): Way {
  if (light.cross === undefined) return 'main';
  const main = nearestOn(roads[light.road]!, light.road, x, z).dist;
  const cross = nearestOn(roads[light.cross]!, light.cross, x, z).dist;
  if (Math.abs(main - cross) < 3) return wayOf(light.heading, heading);
  return cross < main ? 'cross' : 'main';
}

/**
 * Moves the lights on by `dt`. With `want` (the kid's car is coming that way), the other way's green ends at once,
 * its amber and the all-red are short, and `want`'s green is held while the car is near. Returns whether the phase
 * changed.
 */
export function stepLight(light: Light, dt: number, want: Way | null): boolean {
  const green = want === 'main' ? 0 : want === 'cross' ? 3 : -1;
  if (light.phase === green) {
    light.t = 0;
    return false;
  }
  light.t += dt;
  const p = light.phase;
  let len: number = LIGHT_PHASES[p]!;
  if (want) len = p === 0 || p === 3 ? 0 : p === 1 || p === 4 ? HURRY.amber : HURRY.red;
  if (light.t < len) return false;
  light.t = 0;
  // From an all-red, the kid's way goes green next, without the other way's turn in between.
  light.phase = want && (p === 2 || p === 5) ? green : (p + 1) % LIGHT_PHASES.length;
  return true;
}

/** The junction a traffic-lights zone stands at: the one on its road closest to it (the joining road is `road`). */
export function lightsJunction(zone: Zone, junctions: Junction[][]): Junction | undefined {
  if (zone.road === undefined || zone.s === undefined) return undefined;
  return [...junctions[zone.road]!].sort((a, b) => Math.abs(a.s - zone.s!) - Math.abs(b.s - zone.s!))[0];
}

/**
 * Where a junction's poles stand (the look draws them, the kid's car slides along them): one each side of the main
 * road, on the right of the traffic coming at the lights, and one on the right of the joining road's traffic, all
 * well clear of the roads' edges.
 */
export function lightPosts(zone: Zone, index: number, roads: Road[], junctions: Junction[][]): Post[] {
  if (zone.road === undefined || zone.s === undefined) return [];
  const road = roads[zone.road]!, half = road.def.width / 2;
  const posts: Post[] = [];
  const j = lightsJunction(zone, junctions);
  const branchHalf = j ? roads[j.road]!.def.width / 2 : 0;
  const along = branchHalf + 3;
  for (const side of [1, -1] as const) {
    const p = pointAt(road, zone.s - side * along, side * (half + 1.4));
    // Lamps face the traffic coming toward them: forward traffic (side 1) comes from behind, so they face back.
    posts.push({ x: p.x, z: p.z, zone: index, way: 'main', facing: side > 0 ? p.heading + Math.PI : p.heading });
  }
  if (j) {
    const branch = roads[j.road]!;
    // Traffic arrives at the junction driving against the branch's own direction when it starts here (dir 1).
    const p = pointAt(branch, j.dir > 0 ? half + 3 : branch.length - half - 3, -j.dir * (branchHalf + 1.4));
    posts.push({ x: p.x, z: p.z, zone: index, way: 'cross', facing: j.dir > 0 ? p.heading : p.heading + Math.PI });
  }
  return posts;
}
