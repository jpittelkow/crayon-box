// Fords (ADR 0042, `road/ford` and `setpiece/ford`): a shallow stream (`water/stream`) crossing a road. The stream is
// shallow water all along, like a long puddle, so nothing in it can sink or trap a car; the ford zone on the road
// slows vehicles to a splashy wade, throws a bow wave as they drive in and spray while they cross, and washes mud off.
// Plain TypeScript.
import type { MapDef } from './map';
import { onLand, type Land } from './land';
import { buildRoad, pointAt, type Road } from './roads';

/** Top speed through a ford, m/s: slow enough to see the splash, faster than mud. */
export const FORD_SPEED = 9;
/** Water circles along a stream are this far apart, in metres. */
const STEP = 1.5;

/**
 * A map's streams, ready for the simulation: each as a path to follow (for the look) and as a chain of shallow
 * round waters along it, on the land only, so the same rules as a puddle's apply everywhere in it.
 */
export function buildStreams(map: MapDef, land: Land): { paths: Road[]; waters: { x: number; z: number; r: number }[] } {
  const paths: Road[] = [], waters: { x: number; z: number; r: number }[] = [];
  for (const s of map.water.streams ?? []) {
    const path = buildRoad({ kind: 'dirt', width: s.width, points: s.points, closed: false });
    paths.push(path);
    const n = Math.max(1, Math.ceil(path.length / STEP));
    for (let i = 0; i <= n; i++) {
      const p = pointAt(path, (i / n) * path.length);
      if (onLand(land, p.x, p.z)) waters.push({ x: p.x, z: p.z, r: s.width / 2 });
    }
  }
  return { paths, waters };
}
