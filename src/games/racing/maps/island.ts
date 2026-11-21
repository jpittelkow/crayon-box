// The island (milestone-3 B4 and E; ADR 0035): layout A, chosen by the owner on 2026-11-15 (the picture is
// docs/design/island-layout-a.svg), grown to about three times its first area. A loop road round the island, a
// shortcut through a hill in the middle and a spur from the loop to the shortcut, all joined at three-way
// junctions; a bridge where the loop crosses a bay on the east; a wide beach on the south coast; two ramps, the car
// wash, the garage and the flood; a stream with a ford, traffic lights, a roundabout where the spur meets the
// shortcut, and a harbour on the bay by the bridge, with boats moored along its quay (ADR 0042); sheep and ducks in
// the fields.
//
// Places below are written as in the layout picture, x east and z north, at its first size; `at` scales them by
// GROW and turns them round, as the simulation's x grows westward (seen from above with north up).
import type { MapDef, OnRoad } from '../sim/map';
import { buildRoad, nearestOn, ringRoad, smoothPath, type RoadDef } from '../sim/roads';

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
  [-68, 0], [-62, 24], [-46, 40], [-24, 49], [2, 50], [28, 49], [42, 46], [54, 40], [61, 31], [63, 22],
  // The harbour (ADR 0042): a basin north of the bay, between a narrow headland and the loop, whose road runs along
  // its west side as the quay; the shore follows the quay's edge (2 m past the road), then passes under the bridge
  // into the bay.
  [59, 19], [55, 22], [54, 28], [51, 33], [45, 35.5], [39, 34], [34.5, 30.6],
  [34.3, 29.9], [37.0, 27.7], [39.4, 25.6], [41.4, 23.4], [43.2, 21.2], [44.8, 19.0], [46.1, 16.8], [46.8, 14.2],
  // the bay
  [45, 11], [38, 6], [36, 0], [38, -6], [45, -11], [56, -14],
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

/**
 * The roundabout (ADR 0042) where the spur meets the shortcut, south of the hill: its middle (east, north, at the
 * picture's size) and its ring's radius in metres. The ring is road 3; the shortcut is cut in two by it.
 */
const ROUNDABOUT: [number, number] = [0, -18];
const RING_R = 8;
const RING = ringRoad(...at(ROUNDABOUT), RING_R, ROAD_W);
/** The ring's north, west and south points, where the shortcut and the spur join it (at the picture's size). */
const ringNorth = ROUNDABOUT[1] + RING_R / GROW, ringSouth = ROUNDABOUT[1] - RING_R / GROW;

/** The shortcut: north to south straight through the middle, from the loop through the hill to the roundabout. */
const SHORTCUT: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 0, to: 3,
  points: Array.from({ length: 70 }, (_, i): [number, number] => at([0, 37 - (i / 69) * (37 - ringNorth)])),
};
/** The shortcut's south end: from the roundabout on to the loop in the south (road 4). */
const SHORTCUT_SOUTH: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 3, to: 0,
  points: Array.from({ length: 20 }, (_, i): [number, number] => at([0, ringSouth - (i / 19) * (37 + ringSouth)])),
};

/** The spur: from the west of the loop, curving south-east to meet the roundabout's west side. */
const SPUR: RoadDef = {
  kind: 'street', width: ROAD_W, closed: false, from: 0, to: 3,
  points: smoothPath(([[-47, 0], [-34, -6], [-18, -14.5], [ROUNDABOUT[0] - RING_R / GROW, ROUNDABOUT[1]]] as [number, number][]).map(at), false, 1.5),
};

const loop = buildRoad(LOOP), shortcut = buildRoad(SHORTCUT), south = buildRoad(SHORTCUT_SOUTH);
/** How far along the loop (0 to 1) its nearest point to a place from the picture is. */
const atLoop = (p: [number, number]) => {
  const [x, z] = at(p);
  return nearestOn(loop, 0, x, z).s / loop.length;
};
const onLoop = (p: [number, number], offset = 0): OnRoad => ({ road: 0, at: atLoop(p), offset });
const atShortcut = (north: number) => nearestOn(shortcut, 1, 0, north * GROW).s / shortcut.length;
const atSouth = (north: number) => nearestOn(south, 4, 0, north * GROW).s / south.length;

/**
 * A stream (ADR 0042): from a spring inside the loop, south-west of the hill, down across the loop road and the
 * beach to the sea. Shallow all along; the loop crosses it at a ford.
 */
const STREAM = smoothPath(([[-14, -21], [-15, -26], [-18, -31], [-20, -37], [-21, -45], [-23, -58]] as [number, number][]).map(at), false, 1.5);
/** Where the loop crosses the stream: the stream's point nearest the loop. */
const FORD_AT = (() => {
  const near = STREAM.map(([x, z]) => nearestOn(loop, 0, x, z)).sort((a, b) => a.dist - b.dist)[0]!;
  return near.s / loop.length;
})();

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
  roads: [LOOP, SHORTCUT, SPUR, RING, SHORTCUT_SOUTH],
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
    { kind: 'car-wash', on: { road: 4, at: atSouth(-29.4) }, r: 4 },
    // The garage (ADR 0035): drive in, come out as the next vehicle.
    { kind: 'garage', on: { road: 1, at: atShortcut(24) }, r: 4 },
    // ADR 0042: the ford where the loop crosses the stream, and traffic lights where the shortcut meets the loop in
    // the south (for show: traffic may wait at red, the kid never does).
    { kind: 'ford', on: { road: 0, at: FORD_AT }, r: 6 },
    { kind: 'lights', on: onLoop([0, -37]), r: 5 },
    // The roundabout, by its middle; and the harbour on the quay north of the bridge, its last boat sailing out
    // through the bay to the sea and back.
    { kind: 'roundabout', on: spot(ROUNDABOUT), r: RING_R + ROAD_W / 2 },
    {
      kind: 'harbour', on: onLoop([39.6, 20.2]), r: 14,
      sail: ([[52, 15], [60, 9], [70, 5], [78, 0], [72, -6], [62, -2], [54, 8]] as [number, number][]).map(at),
    },
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
      at: ([[28, 30], [36, -24], [-44, -12], [10, 37], [-26, 33], [16, -36]] as [number, number][]).map(atLoop),
      spread: 6, size: [2, 1.6],
    }, { road: 2, at: [0.4, 0.75], spread: 4, size: [2, 1.2] }],
    streams: [{ points: STREAM, width: 6 }],
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
  // Targets (ADR 0041): rows of stars on the roads, for "follows the road" to collect too, and stacks of boxes just
  // off them, all round the island. The loop goes clockwise from the west (north first), so a negative offset is
  // outside it.
  targets: [
    { id: 'toy/star', on: onLoop([-41, -19]), count: 5 },
    { id: 'toy/star', on: onLoop([-14, 36]), count: 4 },
    { id: 'toy/star', on: onLoop([2, 37]), count: 4 },
    { id: 'toy/star', on: onLoop([26, -32]), count: 4 },
    { id: 'toy/star', on: { road: 1, at: atShortcut(18) }, count: 3 },
    { id: 'toy/star', on: { road: 2, at: 0.5 }, count: 3 },
    { id: 'toy/box-stack', on: onLoop([-47, 4], -6) },
    { id: 'toy/box-stack', on: onLoop([-20, 35], 6) },
    { id: 'toy/box-stack', on: onLoop([12, 37], -6) },
    { id: 'toy/box-stack', on: onLoop([40, -20], 6) },
    { id: 'toy/box-stack', on: onLoop([-10, -37], -6) },
    { id: 'toy/box-stack', on: { road: 1, at: atShortcut(31), offset: 6 } },
    { id: 'toy/box-stack', on: { road: 2, at: 0.25, offset: 6 } },
  ],
  // Animals that answer the horn, in the fields, as in the layout picture (milestone-3 B3).
  animals: [
    { id: 'animal/sheep', ...spot([20, 18]), count: 4, roam: 9 },
    { id: 'animal/duck', ...spot([12, 25]), count: 3, roam: 4 },
    { id: 'animal/sheep', ...spot([24, -22]), count: 3, roam: 8 },
  ],
  // A boat moored off the beach (milestone-3 E); the bay's boats are the harbour's now (ADR 0042).
  boats: [{ ...spot([20, -62]), heading: 0.3 }],
};
