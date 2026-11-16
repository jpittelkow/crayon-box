// A roundabout (ADR 0042, `setpiece/roundabout` on `road/roundabout`): a one-way ring road (`ringRoad`) round a low
// bed of grass and flowers with a fountain in its middle. Roads join the ring at three-way junctions, as anywhere
// else: traffic goes round it anticlockwise at a gentle pace and leaves by any exit, and "follows the road" takes the
// exits in turn (the junction rule). The kid's car may go round either way and may cut across the bed (its kerb is
// low); only the fountain's basin is solid, a circle it slides round. Plain TypeScript.
import { nearestOn, type Road } from './roads';
import type { Zone } from './sim';

/** Traffic's top speed in a roundabout, m/s: a gentle swing round the ring. */
export const ROUNDABOUT_SPEED = 7;
/** The fountain's basin: a circle in the middle the kid's car slides round, radius in metres. */
export const BASIN_R = 1.6;
/** How many jets the fountain has round its middle (one more stands in the centre). */
export const JETS = 6;

/**
 * The ring road of a roundabout zone (an index into the roads): the one-way loop round its middle, inside the zone.
 * Undefined when the map has none there.
 */
export function ringOf(zone: Pick<Zone, 'x' | 'z' | 'r'>, roads: Road[]): number | undefined {
  const i = roads.findIndex((road, k) => road.def.closed && road.def.oneWay && nearestOn(road, k, zone.x, zone.z).dist < zone.r);
  return i < 0 ? undefined : i;
}

/** The ring's radius: how far its centre line is from the zone's middle. */
export function ringRadius(zone: Pick<Zone, 'x' | 'z'>, road: Road, index: number): number {
  return nearestOn(road, index, zone.x, zone.z).dist;
}

/**
 * How high each jet is at a time, 0 (down) to 1 (full height): the ring of jets rises and falls in a wave that runs
 * round it, and the centre jet (the last) swells slowly. For the look; the sound follows the time too.
 */
export function jetHeights(time: number): number[] {
  const ring = Array.from({ length: JETS }, (_, i) => 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * 2.1 - (i / JETS) * Math.PI * 2)));
  return [...ring, 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(time * 0.9))];
}
