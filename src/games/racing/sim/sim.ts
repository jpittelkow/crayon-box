// The driving simulation (ADR 0021). Plain TypeScript with no 3D library, so it can be unit-tested: a car is a
// position, a heading and a speed; knocked props get a push and a spin, bounce, settle, and return home. Nothing
// here can stop the car dead, flip it, or let it leave the island. The island itself comes from a map file
// (sim/map.ts, maps/), so another map is another file.
import { ISLAND } from '../maps/island';
import { SCENERY, type SceneryId } from './assets/scenery';
import { TOYS, type ToyId } from './assets/toys';
import { buildLand, keepInland, randomInland, shore, type Land } from './land';
import type { MapDef, OnRoad, ZoneKind } from './map';
import { buildRoad, nearestOn, nearestRoad, pointAt, wrapAlong, type Road } from './roads';

export const MAX_SPEED = 17;
export const FLOOD_SPEED = 8;


const HOME = 0, FLYING = 1, AWAY = 2, SHRINK = 3, GROW = 4;

/** How much the car helps: the kid steers freely, or the car follows the road and a touch only makes it go. */
export type Assist = 'free' | 'road';

export interface Input {
  go: boolean;
  brake: boolean;
  /** -1 is hard left, 1 is hard right. */
  steer: number;
  /** A finger's spot on the ground: the car drives there and stops (ADR 0031). Steering keys leave it out. */
  spot?: { x: number; z: number };
}

/** Closer than this to its spot, the car has arrived. */
export const ARRIVE = 2.5;
/** Within this distance of its spot, the car eases off so it stops there rather than overshooting. */
const SLOW_FROM = 12;

/** What a traffic car is doing about the kid's car (ADR 0031). */
export const CRUISE = 0, JOIN = 1, ALONG = 2, LEAVE = 3;

/** The kinds of vehicle (ADR 0025). Each has its own size, look and engine sound. */
export type VehicleKind = 'car' | 'police' | 'monster' | 'bus';

/** Half the length and half the width of each kind, in metres, for bumping into things. */
export const VEHICLE_SIZE: Record<VehicleKind, { half: number; side: number }> = {
  car: { half: 2.1, side: 1.0 },
  police: { half: 2.1, side: 1.0 },
  monster: { half: 2.7, side: 1.6 },
  bus: { half: 4.7, side: 1.3 },
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
  /**
   * Traffic only: the road it drives, how far along it, its lane now and its usual lane (metres right of the
   * centre line), and its own pace.
   */
  road: number; s: number; lane: number; home: number; cruise: number;
  /** Traffic only: CRUISE, JOIN, ALONG or LEAVE; time left in it; time before it may join the kid again. */
  mode: number; timer: number; cool: number;
}

export interface Tree { kind: SceneryId; x: number; z: number; scale: number }

/** A toy on the map (driving-assets.md, category 2), knocked about and always coming back. */
export interface Prop {
  toy: ToyId;
  homeX: number; homeZ: number; homeYaw: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  qx: number; qy: number; qz: number; qw: number;
  wx: number; wy: number; wz: number;
  scale: number; state: number; timer: number; cool: number;
}

export interface Puff { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }

/** A round patch of water: a shallow puddle, or the deep flood across the road. */
export interface Water { x: number; z: number; r: number; deep: boolean }

/** A ring on the water that spreads and disappears. */
export interface Ripple { x: number; z: number; life: number; size: number }

export const RIPPLE_LIFE = 1.1;
export const DROP_LIFE = 0.8;

export interface World {
  /** The map this world was made from, and its roads ready to follow. */
  map: MapDef;
  roads: Road[];
  rng: number;
  time: number;
  /** cars[0] is the kid's car; the rest are traffic. */
  cars: Car[];
  trees: Tree[];
  props: Prop[];
  puffs: Puff[];
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
}

/** A map's zone, placed on the ground. */
export interface Zone { kind: ZoneKind; x: number; z: number; r: number }

function rand(w: World): number {
  w.rng = (w.rng + 0x6d2b79f5) | 0;
  let t = w.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

function trafficPose(w: World, c: Car): void {
  const p = pointAt(w.roads[c.road]!, c.s, c.lane);
  c.x = p.x;
  c.z = p.z;
  c.heading = p.heading;
}

/** Distance along a road for a map's `OnRoad` place. */
const along = (w: World, on: OnRoad): number => on.at * w.roads[on.road]!.length;

export function makeWorld(seed: number, propCount: number, assist: Assist = 'free', map: MapDef = ISLAND): World {
  const roads = map.roads.map(buildRoad);
  const w: World = {
    map, roads, land: buildLand(map.land), zones: [], zone: -1, zoneEvents: [],
    rng: seed | 0, time: 0, cars: [], trees: [], props: [], puffs: [], puffNext: 0, camHeading: 0, knocks: [],
    waters: [], drops: [], dropNext: 0, ripples: [], rippleNext: 0, splashes: [],
    assist, rescue: 0, mark: { x: 0, z: 0, t: 0 }, goal: null, steer: 0,
  };
  for (const z of map.zones ?? []) {
    const p = 'road' in z.on ? pointAt(roads[z.on.road]!, along(w, z.on), z.on.offset ?? 0) : z.on;
    w.zones.push({ kind: z.kind, x: p.x, z: p.z, r: z.r });
  }
  const car = (kind: VehicleKind, on: OnRoad, cruise: number): Car => {
    const c: Car = {
      kind, x: 0, z: 0, heading: 0, speed: cruise, spin: 0, y: 0, wet: 0, wake: 0,
      road: on.road, s: along(w, on), lane: on.offset ?? 0, home: on.offset ?? 0, cruise,
      mode: CRUISE, timer: 0, cool: 0,
    };
    trafficPose(w, c);
    return c;
  };
  const kid = car('car', map.spawn, 0);
  w.cars.push(kid);
  w.camHeading = kid.heading;
  w.mark = { x: kid.x, z: kid.z, t: 0 };
  for (const t of map.traffic) w.cars.push(car(t.kind, t.on, t.cruise));

  // Water: pools placed by hand (the flood), then puddles along the roads, each with a smaller lobe.
  for (const pool of map.water.pools) {
    const p = pointAt(roads[pool.on.road]!, along(w, pool.on), pool.on.offset ?? 0);
    w.waters.push({ x: p.x, z: p.z, r: pool.r, deep: pool.deep });
  }
  for (const row of map.water.puddles) {
    const road = roads[row.road]!;
    for (const at of row.at) {
      const offset = (rand(w) - 0.5) * row.spread, size = row.size[0] + rand(w) * row.size[1], lobe = rand(w) * Math.PI * 2;
      const { x, z } = pointAt(road, at * road.length, offset);
      w.waters.push({ x, z, r: size, deep: false });
      w.waters.push({ x: x + Math.sin(lobe) * size * 0.7, z: z + Math.cos(lobe) * size * 0.7, r: size * 0.65, deep: false });
    }
  }

  // A random point on the land, no closer than `gap` to its edge.
  const onLand = (gap: number): [number, number] => randomInland(w.land, () => rand(w), gap);
  const offRoad = (x: number, z: number, gap: number) =>
    roads.every((road, i) => nearestOn(road, i, x, z).dist > road.def.width / 2 + gap);

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
    w.trees.push({ kind: pick(trees.kinds), x, z, scale: trees.scale[0] + rand(w) * trees.scale[1] });
  }

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
    w.props.push({
      toy, homeX: x, homeZ: z, homeYaw: yaw, x, y: TOYS[toy].half, z, vx: 0, vy: 0, vz: 0,
      qx: 0, qy: Math.sin(yaw / 2), qz: 0, qw: Math.cos(yaw / 2), wx: 0, wy: 0, wz: 0,
      scale: 1, state: HOME, timer: 0, cool: 0,
    });
  }
  for (let i = 0; i < 48; i++) w.puffs.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 160; i++) w.drops.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  for (let i = 0; i < 40; i++) w.ripples.push({ x: 0, z: 0, life: 0, size: 1 });
  return w;
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
  const spot = nearestRoad(w.roads, car.x, car.z);
  if (!spot) return 0;
  // Aim at a point on the centre line a little way ahead, in whichever direction the car already faces.
  const forward = Math.cos(car.heading - spot.heading) >= 0 ? 1 : -1;
  const ahead = pointAt(w.roads[spot.road]!, spot.s + forward * ROAD_LOOKAHEAD);
  const want = Math.atan2(ahead.x - car.x, ahead.z - car.z);
  return clamp(-wrap(want - car.heading) * 2.5, -1, 1);
}

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
  let cap = Math.max(3, MAX_SPEED * Math.min(1, dist / SLOW_FROM));
  // A spot well off to the side: slow down to turn tightly toward it.
  if (Math.abs(err) > 1.2) cap = Math.min(cap, 6);
  return { go: true, steer: clamp(-err * 2.5, -1, 1), cap };
}

function stepKidCar(w: World, input: Input, dt: number): void {
  const car = w.cars[0]!;
  let go = input.go, brake = input.brake, steer = clamp(input.steer, -1, 1), cap = MAX_SPEED;
  if (input.spot && w.assist === 'free') {
    const to = towardSpot(w, input.spot, dt);
    ({ steer, cap } = to);
    // Arrived: a short, firm stop on the spot.
    if (!to.go) { go = false; brake = true; }
  } else w.goal = null;

  if (brake) car.speed = Math.max(0, car.speed - 24 * dt);
  else if (go && car.speed > cap) car.speed = Math.max(cap, car.speed - 12 * dt);
  else if (go) car.speed = Math.min(cap, car.speed + 10 * dt);
  else car.speed = Math.max(0, car.speed - 6 * dt);
  // Deep water holds the car back to a wade.
  if (car.wet === 2 && car.speed > FLOOD_SPEED) car.speed = Math.max(FLOOD_SPEED, car.speed - 30 * dt);

  const turn = 2.1 * Math.min(1, car.speed / 5) * (1 - 0.35 * (car.speed / MAX_SPEED));
  if (w.assist === 'road' || w.rescue > 0) steer = roadSteer(w);
  car.heading -= steer * turn * dt;
  w.steer = steer;

  // The shore turns the car back inland, harder the closer it gets (ADR 0021: can't get lost).
  const near = shore(w.land, car.x, car.z);
  if (near.depth < 10) {
    const k = Math.min(1, (10 - near.depth) / 8);
    const diff = wrap(Math.atan2(near.nx, near.nz) - car.heading);
    car.heading += clamp(diff * 2, -1, 1) * 3.2 * k * dt * Math.min(1, car.speed / 3);
  }

  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.spin += (car.speed / 0.45) * dt;

  // Never past 1.5 m from the shore.
  if (near.depth < 4) ({ x: car.x, z: car.z } = keepInland(w.land, car.x, car.z, 1.5));

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

  // A car that is being driven but has made no progress for a while is steered back to the road (ADR 0021).
  if (w.rescue > 0) w.rescue -= dt;
  if (!go || brake) {
    w.mark = { x: car.x, z: car.z, t: 0 };
  } else if ((w.mark.t += dt) >= 2.5) {
    if (Math.hypot(car.x - w.mark.x, car.z - w.mark.z) < 2) w.rescue = 1.5;
    w.mark = { x: car.x, z: car.z, t: 0 };
  }
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
    // Company: the kid's car is on this road, moving, and heading the way traffic goes.
    const company = kidOn.dist < road.def.width / 2 + 1.5 && kid.speed > 3 && Math.cos(kid.heading - kidOn.heading) > 0.6;
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
    c.speed += clamp(want - c.speed, -8 * dt, 8 * dt);

    // Near the kid's car, move over a lane to whichever side has road, then drift back to its own lane.
    let lane = c.home;
    if (Math.hypot(c.x - kid.x, c.z - kid.z) < 9) {
      const room = road.def.width / 2 - 0.5;
      const right = kidOn.offset + 3.4 <= room, left = kidOn.offset - 3.4 >= -room;
      const toRight = right && (c.lane >= kidOn.offset || !left);
      lane = clamp(kidOn.offset + (toRight ? 3.4 : -3.4), -room, room);
    }
    c.lane += clamp(lane - c.lane, -3 * dt, 3 * dt);
    c.s = wrapAlong(road, c.s + c.speed * dt);
    c.spin += (c.speed / 0.45) * dt;
    trafficPose(w, c);
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

function stepProps(w: World, dt: number): void {
  for (const p of w.props) {
    const { half, behaviour } = TOYS[p.toy];
    const rolls = behaviour === 'roll';
    if (p.cool > 0) p.cool -= dt;

    if (p.state === SHRINK) {
      p.scale -= dt / 0.25;
      if (p.scale <= 0) {
        p.scale = 0; p.state = GROW;
        p.x = p.homeX; p.z = p.homeZ; p.y = half;
        p.qx = 0; p.qy = Math.sin(p.homeYaw / 2); p.qz = 0; p.qw = Math.cos(p.homeYaw / 2);
        p.vx = p.vy = p.vz = p.wx = p.wy = p.wz = 0;
      }
      continue;
    }
    if (p.state === GROW) {
      p.scale += dt / 0.25;
      if (p.scale >= 1) { p.scale = 1; p.state = HOME; }
      continue;
    }

    if (p.cool <= 0 && p.y < 1.8) {
      for (let i = 0; i < w.cars.length; i++) {
        const car = w.cars[i]!;
        if (car.speed < 1) continue;
        const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
        // The car is longer than it is wide: one circle at the nose, one at the tail.
        const reach = VEHICLE_SIZE[car.kind].side + 0.15 + half;
        let dx = 0, dz = 0, hit = false;
        for (const [bx, bz] of bodyPoints(car)) {
          dx = p.x - bx; dz = p.z - bz;
          if (dx * dx + dz * dz <= reach * reach) { hit = true; break; }
        }
        if (!hit) continue;
        const len = Math.hypot(dx, dz) || 1;
        p.vx = fx * car.speed * 0.85 + (dx / len) * car.speed * 0.45 + (rand(w) - 0.5) * 2;
        p.vz = fz * car.speed * 0.85 + (dz / len) * car.speed * 0.45 + (rand(w) - 0.5) * 2;
        // A tumbling toy flies up; a rolling one only hops and keeps its speed along the ground.
        p.vy = rolls ? 1.5 + rand(w) : 3 + car.speed * 0.32 + rand(w) * 1.5;
        p.wx = (rand(w) - 0.5) * car.speed * 1.2;
        p.wy = (rand(w) - 0.5) * car.speed * 1.2;
        p.wz = (rand(w) - 0.5) * car.speed * 1.2;
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
    }
  }
}

export function step(w: World, input: Input, dt: number): void {
  w.time += dt;
  w.knocks.length = 0;
  w.splashes.length = 0;
  w.zoneEvents.length = 0;
  stepKidCar(w, input, dt);
  stepZones(w);
  stepTraffic(w, dt);
  stepWater(w, dt);
  stepProps(w, dt);
  for (const p of w.puffs) {
    if (p.life <= 0) continue;
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  w.camHeading += wrap(w.cars[0]!.heading - w.camHeading) * Math.min(1, 4 * dt);
}
