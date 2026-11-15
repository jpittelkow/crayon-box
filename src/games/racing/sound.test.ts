import { describe, expect, it } from 'vitest';
import { makeWorld, step, type VehicleKind } from './sim/sim';
import { ENGINES, engineLoudness } from './sound';

describe('engine sounds (ADR 0025)', () => {
  it('every kind of vehicle has an engine voice of its own', () => {
    const kinds = Object.keys(ENGINES) as VehicleKind[];
    expect(kinds.sort()).toEqual(['bus', 'car', 'monster', 'police']);
    const voices = new Set(kinds.map((k) => JSON.stringify(ENGINES[k])));
    expect(voices.size).toBe(kinds.length);
    // The big vehicles sound lower than the small ones.
    expect(ENGINES.monster.idleHz).toBeLessThan(ENGINES.car.idleHz);
    expect(ENGINES.bus.idleHz).toBeLessThan(ENGINES.car.idleHz);
  });

  it("the kid's car is always heard and louder when going fast; traffic fades with distance", () => {
    const w = makeWorld(7, 0);
    const idle = engineLoudness(w, 0);
    expect(idle).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) step(w, { go: true, brake: false, steer: 0 }, 1 / 60);
    expect(engineLoudness(w, 0)).toBeGreaterThan(idle);

    const other = w.cars[2];
    const kid = w.cars[0];
    other.x = kid.x + 5;
    other.z = kid.z;
    const near = engineLoudness(w, 2);
    other.x = kid.x + 20;
    const far = engineLoudness(w, 2);
    other.x = kid.x + 60;
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(engineLoudness(w, 2)).toBe(0);
  });
});
