import { describe, expect, it } from 'vitest';
import { OWN_COLOR } from './look/vehicles';
import { ISLAND } from './maps/island';
import { RING, ROAD_R } from './maps/ring';
import { VEHICLE_NAMES } from './names';
import { VEHICLES, shownVehicles } from './settings';
import { ENGINES } from './sound';
import type { MapDef } from './sim/map';
import { nearestOn } from './sim/roads';
import { VEHICLE_FEEL, VEHICLE_SIZE, makeWorld, step, type VehicleKind, type World } from './sim/sim';

const DT = 1 / 60;

describe('fourteen vehicles (milestone-3 D, ADR 0035)', () => {
  it('every vehicle has a size, a feel, a name, its own colour and an engine', () => {
    expect(VEHICLES).toHaveLength(14);
    for (const kind of VEHICLES) {
      expect(VEHICLE_SIZE[kind].half, kind).toBeGreaterThan(VEHICLE_SIZE[kind].side);
      expect(VEHICLE_FEEL[kind].top, kind).toBeGreaterThanOrEqual(12);
      expect(VEHICLE_NAMES[kind], kind).toBeTruthy();
      expect(OWN_COLOR[kind], kind).toBeTypeOf('number');
      expect(ENGINES[kind], kind).toBeDefined();
    }
  });

  it('a parent can switch vehicles off, but never the car', () => {
    expect(shownVehicles({ sounds: true, hidden: [] })).toEqual([...VEHICLES]);
    const shown = shownVehicles({ sounds: true, hidden: ['police', 'fire', 'car'] });
    expect(shown).not.toContain('police');
    expect(shown).not.toContain('fire');
    expect(shown[0]).toBe('car');
  });

  it('traffic comes from the vehicles switched on, each different, never the kid\'s own', () => {
    const pool: VehicleKind[] = ['car', 'digger', 'tractor', 'race', 'fire'];
    for (const seed of [1, 2, 3, 4]) {
      const w = makeWorld(seed, 0, 'free', RING, 'tractor', pool);
      const traffic = w.cars.slice(1).map((c) => c.kind);
      expect(traffic).not.toContain('tractor');
      expect(new Set(traffic).size).toBe(traffic.length);
      for (const k of traffic) expect(pool).toContain(k);
    }
  });

  it('a heavier vehicle knocks a toy further', () => {
    const flight = (kind: VehicleKind) => {
      const w = makeWorld(7, 150, 'free', RING, kind);
      w.cars.length = 1;
      const prop = w.props.find((p) => Math.abs(Math.hypot(p.homeX, p.homeZ) - ROAD_R) < 3)!;
      const car = w.cars[0]!;
      const a = Math.atan2(prop.homeX, prop.homeZ);
      Object.assign(car, { x: prop.homeX - Math.cos(a) * 6, z: prop.homeZ + Math.sin(a) * 6, speed: 10 });
      car.heading = Math.atan2(prop.homeX - car.x, prop.homeZ - car.z);
      let far = 0;
      for (let i = 0; i < 90; i++) {
        step(w, { go: true, brake: false, steer: 0 }, DT);
        car.speed = Math.min(car.speed, 10);
        far = Math.max(far, Math.hypot(prop.x - prop.homeX, prop.z - prop.homeZ));
      }
      return far;
    };
    expect(flight('digger')).toBeGreaterThan(flight('icecream'));
  });
});

describe('the garage (ADR 0035)', () => {
  /** The ring with a garage on the road just ahead of the start. */
  const GARAGED: MapDef = { ...RING, id: 'garage-test', traffic: [], zones: [{ kind: 'garage', on: { road: 0, at: 0.05 }, r: 4 }] };

  /** Drives the kid's car through the garage, round the ring, `laps` times; returns the vehicle after each pass. */
  function passes(w: World, laps: number): VehicleKind[] {
    const seen: VehicleKind[] = [];
    for (let i = 0; i < Math.round((laps * 20) / DT); i++) {
      const before = w.cars[0]!.kind;
      step(w, { go: true, brake: false, steer: 0 }, DT);
      if (w.cars[0]!.kind !== before) seen.push(w.cars[0]!.kind);
    }
    return seen;
  }

  it('hands out the next vehicle on the list each time the kid drives in, and wraps round', () => {
    const w = makeWorld(7, 0, 'road', GARAGED, 'car', ['car', 'fire', 'race']);
    // Faster vehicles lap sooner, so count only the first three passes.
    expect(passes(w, 3.2).slice(0, 3)).toEqual(['fire', 'race', 'car']);
  });

  it('with only one vehicle on, the car stays the car', () => {
    const w = makeWorld(7, 0, 'road', GARAGED, 'car', ['car']);
    expect(passes(w, 1.2)).toEqual([]);
  });

  it('is on the island, on the shortcut', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const garage = w.zones.find((z) => z.kind === 'garage')!;
    expect(garage).toBeDefined();
    expect(nearestOn(w.roads[1]!, 1, garage.x, garage.z).dist).toBeLessThan(0.5);
  });
});
