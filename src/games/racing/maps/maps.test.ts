// Every map keeps the driving game's rules (ADR 0021, 0035; milestone-3 F): the car never ends up in the sea or
// inside a hill, is never stuck, traffic stays on its roads, and "follows the road" stays close to them.
import { describe, expect, it } from 'vitest';
import { guardAt, hillReach } from '../sim/ground';
import { onLand } from '../sim/land';
import { nearestRoad } from '../sim/roads';
import { VEHICLES } from '../settings';
import { makeWorld, step, type Input, type World } from '../sim/sim';
import { MAPS, MAP_NAMES } from '.';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };

function run(w: World, seconds: number, input: (w: World, i: number) => Input): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(w, input(w, i), DT);
}
const allowed = (w: World, x: number, z: number) => onLand(w.land, x, z) || guardAt(w.guards, w.roads, x, z)?.guard.kind === 'bridge';
const inHill = (w: World, x: number, z: number) =>
  (w.map.hills ?? []).some((h) => hillReach(h, x, z) < 0.8) && !guardAt(w.guards, w.roads, x, z);

describe.each(MAPS.map((m) => [MAP_NAMES[m.id], m] as const))('the %s', (_name, map) => {
  it('has a name, roads, a garage, and zones that don\'t sit on each other', () => {
    expect(MAP_NAMES[map.id]).toBeTruthy();
    const w = makeWorld(7, 0, 'free', map);
    expect(w.zones.some((z) => z.kind === 'garage')).toBe(true);
    for (let i = 0; i < w.zones.length; i++) {
      for (let j = i + 1; j < w.zones.length; j++) {
        expect(Math.hypot(w.zones[i]!.x - w.zones[j]!.x, w.zones[i]!.z - w.zones[j]!.z)).toBeGreaterThan(w.zones[i]!.r + w.zones[j]!.r + 4);
      }
    }
  });

  it('after a minute of random driving the car is on the land and has gone somewhere; never in the sea or a hill', () => {
    for (const seed of [1, 2]) {
      const w = makeWorld(seed, map.propCount ?? 150, 'free', map, 'car', VEHICLES);
      let s = seed;
      const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
      let input = GO, travelled = 0, bad = 0;
      let px = w.cars[0]!.x, pz = w.cars[0]!.z;
      run(w, 60, (world, i) => {
        const kid = world.cars[0]!;
        if (i % 45 === 0) input = { go: next() < 0.85, brake: next() < 0.05, steer: next() * 2 - 1 };
        travelled += Math.hypot(kid.x - px, kid.z - pz);
        px = kid.x;
        pz = kid.z;
        if (!allowed(world, kid.x, kid.z) || inHill(world, kid.x, kid.z)) bad++;
        return input;
      });
      expect(bad, `seed ${seed}`).toBe(0);
      expect(travelled, `seed ${seed}`).toBeGreaterThan(200);
    }
  }, 60_000);

  it('traffic stays on its roads, and "follows the road" stays close to them', () => {
    const w = makeWorld(3, 0, 'road', map, 'car', VEHICLES);
    let traffic = 0, kid = 0;
    run(w, 90, (world) => {
      for (const c of world.cars.slice(1)) traffic = Math.max(traffic, nearestRoad(world.roads, c.x, c.z)!.dist);
      kid = Math.max(kid, nearestRoad(world.roads, world.cars[0]!.x, world.cars[0]!.z)!.dist);
      return GO;
    });
    expect(traffic).toBeLessThan(map.roads[0]!.width / 2 + 0.6);
    expect(kid).toBeLessThan(map.roads[0]!.width / 2 + 4);
  }, 60_000);
});
