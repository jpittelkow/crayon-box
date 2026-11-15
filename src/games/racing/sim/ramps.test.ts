import { describe, expect, it } from 'vitest';
import { RING } from '../maps/ring';
import type { MapDef } from './map';
import { RAMP, rampHeight } from './ramps';
import { makeWorld as makeOn, step, type World, type Assist } from './sim';

/** Worlds on the ring map unless a test says otherwise (the game itself drives the island of layout A). */
const makeWorld = (seed: number, props: number, assist: Assist = 'free', map: MapDef = RING) => makeOn(seed, props, assist, map);

/** The island with one ramp on open ground, facing along +x, and no traffic in the way. */
const RAMPED: MapDef = { ...RING, id: 'ramp-test', traffic: [], zones: [{ kind: 'ramp', on: { x: 0, z: 0, heading: Math.PI / 2 }, r: 3.5 }] };

/** Drives the kid's car straight at the ramp from 15 m away at `speed`, holding that speed; watches the hop. */
function overTheRamp(speed: number, from = -1) {
  const w: World = makeWorld(7, 0, 'free', RAMPED);
  w.trees.length = 0; // nothing to slide off on the way
  const car = w.cars[0];
  Object.assign(car, { x: 15 * from, z: 0, heading: from < 0 ? Math.PI / 2 : -Math.PI / 2, speed });
  let top = 0, landings = 0, heading = car.heading;
  for (let i = 0; i < 3 * 60; i++) {
    step(w, { go: true, brake: false, steer: 0 }, 1 / 60);
    car.speed = speed;
    top = Math.max(top, car.h);
    landings += w.landings.filter((v) => v === 0).length;
    heading = car.heading;
  }
  return { top, landings, heading, h: car.h, x: car.x };
}

describe('ramps (milestone-3 B3)', () => {
  it('is a hump across the road, highest in the middle, the same both ways', () => {
    const zone = { kind: 'ramp' as const, x: 0, z: 0, r: 3.5, heading: Math.PI / 2 };
    expect(rampHeight(zone, 0, 0)).toBeCloseTo(RAMP.height, 5);
    expect(rampHeight(zone, -1.5, 0)).toBeCloseTo(rampHeight(zone, 1.5, 0), 5);
    expect(rampHeight(zone, 3.5, 0)).toBe(0);
    expect(rampHeight(zone, 0, RAMP.width / 2 + 0.1)).toBe(0);
  });

  it('a fast car leaves the ground past the top, flies a little, and lands once, still facing the same way', () => {
    const fast = overTheRamp(15);
    expect(fast.top).toBeGreaterThan(RAMP.height + 0.3);
    expect(fast.landings).toBe(1);
    expect(fast.h).toBe(0);
    expect(fast.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(fast.x).toBeGreaterThan(20); // and kept going
  });

  it('a slow car rolls over it without a hop', () => {
    const slow = overTheRamp(2.5);
    expect(slow.top).toBeLessThan(RAMP.height + 0.1);
    expect(slow.landings).toBe(0);
    expect(slow.h).toBe(0);
  });

  it('works from the other side too', () => {
    const back = overTheRamp(15, 1);
    expect(back.top).toBeGreaterThan(RAMP.height + 0.3);
    expect(back.landings).toBe(1);
  });

  it('keeps toys off the ramp', () => {
    const w = makeWorld(7, 400, 'free', RAMPED);
    expect(w.props.every((p) => Math.hypot(p.homeX, p.homeZ) > 4.5)).toBe(true);
  });
});
