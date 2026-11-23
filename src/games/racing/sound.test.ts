import { describe, expect, it } from 'vitest';
import { soundUrl } from '../../shell/soundFiles';
import { ISLAND } from './maps/island';
import { MAX_SPEED, makeWorld, step, type VehicleKind } from './sim/sim';
import { VEHICLES } from './settings';
import { EFFECTS, ENGINES, engineLoudness, fountainLoudness, rotorLoudness, wavesLoudness } from './sound';

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

describe('set pieces heard nearby (ADR 0042)', () => {
  it('a roundabout\'s fountain and a harbour\'s waves are louder nearer, and silent far off', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const kid = w.cars[0]!;
    const at = (kind: string, away: number) => {
      const zone = w.zones.find((z) => z.kind === kind)!;
      Object.assign(kid, { x: zone.x + away, z: zone.z });
    };
    at('roundabout', 0);
    const fountainNear = fountainLoudness(w);
    at('roundabout', 25);
    const fountainFar = fountainLoudness(w);
    expect(fountainNear).toBeGreaterThan(fountainFar);
    expect(fountainFar).toBeGreaterThan(0);
    at('roundabout', 80);
    expect(fountainLoudness(w)).toBe(0);
    at('harbour', 0);
    const wavesNear = wavesLoudness(w);
    at('harbour', 40);
    expect(wavesNear).toBeGreaterThan(wavesLoudness(w));
    at('harbour', 120);
    expect(wavesLoudness(w)).toBe(0);
  });

  it('a helicopter is heard a little on its pad, more as its rotor speeds up, and not from far off (ADR 0048)', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const kid = w.cars[0]!, heli = w.choppers[0]!, pad = w.zones[heli.zone]!;
    Object.assign(kid, { x: pad.x + 20, z: pad.z });
    const idling = rotorLoudness(w);
    expect(idling).toBeGreaterThan(0);
    heli.rotor = 1;
    expect(rotorLoudness(w)).toBeGreaterThan(idling * 5);
    Object.assign(kid, { x: pad.x + 120, z: pad.z });
    expect(rotorLoudness(w)).toBe(0);
  });
});
