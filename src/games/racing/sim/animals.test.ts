import { describe, expect, it } from 'vitest';
import { RING, ROAD_R } from '../maps/ring';
import { ANIMAL_CLEAR } from './animals';
import type { MapDef } from './map';
import { pointAt } from './roads';
import { CRUISE, honk, makeWorld, step, type World } from './sim';

const DT = 1 / 60;
/** The ring with a herd of sheep in the middle and two ducks by the road, and no traffic. */
const FARM: MapDef = {
  ...RING, id: 'farm-test', traffic: [],
  animals: [{ id: 'animal/sheep', x: 0, z: 0, count: 3, roam: 5 }, { id: 'animal/duck', x: 0, z: ROAD_R - 6, count: 2, roam: 2 }],
};

function run(w: World, seconds: number, input = { go: false, brake: true, steer: 0 }, each: (w: World) => void = () => {}): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, input, DT);
    each(w);
  }
}

describe('animals (milestone-3 B3)', () => {
  it('wander near home, and every one answers the horn once with a hop and its call', () => {
    const w = makeWorld(7, 0, 'free', FARM);
    expect(w.animals.map((a) => a.id)).toEqual(['animal/sheep', 'animal/sheep', 'animal/sheep', 'animal/duck', 'animal/duck']);
    Object.assign(w.cars[0], { x: -15, z: 10 }); // near enough for all of them to hear, far enough not to scare them
    let far = 0;
    run(w, 20, undefined, (world) => {
      for (const a of world.animals) far = Math.max(far, Math.hypot(a.x - a.homeX, a.z - a.homeZ) - a.roam);
    });
    expect(far).toBeLessThan(1);

    honk(w);
    const calls: string[] = [];
    let highest = 0;
    run(w, 2, undefined, (world) => {
      calls.push(...world.calls);
      highest = Math.max(highest, ...world.animals.map((a) => a.h));
    });
    expect(calls.sort()).toEqual(['baa', 'baa', 'baa', 'quack', 'quack']);
    expect(highest).toBeGreaterThan(0.2);
    expect(w.animals.every((a) => a.h === 0)).toBe(true); // all landed
  });

  it('step aside from the car and are never hit, even by a car driving straight at them', () => {
    const w = makeWorld(7, 0, 'free', FARM);
    w.trees.length = 0;
    const sheep = w.animals[0]!;
    // Aim the kid's car at the first sheep from 15 m, full speed.
    Object.assign(w.cars[0], { x: sheep.x, z: sheep.z - 15, heading: 0, speed: 17 });
    let closest = Infinity;
    run(w, 3, { go: true, brake: false, steer: 0 }, (world) => {
      for (const a of world.animals) closest = Math.min(closest, Math.hypot(a.x - world.cars[0]!.x, a.z - world.cars[0]!.z));
    });
    expect(closest).toBeGreaterThanOrEqual(ANIMAL_CLEAR - 1e-6);
  });

  it('a horn too far away is not heard', () => {
    const w = makeWorld(7, 0, 'free', FARM);
    Object.assign(w.cars[0], { x: 0, z: -ROAD_R - 20 });
    honk(w);
    let calls = 0;
    run(w, 2, undefined, (world) => (calls += world.calls.length));
    expect(calls).toBe(0);
  });
});

describe('traffic gives way (driving-assets.md)', () => {
  it('a traffic car slows and waits behind the kid\'s car stopped in its lane, and never runs into it', () => {
    const w = makeWorld(7, 0, 'free', { ...RING, traffic: [RING.traffic[0]!] });
    const bus = w.cars[1]!;
    // The kid's car stopped in the bus's lane, 25 m ahead of it.
    Object.assign(w.cars[0], pointAt(w.roads[0]!, bus.s + 25, bus.lane), { speed: 0 });
    w.cars[0]!.heading += Math.PI / 2; // side on, across the lane
    let closest = Infinity;
    run(w, 12, undefined, (world) => {
      closest = Math.min(closest, Math.hypot(world.cars[1]!.x - world.cars[0]!.x, world.cars[1]!.z - world.cars[0]!.z));
    });
    expect(bus.mode).toBe(CRUISE);
    expect(closest).toBeGreaterThan(4);
    expect(bus.speed).toBeLessThan(0.5); // waiting
  });
});
