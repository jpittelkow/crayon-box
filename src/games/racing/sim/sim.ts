// The driving simulation (ADR 0021). Plain TypeScript with no 3D library, so it can be unit-tested: a car is a
// position, a heading and a speed; knocked props get a push and a spin, bounce, settle, and return home. Nothing
// here can stop the car dead, flip it, or let it leave the island. The island itself comes from a map file
// (sim/map.ts, maps/), so another map is another file.
import { ISLAND } from '../maps/island';
import { SCENERY, type SceneryId } from './assets/scenery';
import { STACK_CLEAR, STACK_ROWS, STAR_BACK, STAR_CLEAR, STAR_HEIGHT, TOYS, type TargetId, type ToyId } from './assets/toys';
import { makeAnimals, stepAnimals, type Animal } from './animals';
import type { AnimalCall } from './assets/animals';
import { buildGuards, buildSand, guardAt, hillReach, onSand, type Guard } from './ground';
import { buildLand, keepInland, randomInland, shore, type Land } from './land';
import type { MapDef, OnRoad, ZoneKind } from './map';
import { HOP_GRAVITY, groundHeight } from './ramps';
import { buildJunctions, buildRoad, nearestOn, nearestRoad, passes, pointAt, wrapAlong, type Junction, type Road } from './roads';

export const MAX_SPEED = 17;
export const FLOOD_SPEED = 8;

/**
 * How each vehicle feels (ADR 0035): its top speed, how hard it knocks toys, and how much faster than the rest it
 * wades the flood. Feel only: nothing a kid has to do is easier with any of them.
 */
export const VEHICLE_FEEL: Record<VehicleKind, { top: number; push: number; wade: number }> = {
  car: { top: 17, push: 1, wade: 0 },
  police: { top: 19, push: 1, wade: 0 },
  monster: { top: 17, push: 1.4, wade: 3 },
  bus: { top: 13, push: 1.1, wade: 0 },
  fire: { top: 16, push: 1.3, wade: 1 },
  ambulance: { top: 19, push: 1, wade: 0 },
  tow: { top: 17, push: 1.1, wade: 0 },
  digger: { top: 12, push: 1.5, wade: 2 },
  dump: { top: 14, push: 1.4, wade: 2 },
  mixer: { top: 13, push: 1.2, wade: 1 },
  tractor: { top: 12, push: 1.2, wade: 3 },
  garbage: { top: 13, push: 1.2, wade: 1 },
  icecream: { top: 13, push: 0.9, wade: 0 },
  race: { top: 19, push: 0.9, wade: 0 },
};
/** How fast a car goes through a car wash (milestone-3 B3): slow enough to see the brushes and the bubbles. */
export const WASH_SPEED = 5;
/** Seconds for the bubbles to rinse off after a car wash. */
export const RINSE = 3.5;
/** Top speed on sand (milestone-3 B4). */
export const SAND_SPEED = 11;


const HOME = 0, FLYING = 1, AWAY = 2, SHRINK = 3, GROW = 4;
/** A toy's states (`Prop.state`), for tests: at home, flying, lying where it landed, shrinking away, growing back. */
export const TOY_STATE = { HOME, FLYING, AWAY, SHRINK, GROW } as const;

/** How much the car helps: the kid steers freely, or the car follows the road and a touch only makes it go. */
export type Assist = 'free' | 'road';

export interface Input {
  go: boolean;
  brake: boolean;
  /** -1 is hard left, 1 is hard right. */
  steer: number;
  /** A finger's spot on the ground: the car drives there and stops (ADR 0031). Steering keys leave it out. */
  spot?: { x: number; z: number };
  /**
   * A finger as a joystick (ADR 0036): where it is from the middle of the screen, `x` -1 (left edge) to 1 (right
   * edge), `y` -1 (bottom) to 1 (top). Above the middle goes, faster the higher; left and right turn, harder the
   * further out; below the middle backs up. Steering keys leave it out.
   */
  stick?: { x: number; y: number };
}

/** Closer to the middle than this (in screen halves), a joystick finger does nothing that way. */
export const STICK_DEAD = 0.12;
/** The top speed backing up, m/s. */
export const REVERSE_SPEED = 5;

/** Closer than this to its spot, the car has arrived. */
export const ARRIVE = 2.5;
/** Within this distance of its spot, the car eases off so it stops there rather than overshooting. */
const SLOW_FROM = 12;

/** What a traffic car is doing about the kid's car (ADR 0031). */
export const CRUISE = 0, JOIN = 1, ALONG = 2, LEAVE = 3;

/** The kinds of vehicle (ADR 0025). Each has its own size, look and engine sound. */
export type VehicleKind = 'car' | 'police' | 'monster' | 'bus'
  // Milestone 3, phase D (ADR 0035).
  | 'fire' | 'ambulance' | 'tow' | 'digger' | 'dump' | 'mixer' | 'tractor' | 'garbage' | 'icecream' | 'race';

/** Half the length and half the width of each kind, in metres, for bumping into things. */
export const VEHICLE_SIZE: Record<VehicleKind, { half: number; side: number }> = {
  car: { half: 2.1, side: 1.0 },
  police: { half: 2.1, side: 1.0 },
  monster: { half: 2.7, side: 1.6 },
  bus: { half: 4.7, side: 1.3 },
  fire: { half: 3.5, side: 1.25 },
  ambulance: { half: 2.8, side: 1.12 },
  tow: { half: 3.0, side: 1.15 },
  digger: { half: 2.8, side: 1.25 },
  dump: { half: 3.3, side: 1.25 },
  mixer: { half: 3.4, side: 1.2 },
  tractor: { half: 2.0, side: 1.15 },
  garbage: { half: 3.6, side: 1.25 },
  icecream: { half: 2.8, side: 1.12 },
  race: { half: 2.3, side: 1.0 },
};

/** Points along a vehicle's middle, front to back, that together cover its length with circles of `side`. */
export function bodyPoints(c: Car): [number, number][] {
  const { half, side } = VEHICLE_SIZE[c.kind];
  const reach = Math.max(0, half - side);
  const n = Math.max(1, Math.ceil((2 * reach) / side) + 1);
  const fx = Math.sin(c.heading), fz = Math.cos(c.heading);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : reach - (2 * reach * i) / (n - 1);
    return [c.x + fx * t, c.z + fz * t];
  });
}

export interface Car {
  kind: VehicleKind;
  x: number; z: number; heading: number; speed: number; spin: number;
  /** How far the car sits below the road (it sinks and bobs in deep water). */
  y: number;
  /** The water it was in last step: 0 none, 1 a puddle, 2 the flood. */
  wet: number;
  /** Time until its next wake ring. */
  wake: number;
  /** Height above the ground under it (ramps), and how fast that is changing; 0 and 0 on flat ground. */
  h: number; vy: number;
  /** How soapy it is from a car wash: 1 just out of it, falling to 0 as it rinses off. */
  soap: number;
  /**
   * Traffic only: the road it drives, how far along it, its lane now and its usual lane (metres right of the
   * centre line), and its own pace.
   */
  road: number; s: number; lane: number; home: number; cruise: number;
  /** Traffic only: which way along its road it drives (1 forward, -1 back). Its lanes are right of that way. */
  dir: 1 | -1;
  /** Traffic only: CRUISE, JOIN, ALONG or LEAVE; time left in it; time before it may join the kid again. */
  mode: number; timer: number; cool: number;
}

export interface Tree { kind: SceneryId; x: number; z: number; scale: number }

/** A toy on the map (driving-assets.md, category 2), knocked about and always coming back. */
export interface Prop {
  toy: ToyId;
  /** Home: where it stands (its middle's height too: a star floats, a box can sit on others) and the way it faces. */
  homeX: number; homeZ: number; homeY: number; homeYaw: number;
  /**
   * A box of a stack (ADR 0041): which stack (an index into `World.stacks`, -1 for any other toy), its row from the
   * bottom, and its place in the stack (the renderer gives each place its own colour).
   */
  stack: number; level: number; slot: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  qx: number; qy: number; qz: number; qw: number;
  wx: number; wy: number; wz: number;
  scale: number; state: number; timer: number; cool: number;
}

export interface Puff { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }

/** A piece of confetti (ADR 0041, `fx/confetti`): its colour (an index), and how fast and from where it turns. */
export interface Confetti extends Puff { hue: number; turn: number; phase: number }

/** Seconds a piece of confetti lasts; pieces in a burst; pieces in the pool (three bursts at once). */
export const CONFETTI_LIFE = 1.8;
export const CONFETTI_BURST = 40;
export const CONFETTI_POOL = 120;
/** How many colours confetti comes in (the renderer's crayon colours). */
export const CONFETTI_HUES = 8;

/** A round patch of water: a shallow puddle, or the deep flood across the road. */
/** A round patch of water: a shallow puddle, or the deep flood across the road; muddy on a building site. */
export interface Water { x: number; z: number; r: number; deep: boolean; mud?: boolean }

/** A ring on the water that spreads and disappears. */
export interface Ripple { x: number; z: number; life: number; size: number }

export const RIPPLE_LIFE = 1.1;
export const DROP_LIFE = 0.8;

export interface World {
  /** The map this world was made from, and its roads ready to follow. */
  map: MapDef;
  roads: Road[];
  rng: number;
  /**
   * A second stream for what no car feels (confetti, and how a stack's boxes fly: toys never move a car), so the
   * targets (ADR 0041) never change what traffic does next.
   */
  fxRng: number;
  time: number;
  /** cars[0] is the kid's car; the rest are traffic. */
  cars: Car[];
  trees: Tree[];
  props: Prop[];
  puffs: Puff[];
  /** Bubbles floating off a soapy kid's car (a car wash), pooled like the puffs. */
  bubbles: Puff[];
  bubbleNext: number;
  puffNext: number;
  waters: Water[];
  /** Water drops thrown up by splashes and wheel spray. */
  drops: Puff[];
  dropNext: number;
  ripples: Ripple[];
  rippleNext: number;
  /** Splashes the kid's car made in the last step, for the sounds: 1 a puddle, 2 the flood. */
  splashes: number[];
  camHeading: number;
  /** Kinds of the props the kid's car knocked in the last step, for the sounds. */
  knocks: ToyId[];
  /** Targets the kid's car toppled or collected in the last step (ADR 0041), for the sounds. */
  cheers: { toy: TargetId; x: number; z: number }[];
  /** Each stack of boxes: the indices of its boxes in `props`. */
  stacks: number[][];
  /** Confetti from targets (ADR 0041), pooled like the puffs. */
  confetti: Confetti[];
  confettiNext: number;
  assist: Assist;
  /** Seconds left of being steered back to the road after getting nowhere. */
  rescue: number;
  /** Where the car was when progress was last checked, and how long it has been driven since. */
  mark: { x: number; z: number; t: number };
  /**
   * The spot the kid's car is driving to (ADR 0031): the closest it has got, how long since it last got closer,
   * and whether it is done (arrived, or gave up on a spot it kept circling).
   */
  goal: { x: number; z: number; best: number; t: number; done: boolean } | null;
  /** The steering the kid's car used in the last step, -1 to 1, whether from keys, a spot or an assist. */
  steer: number;
  /** The map's land, ready to ask how far a point is from the shore. */
  land: Land;
  /** The map's zones, placed (milestone-3 phase B2). */
  zones: Zone[];
  /** The zone the kid's car is in, or -1. */
  zone: number;
  /** Zones the kid's car drove into or out of in the last step, for set pieces and sounds. */
  zoneEvents: { zone: number; kind: ZoneKind; entered: boolean }[];
  /** Vehicles that came down from a hop in the last step: 0 is the kid's car. For the sounds and dust. */
  landings: number[];
  /** Each road's junctions (milestone-3 B4). */
  junctions: Junction[][];
  /** Bridges and tunnels, placed. */
  guards: Guard[];
  /** The map's sandy places. */
  sand: Land[];
  /**
   * "Follows the road": the road the kid's car is following, and which way. Null until it is needed, or when the
   * car is far from that road.
   */
  follow: { road: number; dir: 1 | -1 } | null;
  /**
   * The junctions where "follows the road" took the other road last time (by junction). Each junction takes turns
   * on its own, so every road gets driven: one turn shared by all of them locked into the same choice at every
   * junction when a lap met two of them (found 2026-11-15, the island never drove its tunnel without a bump).
   */
  turned: Record<string, boolean>;
  /** The junction "follows the road" has already decided about, until it is behind the car ('' for none). */
  followAt: string;
  /** How sharply "follows the road" wants to turn (radians off the way ahead), to slow for a bend. */
  followTurn: number;
  /** What is under the kid's car this step, for the sounds (milestone-3 B6): sand, a bridge, a tunnel. */
  under: { sand: boolean; bridge: boolean; tunnel: boolean };
  /** The map's animals (milestone-3 B3). */
  animals: Animal[];
  /** The kid sounded the horn since the last step (see `honk`). */
  honked: boolean;
  /** Animals that answered the horn in the last step, by their call, for the sounds. */
  calls: AnimalCall[];
  /** The vehicles the garage hands out, in order (ADR 0035): the ones a parent has on. */
  pool: VehicleKind[];
}

/** A map's zone, placed on the ground, and the way it faces. */
export interface Zone { kind: ZoneKind; x: number; z: number; r: number; heading: number }

function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A number from the looks-only stream (`fxRng`). */
function fxRand(w: World): number {
  const keep = w.rng;
  w.rng = w.fxRng;
  const r = rand(w);
  w.fxRng = w.rng;
  w.rng = keep;
  return r;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Puts a traffic car on its road: its lane is right of the way it drives. With `dt`, it turns toward the road's
 * heading instead of snapping, so a turn at a junction is a quick swing rather than a jump.
 */
function trafficPose(w: World, c: Car, dt = 0): void {
  const p = pointAt(w.roads[c.road]!, c.s, c.lane * c.dir);
  c.x = p.x;
  c.z = p.z;
  const heading = c.dir > 0 ? p.heading : p.heading + Math.PI;
  c.heading = dt > 0 ? c.heading + clamp(wrap(heading - c.heading), -5 * dt, 5 * dt) : heading;
}

/** Distance along a road for a map's `OnRoad` place. */
const along = (w: World, on: OnRoad): number => on.at * w.roads[on.road]!.length;

/**
 * A world to drive. `kidKind` is the vehicle the kid picked (milestone-3 B5); traffic keeps the others, with the
 * plain car standing in for the one the kid is driving.
 */
export function makeWorld(
  seed: number, propCount: number, assist: Assist = 'free', map: MapDef = ISLAND, kidKind: VehicleKind = 'car',
  /** Vehicles traffic may be (ADR 0035: every vehicle switched on); without it, the map's own traffic kinds. */
  pool?: readonly VehicleKind[],
): World {
  const roads = map.roads.map(buildRoad);
  const w: World = {
    map, roads, land: buildLand(map.land), zones: [], zone: -1, zoneEvents: [], landings: [], bubbles: [], bubbleNext: 0,
    junctions: buildJunctions(roads), guards: buildGuards(map.guards, roads), sand: buildSand(map.sand),
    follow: null, turned: {}, followAt: '', followTurn: 0, under: { sand: false, bridge: false, tunnel: false }, animals: [], honked: false, calls: [], pool: [...(pool ?? [kidKind])],
    rng: seed | 0, fxRng: (seed | 0) ^ 0x5bd1e995, time: 0, cars: [], trees: [], props: [], puffs: [], puffNext: 0, camHeading: 0, knocks: [],
    cheers: [], stacks: [], confetti: [], confettiNext: 0,
    waters: [], drops: [], dropNext: 0, ripples: [], rippleNext: 0, splashes: [],
    assist, rescue: 0, mark: { x: 0, z: 0, t: 0 }, goal: null, steer: 0,
  };
  for (const z of map.zones ?? []) {
    const p = 'road' in z.on ? pointAt(roads[z.on.road]!, along(w, z.on), z.on.offset ?? 0) : z.on;
    w.zones.push({ kind: z.kind, x: p.x, z: p.z, r: z.r, heading: 'heading' in p ? (p.heading ?? 0) : 0 });
  }
  const car = (kind: VehicleKind, on: OnRoad, cruise: number): Car => {
    const c: Car = {
      kind, x: 0, z: 0, heading: 0, speed: cruise, spin: 0, y: 0, wet: 0, wake: 0, h: 0, vy: 0, soap: 0,
      road: on.road, s: along(w, on), lane: on.offset ?? 0, home: on.offset ?? 0, cruise,
      dir: 1, mode: CRUISE, timer: 0, cool: 0,
    };
    trafficPose(w, c);
    return c;
  };
  const kid = car(kidKind, map.spawn, 0);
  w.cars.push(kid);
  w.camHeading = kid.heading;
  w.mark = { x: kid.x, z: kid.z, t: 0 };
  // Traffic from the pool, a different vehicle in each slot where it can be, never the kid's own; or the map's.
  // The map's favourites first (the building site's trucks), when they are switched on.
  const prefer = map.trafficPrefer ?? [];
  const others = (pool ?? []).filter((k) => k !== kidKind).sort((a, b) => Number(prefer.includes(b)) - Number(prefer.includes(a)));
  const start = Math.floor(rand(w) * Math.max(1, others.length));
  map.traffic.forEach((t, i) => {
    const kind = others.length ? others[(start + i) % others.length]! : t.kind === kidKind ? 'car' : t.kind;
    w.cars.push(car(kind, t.on, t.cruise));
  });

  // Water: pools placed by hand (the flood), then puddles along the roads, each with a smaller lobe.
  for (const pool of map.water.pools) {
    const p = pointAt(roads[pool.on.road]!, along(w, pool.on), pool.on.offset ?? 0);
    w.waters.push({ x: p.x, z: p.z, r: pool.r, deep: pool.deep, mud: pool.mud });
  }
  for (const row of map.water.puddles) {
    const road = roads[row.road]!;
    for (const at of row.at) {
      const offset = (rand(w) - 0.5) * row.spread, size = row.size[0] + rand(w) * row.size[1], lobe = rand(w) * Math.PI * 2;
      const { x, z } = pointAt(road, at * road.length, offset);
      w.waters.push({ x, z, r: size, deep: false, mud: row.mud });
      w.waters.push({ x: x + Math.sin(lobe) * size * 0.7, z: z + Math.cos(lobe) * size * 0.7, r: size * 0.65, deep: false, mud: row.mud });
    }
  }

  // A random point on the land, no closer than `gap` to its edge.
  const onLand = (gap: number): [number, number] => randomInland(w.land, () => rand(w), gap);
  const offRoad = (x: number, z: number, gap: number) =>
    roads.every((road, i) => nearestOn(road, i, x, z).dist > road.def.width / 2 + gap);
  const onHill = (x: number, z: number, pad: number) => (map.hills ?? []).some((h) => hillReach(h, x, z, pad) < 1);

  // One of a map's kinds, chosen by their shares.
  const pick = <T>(kinds: { id: T; share: number }[]): T => {
    let r = rand(w) * kinds.reduce((sum, k) => sum + k.share, 0);
    for (const k of kinds) if ((r -= k.share) < 0) return k.id;
    return kinds[kinds.length - 1]!.id;
  };

  const trees = map.trees;
  let treeTries = 0;
  while (w.trees.length < trees.count && treeTries++ < trees.count * 10) {
    const [x, z] = onLand(trees.edgeGap);
    if (!offRoad(x, z, trees.roadGap)) continue;
    if (w.waters.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + trees.waterGap)) continue;
    if (onHill(x, z, 2) || onSand(w.sand, x, z)) continue;
    w.trees.push({ kind: pick(trees.kinds), x, z, scale: trees.scale[0] + rand(w) * trees.scale[1] });
  }

  // Targets (ADR 0041) at their fixed spots on the roads; a row is several, `gap` metres apart along the road.
  const targets: { id: TargetId; x: number; z: number; heading: number }[] = [];
  for (const t of map.targets ?? []) {
    for (let k = 0; k < (t.count ?? 1); k++) {
      const p = pointAt(roads[t.on.road]!, along(w, t.on) + k * (t.gap ?? 4), t.on.offset ?? 0);
      targets.push({ id: t.id, x: p.x, z: p.z, heading: p.heading });
    }
  }
  const nearTarget = (x: number, z: number) =>
    targets.some((t) => Math.hypot(x - t.x, z - t.z) < (t.id === 'toy/box-stack' ? TARGET_GAP + 1.2 : TARGET_GAP));

  const props = map.props;
  let tries = 0;
  while (w.props.length < propCount && tries++ < propCount * 20) {
    // A share sits on or beside a road, on purpose in the car's way; the rest are spread about.
    let x: number, z: number;
    if (roads.length && rand(w) < props.nearRoad) {
      const road = roads[Math.floor(rand(w) * roads.length)]!;
      ({ x, z } = pointAt(road, rand(w) * road.length, (rand(w) - 0.5) * (road.def.width + props.spread)));
    } else {
      [x, z] = onLand(props.edgeGap);
    }
    const toy = pick(props.kinds);
    const yaw = rand(w) * Math.PI * 2;
    if (Math.hypot(x - kid.x, z - kid.z) < props.spawnGap) continue;
    if (w.trees.some((t) => Math.hypot(x - t.x, z - t.z) < 1.6 * t.scale)) continue;
    if (waterAt(w, x, z) === 2) continue;
    if (w.zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.r + 1)) continue;
    if (nearTarget(x, z)) continue;
    // Not inside a hill (unless on its tunnel's road), and not out over the water on a bridge.
    if (onHill(x, z, 1) && !guardAt(w.guards, roads, x, z)) continue;
    if (guardAt(w.guards, roads, x, z)?.guard.kind === 'bridge') continue;
    w.props.push(toyAt(toy, x, TOYS[toy].half, z, yaw));
  }
  // The targets go after the scattered toys, so `propCount` counts only those.
  for (const t of targets) {
    if (t.id === 'toy/star') {
      w.props.push(toyAt(t.id, t.x, STAR_HEIGHT, t.z, t.heading));
      continue;
    }
    // A stack: a pyramid of boxes along the road, each row sitting on the one below.
    const half = TOYS[t.id].half, size = half * 2, fx = Math.sin(t.heading), fz = Math.cos(t.heading);
    const boxes: number[] = [];
    STACK_ROWS.forEach((n, level) => {
      for (let j = 0; j < n; j++) {
        const a = (j - (n - 1) / 2) * (size + 0.04);
        boxes.push(w.props.length);
        w.props.push({ ...toyAt(t.id, t.x + fx * a, half + level * size, t.z + fz * a, t.heading), stack: w.stacks.length, level, slot: boxes.length - 1 });
      }
    });
    w.stacks.push(boxes);
  }
  w.animals = makeAnimals(map.animals, () => rand(w));
  for (let i = 0; i < 60; i++) w.bubbles.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 48; i++) w.puffs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 160; i++) w.drops.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 40; i++) w.ripples.push({ x: 0, z: 0, life: 0, size: 1 });
  for (let i = 0; i < CONFETTI_POOL; i++) {
    w.confetti.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, hue: i % CONFETTI_HUES, turn: 0, phase: 0 });
  }
  return w;
}

/** Scattered toys keep this far from a target's spot (a stack's a little further, it is wider), in metres. */
const TARGET_GAP = 2.5;

/** A toy standing at home, its middle at height `y`, facing `yaw`. */
function toyAt(toy: ToyId, x: number, y: number, z: number, yaw: number): Prop {
  return {
    toy, homeX: x, homeZ: z, homeY: y, homeYaw: yaw, stack: -1, level: 0, slot: 0, x, y, z, vx: 0, vy: 0, vz: 0,
    qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), wx: 0, wy: 0, wz: 0,
    scale: 1, state: HOME, timer: 0, cool: 0,
  };
}

/** 0 for dry land, 1 in a puddle, 2 in the flood. */
export function waterAt(w: World, x: number, z: number): number {
  let found = 0;
  for (const p of w.waters) {
    const dx = x - p.x, dz = z - p.z;
    if (dx * dx + dz * dz > p.r * p.r) continue;
    if (p.deep) return 2;
    found = 1;
  }
  return found;
}

/**
 * The steering that takes the kid's car to the road and along it, in whichever direction it already faces.
 * Used by the "follows the road" assist and to get a car that is going nowhere moving again.
 */
export function roadSteer(w: World): number {
  const car = w.cars[0]!;
  const near = nearestRoad(w.roads, car.x, car.z);
  if (!near) return 0;
  // Keep following the same road; pick it up afresh (the nearest, in the direction the car faces) when there is
  // none yet or the car has wandered far from it.
  let f = w.follow;
  if (!f || nearestOn(w.roads[f.road]!, f.road, car.x, car.z).dist > w.roads[f.road]!.def.width / 2 + 8) {
    f = w.follow = { road: near.road, dir: Math.cos(car.heading - near.heading) >= 0 ? 1 : -1 };
  }
  let road = w.roads[f.road]!;
  let spot = nearestOn(road, f.road, car.x, car.z);
  const key = (on: number, s: number) => `${on}:${s.toFixed(1)}`;
  // A junction just ahead (milestone-3 B4): decide once, before reaching it, so the car can start the turn in
  // time. At each junction, every other time it takes the other road (the first time it does), so both get driven.
  const coming = w.junctions[f.road]!.find((j) => passes(road, spot.s, JUNCTION_AHEAD, f!.dir, j.s));
  if (!coming) w.followAt = '';
  else if (w.followAt !== key(f.road, coming.s)) {
    const at = w.followAt = key(f.road, coming.s);
    const turn = w.turned[at] = !w.turned[at];
    if (turn) {
      f = w.follow = { road: coming.road, dir: coming.dir };
      road = w.roads[f.road]!;
      spot = nearestOn(road, f.road, car.x, car.z);
    }
  }
  // Near the end of an open road, carry on along the road it joins, whichever way the car faces. That junction is
  // already decided, so it doesn't turn straight back in.
  if (!road.def.closed) {
    const parent = f.dir > 0 && spot.s > road.length - JUNCTION_AHEAD ? road.def.to
      : f.dir < 0 && spot.s < JUNCTION_AHEAD ? road.def.from : undefined;
    if (parent !== undefined) {
      const from = f.road, junction = w.junctions[parent]!.find((j) => j.road === from && j.dir === (f!.dir > 0 ? -1 : 1));
      road = w.roads[parent]!;
      const at = junction ? pointAt(road, junction.s) : nearestOn(road, parent, car.x, car.z);
      f = w.follow = { road: parent, dir: Math.cos(car.heading - at.heading) >= 0 ? 1 : -1 };
      if (junction) w.followAt = key(parent, junction.s);
      spot = nearestOn(road, parent, car.x, car.z);
    }
  }
  // Aim at a point on the centre line a little way ahead.
  const ahead = pointAt(road, spot.s + f.dir * ROAD_LOOKAHEAD);
  const err = wrap(Math.atan2(ahead.x - car.x, ahead.z - car.z) - car.heading);
  w.followTurn = Math.abs(err);
  return clamp(-err * 2.5, -1, 1);
}

/** How far ahead of a junction "follows the road" decides which way to go, in metres. */
const JUNCTION_AHEAD = 10;

/** How far ahead along the road the assist aims, in metres. */
const ROAD_LOOKAHEAD = 11.4;

/**
 * Drives the kid's car toward a finger's spot (ADR 0031): steer at it, ease off near it, stop on it. A spot it
 * gets no closer to for 2 s (one inside its turning circle) is given up, so the car never circles a spot forever.
 */
function towardSpot(w: World, spot: { x: number; z: number }, dt: number): { go: boolean; steer: number; cap: number } {
  const car = w.cars[0]!;
  // A spot off the land is pulled back onto it.
  const { x: sx, z: sz } = keepInland(w.land, spot.x, spot.z, 5);
  let g = w.goal;
  if (!g || Math.hypot(sx - g.x, sz - g.z) > 1.5) g = w.goal = { x: sx, z: sz, best: Infinity, t: 0, done: false };
  const dist = Math.hypot(g.x - car.x, g.z - car.z);
  if (dist < ARRIVE) g.done = true;
  if (dist < g.best - 0.5) {
    g.best = dist;
    g.t = 0;
  } else if ((g.t += dt) > 2) g.done = true;
  if (g.done) return { go: false, steer: 0, cap: 0 };
  const err = wrap(Math.atan2(g.x - car.x, g.z - car.z) - car.heading);
  let cap = Math.max(3, VEHICLE_FEEL[car.kind].top * Math.min(1, dist / SLOW_FROM));
  // A spot well off to the side: slow down to turn tightly toward it.
  if (Math.abs(err) > 1.2) cap = Math.min(cap, 6);
  return { go: true, steer: clamp(-err * 2.5, -1, 1), cap };
}

function stepKidCar(w: World, input: Input, dt: number): void {
  const car = w.cars[0]!;
  let go = input.go, brake = input.brake, steer = clamp(input.steer, -1, 1), cap = VEHICLE_FEEL[car.kind].top;
  // Backing up, for a joystick finger below the middle (ADR 0036): the speed it backs up at, or 0.
  let back = 0;
  if (input.spot && w.assist === 'free') {
    const to = towardSpot(w, input.spot, dt);
    ({ steer, cap } = to);
    // Arrived: a short, firm stop on the spot.
    if (!to.go) { go = false; brake = true; }
  } else w.goal = null;
  if (input.stick && w.assist === 'free') {
    const { x, y } = input.stick;
    const past = (v: number) => Math.sign(v) * Math.min(1, Math.max(0, Math.abs(v) - STICK_DEAD) / (0.85 - STICK_DEAD));
    steer = past(x);
    const up = past(y);
    go = up > 0;
    // Faster the higher the finger: a little above the middle creeps, the top edge is full speed.
    if (go) cap = Math.min(cap, 4 + (cap - 4) * up);
    else if (up < 0) back = REVERSE_SPEED * Math.max(0.4, -up);
    // A finger in the middle, either way: the car rolls to a stop.
  } else if (input.stick) go = true; // "follows the road": a touch only makes it go, as before
  // Backing up, or stopping from it, eases to the speed wanted (negative is backwards); from forwards it brakes first.
  const backing = back > 0 || car.speed < 0;
  // Following the road round a sharp bend (a junction): slow down so the turn stays close to the road.
  if ((w.assist === 'road' || w.rescue > 0) && w.followTurn > 0.5) cap = Math.min(cap, 8);
  // Sand holds it to a slower top speed (milestone-3 B4).
  const sandy = onSand(w.sand, car.x, car.z);
  if (sandy) cap = Math.min(cap, SAND_SPEED);

  if (backing) {
    const want = -back;
    car.speed = want < car.speed ? Math.max(want, car.speed - (car.speed > 0 ? 24 : 8) * dt) : Math.min(want, car.speed + 12 * dt);
  } else if (brake) car.speed = Math.max(0, car.speed - 24 * dt);
  else if (go && car.speed > cap) car.speed = Math.max(cap, car.speed - 12 * dt);
  else if (go) car.speed = Math.min(cap, car.speed + 10 * dt);
  else car.speed = Math.max(0, car.speed - 6 * dt);
  // Deep water holds the car back to a wade.
  const wade = FLOOD_SPEED + VEHICLE_FEEL[car.kind].wade;
  if (car.wet === 2 && car.speed > wade) car.speed = Math.max(wade, car.speed - 30 * dt);
  // A car wash slows it to a crawl from just before it, so the brushes and the bubbles show.
  if (inWash(w, car, 5, ['car-wash', 'garage']) && car.speed > WASH_SPEED) car.speed = Math.max(WASH_SPEED, car.speed - 30 * dt);

  const turn = 2.1 * Math.min(1, car.speed / 5) * (1 - 0.35 * (car.speed / MAX_SPEED));
  if (w.assist === 'road' || w.rescue > 0) steer = roadSteer(w);
  car.heading -= steer * turn * dt;
  w.steer = steer;

  // The shore turns the car back inland, harder the closer it gets (ADR 0021: can't get lost). Not on a bridge or
  // close to one, where the road itself crosses the water.
  const near = shore(w.land, car.x, car.z);
  const bridged = guardAt(w.guards, w.roads, car.x, car.z, 12) !== null;
  if (near.depth < 6 && !bridged) {
    const k = Math.min(1, (6 - near.depth) / 4.5);
    const diff = wrap(Math.atan2(near.nx, near.nz) - car.heading);
    car.heading += clamp(diff * 2, -1, 1) * 3.2 * k * dt * Math.min(1, car.speed / 3);
  }

  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.spin += (car.speed / 0.45) * dt;

  // Never past 1.5 m from the shore (a bridge's rails keep it on the bridge instead).
  if (near.depth < 4 && !bridged) ({ x: car.x, z: car.z } = keepInland(w.land, car.x, car.z, 1.5));
  // Sand flies up behind the wheels.
  if (sandy && car.speed > 4 && rand(w) < 0.35) {
    puff(w, car.x - Math.sin(car.heading) * 1.8, 0.25, car.z - Math.cos(car.heading) * 1.8);
  }

  // Trees and traffic are round and never stop the car: it is pushed out and slides along (can't get stuck).
  // Returns the shove the car got, or null if it didn't touch.
  const pushOut = (ox: number, oz: number, reach: number, drag: number): [number, number] | null => {
    const dx = car.x - ox, dz = car.z - oz, dist = Math.hypot(dx, dz);
    if (dist >= reach || dist < 1e-6) return null;
    const nx = dx / dist, nz = dz / dist, over = reach - dist;
    car.x += nx * over;
    car.z += nz * over;
    car.speed *= drag;
    // Turn the nose away from the thing, toward the side it is already passing on.
    const side = Math.sin(car.heading) * dz - Math.cos(car.heading) * dx;
    car.heading += (side > 0 ? -1 : 1) * 1.6 * dt;
    return [nx * over, nz * over];
  };
  for (const t of w.trees) pushOut(t.x, t.z, SCENERY[t.kind].radius * t.scale + 1.3, 0.985);
  // A bump with traffic is a toy bump (ADR 0031): both cars shove apart and the kid's car barely slows.
  const own = VEHICLE_SIZE[car.kind].side;
  for (let i = 1; i < w.cars.length; i++) {
    const other = w.cars[i]!;
    for (const [px, pz] of bodyPoints(other)) {
      const shove = pushOut(px, pz, own + VEHICLE_SIZE[other.kind].side + 0.3, 0.997);
      if (!shove) continue;
      // The traffic car is shoved the other way across its lane (right of travel is (−cos h, sin h)); its lane
      // rule then eases it back.
      const across = -shove[0] * Math.cos(other.heading) + shove[1] * Math.sin(other.heading);
      const room = w.roads[other.road]!.def.width / 2 + 0.5;
      other.lane = clamp(other.lane - across * 0.7, -room, room);
      trafficPose(w, other);
    }
  }

  // Hills are too steep to drive up: the car slides round one like a big tree, unless it is in the tunnel.
  for (const h of w.map.hills ?? []) {
    const e = hillReach(h, car.x, car.z, 1.2);
    if (e >= 1 || guardAt(w.guards, w.roads, car.x, car.z)) continue;
    const dx = car.x - h.x, dz = car.z - h.z, k = 1 / Math.sqrt(Math.max(e, 1e-6));
    car.x = h.x + dx * k;
    car.z = h.z + dz * k;
    car.speed *= 0.985;
    const side = Math.sin(car.heading) * dz - Math.cos(car.heading) * dx;
    car.heading += (side > 0 ? -1 : 1) * 1.6 * dt;
  }
  // On a bridge or in a tunnel, its sides keep the car on the road: it slides along them (milestone-3 B4).
  const held = guardAt(w.guards, w.roads, car.x, car.z);
  w.under = { sand: sandy, bridge: held?.guard.kind === 'bridge', tunnel: held?.guard.kind === 'tunnel' };
  if (held) {
    const { spot } = held, limit = w.roads[spot.road]!.def.width / 2 - 0.8;
    if (Math.abs(spot.offset) > limit) {
      const back = spot.offset - Math.sign(spot.offset) * limit;
      // Right of the road is (−cos h, sin h).
      car.x += Math.cos(spot.heading) * back;
      car.z -= Math.sin(spot.heading) * back;
      const along = Math.cos(car.heading - spot.heading) >= 0 ? spot.heading : spot.heading + Math.PI;
      car.heading += clamp(wrap(along - car.heading), -2 * dt, 2 * dt);
      car.speed *= 0.995;
    }
  }

  // A car that is being driven but has made no progress for a while is steered back to the road (ADR 0021).
  if (w.rescue > 0) w.rescue -= dt;
  if (!go || brake) {
    w.mark = { x: car.x, z: car.z, t: 0 };
  } else if ((w.mark.t += dt) >= 2.5) {
    if (Math.hypot(car.x - w.mark.x, car.z - w.mark.z) < 2) {
      w.rescue = 1.5;
      w.follow = null; // pick the nearest road afresh
    }
    w.mark = { x: car.x, z: car.z, t: 0 };
  }
}

/** How far before its stopping point traffic starts to slow for the kid's car in its lane, to give way. */
const GIVE_WAY = 8;

/** How often traffic takes the other road at a junction. */
const TURN_CHANCE = 0.5;

/**
 * Moves a traffic car `dist` metres along its road (milestone-3 B4). At a junction it sometimes turns onto the
 * other road, never while keeping the kid company. At the end of an open road it joins the road there; at a dead
 * end it turns round. Its lane is matched to where it is, then eases back to its own.
 */
function moveTraffic(w: World, c: Car, dist: number): void {
  const road = w.roads[c.road]!;
  const switchTo = (to: number, dir: 1 | -1, s: number) => {
    const next = w.roads[to]!;
    c.road = to;
    c.dir = dir;
    c.s = s;
    const room = next.def.width / 2 - 0.5;
    c.lane = clamp(nearestOn(next, to, c.x, c.z).offset * dir, -room, room);
  };
  for (const j of w.junctions[c.road]!) {
    if (!passes(road, c.s, dist, c.dir, j.s)) continue;
    if (c.mode === JOIN || c.mode === ALONG || rand(w) >= TURN_CHANCE) continue;
    switchTo(j.road, j.dir, j.dir > 0 ? 0 : w.roads[j.road]!.length);
    return;
  }
  const s = c.s + c.dir * dist;
  if (!road.def.closed && (s > road.length || s < 0)) {
    const atEnd = s > road.length;
    const parent = atEnd ? road.def.to : road.def.from;
    const junction = parent === undefined ? undefined : w.junctions[parent]!.find((j) => j.road === c.road && j.dir === (atEnd ? -1 : 1));
    if (parent !== undefined && junction) {
      // Join the other road just past the junction, going forward along it.
      switchTo(parent, 1, wrapAlong(w.roads[parent]!, junction.s + 0.01));
      return;
    }
    // A dead end: turn round.
    c.dir = c.dir > 0 ? -1 : 1;
    c.s = clamp(s, 0, road.length);
    return;
  }
  c.s = wrapAlong(road, s);
}

/**
 * Traffic keeps the kid company (ADR 0031). When the kid's car drives a road the way its traffic goes, one traffic
 * car at a time catches up and pulls alongside in the next lane, rides there for 4 to 6 s, then speeds off ahead
 * and won't come back for a while. Traffic never blocks the road: near the kid's car it moves over a lane.
 */
function stepTraffic(w: World, dt: number): void {
  const kid = w.cars[0]!;
  for (let i = 1; i < w.cars.length; i++) {
    const c = w.cars[i]!;
    const road = w.roads[c.road]!;
    c.cool = Math.max(0, c.cool - dt);
    c.timer -= dt;
    // Where the kid's car is on this car's road, and how far ahead of it along the road (negative: behind).
    const kidOn = nearestOn(road, c.road, kid.x, kid.z);
    let gap = kidOn.s - c.s;
    if (road.def.closed) gap -= Math.round(gap / road.length) * road.length;
    gap *= c.dir;
    // The kid's car's place across the road, measured to the right of the way this car drives.
    const kidLane = kidOn.offset * c.dir;
    // Company: the kid's car is on this road, moving, and heading the way this car goes.
    const company = kidOn.dist < road.def.width / 2 + 1.5 && kid.speed > 3 &&
      Math.cos(kid.heading - kidOn.heading - (c.dir > 0 ? 0 : Math.PI)) > 0.6;
    const busy = w.cars.some((o, j) => j > 0 && j !== i && (o.mode === JOIN || o.mode === ALONG));
    if (c.mode === CRUISE && company && c.cool === 0 && !busy && Math.abs(gap) < 20) {
      c.mode = JOIN;
      c.timer = 8;
    } else if ((c.mode === JOIN || c.mode === ALONG) && (!company || c.timer <= 0)) {
      c.mode = LEAVE;
      c.timer = 3;
      c.cool = 12;
    } else if (c.mode === JOIN && Math.abs(gap) < 1.5) {
      c.mode = ALONG;
      c.timer = 4 + rand(w) * 2;
    } else if (c.mode === LEAVE && ((c.timer <= 0 && Math.abs(gap) > 12) || c.timer <= -4)) c.mode = CRUISE;

    let want = c.cruise;
    if (c.mode === JOIN) want = kid.speed + clamp(gap * 1.2, -5, 5);
    else if (c.mode === ALONG) want = kid.speed + clamp(gap * 1.5, -3, 3);
    else if (c.mode === LEAVE) want = Math.max(c.cruise, kid.speed + 5);
    want = clamp(want, 3, MAX_SPEED + 4);
    if (c.wet === 2) want = Math.min(want, FLOOD_SPEED - 1);
    if (inWash(w, c, 5)) want = Math.min(want, WASH_SPEED);
    // Traffic gives way (driving-assets.md): the kid's car just ahead in its lane, at a junction, on a bridge or
    // anywhere, and it slows and waits rather than drive into it.
    if (c.mode === CRUISE) {
      const dx = kid.x - c.x, dz = kid.z - c.z;
      const ahead = dx * Math.sin(c.heading) + dz * Math.cos(c.heading), across = -dx * Math.cos(c.heading) + dz * Math.sin(c.heading);
      // It stops with its front a few metres short of the kid's car, however long it is.
      const stop = VEHICLE_SIZE[c.kind].half + VEHICLE_SIZE[kid.kind].half + 2.5;
      if (ahead > 0 && ahead < stop + GIVE_WAY && Math.abs(across) < 2.6) want = Math.min(want, Math.max(0, (ahead - stop) * 1.5));
    }
    // Brakes harder than it speeds up, so it keeps pace when the kid slows for the flood or a car wash.
    c.speed += clamp(want - c.speed, -16 * dt, 8 * dt);

    // Near the kid's car, move over a lane to whichever side has road, then drift back to its own lane.
    let lane = c.home;
    if (Math.hypot(c.x - kid.x, c.z - kid.z) < 9) {
      const room = road.def.width / 2 - 0.5;
      const right = kidLane + 3.4 <= room, left = kidLane - 3.4 >= -room;
      const toRight = right && (c.lane >= kidLane || !left);
      lane = clamp(kidLane + (toRight ? 3.4 : -3.4), -room, room);
    }
    c.lane += clamp(lane - c.lane, -3 * dt, 3 * dt);
    moveTraffic(w, c, c.speed * dt);
    c.spin += (c.speed / 0.45) * dt;
    trafficPose(w, c, dt);
  }
}

function puff(w: World, x: number, y: number, z: number): void {
  for (let i = 0; i < 3; i++) {
    const p = w.puffs[w.puffNext]!;
    w.puffNext = (w.puffNext + 1) % w.puffs.length;
    p.x = x; p.y = y; p.z = z;
    p.vx = (rand(w) - 0.5) * 4; p.vy = 2 + rand(w) * 2; p.vz = (rand(w) - 0.5) * 4;
    p.life = 0.5;
  }
}

function drop(w: World, x: number, y: number, z: number, vx: number, vy: number, vz: number): void {
  const d = w.drops[w.dropNext]!;
  w.dropNext = (w.dropNext + 1) % w.drops.length;
  d.x = x; d.y = y; d.z = z; d.vx = vx; d.vy = vy; d.vz = vz; d.life = DROP_LIFE;
}

function ripple(w: World, x: number, z: number, size: number): void {
  const r = w.ripples[w.rippleNext]!;
  w.rippleNext = (w.rippleNext + 1) % w.ripples.length;
  r.x = x; r.z = z; r.size = size; r.life = RIPPLE_LIFE;
}

/** A ring of drops thrown up and outward, carried along by whatever made the splash. */
function splash(w: World, x: number, z: number, vx: number, vz: number, count: number, height: number): void {
  for (let i = 0; i < count; i++) {
    const a = rand(w) * Math.PI * 2, out = 1.5 + rand(w) * 3.5;
    drop(w, x, 0.15, z, vx * 0.3 + Math.sin(a) * out, height * (0.55 + rand(w) * 0.45), vz * 0.3 + Math.cos(a) * out);
  }
  ripple(w, x, z, count > 10 ? 2.2 : 1.2);
}

/** Splashes on the way in, spray off the back wheels, a wake and a sinking, bobbing car in the flood. */
function stepWater(w: World, dt: number): void {
  w.cars.forEach((car, i) => {
    const now = waterAt(w, car.x, car.z);
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    if (now > car.wet && car.speed > 2) {
      splash(w, car.x + fx * 1.6, car.z + fz * 1.6, fx * car.speed, fz * car.speed, now === 2 ? 20 : 8, now === 2 ? 7.5 : 4.5);
      if (i === 0) w.splashes.push(now);
    }
    if (now && car.speed > 3 && rand(w) < car.speed / MAX_SPEED + 0.25) {
      const side = rand(w) < 0.5 ? -0.98 : 0.98;
      drop(w, car.x - fx * 1.3 + fz * side, 0.3, car.z - fz * 1.3 - fx * side,
        -fx * car.speed * 0.2 + fz * side * 1.6, 2.5 + rand(w) * 2.5, -fz * car.speed * 0.2 - fx * side * 1.6);
    }
    if (now === 2) {
      car.wake -= dt;
      if (car.speed > 1 && car.wake <= 0) {
        car.wake = 0.34;
        ripple(w, car.x - fx * 1.8, car.z - fz * 1.8, 1.4);
      }
    }
    const sink = now === 2 ? -0.25 + Math.sin(w.time * 3 + i) * 0.06 : 0;
    car.y += (sink - car.y) * Math.min(1, 8 * dt);
    car.wet = now;
  });

  for (const d of w.drops) {
    if (d.life <= 0) continue;
    d.life -= dt;
    d.vy -= 20 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.y < 0.08) d.life = 0;
  }
  for (const r of w.ripples) if (r.life > 0) r.life -= dt;
}

/** A burst of confetti (ADR 0041) thrown up from a spot, every piece its own way, turning as it flutters down. */
function confetti(w: World, x: number, y: number, z: number): void {
  for (let i = 0; i < CONFETTI_BURST; i++) {
    const c = w.confetti[w.confettiNext]!;
    w.confettiNext = (w.confettiNext + 1) % w.confetti.length;
    const a = fxRand(w) * Math.PI * 2, out = 1.5 + fxRand(w) * 3.5;
    c.x = x; c.y = y; c.z = z;
    c.vx = Math.sin(a) * out; c.vy = 5 + fxRand(w) * 4; c.vz = Math.cos(a) * out;
    c.life = CONFETTI_LIFE * (0.75 + fxRand(w) * 0.25);
    c.turn = 4 + fxRand(w) * 8; c.phase = fxRand(w) * Math.PI * 2;
  }
}

/** Confetti falls slowly, held back by the air, drifting from side to side, and lies on the ground at the end. */
function stepConfetti(w: World, dt: number): void {
  const drag = Math.max(0, 1 - 2.6 * dt);
  for (const c of w.confetti) {
    if (c.life <= 0) continue;
    c.life -= dt;
    c.vy -= 9 * dt;
    c.vx *= drag; c.vy *= drag; c.vz *= drag;
    c.x += c.vx * dt + Math.sin(w.time * 7 + c.phase) * 0.8 * dt;
    c.y += c.vy * dt;
    c.z += c.vz * dt + Math.cos(w.time * 6 + c.phase) * 0.8 * dt;
    if (c.y < 0.03) { c.y = 0.03; c.vx = c.vy = c.vz = 0; }
  }
}

/** Whether a car's body (its middle, front to back: bodyPoints) is within `reach` of a point on the ground. */
function touches(car: Car, x: number, z: number, reach: number): boolean {
  return bodyPoints(car).some(([bx, bz]) => (x - bx) ** 2 + (z - bz) ** 2 <= reach * reach);
}

/**
 * A star (ADR 0041): it floats at home, turning and bobbing. The kid's car drives through it and takes it (traffic
 * never does): confetti and a twinkle, and it spins off up and away. It comes back once the kid's car has gone.
 */
function stepStar(w: World, p: Prop, dt: number): void {
  const kid = w.cars[0]!;
  const { half } = TOYS[p.toy];
  const turnTo = (yaw: number) => { p.qx = 0; p.qy = Math.sin(yaw / 2); p.qz = 0; p.qw = Math.cos(yaw / 2); };
  if (p.state === HOME || p.state === GROW) {
    if (p.state === GROW && (p.scale += dt / 0.35) >= 1) { p.scale = 1; p.state = HOME; }
    p.y = p.homeY + Math.sin(w.time * 2.2 + p.homeYaw) * 0.12;
    turnTo(p.homeYaw + w.time * 1.6);
    if (p.state === HOME && touches(kid, p.x, p.z, VEHICLE_SIZE[kid.kind].side + half + 0.5)) {
      p.state = FLYING; p.timer = 0; p.vy = 3; p.wy = p.homeYaw + w.time * 1.6;
      w.cheers.push({ toy: p.toy as TargetId, x: p.x, z: p.z });
      confetti(w, p.x, p.y, p.z);
    }
  } else if (p.state === FLYING) {
    // Spinning off: up, faster and faster round, shrinking away.
    p.timer += dt;
    p.y += p.vy * dt;
    p.wy += (8 + p.timer * 30) * dt;
    turnTo(p.wy);
    p.scale = Math.max(0, 1 - p.timer / 0.8);
    if (p.scale === 0) { p.state = AWAY; p.timer = 0; p.x = p.homeX; p.z = p.homeZ; p.y = p.homeY; }
  } else if (p.state === AWAY && (p.timer += dt) > STAR_BACK && Math.hypot(kid.x - p.homeX, kid.z - p.homeZ) > STAR_CLEAR) {
    p.state = GROW; p.scale = 0;
  }
}

/** Whether a stack's box may grow back (ADR 0041): the boxes under it are home and the kid's car isn't near. */
function stackReady(w: World, p: Prop): boolean {
  const kid = w.cars[0]!;
  if (Math.hypot(kid.x - p.homeX, kid.z - p.homeZ) < STACK_CLEAR) return false;
  return w.stacks[p.stack]!.every((i) => {
    const b = w.props[i]!;
    return b.level >= p.level || (b.state === HOME && b.scale === 1);
  });
}

/**
 * A car knocked a stack (ADR 0041): every box that is standing flies off the way the car was going, the higher
 * ones further, tumbling. The kid's car gets confetti and the silly noise; traffic only knocks it over.
 */
function topple(w: World, stack: number, car: Car, kid: boolean): void {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading), v = Math.abs(car.speed), push = VEHICLE_FEEL[car.kind].push;
  let top: Prop | null = null;
  for (const i of w.stacks[stack]!) {
    const b = w.props[i]!;
    if (b.state !== HOME && b.state !== GROW) continue;
    b.scale = 1;
    const k = 0.5 + 0.2 * b.level;
    b.vx = fx * car.speed * k * push + (fxRand(w) - 0.5) * 3;
    b.vz = fz * car.speed * k * push + (fxRand(w) - 0.5) * 3;
    b.vy = 2.5 + b.level * 1.6 + fxRand(w) * 1.5;
    b.wx = (fxRand(w) - 0.5) * (4 + v); b.wy = (fxRand(w) - 0.5) * (4 + v); b.wz = (fxRand(w) - 0.5) * (4 + v);
    b.state = FLYING; b.cool = 0.3; b.timer = 0;
    if (!top || b.level > top.level) top = b;
  }
  if (!top) return;
  if (!kid) return;
  w.cheers.push({ toy: top.toy as TargetId, x: top.x, z: top.z });
  confetti(w, top.x, top.y + 0.5, top.z);
}

function stepProps(w: World, dt: number): void {
  for (const p of w.props) {
    const { half, behaviour } = TOYS[p.toy];
    if (behaviour === 'collect') {
      stepStar(w, p, dt);
      continue;
    }
    const rolls = behaviour === 'roll';
    if (p.cool > 0) p.cool -= dt;

    if (p.state === SHRINK) {
      p.scale -= dt / 0.25;
      if (p.scale <= 0) {
        p.scale = 0;
        p.x = p.homeX; p.z = p.homeZ; p.y = p.homeY;
        p.qx = 0; p.qy = Math.sin(p.homeYaw / 2); p.qz = 0; p.qw = Math.cos(p.homeYaw / 2);
        p.vx = p.vy = p.vz = p.wx = p.wy = p.wz = 0;
        // A stack rebuilds bottom first, and not round the kid's car; until then the box waits at home, unseen.
        if (p.stack < 0 || stackReady(w, p)) p.state = GROW;
      }
      continue;
    }
    if (p.state === GROW) {
      p.scale += dt / 0.25;
      if (p.scale >= 1) { p.scale = 1; p.state = HOME; }
      continue;
    }

    // A standing stack is knocked by its bottom row; the boxes above go with it.
    const standing = p.stack >= 0 && p.state === HOME;
    if (p.cool <= 0 && p.y < 1.8 && !(standing && p.level > 0)) {
      for (let i = 0; i < w.cars.length; i++) {
        const car = w.cars[i]!;
        // Backing up knocks toys too (ADR 0036): `v` is the speed either way, `car.speed` keeps the direction.
        const v = Math.abs(car.speed);
        if (v < 1) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        // The car is longer than it is wide: one circle at the nose, one at the tail.
        const reach = VEHICLE_SIZE[car.kind].side + 0.15 + half;
        let dx = 0, dz = 0, hit = false;
        for (const [bx, bz] of bodyPoints(car)) {
          dx = p.x - bx; dz = p.z - bz;
          if (dx * dx + dz * dz <= reach * reach) { hit = true; break; }
        }
        if (!hit) continue;
        if (standing) {
          topple(w, p.stack, car, i === 0);
          break;
        }
        const len = Math.hypot(dx, dz) || 1;
        // A heavier vehicle knocks it further (ADR 0035).
        const push = VEHICLE_FEEL[car.kind].push;
        p.vx = (fx * car.speed * 0.85 + (dx / len) * v * 0.45) * push + (rand(w) - 0.5) * 2;
        p.vz = (fz * car.speed * 0.85 + (dz / len) * v * 0.45) * push + (rand(w) - 0.5) * 2;
        // A tumbling toy flies up; a rolling one only hops and keeps its speed along the ground.
        p.vy = rolls ? 1.5 + rand(w) : 3 + v * 0.32 + rand(w) * 1.5;
        p.wx = (rand(w) - 0.5) * v * 1.2;
        p.wy = (rand(w) - 0.5) * v * 1.2;
        p.wz = (rand(w) - 0.5) * v * 1.2;
        p.state = FLYING; p.cool = 0.3; p.timer = 0;
        puff(w, p.x, p.y, p.z);
        if (i === 0) w.knocks.push(p.toy);
        break;
      }
    }

    if (p.state === FLYING) {
      p.vy -= 24 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const hx = p.wx * dt * 0.5, hy = p.wy * dt * 0.5, hz = p.wz * dt * 0.5;
      const nx = p.qx + hx * p.qw + hy * p.qz - hz * p.qy;
      const ny = p.qy + hy * p.qw + hz * p.qx - hx * p.qz;
      const nz = p.qz + hz * p.qw + hx * p.qy - hy * p.qx;
      const nw = p.qw - hx * p.qx - hy * p.qy - hz * p.qz;
      const nl = Math.hypot(nx, ny, nz, nw) || 1;
      p.qx = nx / nl; p.qy = ny / nl; p.qz = nz / nl; p.qw = nw / nl;
      if (p.y <= half) {
        p.y = half;
        if (p.vy < -2) {
          if (waterAt(w, p.x, p.z)) splash(w, p.x, p.z, p.vx, p.vz, 6, 4);
          p.vy = -p.vy * 0.42; p.vx *= 0.75; p.vz *= 0.75;
          p.wx *= 0.7; p.wy *= 0.7; p.wz *= 0.7;
        } else if (rolls) {
          // Rolling: slows gently, and spins the way a ball rolls (about the axis across its path).
          p.vy = 0;
          const f = Math.max(0, 1 - 0.9 * dt);
          p.vx *= f; p.vz *= f;
          p.wx = p.vz / half; p.wy = 0; p.wz = -p.vx / half;
          if (p.vx * p.vx + p.vz * p.vz < 0.15) { p.state = AWAY; p.timer = 0; }
        } else {
          p.vy = 0;
          const f = Math.max(0, 1 - 5 * dt);
          p.vx *= f; p.vz *= f; p.wx *= f; p.wy *= f; p.wz *= f;
          if (p.vx * p.vx + p.vz * p.vz < 0.15) { p.state = AWAY; p.timer = 0; }
        }
      }
      if (shore(w.land, p.x, p.z).depth < -1.5) p.state = SHRINK; // into the sea: straight back home
    } else if (p.state === AWAY) {
      // Stand back up where it landed, wait a little, then go home.
      const ty = Math.sin(p.homeYaw / 2), tw = Math.cos(p.homeYaw / 2);
      const sign = p.qy * ty + p.qw * tw < 0 ? -1 : 1;
      const k = Math.min(1, 6 * dt);
      p.qx += (0 - p.qx) * k; p.qy += (ty * sign - p.qy) * k; p.qz += (0 - p.qz) * k; p.qw += (tw * sign - p.qw) * k;
      const nl = Math.hypot(p.qx, p.qy, p.qz, p.qw) || 1;
      p.qx /= nl; p.qy /= nl; p.qz /= nl; p.qw /= nl;
      p.timer += dt;
      if (p.timer > 4) p.state = SHRINK;
    }
  }
}

/** Whether a car is inside a car wash's arch (or a garage, with `kinds`), or within `approach` metres of it. */
function inWash(w: World, c: Car, approach = 0, kinds: ZoneKind[] = ['car-wash']): boolean {
  return w.zones.some((z) => kinds.includes(z.kind) && Math.hypot(c.x - z.x, c.z - z.z) < z.r + approach);
}

/**
 * Car washes (milestone-3 B3): a car inside one soaps up; once out, it rinses off over a few seconds. The kid's
 * car sheds bubbles while it is soapy, more the soapier it is.
 */
function stepWash(w: World, dt: number): void {
  for (const c of w.cars) c.soap = inWash(w, c) ? Math.min(1, c.soap + dt * 1.5) : Math.max(0, c.soap - dt / RINSE);
  const kid = w.cars[0]!;
  if (kid.soap > 0 && rand(w) < kid.soap * 0.9) {
    const b = w.bubbles[w.bubbleNext]!;
    w.bubbleNext = (w.bubbleNext + 1) % w.bubbles.length;
    const side = (rand(w) - 0.5) * 2, along = (rand(w) - 0.5) * 3;
    const fx = Math.sin(kid.heading), fz = Math.cos(kid.heading);
    b.x = kid.x + fx * along - fz * side;
    b.z = kid.z + fz * along + fx * side;
    b.y = kid.y + kid.h + 0.6 + rand(w) * 0.9;
    b.vx = (rand(w) - 0.5) * 0.8;
    b.vy = 0.6 + rand(w) * 0.8;
    b.vz = (rand(w) - 0.5) * 0.8;
    b.life = 1.2 + rand(w) * 0.8;
  }
  for (const b of w.bubbles) {
    if (b.life <= 0) continue;
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }
}

/**
 * Cars follow the ground's height over ramps (milestone-3 B3). Climbing a ramp gives a car upward speed; past the
 * top the ground drops away, so a fast car leaves it, flies under gravity and lands. Only the height changes: the
 * car keeps its heading and speed and can't flip.
 */
function stepHops(w: World, dt: number): void {
  w.cars.forEach((c, i) => {
    const ground = groundHeight(w.zones, c.x, c.z);
    if (ground === 0 && c.h === 0 && c.vy === 0) return;
    const was = c.h;
    c.vy -= HOP_GRAVITY * dt;
    c.h += c.vy * dt;
    if (c.h <= ground) {
      // On the ground: ride it, carrying its rise as upward speed (so the top of a ramp throws the car up).
      // Coming down fast is a landing; rolling down the ramp's far side never falls this fast.
      if (c.vy < -3) {
        w.landings.push(i);
        puff(w, c.x, 0.2 + ground, c.z);
      }
      c.vy = Math.max(0, (ground - was) / dt);
      c.h = ground;
    }
  });
}

/** Which zone the kid's car is in; reports driving in and out. Leaving needs a metre past the edge, so a car on the
 * edge doesn't flicker in and out. */
function stepZones(w: World): void {
  const kid = w.cars[0]!;
  const dist = (i: number) => Math.hypot(kid.x - w.zones[i]!.x, kid.z - w.zones[i]!.z);
  if (w.zone >= 0 && dist(w.zone) > w.zones[w.zone]!.r + 1) {
    w.zoneEvents.push({ zone: w.zone, kind: w.zones[w.zone]!.kind, entered: false });
    w.zone = -1;
  }
  if (w.zone < 0) {
    const i = w.zones.findIndex((z, j) => dist(j) < z.r);
    if (i >= 0) {
      w.zone = i;
      w.zoneEvents.push({ zone: i, kind: w.zones[i]!.kind, entered: true });
      // The garage (ADR 0035): the car comes out as the next vehicle on the list, in a puff.
      if (w.zones[i]!.kind === 'garage' && w.pool.length > 1) {
        const at = w.pool.indexOf(kid.kind);
        kid.kind = w.pool[(at + 1) % w.pool.length]!;
        for (let k = 0; k < 4; k++) puff(w, kid.x + (rand(w) - 0.5) * 3, 0.6, kid.z + (rand(w) - 0.5) * 3);
      }
    }
  }
}

/**
 * The kid swapped vehicle from the tray in the game (playtest, 2026-11-15): it changes on the spot, in a puff, as
 * in the garage. A vehicle that isn't on the list (a parent hid it) is ignored.
 */
export function swapVehicle(w: World, kind: VehicleKind): void {
  const kid = w.cars[0]!;
  if (kid.kind === kind || !w.pool.includes(kind)) return;
  kid.kind = kind;
  for (let k = 0; k < 4; k++) puff(w, kid.x + (rand(w) - 0.5) * 3, 0.6, kid.z + (rand(w) - 0.5) * 3);
}

/** The kid sounded the horn: animals nearby answer it (milestone-3 B3). */
export function honk(w: World): void {
  w.honked = true;
}

export function step(w: World, input: Input, dt: number): void {
  w.time += dt;
  w.knocks.length = 0;
  w.cheers.length = 0;
  w.splashes.length = 0;
  w.zoneEvents.length = 0;
  w.landings.length = 0;
  w.calls.length = 0;
  stepKidCar(w, input, dt);
  stepZones(w);
  stepTraffic(w, dt);
  stepHops(w, dt);
  stepWash(w, dt);
  stepAnimals(w.animals, w.cars[0]!, w.honked, dt, () => rand(w), w.calls);
  w.honked = false;
  stepWater(w, dt);
  stepProps(w, dt);
  stepConfetti(w, dt);
  for (const p of w.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  w.camHeading += wrap(w.cars[0]!.heading - w.camHeading) * Math.min(1, 4 * dt);
}
