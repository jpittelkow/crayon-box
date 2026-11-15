// A driving map as data (milestone-3 phase B; driving-assets.md). The simulation and the look both read a map, so
// another map is another file. Plain TypeScript, no three.js.
import type { AnimalId } from './assets/animals';
import type { DecorId, SceneryId } from './assets/scenery';
import type { ToyId } from './assets/toys';
import type { LandDef } from './land';
import type { RoadDef } from './roads';
import type { VehicleKind } from './sim';

/** A place on a road: a fraction of the way along it (0 to 1) and metres right of its centre line. */
export interface OnRoad { road: number; at: number; offset?: number }

/** The kinds of zone a set piece can have (milestone-3 phase B3). */
export type ZoneKind = 'ramp' | 'car-wash' | 'garage';

/** A stretch of road, from one fraction along it to another, that the car is held on. */
export interface GuardDef { kind: 'bridge' | 'tunnel'; road: number; from: number; to: number }

/** A hill: a low dome, `rx` by `rz` metres across its base (half-widths), `height` metres high. */
export interface HillDef { x: number; z: number; rx: number; rz: number; height: number }

/** A zone: a round area of radius `r`, placed on a road or by its middle. */
export interface ZoneDef {
  kind: ZoneKind;
  /** On a road (facing along it), or by its middle and the way it faces (a heading, default 0). */
  on: OnRoad | { x: number; z: number; heading?: number };
  r: number;
}

export interface MapDef {
  id: string;
  /** The land, as a shoreline of any shape. The car turns back before its edge and can never leave it. */
  land: LandDef;
  /**
   * Places where something happens when the kid's car drives in (set pieces, driving-assets.md category 7): a
   * round area on a road, or anywhere by its middle. Optional; the simulation reports entering and leaving.
   */
  zones?: ZoneDef[];
  roads: RoadDef[];
  /**
   * Stretches of road with sides the car can't leave (milestone-3 B4): a bridge over water, or a tunnel through a
   * hill. Given as fractions along the road. On and near a bridge the shore doesn't turn the car back.
   */
  guards?: GuardDef[];
  /** Hills the car can't climb: it slides round them, or goes through one in a tunnel. */
  hills?: HillDef[];
  /** Sandy places (a beach): drawn as sand; wheels kick up sand and the car slows a little. */
  sand?: [number, number][][];
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
  /** Herds of animals (driving-assets.md category 8): `count` of one kind wandering within `roam` metres of a spot. */
  animals?: { id: AnimalId; x: number; z: number; count: number; roam: number }[];
}
