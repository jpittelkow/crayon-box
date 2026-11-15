import { describe, expect, it } from 'vitest';
import { soundUrl } from '../../shell/soundFiles';
import { MAX_SPEED, makeWorld, step, type VehicleKind } from './sim/sim';
import { VEHICLES } from './settings';
import { EFFECTS, ENGINES, engineLoudness } from './sound';

describe('engine sounds (ADR 0025, 0032)', () => {
  it('every kind of vehicle has an engine; the first four have loops of their own (the rest are stand-ins, ADR 0035)', () => {
    const kinds = Object.keys(ENGINES) as VehicleKind[];
    expect(kinds.sort()).toEqual([...VEHICLES].sort());
    const own: VehicleKind[] = ['car', 'police', 'monster', 'bus'];
    expect(new Set(own.map((k) => ENGINES[k].file)).size).toBe(own.length);
    for (const k of kinds) expect(soundUrl(ENGINES[k].file), k).toBeTruthy();
    // The big vehicles sound lower than the small ones, at every speed.
    for (const speed of [0, MAX_SPEED / 2, MAX_SPEED]) {
      const rate = (k: VehicleKind) => ENGINES[k].idleRate + ENGINES[k].perSpeed * speed;
      expect(rate('monster')).toBeLessThan(rate('car'));
      expect(rate('bus')).toBeLessThan(rate('car'));
    }
  });

  it('every effect has a file', () => {
    for (const [name, path] of Object.entries(EFFECTS)) expect(soundUrl(path), name).toBeTruthy();
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
