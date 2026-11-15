// The island (milestone-3 B4 and E; ADR 0035): layout A, chosen by the owner on 2026-11-15 (the picture is
// docs/design/island-layout-a.svg), grown to about three times its first area. A loop road round the island, a
// shortcut through a hill in the middle and a spur from the loop to the shortcut, all joined at three-way
// junctions; a bridge where the loop crosses a bay on the east, with boats moored in the bay; a wide beach on the
// south coast; two ramps, the car wash, the garage and the flood; sheep and ducks in the fields.
//
// Places below are written as in the layout picture, x east and z north, at its first size; `at` scales them by
// GROW and turns them round, as the simulation's x grows westward (seen from above with north up).
import type { MapDef, OnRoad } from '../sim/map';
import { buildRoad, nearestOn, smoothPath, type RoadDef } from '../sim/roads';

export const ROAD_W = 9;
/** How much bigger the island is than its first layout, across. */
const GROW = 1.8;

/** A place from the picture (east, north, at its first size) in the simulation's x and z. */
const at = ([x, z]: [number, number]): [number, number] => [-x * GROW, z * GROW];
const spot = (p: [number, number]) => {
  const [x, z] = at(p);
  return { x, z };
};

/** The shoreline: an oval with a bay cutting in from the east, smoothed through these points. */
const SHORE = smoothPath(([
  [-68, 0], [-62, 24], [-46, 40], [-24, 49], [2, 50], [28, 49], [48, 42], [62, 30], [68, 18],
  // the bay
  [56, 14], [45, 11], [38, 6], [36, 0], [38, -6], [45, -11], [56, -14],
  [68, -18], [64, -32], [50, -44], [28, -53], [2, -56], [-26, -54], [-48, -44], [-62, -26],
] as [number, number][]).map(at), true, 2);

/** The loop: an oval, starting on the west side and going north first. */
const LOOP: RoadDef = {
  kind: 'street', width: ROAD_W, closed: true,
  points: Array.from({ length: 300 }, (_, i): [number, number] => {
    const a = -Math.PI / 2 + (i / 300) * Math.PI * 2;
    return at([Math.sin(a) * 47, Math.cos(a) * 37]);
  }),
};

/** The shortcut: north to south straight through the middle, joining the loop at both ends. */
const SHORTCUT: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 0, to: 0,
  points: Array.from({ length: 90 }, (_, i): [number, number] => at([0, 37 - (i / 89) * 74])),
};

/** The spur: from the west of the loop, curving south-east to meet the shortcut below the hill. */
const SPUR: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 0, to: 1,
  points: smoothPath(([[-47, 0], [-34, -6], [-18, -14], [0, -16]] as [number, number][]).map(at), false, 1.5),
};

const loop = buildRoad(LOOP), shortcut = buildRoad(SHORTCUT);
/** How far along the loop (0 to 1) its nearest point to a place from the picture is. */
const atLoop = (p: [number, number]) => {
  const [x, z] = at(p);
  return nearestOn(loop, 0, x, z).s / loop.length;
};
const onLoop = (p: [number, number], offset = 0): OnRoad => ({ road: 0, at: atLoop(p), offset });
const atShortcut = (north: number) => nearestOn(shortcut, 1, 0, north * GROW).s / shortcut.length;

/** The beach: the south coast below the loop road, out to the shoreline. */
const BEACH_EDGE = -43 * GROW;
const beachShore = SHORE.filter(([x, z]) => z < BEACH_EDGE && -x > -44 * GROW && -x < 48 * GROW);
const BEACH: [number, number][] = [
  ...beachShore,
  [beachShore[beachShore.length - 1]![0], BEACH_EDGE],
  [beachShore[0]![0], BEACH_EDGE],
];

export const ISLAND: MapDef = {
  id: 'island',
  land: { outline: SHORE, beach: 8 },
  roads: [LOOP, SHORTCUT, SPUR],
  // The bridge carries the loop over the bay; the tunnel takes the shortcut through the hill.
  guards: [
    { kind: 'bridge', road: 0, from: atLoop([45, 15]), to: atLoop([45, -15]) },
    { kind: 'tunnel', road: 1, from: atShortcut(9), to: atShortcut(-9) },
  ],
  hills: [{ ...spot([0, 0]), rx: 19, rz: 15, height: 9 }],
  sand: [BEACH],
  spawn: onLoop([-32, -31]),
  propCount: 380,
  zones: [
    { kind: 'ramp', on: onLoop([-45, 11]), r: 3.5 },
    { kind: 'ramp', on: onLoop([22, 33]), r: 3.5 },
    { kind: 'car-wash', on: { road: 1, at: atShortcut(-26) }, r: 4 },
    // The garage (ADR 0035): drive in, come out as the next vehicle.
    { kind: 'garage', on: { road: 1, at: atShortcut(24) }, r: 4 },
  ],
  traffic: [
    { kind: 'bus', on: onLoop([30, 28], -2.2), cruise: 6.5 },
    { kind: 'police', on: onLoop([30, -28], 2.2), cruise: 9.5 },
    { kind: 'monster', on: onLoop([-40, -20], -2.2), cruise: 8 },
    { kind: 'bus', on: onLoop([-30, 30], 2.2), cruise: 7 },
    { kind: 'police', on: onLoop([0, -37], -2.2), cruise: 8.5 },
    { kind: 'monster', on: { road: 1, at: 0.15, offset: 2.2 }, cruise: 7.5 },
  ],
  water: {
    pools: [{ on: onLoop([-32, 27]), r: 13, deep: true }],
    puddles: [{
      road: 0,
      at: ([[28, 30], [36, -24], [-16, -35], [-44, -12], [10, 37], [42, 16], [-26, 33], [16, -36]] as [number, number][]).map(atLoop),
      spread: 6, size: [2, 1.6],
    }, { road: 2, at: [0.4, 0.75], spread: 4, size: [2, 1.2] }],
  },
  trees: {
    kinds: [{ id: 'scenery/pine', share: 2 }, { id: 'scenery/round-tree', share: 1 }],
    count: 150, scale: [0.8, 0.6], roadGap: 2.5, waterGap: 2, edgeGap: 5,
  },
  props: {
    kinds: [
      { id: 'toy/cone', share: 1 }, { id: 'toy/crate', share: 1 }, { id: 'toy/beach-ball', share: 1 }, { id: 'toy/hay-bale', share: 1 },
    ],
    nearRoad: 0.55, spread: 4, edgeGap: 5, spawnGap: 7,
  },
  decor: [{ id: 'decor/bush', clumps: 220, perClump: 3 }],
  // Animals that answer the horn, in the fields, as in the layout picture (milestone-3 B3).
  animals: [
    { id: 'animal/sheep', ...spot([20, 18]), count: 4, roam: 9 },
    { id: 'animal/duck', ...spot([12, 25]), count: 3, roam: 4 },
    { id: 'animal/sheep', ...spot([24, -22]), count: 3, roam: 8 },
  ],
  // Boats moored in the bay and off the beach (milestone-3 E).
  boats: [
    { ...spot([60, 6]), heading: 1.2 },
    { ...spot([62, -8]), heading: 1.9 },
    { ...spot([20, -62]), heading: 0.3 },
  ],
};
