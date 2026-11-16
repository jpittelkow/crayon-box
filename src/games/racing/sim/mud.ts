// Mud (ADR 0042, `setpiece/mud`): a patch of mud over a track. Vehicles slow to a squelchy crawl in it and come out
// muddy; muddy is a vehicle state (driving-assets.md), `Car.mud`, 0 clean to 1 covered. Muddy puddles add a little;
// a car wash or clean water (a ford, a puddle, the flood) washes it off. Time alone never does: the car stays
// muddy until it is washed. Plain TypeScript.
import type { Zone } from './sim';

/** Top speed in mud, m/s (sand is 11, a car wash 5); a vehicle that wades well (ADR 0035) goes that much faster. */
export const MUD_SPEED = 7;
/** How fast a car gets muddy inside a mud patch: covered in about half a second. */
export const MUD_UP = 1.8;
/** Muddy water (the building site's puddles and pond) makes a car this muddy at most. */
export const MUD_WATER = 0.5;
/** Seconds clean water takes to wash a covered car clean. */
export const MUD_RINSE = 1.5;
/** Seconds a car wash takes to wash a covered car clean. */
export const MUD_WASH = 0.8;
/** Bits of mud flicked off the wheels, pooled like the puffs (`fx/mud`), and how long one flies. */
export const MUD_POOL = 60;
export const MUD_FLY = 0.7;

/** The zone of a kind a point is inside (within `pad` metres past its edge), or undefined. */
export function zoneAt(zones: Zone[], kind: Zone['kind'], x: number, z: number, pad = 0): Zone | undefined {
  return zones.find((zone) => zone.kind === kind && (x - zone.x) ** 2 + (z - zone.z) ** 2 < (zone.r + pad) ** 2);
}
