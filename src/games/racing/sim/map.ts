// A driving map as data (milestone-3 phase B; driving-assets.md). The simulation and the look both read a map, so
// another map is another file. Plain TypeScript, no three.js.
import type { DecorId, SceneryId } from './assets/scenery';
import type { ToyId } from './assets/toys';
import type { RoadDef } from './roads';
import type { VehicleKind } from './sim';

/** A place on a road: a fraction of the way along it (0 to 1) and metres right of its centre line. */
export interface OnRoad { road: number; at: number; offset?: number }

export interface MapDef {
  id: string;
  /** The land: a round island for now. The car turns back before its edge and can never leave it. */
  land: { x: number; z: number; r: number; beach: number };
  roads: RoadDef[];
  /** Where the kid's car starts, facing along the road. */
  spawn: OnRoad;
  /** Traffic: each vehicle starts on a road, keeps to its lane and drives at its own pace. */
  traffic: { kind: VehicleKind; on: OnRoad; cruise: number }[];
  water: {
    /** Round pools placed by hand: the flood is a deep one. */
    pools: { on: OnRoad; r: number; deep: boolean }[];
    /** Puddles along a road, each with a smaller lobe so it is not a perfect circle. */
    puddles: { road: number; at: number[]; spread: number; size: [number, number] }[];
  };
  /** Trees scattered over the land, kept off the roads and out of the water; which kinds, by share. */
  trees: {
    kinds: { id: SceneryId; share: number }[];
    count: number; scale: [number, number]; roadGap: number; waterGap: number; edgeGap: number;
  };
  /** Toys to knock around: which kinds, by share; a share of them sits on or beside the roads. */
  props: { kinds: { id: ToyId; share: number }[]; nearRoad: number; spread: number; edgeGap: number; spawnGap: number };
  /** Decor scattered in clumps, off the roads and out of the water (drawn only; the car drives through it). */
  decor: { id: DecorId; clumps: number; perClump: number }[];
}
