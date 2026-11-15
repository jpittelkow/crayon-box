import { describe, expect, it } from 'vitest';
import { ISLAND, ROAD_R } from '../maps/island';
import type { MapDef } from './map';
import { buildRoad, circlePath, nearestOn, nearestRoad, pointAt, smoothPath, wrapAlong } from './roads';
import { makeWorld, step, type Input, type World } from './sim';

const DT = 1 / 60;

function run(w: World, seconds: number, input: (w: World, i: number) => Input): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(w, input(w, i), DT);
}

/**
 * A map that is not a circle: an off-centre island with a long, bent loop road drawn from five points. If the
 * simulation only worked on the prototype's ring road, these tests would fail.
 */
const OVAL: MapDef = {
  ...ISLAND,
  id: 'oval-test',
  land: { x: 20, z: -10, r: 75, beach: 8 },
  roads: [{ kind: 'street', width: 9, closed: true, points: smoothPath([[-30, -10], [20, 30], [70, -5], [45, -45], [0, -50]], true) }],
  spawn: { road: 0, at: 0 },
  traffic: [
    { kind: 'bus', on: { road: 0, at: 0.3, offset: -2.2 }, cruise: 6.5 },
    { kind: 'police', on: { road: 0, at: 0.65, offset: 2.2 }, cruise: 9.5 },
  ],
  water: { pools: [{ on: { road: 0, at: 0.5 }, r: 10, deep: true }], puddles: [{ road: 0, at: [0.15, 0.4, 0.8], spread: 6, size: [2, 1.5] }] },
};

describe('roads', () => {
  it('a ring road matches the circle it was drawn from', () => {
    const road = buildRoad({ kind: 'street', width: 9, points: circlePath(ROAD_R), closed: true });
    expect(road.length).toBeCloseTo(2 * Math.PI * ROAD_R, 0);
    const start = pointAt(road, 0);
    expect(start.x).toBeCloseTo(0, 5);
    expect(start.z).toBeCloseTo(ROAD_R, 5);
    expect(start.heading).toBeCloseTo(Math.PI / 2, 1);
    // Positive offsets are to the right of travel: on the ring, toward the sea.
    const right = pointAt(road, 0, 2);
    expect(Math.hypot(right.x, right.z)).toBeCloseTo(ROAD_R + 2, 1);
    // A quarter of the way round is at the island's east side.
    const quarter = pointAt(road, road.length / 4);
    expect(quarter.x).toBeCloseTo(ROAD_R, 1);
    expect(quarter.z).toBeCloseTo(0, 1);
  });

  it('finds the nearest point and which side of the road a point is on', () => {
    const road = buildRoad({ kind: 'street', width: 9, points: circlePath(ROAD_R), closed: true });
    const outside = nearestOn(road, 0, 0, ROAD_R + 3);
    expect(outside.dist).toBeCloseTo(3, 2);
    expect(outside.offset).toBeCloseTo(3, 2);
    expect(nearestOn(road, 0, 0, ROAD_R - 3).offset).toBeCloseTo(-3, 2);
    expect(nearestRoad([], 0, 0)).toBeUndefined();
  });

  it('wraps distances around a loop and clamps them on an open road', () => {
    const loop = buildRoad({ kind: 'street', width: 9, points: circlePath(10), closed: true });
    expect(wrapAlong(loop, loop.length + 3)).toBeCloseTo(3, 5);
    expect(wrapAlong(loop, -3)).toBeCloseTo(loop.length - 3, 5);
    const line = buildRoad({ kind: 'street', width: 9, points: [[0, 0], [0, 10]], closed: false });
    expect(wrapAlong(line, 14)).toBe(10);
    expect(pointAt(line, 4).z).toBeCloseTo(4, 5);
  });

  it('smooths a few points into a curve that passes through them', () => {
    const control: [number, number][] = [[0, 0], [20, 10], [40, 0], [20, -10]];
    const path = smoothPath(control, true);
    expect(path.length).toBeGreaterThan(40);
    for (const [cx, cz] of control) {
      expect(Math.min(...path.map(([x, z]) => Math.hypot(x - cx, z - cz)))).toBeLessThan(0.01);
    }
  });
});

describe('a map that is not the ring island', () => {
  it('places the car, traffic, water, trees and props from the map', () => {
    const w = makeWorld(3, 120, 'free', OVAL);
    const road = w.roads[0];
    expect(nearestOn(road, 0, w.cars[0].x, w.cars[0].z).dist).toBeLessThan(0.01);
    expect(w.cars.map((c) => c.kind)).toEqual(['car', 'bus', 'police']);
    expect(w.waters.filter((p) => p.deep)).toHaveLength(1);
    expect(w.trees.length).toBe(ISLAND.trees.count);
    expect(w.props.length).toBe(120);
    for (const t of w.trees) expect(nearestOn(road, 0, t.x, t.z).dist).toBeGreaterThan(4.5 + 2.5);
  });

  it('with "follows the road", the car stays on a bent road whatever the finger does', () => {
    const w = makeWorld(3, 120, 'road', OVAL);
    let off = 0;
    let travelled = 0;
    let px = w.cars[0].x, pz = w.cars[0].z;
    run(w, 40, (world, i) => {
      const car = world.cars[0];
      if (i > 120 && nearestOn(world.roads[0], 0, car.x, car.z).dist > 4.5 + 1) off++;
      travelled += Math.hypot(car.x - px, car.z - pz);
      px = car.x;
      pz = car.z;
      return { go: true, brake: false, steer: Math.sin(i / 20) };
    });
    expect(off).toBe(0);
    expect(travelled).toBeGreaterThan(400);
  });

  it('never leaves an off-centre island, and is never stuck', () => {
    const w = makeWorld(3, 120, 'free', OVAL);
    let s = 9;
    const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    let input: Input = { go: true, brake: false, steer: 0 };
    let far = 0, travelled = 0;
    let px = w.cars[0].x, pz = w.cars[0].z;
    run(w, 60, (world, i) => {
      const car = world.cars[0];
      far = Math.max(far, Math.hypot(car.x - OVAL.land.x, car.z - OVAL.land.z));
      travelled += Math.hypot(car.x - px, car.z - pz);
      px = car.x;
      pz = car.z;
      if (i % 45 === 0) input = { go: next() < 0.85, brake: next() < 0.05, steer: next() * 2 - 1 };
      return input;
    });
    expect(far).toBeLessThan(OVAL.land.r);
    expect(travelled).toBeGreaterThan(200);
  }, 30_000);

  it('traffic drives the bent road in its lane and comes back round', () => {
    const w = makeWorld(3, 0, 'free', OVAL);
    const bus = w.cars[1];
    const road = w.roads[0];
    const start = bus.s;
    let worst = 0;
    // Park the kid far off the road so traffic keeps to its own lane.
    Object.assign(w.cars[0], { x: OVAL.land.x + 60, z: OVAL.land.z });
    run(w, road.length / bus.cruise + 2, (world) => {
      worst = Math.max(worst, Math.abs(nearestOn(road, 0, world.cars[1].x, world.cars[1].z).offset - bus.home));
      return { go: false, brake: true, steer: 0 };
    });
    expect(worst).toBeLessThan(0.3);
    // A full lap and a little more: it went all the way round and is just past where it started.
    const past = wrapAlong(road, bus.s - start);
    expect(past).toBeGreaterThan(0);
    expect(past).toBeLessThan(bus.cruise * 3);
  });
});
