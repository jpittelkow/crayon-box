// A driving map as data (milestone-3 phase B; driving-assets.md). The simulation and the look both read a map, so
// another map is another file. Plain TypeScript, no three.js.
import type { AnimalId } from './assets/animals';
import type { DecorId, SceneryId } from './assets/scenery';
import type { TargetId, ToyId } from './assets/toys';
import type { LandDef } from './land';
import type { RoadDef } from './roads';
import type { VehicleKind } from './sim';

/** A place on a road: a fraction of the way along it (0 to 1) and metres right of its centre line. */
export interface OnRoad { road: number; at: number; offset?: number }

/**
 * The kinds of zone a set piece can have (milestone-3 phase B3). ADR 0042 adds a patch of mud, a ford where a
 * stream crosses a road, traffic lights at a junction (for show: they never stop the kid), a roundabout (by the
 * middle of a one-way ring road, `ringRoad`) and a harbour (on a road along the shore: its quay). ADR 0048 adds a
 * helicopter pad (by its middle, beside a road: the helicopter lifts off as the kid comes).
 */
export type ZoneKind = 'ramp' | 'car-wash' | 'garage' | 'mud' | 'ford' | 'lights' | 'roundabout' | 'harbour' | 'helipad';

/** A stretch of road, from one fraction along it to another, that the car is held on. */
export interface GuardDef { kind: 'bridge' | 'tunnel'; road: number; from: number; to: number }

/** A hill: a low dome, `rx` by `rz` metres across its base (half-widths), `height` metres high. */
export interface HillDef {
  x: number; z: number; rx: number; rz: number; height: number;
  /** Its colour: grass when left out; dirt on a building site (milestone-3 E). */
  color?: number;
}

/** A zone: a round area of radius `r`, placed on a road or by its middle. */
export interface ZoneDef {
  kind: ZoneKind;
  /** On a road (facing along it), or by its middle and the way it faces (a heading, default 0). */
  on: OnRoad | { x: number; z: number; heading?: number };
  r: number;
  /**
   * A harbour only (ADR 0042): the way its sailing boat goes out to sea and back, from its berth (the last boat
   * along the quay) through these points on the water, and home the same way.
   */
  sail?: [number, number][];
}

export interface MapDef {
  id: string;
  /** How many toys to knock around; the game's default when left out. */
  propCount?: number;
  /** Vehicles traffic prefers on this map, when they are switched on (the building site's diggers and trucks). */
  trafficPrefer?: VehicleKind[];
  /** Boats moored on the water: drawn only, to look at. */
  boats?: { x: number; z: number; heading: number }[];
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
  /**
   * Traffic by a rule, for a big map (docs/highway-map-plan.md, phase 2), on top of `traffic`: `count` vehicles
   * that live near the kid, on `roads` (all of them when left out), each at a pace between `cruise`'s two numbers.
   * One that falls far behind is put back on a road ahead or behind, out of sight (`TRAFFIC_NEAR`, sim.ts).
   */
  trafficNear?: { count: number; roads?: number[]; cruise: [number, number] };
  water: {
    /** Round pools placed by hand: the flood is a deep one. */
    pools: { on: OnRoad; r: number; deep: boolean; mud?: boolean }[];
    /** Puddles along a road, each with a smaller lobe so it is not a perfect circle. */
    puddles: { road: number; at: number[]; spread: number; size: [number, number]; mud?: boolean }[];
    /**
     * Streams (ADR 0042, `water/stream`): shallow water along a path, `width` metres across, never deep anywhere.
     * Where one crosses a road, a `ford` zone makes the crossing. Only the stretches on the land are water.
     */
    streams?: { points: [number, number][]; width: number }[];
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
  /**
   * Targets (ADR 0041), at fixed spots on the roads: a stack of boxes to knock over, or a star to collect. With
   * `count`, a row of them along the road from `on`, `gap` metres apart (4 when left out), all at its offset. A
   * stack faces along its road.
   */
  targets?: { id: TargetId; on: OnRoad; count?: number; gap?: number }[];
  /** Herds of animals (driving-assets.md category 8): `count` of one kind wandering within `roam` metres of a spot. */
  animals?: { id: AnimalId; x: number; z: number; count: number; roam: number }[];
}
