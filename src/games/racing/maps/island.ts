// The island the game drives (milestone-3 B4, layout A, chosen by the owner on 2026-11-15; the picture is
// docs/design/island-layout-a.svg): a loop road round the island and a shortcut through a hill in the middle, with a
// junction at each end; a bridge where the loop crosses a bay on the east; a wide beach on the south coast; the
// ramp, the car wash and the flood. Places below are written with x east and z north, in metres; the simulation's
// x grows westward (seen from above with north up), so `east` turns them round.
import type { MapDef, OnRoad } from '../sim/map';
import { buildRoad, nearestOn, smoothPath, type RoadDef } from '../sim/roads';

export const ROAD_W = 9;

/** Turns a place written as (east, north) into the simulation's x and z. */
const east = ([x, z]: [number, number]): [number, number] => [-x, z];

/** The shoreline: an oval with a bay cutting in from the east, smoothed through these points. */
const SHORE = smoothPath(([
  [-68, 0], [-62, 24], [-46, 40], [-24, 49], [2, 50], [28, 49], [48, 42], [62, 30], [68, 18],
  // the bay
  [56, 14], [45, 11], [38, 6], [36, 0], [38, -6], [45, -11], [56, -14],
  [68, -18], [64, -32], [50, -44], [28, -53], [2, -56], [-26, -54], [-48, -44], [-62, -26],
] as [number, number][]).map(east), true, 2);

/** The loop: an oval 94 by 74 m, starting on the west side and going north first. */
const LOOP: RoadDef = {
  kind: 'street', width: ROAD_W, closed: true,
  points: Array.from({ length: 180 }, (_, i): [number, number] => {
    const a = -Math.PI / 2 + (i / 180) * Math.PI * 2;
    return east([Math.sin(a) * 47, Math.cos(a) * 37]);
  }),
};

/** The shortcut: north to south straight through the middle, joining the loop at both ends. */
const SHORTCUT: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 0, to: 0,
  points: Array.from({ length: 50 }, (_, i): [number, number] => [0, 37 - (i / 49) * 74]),
};

const loop = buildRoad(LOOP), shortcut = buildRoad(SHORTCUT);
/** How far along a road (0 to 1) its nearest point to (x, z) is. */
const atLoop = (x: number, z: number) => nearestOn(loop, 0, -x, z).s / loop.length;
const onLoop = (x: number, z: number, offset = 0): OnRoad => ({ road: 0, at: atLoop(x, z), offset });
const atShortcut = (z: number) => nearestOn(shortcut, 1, 0, z).s / shortcut.length;

/** The beach: the south coast below the loop road, out to the shoreline. */
const BEACH_EDGE = -43;
const beachShore = SHORE.filter(([x, z]) => z < BEACH_EDGE && -x > -44 && -x < 48);
const BEACH: [number, number][] = [
  ...beachShore,
  [beachShore[beachShore.length - 1]![0], BEACH_EDGE],
  [beachShore[0]![0], BEACH_EDGE],
];

export const ISLAND: MapDef = {
  id: 'island',
  land: { outline: SHORE, beach: 8 },
  roads: [LOOP, SHORTCUT],
  // The bridge carries the loop over the bay; the tunnel takes the shortcut through the hill.
  guards: [
    { kind: 'bridge', road: 0, from: atLoop(45, 15), to: atLoop(45, -15) },
    { kind: 'tunnel', road: 1, from: atShortcut(12), to: atShortcut(-12) },
  ],
  hills: [{ x: 0, z: 0, rx: 13, rz: 11, height: 7 }],
  sand: [BEACH],
  spawn: onLoop(-32, -31),
  zones: [
    { kind: 'ramp', on: onLoop(-45, 11), r: 3.5 },
    { kind: 'car-wash', on: { road: 1, at: atShortcut(-23) }, r: 4 },
    // The garage (ADR 0035): drive in, come out as the next vehicle.
    { kind: 'garage', on: { road: 1, at: atShortcut(24) }, r: 4 },
  ],
  traffic: [
    { kind: 'bus', on: onLoop(30, 28, -2.2), cruise: 6.5 },
    { kind: 'police', on: onLoop(30, -28, 2.2), cruise: 9.5 },
    { kind: 'monster', on: onLoop(-40, -20, -2.2), cruise: 8 },
  ],
  water: {
    pools: [{ on: onLoop(-32, 27), r: 9, deep: true }],
    puddles: [{ road: 0, at: [atLoop(28, 30), atLoop(36, -24), atLoop(-16, -35), atLoop(-44, -12)], spread: 6, size: [2, 1.4] }],
  },
  trees: {
    kinds: [{ id: 'scenery/pine', share: 2 }, { id: 'scenery/round-tree', share: 1 }],
    count: 44, scale: [0.8, 0.6], roadGap: 2.5, waterGap: 2, edgeGap: 5,
  },
  props: {
    kinds: [
      { id: 'toy/cone', share: 1 }, { id: 'toy/crate', share: 1 }, { id: 'toy/beach-ball', share: 1 }, { id: 'toy/hay-bale', share: 1 },
    ],
    nearRoad: 0.55, spread: 4, edgeGap: 5, spawnGap: 7,
  },
  decor: [{ id: 'decor/bush', clumps: 70, perClump: 3 }],
  // Animals that answer the horn, in the field north-east of the hill, as in the layout picture (milestone-3 B3).
  animals: [
    { id: 'animal/sheep', ...at(east([20, 18])), count: 3, roam: 6 },
    { id: 'animal/duck', ...at(east([12, 25])), count: 2, roam: 3 },
  ],
};

/** A place as an object, for a herd. */
function at([x, z]: [number, number]): { x: number; z: number } {
  return { x, z };
}

