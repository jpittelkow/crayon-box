// The rules every driving map keeps (ADR 0021, 0035, 0041, 0042, 0043), in one place: `maps.test.ts` holds the
// built-in maps to them, and a map from the device's maps folder is checked against them when it loads, so a bad
// file is left out with a reason for the parent area instead of breaking a kid's screen.
//
// Two parts. `shapeProblems` checks a file's map has every field of `MapDef` (sim/map.ts), of the right kind and
// within sensible sizes, naming only things the game has. `placeProblems` builds the world and checks where things
// ended up: a garage, zones apart, targets clear of everything. The minute of random driving stays in the test:
// too slow to run on the laptop at every start.
import { guardAt, hillReach } from '../sim/ground';
import { onLand } from '../sim/land';
import type { MapDef } from '../sim/map';
import { nearestRoad } from '../sim/roads';
import { makeWorld, VEHICLE_SIZE, waterAt, type World } from '../sim/sim';
import { ANIMAL_IDS } from '../sim/assets/animals';
import { SET_PIECES } from '../sim/assets';
import { DECOR_IDS, SCENERY_IDS } from '../sim/assets/scenery';
import { TARGET_IDS, TOY_IDS } from '../sim/assets/toys';

/** A map id: lower case letters, digits and dashes (built-in ones too). */
export const MAP_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** How far from the middle anything may be, in metres (the very large map, ADR 0040, is about 1 km across). */
const FAR = 5000;
/** Caps on how many of anything, so a file can't stall the laptop. Well above the built-in maps. */
const MAX_POINTS = 20_000;
const MAX_ITEMS = 2_000;
const MAX_COUNT = 5_000;
/** Problems reported per map at most: the first few are enough to fix a file. */
const MAX_PROBLEMS = 5;

const ZONE_KINDS = Object.keys(SET_PIECES);
const VEHICLE_KINDS = Object.keys(VEHICLE_SIZE);
const SCATTER_TOYS = TOY_IDS.filter((id) => !(TARGET_IDS as readonly string[]).includes(id));

type Obj = Record<string, unknown>;

/** Collects problems as "where: what", e.g. `roads[2].from: there is no road 7.` */
class Checker {
  readonly out: string[] = [];
  constructor(private readonly roadCount: () => number) {}

  bad(path: string, what: string): false {
    if (this.out.length < MAX_PROBLEMS) this.out.push(`${path}: ${what}.`);
    return false;
  }
  obj(v: unknown, path: string): v is Obj {
    return (!!v && typeof v === 'object' && !Array.isArray(v)) || this.bad(path, 'needs to be an object { }');
  }
  arr(v: unknown, path: string, min = 0, max = MAX_ITEMS): v is unknown[] {
    if (!Array.isArray(v)) return this.bad(path, 'needs to be a list [ ]');
    if (v.length < min) return this.bad(path, `needs at least ${min}`);
    if (v.length > max) return this.bad(path, `has more than ${max}`);
    return true;
  }
  num(v: unknown, path: string, min = -FAR, max = FAR): v is number {
    if (typeof v !== 'number' || !Number.isFinite(v)) return this.bad(path, 'needs to be a number');
    if (v < min || v > max) return this.bad(path, `needs to be from ${min} to ${max}`);
    return true;
  }
  int(v: unknown, path: string, min: number, max: number): v is number {
    return this.num(v, path, min, max) && (Number.isInteger(v) || this.bad(path, 'needs to be a whole number'));
  }
  bool(v: unknown, path: string): v is boolean {
    return typeof v === 'boolean' || this.bad(path, 'needs to be true or false');
  }
  oneOf(v: unknown, path: string, list: readonly string[]): boolean {
    return (typeof v === 'string' && list.includes(v)) || this.bad(path, `needs to be one of ${list.map((s) => `"${s}"`).join(', ')}`);
  }
  optional(o: Obj, key: string, path: string, check: (v: unknown, path: string) => unknown): void {
    if (o[key] !== undefined) check(o[key], `${path}.${key}`);
  }
  point(v: unknown, path: string): boolean {
    if (!Array.isArray(v) || v.length !== 2) return this.bad(path, 'needs to be a point [x, z]');
    return this.num(v[0], `${path}[0]`) && this.num(v[1], `${path}[1]`);
  }
  points(v: unknown, path: string, min: number): boolean {
    if (!this.arr(v, path, min, MAX_POINTS)) return false;
    for (let i = 0; i < v.length; i++) if (!this.point(v[i], `${path}[${i}]`)) return false;
    return true;
  }
  pair(v: unknown, path: string, min = 0, max = FAR): boolean {
    if (!Array.isArray(v) || v.length !== 2) return this.bad(path, 'needs to be two numbers [a, b]');
    return this.num(v[0], `${path}[0]`, min, max) && this.num(v[1], `${path}[1]`, min, max);
  }
  road(v: unknown, path: string): boolean {
    return this.int(v, path, 0, MAX_ITEMS) && (v < this.roadCount() || this.bad(path, `there is no road ${v} (roads are numbered from 0)`));
  }
  frac(v: unknown, path: string): boolean {
    return this.num(v, path, 0, 1);
  }
  onRoad(v: unknown, path: string): boolean {
    if (!this.obj(v, path)) return false;
    this.road(v.road, `${path}.road`);
    this.frac(v.at, `${path}.at`);
    this.optional(v, 'offset', path, (x, p) => this.num(x, p, -100, 100));
    return true;
  }
  /** A list of objects, each checked by `each`. */
  list(v: unknown, path: string, each: (o: Obj, path: string) => void, min = 0, max = MAX_ITEMS): void {
    if (!this.arr(v, path, min, max)) return;
    v.forEach((item, i) => {
      if (this.obj(item, `${path}[${i}]`)) each(item, `${path}[${i}]`);
    });
  }
  kinds(v: unknown, path: string, ids: readonly string[]): void {
    this.list(v, path, (k, p) => {
      this.oneOf(k.id, `${p}.id`, ids);
      this.num(k.share, `${p}.share`, 0, 1000);
    }, 1, 50);
  }
}

/**
 * What is wrong with the shape of a map (a file's `map`): every field `MapDef` needs, of the right kind and size,
 * and only names of things the game has. Empty when it is fine. Fields it doesn't know are left alone.
 */
export function shapeProblems(raw: unknown): string[] {
  let roads = 0;
  const c = new Checker(() => roads);
  if (!c.obj(raw, 'map')) return c.out;
  const m = raw;
  if (typeof m.id !== 'string' || !MAP_ID.test(m.id)) c.bad('map.id', 'needs to be lower case letters, digits and dashes, like "my-map"');
  if (c.arr(m.roads, 'map.roads', 1, 500)) roads = m.roads.length;
  c.list(m.roads, 'map.roads', (r, p) => {
    c.oneOf(r.kind, `${p}.kind`, ['street', 'dirt']);
    c.num(r.width, `${p}.width`, 4, 40);
    c.points(r.points, `${p}.points`, 2);
    c.bool(r.closed, `${p}.closed`);
    c.optional(r, 'from', p, (v, q) => c.road(v, q));
    c.optional(r, 'to', p, (v, q) => c.road(v, q));
    // A roundabout's ring is one-way (ADR 0042).
    c.optional(r, 'oneWay', p, (v, q) => c.bool(v, q));
  }, 1, 500);
  if (c.obj(m.land, 'map.land')) {
    c.points(m.land.outline, 'map.land.outline', 3);
    c.num(m.land.beach, 'map.land.beach', 0, 100);
  }
  c.onRoad(m.spawn, 'map.spawn');
  c.optional(m, 'propCount', 'map', (v, p) => c.int(v, p, 0, MAX_COUNT));
  c.optional(m, 'trafficPrefer', 'map', (v, p) => {
    if (c.arr(v, p, 0, 50)) v.forEach((k, i) => c.oneOf(k, `${p}[${i}]`, VEHICLE_KINDS));
  });
  c.optional(m, 'boats', 'map', (v, p) => c.list(v, p, (b, q) => {
    c.num(b.x, `${q}.x`);
    c.num(b.z, `${q}.z`);
    c.num(b.heading, `${q}.heading`, -100, 100);
  }, 0, 200));
  c.optional(m, 'zones', 'map', (v, p) => c.list(v, p, (z, q) => {
    c.oneOf(z.kind, `${q}.kind`, ZONE_KINDS);
    if (c.obj(z.on, `${q}.on`)) {
      if ('road' in z.on) c.onRoad(z.on, `${q}.on`);
      else {
        c.num(z.on.x, `${q}.on.x`);
        c.num(z.on.z, `${q}.on.z`);
        c.optional(z.on, 'heading', `${q}.on`, (h, r) => c.num(h, r, -100, 100));
      }
    }
    c.num(z.r, `${q}.r`, 0.5, 100);
    // A harbour's way out to sea and back for its sailing boat (ADR 0042).
    c.optional(z, 'sail', q, (s, r) => c.points(s, r, 1));
  }, 0, 500));
  c.optional(m, 'guards', 'map', (v, p) => c.list(v, p, (g, q) => {
    c.oneOf(g.kind, `${q}.kind`, ['bridge', 'tunnel']);
    c.road(g.road, `${q}.road`);
    c.frac(g.from, `${q}.from`);
    c.frac(g.to, `${q}.to`);
  }, 0, 500));
  c.optional(m, 'hills', 'map', (v, p) => c.list(v, p, (h, q) => {
    c.num(h.x, `${q}.x`);
    c.num(h.z, `${q}.z`);
    c.num(h.rx, `${q}.rx`, 0.5, 1000);
    c.num(h.rz, `${q}.rz`, 0.5, 1000);
    c.num(h.height, `${q}.height`, 0.1, 200);
    c.optional(h, 'color', q, (col, r) => c.int(col, r, 0, 0xffffff));
  }, 0, 500));
  c.optional(m, 'sand', 'map', (v, p) => {
    if (c.arr(v, p, 0, 500)) v.forEach((s, i) => c.points(s, `${p}[${i}]`, 3));
  });
  c.list(m.traffic, 'map.traffic', (t, q) => {
    c.oneOf(t.kind, `${q}.kind`, VEHICLE_KINDS);
    c.onRoad(t.on, `${q}.on`);
    c.num(t.cruise, `${q}.cruise`, 1, 30);
  }, 0, 60);
  // Traffic by a rule, near the kid (docs/highway-map-plan.md, phase 2).
  c.optional(m, 'trafficNear', 'map', (t, p) => {
    if (!c.obj(t, p)) return;
    c.int(t.count, `${p}.count`, 0, 60);
    c.optional(t, 'roads', p, (v, q) => {
      if (c.arr(v, q, 1, 500)) v.forEach((r, i) => c.road(r, `${q}[${i}]`));
    });
    c.pair(t.cruise, `${p}.cruise`, 1, 30);
  });
  if (c.obj(m.water, 'map.water')) {
    const w = m.water;
    c.list(w.pools, 'map.water.pools', (o, q) => {
      c.onRoad(o.on, `${q}.on`);
      c.num(o.r, `${q}.r`, 0.5, 200);
      c.bool(o.deep, `${q}.deep`);
      c.optional(o, 'mud', q, (b, r) => c.bool(b, r));
    }, 0, 500);
    c.list(w.puddles, 'map.water.puddles', (o, q) => {
      c.road(o.road, `${q}.road`);
      if (c.arr(o.at, `${q}.at`, 0, MAX_ITEMS)) o.at.forEach((a, i) => c.frac(a, `${q}.at[${i}]`));
      c.num(o.spread, `${q}.spread`, 0, 100);
      c.pair(o.size, `${q}.size`, 0, 50);
      c.optional(o, 'mud', q, (b, r) => c.bool(b, r));
    }, 0, 500);
    c.optional(w, 'streams', 'map.water', (v, p) => c.list(v, p, (s, q) => {
      c.points(s.points, `${q}.points`, 2);
      c.num(s.width, `${q}.width`, 0.5, 50);
    }, 0, 100));
  }
  if (c.obj(m.trees, 'map.trees')) {
    const t = m.trees;
    c.kinds(t.kinds, 'map.trees.kinds', SCENERY_IDS);
    c.int(t.count, 'map.trees.count', 0, MAX_COUNT);
    c.pair(t.scale, 'map.trees.scale', 0, 10);
    for (const k of ['roadGap', 'waterGap', 'edgeGap']) c.num(t[k], `map.trees.${k}`, 0, 100);
  }
  if (c.obj(m.props, 'map.props')) {
    const t = m.props;
    c.kinds(t.kinds, 'map.props.kinds', SCATTER_TOYS);
    c.num(t.nearRoad, 'map.props.nearRoad', 0, 1);
    for (const k of ['spread', 'edgeGap', 'spawnGap']) c.num(t[k], `map.props.${k}`, 0, 100);
  }
  c.list(m.decor, 'map.decor', (d, q) => {
    c.oneOf(d.id, `${q}.id`, DECOR_IDS);
    c.int(d.clumps, `${q}.clumps`, 0, MAX_COUNT);
    c.int(d.perClump, `${q}.perClump`, 0, 50);
  }, 0, 50);
  c.optional(m, 'targets', 'map', (v, p) => c.list(v, p, (t, q) => {
    c.oneOf(t.id, `${q}.id`, TARGET_IDS);
    c.onRoad(t.on, `${q}.on`);
    c.optional(t, 'count', q, (n, r) => c.int(n, r, 1, 50));
    c.optional(t, 'gap', q, (n, r) => c.num(n, r, 0.5, 100));
  }, 0, 500));
  c.optional(m, 'animals', 'map', (v, p) => c.list(v, p, (a, q) => {
    c.oneOf(a.id, `${q}.id`, ANIMAL_IDS);
    c.num(a.x, `${q}.x`);
    c.num(a.z, `${q}.z`);
    c.int(a.count, `${q}.count`, 1, 50);
    c.num(a.roam, `${q}.roam`, 0, 200);
  }, 0, 200));
  return c.out;
}

/** True where the car may be: on the land, or on a bridge. */
export const allowedAt = (w: World, x: number, z: number) =>
  onLand(w.land, x, z) || guardAt(w.guards, w.roads, x, z)?.guard.kind === 'bridge';
/** True inside a hill (and not in its tunnel). */
export const inHill = (w: World, x: number, z: number) =>
  (w.map.hills ?? []).some((h) => hillReach(h, x, z) < 0.8) && !guardAt(w.guards, w.roads, x, z);

/**
 * What is wrong with where things are on a map of the right shape (`shapeProblems` first): the world is built as
 * the game builds it and checked. Empty when it is fine.
 */
export function placeProblems(map: MapDef): string[] {
  const out: string[] = [];
  const bad = (what: string) => void (out.length < MAX_PROBLEMS && out.push(`${what}.`));
  let w: World;
  try {
    w = makeWorld(7, map.propCount ?? 150, 'free', map);
  } catch (err) {
    return [`The game couldn't build this map (${(err as Error).message}).`];
  }
  const kid = w.cars[0]!;
  if (!Number.isFinite(kid.x) || !Number.isFinite(kid.z)) return ['The start (spawn) is not on a road the game can follow.'];
  if (!allowedAt(w, kid.x, kid.z)) bad(`The start (spawn) is in the sea, at ${kid.x.toFixed(0)}, ${kid.z.toFixed(0)}`);
  if (inHill(w, kid.x, kid.z)) bad(`The start (spawn) is inside a hill, at ${kid.x.toFixed(0)}, ${kid.z.toFixed(0)}`);

  // A garage (ADR 0035), and zones that don't sit on each other (ADR 0042).
  if (!w.zones.some((z) => z.kind === 'garage')) bad('It has no garage (a zone of kind "garage"), so a kid can\'t change vehicle');
  for (let i = 0; i < w.zones.length; i++) {
    for (let j = i + 1; j < w.zones.length; j++) {
      const a = w.zones[i]!, b = w.zones[j]!;
      if (Math.hypot(a.x - b.x, a.z - b.z) <= a.r + b.r + 4) bad(`zones[${i}] (${a.kind}) and zones[${j}] (${b.kind}) are too close: keep them 4 m further apart`);
    }
  }

  // Targets (ADR 0041): on the land, out of deep water, off bridges and tunnels and hills, clear of zones and the
  // start; stars on the road (where "follows the road" goes), stacks off it but near.
  const stacks = w.stacks.map((s) => w.props[s[0]!]!);
  const targets = [...w.props.filter((p) => p.toy === 'toy/star'), ...stacks];
  for (const t of targets) {
    const where = `A target (${t.toy}) at ${t.homeX.toFixed(0)}, ${t.homeZ.toFixed(0)}`;
    const road = nearestRoad(w.roads, t.homeX, t.homeZ)!;
    if (!onLand(w.land, t.homeX, t.homeZ)) bad(`${where} is off the land`);
    else if (waterAt(w, t.homeX, t.homeZ) >= 2) bad(`${where} is in deep water`);
    else if (guardAt(w.guards, w.roads, t.homeX, t.homeZ, 3)) bad(`${where} is on a bridge or in a tunnel`);
    else if ((map.hills ?? []).some((h) => hillReach(h, t.homeX, t.homeZ, 2) < 1)) bad(`${where} is on a hill`);
    else if (w.zones.some((z) => Math.hypot(t.homeX - z.x, t.homeZ - z.z) <= z.r + 3)) bad(`${where} is in a zone: keep it 3 m clear`);
    else if (Math.hypot(t.homeX - kid.x, t.homeZ - kid.z) <= 10) bad(`${where} is within 10 m of the start`);
    else if (t.toy === 'toy/star' && road.dist >= 2.5) bad(`${where} is off the road: stars go on it`);
    else if (t.toy !== 'toy/star' && road.dist <= map.roads[road.road]!.width / 2) bad(`${where} is on the road: stacks go just off it`);
    else if (t.toy !== 'toy/star' && road.dist >= 16) bad(`${where} is more than 16 m from a road`);
  }
  // No scattered toy inside a stack.
  const scattered = w.props.filter((p) => p.stack < 0 && p.toy !== 'toy/star');
  for (const s of stacks) {
    if (scattered.some((o) => Math.hypot(o.homeX - s.homeX, o.homeZ - s.homeZ) <= 2)) bad(`A toy sits inside the stack at ${s.homeX.toFixed(0)}, ${s.homeZ.toFixed(0)}`);
  }
  return out;
}

/**
 * How far from a road a place a kid can reach may be, in metres: the highway plan's decision D6 as proposed (45 m;
 * ADR 0035 said 25 m, which neither built-in map keeps). Not a load check yet: the map viewer and the map editor
 * show the places over it in red (`farFromRoad`).
 */
export const ROAD_REACH = 45;

/**
 * The places a kid can reach (on the land or a bridge, outside hills) further than `reach` metres from every road,
 * sampled on a grid `step` metres apart: the middle of each cell over it. For the map tools; not a load check.
 */
export function farFromRoad(w: World, step = 4, reach = ROAD_REACH): [number, number][] {
  const out: [number, number][] = [];
  const { minX, maxX, minZ, maxZ } = w.land;
  for (let x = minX + step / 2; x < maxX; x += step) {
    for (let z = minZ + step / 2; z < maxZ; z += step) {
      if (!allowedAt(w, x, z) || inHill(w, x, z)) continue;
      if ((nearestRoad(w.roads, x, z)?.dist ?? Infinity) > reach) out.push([x, z]);
    }
  }
  return out;
}

/** Everything wrong with a map, shape first: where things are is checked only once the shape is right. */
export function mapProblems(raw: unknown): string[] {
  const shape = shapeProblems(raw);
  return shape.length ? shape : placeProblems(raw as MapDef);
}
