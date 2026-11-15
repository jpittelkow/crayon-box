// Ramps (milestone-3 phase B3; ADR 0021 "a ramp with a small faked jump"). A ramp is a low triangular hump across
// the road: cars follow its height, and one going fast enough leaves the ground past the top, flies a little and
// lands on its wheels. Only the height and the nose's tilt change, so nothing can flip. Plain TypeScript.
import type { Zone } from './sim';

/** A ramp's size, in metres: along the road, across it, and its height at the top. */
export const RAMP = { length: 6, width: 4.6, height: 0.9 };

/** Gravity for hops, a little stronger than real so a hop is short and snappy. */
export const HOP_GRAVITY = 24;

/** The ramp's height at a point, or 0 off it. Same both ways, so it works in either direction. */
export function rampHeight(z: Zone, x: number, zz: number): number {
  const dx = x - z.x, dz = zz - z.z;
  const along = dx * Math.sin(z.heading) + dz * Math.cos(z.heading);
  const across = -dx * Math.cos(z.heading) + dz * Math.sin(z.heading);
  if (Math.abs(across) > RAMP.width / 2) return 0;
  const half = RAMP.length / 2;
  return Math.max(0, RAMP.height * (1 - Math.abs(along) / half));
}

/** The ground's height at a point: 0, or a ramp's. */
export function groundHeight(zones: Zone[], x: number, z: number): number {
  let h = 0;
  for (const zone of zones) if (zone.kind === 'ramp') h = Math.max(h, rampHeight(zone, x, z));
  return h;
}
