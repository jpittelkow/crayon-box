// The building site (milestone-3 E; ADR 0035): a square of land by the sea, about 230 m across. A loop of dirt
// track round it, a north-south track through the middle and an east-west track from the loop's west side to it,
// joined at three-way junctions. Dirt hills to drive round, three ramps, mud puddles and a muddy pond, a sand pit,
// cones and crates to knock down, cows in a field, the site office as the garage, a car wash, and the building
// vehicles first in traffic. Places are in the simulation's own x and z, in metres.
import type { MapDef, OnRoad } from '../sim/map';
import { buildRoad, nearestOn, smoothPath, type RoadDef } from '../sim/roads';

const TRACK_W = 9;
const DIRT = 0x9a6b42;

/** The shoreline: a square with rounded corners. */
const SHORE = smoothPath([
  [-112, -96], [0, -108], [112, -96], [118, 0], [110, 100], [0, 110], [-108, 98], [-116, 0],
], true, 2);

/** The loop: a rounded square of track inside the shore. */
const LOOP: RoadDef = {
  kind: 'dirt', width: TRACK_W, closed: true,
  points: smoothPath([[-80, 0], [-78, 62], [0, 72], [78, 64], [82, 0], [80, -60], [0, -72], [-76, -64]], true, 1.5),
};

/** North to south through the middle, joining the loop at both ends. */
const MIDDLE: RoadDef = {
  kind: 'dirt', width: TRACK_W, closed: false, from: 0, to: 0,
  points: Array.from({ length: 96 }, (_, i): [number, number] => [0, 72 - (i / 95) * 144]),
};

/** From the loop's west side east to the middle track. */
const CROSS: RoadDef = {
  kind: 'dirt', width: TRACK_W, closed: false, from: 0, to: 1,
  points: Array.from({ length: 54 }, (_, i): [number, number] => [-80 + (i / 53) * 80, 0]),
};

const loop = buildRoad(LOOP), middle = buildRoad(MIDDLE), cross = buildRoad(CROSS);
const atLoop = (x: number, z: number) => nearestOn(loop, 0, x, z).s / loop.length;
const onLoop = (x: number, z: number, offset = 0): OnRoad => ({ road: 0, at: atLoop(x, z), offset });
const atMiddle = (z: number) => nearestOn(middle, 1, 0, z).s / middle.length;
const atCross = (x: number) => nearestOn(cross, 2, x, 0).s / cross.length;

export const SITE: MapDef = {
  id: 'site',
  land: { outline: SHORE, beach: 6 },
  roads: [LOOP, MIDDLE, CROSS],
  hills: [
    { x: 42, z: 34, rx: 16, rz: 13, height: 7, color: DIRT },
    { x: -42, z: -34, rx: 14, rz: 12, height: 6, color: DIRT },
    { x: 44, z: -26, rx: 11, rz: 10, height: 5, color: DIRT },
  ],
  // A sand pit by the south track, to drive through.
  sand: [[[30, -46], [60, -46], [62, -58], [28, -60]]],
  spawn: onLoop(-80, -30),
  propCount: 340,
  trafficPrefer: ['digger', 'dump', 'mixer', 'tractor', 'garbage'],
  zones: [
    { kind: 'ramp', on: onLoop(0, 72), r: 3.5 },
    { kind: 'ramp', on: onLoop(82, 0), r: 3.5 },
    { kind: 'ramp', on: { road: 1, at: atMiddle(-48) }, r: 3.5 },
    { kind: 'car-wash', on: { road: 2, at: atCross(-46) }, r: 4 },
    // The site office: the garage (ADR 0035).
    { kind: 'garage', on: { road: 1, at: atMiddle(30) }, r: 4 },
  ],
  traffic: [
    { kind: 'bus', on: onLoop(-60, 64, 2.2), cruise: 6 },
    { kind: 'bus', on: onLoop(60, 66, -2.2), cruise: 7 },
    { kind: 'bus', on: onLoop(80, -30, 2.2), cruise: 6.5 },
    { kind: 'bus', on: onLoop(-40, -68, -2.2), cruise: 7.5 },
    { kind: 'bus', on: { road: 1, at: 0.6, offset: 2.2 }, cruise: 6 },
  ],
  water: {
    // A muddy pond across the middle track: deep enough to wade.
    pools: [{ on: { road: 1, at: atMiddle(-22) }, r: 8, deep: true, mud: true }],
    puddles: [
      { road: 0, at: [0.06, 0.18, 0.31, 0.44, 0.58, 0.7, 0.83, 0.94], spread: 6, size: [2.2, 1.6], mud: true },
      { road: 2, at: [0.25, 0.75], spread: 4, size: [2, 1.2], mud: true },
    ],
  },
  trees: {
    kinds: [{ id: 'scenery/pine', share: 1 }],
    count: 45, scale: [0.8, 0.5], roadGap: 3, waterGap: 2, edgeGap: 4,
  },
  props: {
    kinds: [{ id: 'toy/cone', share: 3 }, { id: 'toy/crate', share: 3 }, { id: 'toy/hay-bale', share: 1 }],
    nearRoad: 0.65, spread: 5, edgeGap: 6, spawnGap: 8,
  },
  decor: [{ id: 'decor/bush', clumps: 50, perClump: 3 }],
  animals: [{ id: 'animal/cow', x: -42, z: 36, count: 3, roam: 8 }],
};
