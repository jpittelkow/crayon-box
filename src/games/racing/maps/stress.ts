// A stand-in for the very large map (docs/highway-map-plan.md, phase 1): generated, about 1,080 m by 660 m (D1),
// with roads on a grid and the plan's counts of toys, trees, set pieces and traffic. It is for tests and dev tools
// only (the step-time budget, the frame-time page `tools/driving-stress.html`), never in `MAPS`: it has no ideas,
// no landmarks and a big empty middle in each block, which the real map must not have.
//
// Places are in the simulation's own x and z, in metres. The map is the same mirrored east to west, so it needs
// no turning round.
import type { MapDef, OnRoad, ZoneDef } from '../sim/map';
import { buildRoad, nearestOn, smoothPath, type RoadDef } from '../sim/roads';

const W = 9;
/** Half the land's size, across (x) and from south to north (z): 1,080 m by 660 m. */
const HALF_X = 540, HALF_Z = 330;
/** The loop runs this far inside the shore. */
const INSET = 60;
const LX = HALF_X - INSET, LZ = HALF_Z - INSET;
/** The north-south roads, and where the east-west road through the middle meets them. */
const NS_X = [-360, -120, 120, 360];

/** Points every 1.5 m along a straight line. */
const line = (x0: number, z0: number, x1: number, z1: number): [number, number][] => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.5));
  return Array.from({ length: n + 1 }, (_, i): [number, number] => [x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n]);
};

/** A rectangle with rounded corners of radius `r`, as a few control points for `smoothPath`. */
const rounded = (hx: number, hz: number, r: number): [number, number][] => [
  [-hx, 0], [-hx, hz - r], [-hx + r * 0.3, hz - r * 0.3], [-hx + r, hz], [0, hz], [hx - r, hz], [hx - r * 0.3, hz - r * 0.3],
  [hx, hz - r], [hx, 0], [hx, -hz + r], [hx - r * 0.3, -hz + r * 0.3], [hx - r, -hz], [0, -hz], [-hx + r, -hz],
  [-hx + r * 0.3, -hz + r * 0.3], [-hx, -hz + r],
];

const SHORE = smoothPath(rounded(HALF_X, HALF_Z, 90), true, 2);

/** Road 0: the loop round the land. */
const LOOP: RoadDef = { kind: 'street', width: W, closed: true, points: smoothPath(rounded(LX, LZ, 60), true, 1.5) };
/** Roads 1 to 4: north to south, joining the loop at both ends. */
const NORTH_SOUTH: RoadDef[] = NS_X.map((x) => ({ kind: 'street', width: W, closed: false, from: 0, to: 0, points: line(x, -LZ, x, LZ) }));
/**
 * Roads 5 to 9: the east-west road through the middle, in five stretches from the loop to the loop, each joining
 * the north-south roads at its ends (a crossroads is two three-way junctions at one spot).
 */
const XS = [-LX, ...NS_X, LX];
const EAST_WEST: RoadDef[] = XS.slice(0, -1).map((x, i) => ({
  kind: i % 2 ? 'street' : 'dirt', width: W, closed: false, from: i === 0 ? 0 : i, to: i === XS.length - 2 ? 0 : i + 1,
  points: line(x, 0, XS[i + 1]!, 0),
}));

const ROADS = [LOOP, ...NORTH_SOUTH, ...EAST_WEST];
const built = ROADS.map(buildRoad);
/** A place on a road by a point near it. */
const near = (road: number, x: number, z: number, offset = 0): OnRoad =>
  ({ road, at: nearestOn(built[road]!, road, x, z).s / built[road]!.length, offset });

/**
 * About 25 set pieces, spread round the roads: ramps, car washes, garages, mud, traffic lights at four of the
 * crossroads, and a ford where a stream crosses the loop.
 */
const ZONES: ZoneDef[] = [
  ...[-300, -60, 200, 420].map((x): ZoneDef => ({ kind: 'ramp', on: near(0, x, LZ), r: 3.5 })),
  ...[-420, 60, 300].map((x): ZoneDef => ({ kind: 'ramp', on: near(0, x, -LZ), r: 3.5 })),
  ...[1, 4].map((r): ZoneDef => ({ kind: 'ramp', on: { road: r, at: 0.3 }, r: 3.5 })),
  ...[2, 3].map((r): ZoneDef => ({ kind: 'car-wash', on: { road: r, at: 0.75 }, r: 4 })),
  { kind: 'car-wash', on: near(0, LX, -150), r: 4 },
  ...[1, 2, 3, 4].map((r): ZoneDef => ({ kind: 'garage', on: { road: r, at: 0.2 }, r: 4 })),
  ...[5, 7, 9].map((r): ZoneDef => ({ kind: 'mud', on: { road: r, at: 0.5 }, r: 6.5 })),
  { kind: 'mud', on: near(0, -LX, 150), r: 6.5 },
  ...[1, 2, 3, 4].map((r): ZoneDef => ({ kind: 'lights', on: near(r, NS_X[r - 1]!, 0), r: 5 })),
  { kind: 'ford', on: near(0, -240, -LZ), r: 6 },
];

/** A stream from the middle of a block, across the loop at the ford, to the sea. */
const STREAM = line(-240, -150, -240, -HALF_Z - 20);

/** Stars and stacks along the roads, as on today's maps: about one a 100 m. */
const TARGETS: NonNullable<MapDef['targets']> = [
  ...[-400, -180, 40, 260, 450].flatMap((x) => [
    { id: 'toy/star' as const, on: near(0, x, LZ), count: 4 },
    { id: 'toy/star' as const, on: near(0, x - 20, -LZ), count: 4 },
    { id: 'toy/box-stack' as const, on: near(0, x + 40, LZ, -6) },
    { id: 'toy/box-stack' as const, on: near(0, x + 60, -LZ, 6) },
  ]),
  ...[1, 2, 3, 4].flatMap((r) => [
    { id: 'toy/star' as const, on: { road: r, at: 0.62 }, count: 3 },
    { id: 'toy/box-stack' as const, on: { road: r, at: 0.88, offset: 6 } },
  ]),
];

export const STRESS: MapDef = {
  id: 'stress',
  land: { outline: SHORE, beach: 8 },
  roads: ROADS,
  // A bridge on the loop's north side (over land: only its rails matter here) and a tunnel through a hill on a
  // north-south road.
  guards: [
    { kind: 'bridge', road: 0, ...(() => { const a = near(0, -60, LZ).at, b = near(0, -110, LZ).at; return { from: a, to: b }; })() },
    { kind: 'tunnel', road: 3, from: 0.4, to: 0.45 },
  ],
  hills: [
    { x: NS_X[2]!, z: -38, rx: 18, rz: 14, height: 8 },
    { x: -240, z: 140, rx: 20, rz: 16, height: 8 },
    { x: 240, z: 140, rx: 16, rz: 13, height: 7, color: 0x9a6b42 },
  ],
  sand: [[[-500, -315], [-300, -315], [-300, -285], [-500, -285]]],
  spawn: near(0, -LX, -100),
  propCount: 3000,
  trafficPrefer: ['digger', 'dump', 'mixer', 'tractor', 'garbage'],
  zones: ZONES,
  traffic: [],
  trafficNear: { count: 10, cruise: [6, 9.5] },
  water: {
    pools: [
      { on: near(0, LX, 120), r: 12, deep: true },
      { on: { road: 2, at: 0.35 }, r: 9, deep: true, mud: true },
    ],
    puddles: ROADS.map((_, road) => ({ road, at: [0.1, 0.27, 0.44, 0.61, 0.78, 0.95], spread: 5, size: [2, 1.6] as [number, number], mud: road >= 5 })),
    streams: [{ points: STREAM, width: 6 }],
  },
  trees: {
    kinds: [{ id: 'scenery/pine', share: 2 }, { id: 'scenery/round-tree', share: 1 }],
    count: 600, scale: [0.8, 0.6], roadGap: 2.5, waterGap: 2, edgeGap: 5,
  },
  props: {
    kinds: [
      { id: 'toy/cone', share: 3 }, { id: 'toy/crate', share: 2 }, { id: 'toy/beach-ball', share: 1 }, { id: 'toy/hay-bale', share: 1 },
    ],
    nearRoad: 0.6, spread: 4, edgeGap: 5, spawnGap: 7,
  },
  decor: [{ id: 'decor/bush', clumps: 1500, perClump: 3 }],
  targets: TARGETS,
  animals: [
    { id: 'animal/cow', x: -240, z: 60, count: 4, roam: 10 },
    { id: 'animal/sheep', x: 240, z: -140, count: 5, roam: 9 },
    { id: 'animal/duck', x: 0, z: 150, count: 3, roam: 5 },
  ],
};
