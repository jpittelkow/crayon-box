// A roundabout (ADR 0042): a one-way ring with roads joining it. Traffic goes round it anticlockwise, slowly, and
// leaves by every exit; "follows the road" goes round with it and takes the exits in turn; the kid's car may cut
// across the bed or go round the other way, slides round the fountain, and random driving never gets stuck there.
import { describe, expect, it } from 'vitest';
import { RING, acrossRing } from '../maps/ring';
import type { MapDef } from './map';
import { BASIN_R, ROUNDABOUT_SPEED, jetHeights, ringOf } from './roundabout';
import { nearestRoad, pointAt, ringRoad, type RoadDef } from './roads';
import { VEHICLE_SIZE, bodyPoints, makeWorld, step, type Input, type World } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const STOP: Input = { go: false, brake: true, steer: 0 };
const RING_IX = 1;
const RING_R = 8;

/**
 * The ring map's loop with a roundabout in the middle of the island: four straight roads from the roundabout out to
 * the loop, north, west, south and east, each joining the roundabout's ring at its start and the loop at its end.
 */
const SPOKES: RoadDef[] = [0, 1, 2, 3].map((k) => ({
  kind: 'street', width: 9, closed: false, from: RING_IX, to: 0, points: acrossRing((k * Math.PI) / 2, RING_R, 38),
}));
const ROUNDABOUT: MapDef = {
  ...RING, id: 'roundabout-test',
  roads: [...RING.roads, ringRoad(0, 0, RING_R, 9), ...SPOKES],
  zones: [{ kind: 'roundabout', on: { x: 0, z: 0 }, r: RING_R + 4.5 }],
  water: { pools: [], puddles: [] },
};

function run(w: World, seconds: number, input: Input | ((w: World, i: number) => Input), each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, typeof input === 'function' ? input(w, i) : input, DT);
    each?.(w);
  }
}
/** Which way round the middle a point is (radians): it grows going anticlockwise seen from above, as traffic should. */
const around = (x: number, z: number) => Math.atan2(x, z);
const turned = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

describe('a roundabout (ADR 0042)', () => {
  it('is a one-way ring that the zone knows, with every road joining it at a junction', () => {
    const w = makeWorld(7, 0, 'free', ROUNDABOUT);
    expect(w.zones[0]!.ring).toBe(RING_IX);
    expect(ringOf(w.zones[0]!, w.roads)).toBe(RING_IX);
    expect(w.roads[RING_IX]!.def.oneWay).toBe(true);
    expect(w.junctions[RING_IX]!.map((j) => j.road).sort()).toEqual([2, 3, 4, 5]);
    // The ring starts at its north point and goes north, then west: anticlockwise seen from above.
    const a = pointAt(w.roads[RING_IX]!, 0), b = pointAt(w.roads[RING_IX]!, 3);
    expect(a.z).toBeCloseTo(RING_R, 1);
    expect(turned(around(a.x, a.z), around(b.x, b.z))).toBeGreaterThan(0);
  });

  it('traffic goes round it one way, slowly, leaves by every exit, and stays on the roads', () => {
    const w = makeWorld(7, 0, 'free', ROUNDABOUT);
    Object.assign(w.cars[0]!, { x: 0, z: 52 }); // the kid parked out of the way, by the shore
    const exits = new Set<number>();
    const was = w.cars.map((c) => ({ road: c.road, a: around(c.x, c.z) }));
    let backwards = 0, fastest = 0, worst = 0, laps = 0;
    run(w, 300, STOP, (world) => {
      world.cars.slice(1).forEach((c, k) => {
        const before = was[k + 1]!, a = around(c.x, c.z);
        if (c.road === RING_IX && before.road === RING_IX) {
          if (c.dir !== 1 || turned(before.a, a) < -1e-6) backwards++;
          fastest = Math.max(fastest, c.speed);
          laps += turned(before.a, a) / (Math.PI * 2);
        }
        if (before.road === RING_IX && c.road !== RING_IX) exits.add(c.road);
        worst = Math.max(worst, nearestRoad(world.roads, c.x, c.z)!.dist);
        was[k + 1] = { road: c.road, a };
      });
    });
    expect([...exits].sort()).toEqual([2, 3, 4, 5]);
    expect(backwards).toBe(0);
    expect(laps).toBeGreaterThan(2);
    // It slows onto the ring (it may still be easing off as it joins).
    expect(fastest).toBeLessThan(ROUNDABOUT_SPEED + 1.5);
    expect(worst).toBeLessThan(9 / 2 + 0.6);
  }, 60_000);

  it('"follows the road" goes round with the traffic and leaves by every exit in turn, staying near the road', () => {
    const w = makeWorld(7, 0, 'road', ROUNDABOUT);
    w.cars = w.cars.slice(0, 1);
    const exits: number[] = [];
    let road = w.follow?.road ?? -1, prev = around(w.cars[0]!.x, w.cars[0]!.z), against = 0, off = 0, still = 0;
    run(w, 300, GO, (world) => {
      const kid = world.cars[0]!, now = world.follow?.road ?? -1, a = around(kid.x, kid.z);
      if (road === RING_IX && now !== RING_IX && now >= 0) exits.push(now);
      if (now === RING_IX && Math.hypot(kid.x, kid.z) < RING_R + 3 && turned(prev, a) < -1e-4) against++;
      off = Math.max(off, nearestRoad(world.roads, kid.x, kid.z)!.dist);
      if (world.time > 3 && kid.speed < 2) still++;
      road = now;
      prev = a;
    });
    expect(new Set(exits).size).toBe(4);
    // It never takes the same exit twice running while there are others to take.
    expect(exits.slice(0, 4).sort()).toEqual([2, 3, 4, 5]);
    expect(against).toBe(0);
    expect(off).toBeLessThan(9 / 2 + 4);
    expect(still).toBe(0);
  }, 60_000);

  it('random driving round and over it never gets stuck, and never inside the fountain', () => {
    for (const seed of [1, 2, 3, 4]) {
      const w = makeWorld(seed, 0, 'free', ROUNDABOUT);
      w.cars = w.cars.slice(0, 1);
      const kid = w.cars[0]!;
      // Start on the ring, facing round it either way.
      const p = pointAt(w.roads[RING_IX]!, seed * 9);
      Object.assign(kid, { x: p.x, z: p.z, heading: p.heading + (seed % 2 ? Math.PI : 0), speed: 0 });
      let s = seed, input = GO, travelled = 0, px = kid.x, pz = kid.z, stuck = 0, longest = 0, closest = 99;
      const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
      run(w, 40, (_world, i) => {
        // Short bursts of steering, mostly near the roundabout: held hard for a while, then turned back toward it.
        if (i % 40 === 0) input = { go: next() < 0.9, brake: false, steer: next() * 2 - 1 };
        if (Math.hypot(kid.x, kid.z) > 22 && i % 40 < 20) input = { go: true, brake: false, steer: turned(kid.heading, Math.atan2(-kid.x, -kid.z)) > 0 ? -1 : 1 };
        return input;
      }, () => {
        const moved = Math.hypot(kid.x - px, kid.z - pz);
        travelled += moved;
        px = kid.x;
        pz = kid.z;
        stuck = input.go && moved < 0.5 * DT ? stuck + DT : 0;
        longest = Math.max(longest, stuck);
        closest = Math.min(closest, Math.hypot(kid.x, kid.z));
      });
      expect(travelled, `seed ${seed}`).toBeGreaterThan(150);
      expect(longest, `seed ${seed}`).toBeLessThan(3);
      expect(closest, `seed ${seed}`).toBeGreaterThan(VEHICLE_SIZE.car.side + BASIN_R - 0.05);
    }
  }, 60_000);

  it('the kid\'s car slides round the fountain it drives at, and goes on past', () => {
    const w = makeWorld(7, 0, 'free', ROUNDABOUT);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!;
    // Ten metres off, aimed straight at the middle (a hair to one side).
    Object.assign(kid, { x: 0.1, z: -10, heading: 0, speed: 8 });
    let closest = 99;
    run(w, 3, GO, () => (closest = Math.min(closest, Math.hypot(kid.x, kid.z))));
    expect(closest).toBeGreaterThan(VEHICLE_SIZE.car.side + BASIN_R - 0.05);
    expect(kid.z).toBeGreaterThan(8);
  });

  it('the kid\'s car may cut across the bed at full speed, and go round the wrong way: nothing slows it', () => {
    const w = makeWorld(7, 0, 'free', ROUNDABOUT);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!;
    // Across the bed, 3.2 m from the middle: over the kerb and the flowers, clear of the basin.
    Object.assign(kid, { x: 3.2, z: -20, heading: 0, speed: 17 });
    let slowest = 99;
    run(w, 2.4, GO, () => (slowest = Math.min(slowest, kid.speed)));
    expect(kid.z).toBeGreaterThan(15);
    expect(slowest).toBeGreaterThan(16.9);

    // Round the ring clockwise, against the arrows and the traffic, chasing a spot just ahead that way.
    const wrong = makeWorld(7, 0, 'free', ROUNDABOUT);
    const car = wrong.cars[0]!, ring = wrong.roads[RING_IX]!;
    const start = pointAt(ring, 0);
    Object.assign(car, { x: start.x, z: start.z, heading: start.heading + Math.PI, speed: 6 });
    let laps = 0, prev = around(car.x, car.z), worst = 0;
    run(wrong, 20, () => {
      const spot = pointAt(ring, Math.atan2(car.x, car.z) * RING_R - 6);
      return { go: true, brake: false, steer: 0, spot: { x: spot.x, z: spot.z } };
    }, () => {
      const a = around(car.x, car.z);
      laps -= turned(prev, a) / (Math.PI * 2);
      prev = a;
      worst = Math.max(worst, Math.abs(Math.hypot(car.x, car.z) - RING_R));
    });
    expect(laps).toBeGreaterThan(1.5);
    expect(worst).toBeLessThan(5);
  });

  it('traffic gives way to the kid\'s car sitting on the ring, and goes on round it', () => {
    const w = makeWorld(7, 0, 'free', ROUNDABOUT);
    const kid = w.cars[0]!, ring = w.roads[RING_IX]!;
    // Parked on the ring in its outer lane, between the south and east roads, in the traffic's way.
    const p = pointAt(ring, ring.length * 0.625, 2.2);
    Object.assign(kid, { x: p.x, z: p.z, heading: p.heading, speed: 0 });
    let closest = 99, through = 0;
    const was = w.cars.map((c) => c.road);
    run(w, 120, STOP, (world) => {
      world.cars.slice(1).forEach((c, k) => {
        for (const [bx, bz] of bodyPoints(c)) closest = Math.min(closest, Math.hypot(bx - kid.x, bz - kid.z) - VEHICLE_SIZE[c.kind].side);
        if (was[k + 1] === RING_IX && c.road !== RING_IX) through++;
        was[k + 1] = c.road;
      });
    });
    // Its body never runs into the kid's car (a bump may nudge, but not drive through it).
    expect(closest).toBeGreaterThan(VEHICLE_SIZE.car.side - 0.3);
    expect(through).toBeGreaterThan(2);
  }, 60_000);

  it('the fountain\'s jets rise and fall in a wave', () => {
    const a = jetHeights(0), b = jetHeights(0.7);
    expect(a.length).toBe(7);
    for (const h of [...a, ...b]) {
      expect(h).toBeGreaterThan(0);
      expect(h).toBeLessThanOrEqual(1);
    }
    expect(a).not.toEqual(b);
    // Not all together: the ring's jets are at different heights at once.
    expect(new Set(a.slice(0, 6).map((h) => h.toFixed(3))).size).toBeGreaterThan(2);
  });
});
