// The prototype's island (ADR 0021) as a map: a round island with one ring road, a flood across the far side,
// puddles along the road, trees and things to knock around. The first map file (milestone-3 phase B).
import type { MapDef } from '../sim/map';
import { roundOutline } from '../sim/land';
import { circlePath } from '../sim/roads';

/** The island's radius, the ring road's radius and its width, in metres. */
export const LAND_R = 60;
export const ROAD_R = 38;
export const ROAD_W = 9;

/** A spot on the ring road given as an angle around the island (0 is the start, a full turn is 2π). */
const around = (angle: number, offset = 0) => ({ road: 0, at: angle / (Math.PI * 2), offset });

export const ISLAND: MapDef = {
  id: 'island',
  land: { outline: roundOutline(0, 0, LAND_R), beach: 8 },
  roads: [{ kind: 'street', width: ROAD_W, points: circlePath(ROAD_R), closed: true }],
  spawn: around(0),
  // A ramp across the road and a car wash over it (milestone-3 B3), clear of the puddles and the flood. Traffic
  // hops the ramp and goes through the wash too.
  zones: [{ kind: 'ramp', on: around(2.45), r: 3.5 }, { kind: 'car-wash', on: around(5.2), r: 4 }],
  traffic: [
    { kind: 'bus', on: around(1.3, -2.2), cruise: 6.5 },
    { kind: 'police', on: around(3.1, 2.2), cruise: 9.5 },
    { kind: 'monster', on: around(4.7, -2.2), cruise: 8 },
  ],
  water: {
    pools: [{ on: around(Math.PI), r: 12, deep: true }],
    puddles: [{ road: 0, at: [0.75, 1.5, 2.2, 4.0, 4.8, 5.6].map((a) => a / (Math.PI * 2)), spread: 7, size: [2.2, 1.6] }],
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
};
