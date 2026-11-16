// The map in squares (sim/grid.ts, docs/highway-map-plan.md phase 2) gives exactly the old answers: every lookup,
// asked the quick way and the slow way (every road segment, every bit of shore, every toy) on thousands of random
// points, and a minute of driving, step by step. Toys asleep wake when bumped, and traffic by a rule is only ever
// moved out of sight, and never the kid's own car.
import { afterEach, describe, expect, it } from 'vitest';
import { STRESS } from '../maps/stress';
import { RING } from '../maps/ring';
import { MAPS } from '../maps';
import { VEHICLES } from '../settings';
import { guardAt, onSand } from './ground';
import { LOOKUP, buildGrid, inBox, nearest } from './grid';
import { onLand, shore } from './land';
import type { MapDef, ZoneKind } from './map';
import { zoneAt } from './mud';
import { nearestOn, nearestRoad } from './roads';
import { HIDE_M, chaseView } from './view';
import { TOY_STATE, TRAFFIC_NEAR, makeWorld, step, waterUnder, type Input, type World } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const ZONE_KINDS: ZoneKind[] = ['ramp', 'car-wash', 'garage', 'mud', 'ford', 'lights', 'roundabout', 'harbour'];

afterEach(() => {
  LOOKUP.grid = true;
});

/** The same question asked the slow way. */
function slow<T>(ask: () => T): T {
  LOOKUP.grid = false;
  try {
    return ask();
  } finally {
    LOOKUP.grid = true;
  }
}

/** A seeded random number, 0 to 1. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}

const maps: [string, MapDef][] = [...MAPS.map((m) => [m.id, m] as [string, MapDef]), ['stress', STRESS], ['ring', RING]];

describe('a grid', () => {
  it('lists each thing in every square its box overlaps, and finds the nearest the way a plain loop does', () => {
    const rand = seeded(3);
    const dots = Array.from({ length: 400 }, () => [rand() * 300 - 150, rand() * 200 - 100] as const);
    const g = buildGrid(dots.length, 25, (i, out) => {
      out[0] = out[2] = dots[i]![0];
      out[1] = out[3] = dots[i]![1];
    });
    const seen = new Uint8Array(dots.length);
    for (let k = 0; k < 2000; k++) {
      const x = rand() * 500 - 250, z = rand() * 400 - 200, r = rand() * 40;
      const d2 = (i: number) => (dots[i]![0] - x) ** 2 + (dots[i]![1] - z) ** 2;
      // Nearest, with ties to the lower index (dots on a grid of whole metres tie often).
      let best = Infinity, bi = -1;
      dots.forEach((_, i) => {
        if (d2(i) < best) {
          best = d2(i);
          bi = i;
        }
      });
      expect(nearest(g, x, z, d2)).toEqual({ i: bi, d2: best });
      // In a box: every dot inside it is listed (a few outside may be too: whole squares are listed).
      const listed = inBox(g, x - r, z - r, x + r, z + r, seen);
      const inside = dots.flatMap(([dx, dz], i) => (Math.abs(dx - x) <= r && Math.abs(dz - z) <= r ? [i] : []));
      expect(listed.filter((i) => inside.includes(i))).toEqual(inside);
      expect([...listed].sort((a, b) => a - b)).toEqual(listed);
    }
  });

  it('breaks ties the way a plain loop does', () => {
    const dots = Array.from({ length: 50 }, (_, i) => [(i % 5) * 10, Math.floor(i / 5) * 10] as const);
    const g = buildGrid(dots.length, 12.5, (i, out) => {
      out[0] = out[2] = dots[i]![0];
      out[1] = out[3] = dots[i]![1];
    });
    for (const [x, z] of [[5, 5], [15, 25], [-30, 45], [100, 100], [20, 0]] as const) {
      const d2 = (i: number) => (dots[i]![0] - x) ** 2 + (dots[i]![1] - z) ** 2;
      const best = Math.min(...dots.map((_, i) => d2(i)));
      expect(nearest(g, x, z, d2).i).toBe(dots.findIndex((_, i) => d2(i) === best));
    }
  });
});

describe.each(maps)('on the %s, the quick lookups give the slow answers', (_name, map) => {
  const w = makeWorld(5, map.propCount ?? 150, 'free', map);
  const { minX, maxX, minZ, maxZ } = w.land;
  const rand = seeded(11);
  /** Points over the whole map and a way out to sea; a third of them on or near a road, where the answers matter. */
  const points = Array.from({ length: 3000 }, (_, i): [number, number] => {
    if (i % 3) return [minX - 60 + rand() * (maxX - minX + 120), minZ - 60 + rand() * (maxZ - minZ + 120)];
    const road = w.roads[Math.floor(rand() * w.roads.length)]!;
    const k = Math.floor(rand() * road.xs.length);
    return [road.xs[k]! + (rand() - 0.5) * 30, road.zs[k]! + (rand() - 0.5) * 30];
  });

  it('nearest road, and the nearest point on each road', () => {
    for (const [x, z] of points) {
      expect(nearestRoad(w.roads, x, z)).toEqual(slow(() => nearestRoad(w.roads, x, z)));
      w.roads.forEach((road, i) => expect(nearestOn(road, i, x, z)).toEqual(slow(() => nearestOn(road, i, x, z))));
    }
  });

  it('the shore, the land and the sand', () => {
    for (const [x, z] of points) {
      expect(shore(w.land, x, z)).toEqual(slow(() => shore(w.land, x, z)));
      expect(onLand(w.land, x, z)).toBe(slow(() => onLand(w.land, x, z)));
      expect(onSand(w.sand, x, z)).toBe(slow(() => onSand(w.sand, x, z)));
    }
  });

  it('bridges and tunnels, water and zones', () => {
    for (const [x, z] of points) {
      for (const margin of [0, 6, 12]) expect(guardAt(w.guards, w.roads, x, z, margin)).toEqual(slow(() => guardAt(w.guards, w.roads, x, z, margin)));
      expect(waterUnder(w, x, z)).toBe(slow(() => waterUnder(w, x, z)));
      for (const kind of ZONE_KINDS) {
        for (const pad of [0, 10]) expect(zoneAt(w.zones, kind, x, z, pad)).toBe(slow(() => zoneAt(w.zones, kind, x, z, pad)));
      }
    }
  });
});

/** Everything a step can change, to compare two worlds. */
const state = (w: World) => ({
  rng: w.rng, fxRng: w.fxRng, cars: w.cars, props: w.props, animals: w.animals, follow: w.follow, turned: w.turned,
  zone: w.zone, puffs: w.puffs, drops: w.drops, confetti: w.confetti, lights: w.lights, boats: w.boats, mark: w.mark,
});

describe.each(maps)('on the %s, a minute of driving the quick way is the slow way, step for step', (_name, map) => {
  it.each(['free', 'road'] as const)('with %s steering', (assist) => {
    const fast = makeWorld(2, map.propCount ?? 150, assist, map, 'car', VEHICLES);
    const plain = slow(() => makeWorld(2, map.propCount ?? 150, assist, map, 'car', VEHICLES));
    expect(state(fast)).toEqual(state(plain));
    expect(fast.trees).toEqual(plain.trees);
    expect(fast.waters).toEqual(plain.waters);
    const rand = seeded(7);
    let input = GO;
    for (let i = 0; i < 60 / DT; i++) {
      if (i % 45 === 0) input = { go: rand() < 0.9, brake: rand() < 0.04, steer: rand() * 2 - 1 };
      step(fast, input, DT);
      slow(() => step(plain, input, DT));
      if (i % 60 === 0) expect(state(fast), `step ${i}`).toEqual(state(plain));
    }
    expect(state(fast)).toEqual(state(plain));
  }, 60_000);
});

describe('toys asleep', () => {
  it('a toy at home with nothing near sleeps, and wakes when a car bumps it', () => {
    const w = makeWorld(7, 150, 'free', RING);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!;
    // A scattered toy away from the kid's car.
    const i = w.props.findIndex((p) => p.stack < 0 && p.toy !== 'toy/star' && Math.hypot(p.homeX - kid.x, p.homeZ - kid.z) > 30);
    const prop = w.props[i]!;
    step(w, { go: false, brake: true, steer: 0 }, DT);
    expect(w.awake).not.toContain(i);
    // Drive straight at it from 6 m.
    const a = Math.atan2(prop.homeX - kid.x, prop.homeZ - kid.z);
    Object.assign(kid, { x: prop.homeX - Math.sin(a) * 6, z: prop.homeZ - Math.cos(a) * 6, heading: a, speed: 8 });
    let woke = false;
    for (let k = 0; k < 60 && !woke; k++) {
      step(w, GO, DT);
      woke = prop.state !== TOY_STATE.HOME;
    }
    expect(woke).toBe(true);
    expect(w.awake).toContain(i);
    // It flies, lands, goes home, and sleeps again once the car has gone.
    kid.x += 60;
    for (let k = 0; k < 12 / DT; k++) step(w, { go: false, brake: true, steer: 0 }, DT);
    expect(prop.state).toBe(TOY_STATE.HOME);
    expect(w.awake).not.toContain(i);
  });

  it('most of the stand-in map\'s toys sleep while a car drives round it', () => {
    const w = makeWorld(5, STRESS.propCount!, 'road', STRESS, 'car', VEHICLES);
    let most = 0;
    for (let k = 0; k < 20 / DT; k++) {
      step(w, GO, DT);
      most = Math.max(most, w.awake.length);
    }
    expect(most).toBeLessThan(w.props.length / 10);
  });
});

describe('traffic near the kid (trafficNear)', () => {
  it('keeps its count near the kid, moves only far-off traffic, out of sight, and never the kid\'s car', () => {
    const w = makeWorld(5, 0, 'road', STRESS, 'car', VEHICLES);
    const kid = w.cars[0]!;
    expect(w.cars.length).toBe(1 + STRESS.trafficNear!.count);
    for (const c of w.cars.slice(1)) expect(c.kind).not.toBe(kid.kind);
    // Out of sight: further than anything is drawn from where the camera looks (5 m ahead of the car).
    expect(TRAFFIC_NEAR.from - 5).toBeGreaterThan(HIDE_M);
    expect(TRAFFIC_NEAR.behind - 5).toBeGreaterThan(HIDE_M);
    let moved = 0;
    let last = w.cars.map((c) => ({ x: c.x, z: c.z }));
    for (let k = 0; k < 150 / DT; k++) {
      const before = { x: kid.x, z: kid.z };
      step(w, GO, DT);
      // The kid's car only drives (a bump with traffic shoves it a little): it is never put anywhere.
      expect(Math.hypot(kid.x - before.x, kid.z - before.z)).toBeLessThan(3);
      const [tx, , tz] = chaseView(w).target;
      w.cars.forEach((c, i) => {
        const jump = Math.hypot(c.x - last[i]!.x, c.z - last[i]!.z);
        if (i === 0 || jump < 5) return;
        moved++;
        // It went from far off to a road 160 to 220 m away: never seen to go or to come.
        expect(Math.hypot(last[i]!.x - before.x, last[i]!.z - before.z)).toBeGreaterThan(TRAFFIC_NEAR.behind - 1);
        const d = Math.hypot(c.x - kid.x, c.z - kid.z);
        expect(d).toBeGreaterThan(TRAFFIC_NEAR.from - 3);
        expect(d).toBeLessThan(TRAFFIC_NEAR.to + 3);
        expect(Math.hypot(c.x - tx, c.z - tz)).toBeGreaterThan(HIDE_M);
        expect(nearestRoad(w.roads, c.x, c.z)!.dist).toBeLessThan(5);
      });
      last = w.cars.map((c) => ({ x: c.x, z: c.z }));
    }
    expect(moved).toBeGreaterThan(0);
    expect(w.cars.length).toBe(1 + STRESS.trafficNear!.count);
  }, 60_000);
});
