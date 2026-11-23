// A helicopter pad (ADR 0048): the helicopter takes off as the kid comes, lands when the kid has gone, and is never
// in a car's way.
import { describe, expect, it } from 'vitest';
import { ISLAND } from '../maps/island';
import { RING } from '../maps/ring';
import { VEHICLES } from '../settings';
import { CLEAR_HEIGHT, HELIPAD, chopper, stepChopper } from './helipad';
import type { MapDef } from './map';
import { VEHICLE_FEEL, makeWorld, step, type Input } from './sim';

const DT = 1 / 60;
const IDLE: Input = { go: false, brake: false, steer: 0 };

/** The ring with a pad at its middle, 38 m from the road all round: out of reach from the road, so it stays down. */
const PADDED: MapDef = { ...RING, id: 'helipad-test', traffic: [], zones: [{ kind: 'helipad', on: { x: 0, z: 0 }, r: 7 }] };

describe('a helicopter pad (ADR 0048)', () => {
  it('stands on its pad with its rotor idling while the kid is far away', () => {
    const c = chopper(0, 0);
    for (let i = 0; i < 600; i++) stepChopper(c, HELIPAD.far + 20, DT);
    expect(c).toMatchObject({ height: 0, rotor: HELIPAD.idle, flying: false, heading: 0 });
  });

  it('spins up, lifts off and hovers when the kid comes near; lands and slows when the kid has gone', () => {
    const c = chopper(0, 0);
    stepChopper(c, HELIPAD.near - 1, DT);
    expect(c.flying).toBe(true);
    // The rotor first: it doesn't leave the ground until the rotor is fast.
    expect(c.height).toBe(0);
    for (let i = 0; i < 600; i++) stepChopper(c, HELIPAD.near - 1, DT);
    expect(c.height).toBe(HELIPAD.hover);
    expect(c.rotor).toBe(1);
    expect(c.heading).not.toBe(0);
    // Between near and far it stays up.
    for (let i = 0; i < 600; i++) stepChopper(c, (HELIPAD.near + HELIPAD.far) / 2, DT);
    expect(c.height).toBe(HELIPAD.hover);
    // Gone: down it comes, and only then does the rotor slow.
    stepChopper(c, HELIPAD.far + 1, DT);
    expect(c.flying).toBe(false);
    expect(c.rotor).toBe(1);
    for (let i = 0; i < 1200; i++) stepChopper(c, HELIPAD.far + 1, DT);
    expect(c.height).toBe(0);
    expect(c.rotor).toBeCloseTo(HELIPAD.idle);
  });

  it('is above every vehicle before the fastest one can reach the pad, even coming back as it lands', () => {
    const fastest = Math.max(...VEHICLES.map((k) => VEHICLE_FEEL[k].top));
    // Straight at the pad's middle at top speed, from far away.
    const c = chopper(0, 0);
    let dist = HELIPAD.far + 30;
    const approach = () => {
      while (dist > 4) {
        dist -= fastest * DT;
        stepChopper(c, dist, DT);
      }
    };
    approach();
    expect(c.height).toBeGreaterThanOrEqual(CLEAR_HEIGHT);
    // Away until it starts down, then straight back.
    while (c.flying) {
      dist += fastest * DT;
      stepChopper(c, dist, DT);
    }
    approach();
    expect(c.height).toBeGreaterThanOrEqual(CLEAR_HEIGHT);
  });

  it('in the world: a pad has a helicopter, trees and toys keep off it, and only the kid sets it off', () => {
    const w = makeWorld(7, 150, 'free', PADDED);
    expect(w.choppers).toHaveLength(1);
    const pad = w.zones[w.choppers[0]!.zone]!;
    for (const t of w.trees) expect(Math.hypot(t.x - pad.x, t.z - pad.z)).toBeGreaterThan(pad.r);
    for (const p of w.props) expect(Math.hypot(p.homeX - pad.x, p.homeZ - pad.z)).toBeGreaterThan(pad.r);
    // On the road, 38 m away: inside `near`, so it goes up.
    for (let i = 0; i < 300; i++) step(w, IDLE, DT);
    expect(w.choppers[0]!.height).toBe(HELIPAD.hover);
    // With the kid's car between near and far, traffic going round on the road (38 m from the pad) doesn't lift it.
    const far = makeWorld(7, 0, 'free', { ...PADDED, traffic: RING.traffic });
    expect(far.cars.length).toBeGreaterThan(1);
    for (let i = 0; i < 300; i++) {
      Object.assign(far.cars[0]!, { x: pad.x, z: pad.z + (HELIPAD.near + HELIPAD.far) / 2, speed: 0 });
      step(far, IDLE, DT);
    }
    expect(far.choppers[0]!).toMatchObject({ height: 0, flying: false });
  });

  it('the island has one, clear of its roads', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    expect(w.choppers).toHaveLength(1);
    const pad = w.zones[w.choppers[0]!.zone]!;
    expect(pad.kind).toBe('helipad');
    expect(pad.road).toBeUndefined();
  });
});
