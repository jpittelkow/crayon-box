import { describe, expect, it } from 'vitest';
import { RING } from '../maps/ring';
import type { MapDef } from './map';
import { RINSE, WASH_SPEED, makeWorld as makeOn, step, type Input, type World, type Assist } from './sim';

/** Worlds on the ring map unless a test says otherwise (the game itself drives the island of layout A). */
const makeWorld = (seed: number, props: number, assist: Assist = 'free', map: MapDef = RING) => makeOn(seed, props, assist, map);

/** The island with only a car wash, 10 % of the way round the ring road. */
const WASHED: MapDef = { ...RING, id: 'wash-test', zones: [{ kind: 'car-wash', on: { road: 0, at: 0.1 }, r: 4 }] };
const GO: Input = { go: true, brake: false, steer: 0 };

function run(w: World, seconds: number, each: (w: World) => void = () => {}): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, GO, 1 / 60);
    each(w);
  }
}

describe('car wash (milestone-3 B3)', () => {
  it('slows the kid to a crawl inside, soaps the car up, then it rinses off', () => {
    const w = makeWorld(7, 0, 'road', WASHED);
    const kid = w.cars[0];
    let fastestInside = 0, soapiest = 0, bubbles = 0, inside = false;
    run(w, 5, (world) => {
      inside = world.zone === 0;
      if (inside && kid.soap > 0.5) fastestInside = Math.max(fastestInside, kid.speed);
      soapiest = Math.max(soapiest, kid.soap);
      bubbles = Math.max(bubbles, world.bubbles.filter((b) => b.life > 0).length);
    });
    expect(fastestInside).toBeLessThanOrEqual(WASH_SPEED + 0.01);
    expect(soapiest).toBe(1);
    expect(bubbles).toBeGreaterThan(10);
    // Well out of it now: give it the rinse time and it is clean, with the last bubbles gone soon after.
    let after = 0;
    run(w, RINSE + 2.5, () => (after = Math.max(after, kid.speed)));
    expect(kid.soap).toBe(0);
    expect(w.bubbles.every((b) => b.life <= 0)).toBe(true);
    expect(after).toBeGreaterThan(WASH_SPEED + 5); // back up to speed
  });

  it('traffic goes through it slowly and comes out the other side', () => {
    const w = makeWorld(7, 0, 'free', WASHED);
    // Park the kid off the road so traffic keeps its own pace.
    Object.assign(w.cars[0], { x: 0, z: 0 });
    const bus = w.cars[1];
    const start = bus.s;
    let washed = false;
    for (let i = 0; i < 60 * 60; i++) {
      step(w, { go: false, brake: true, steer: 0 }, 1 / 60);
      washed ||= bus.soap === 1;
    }
    expect(washed).toBe(true);
    expect(bus.s).not.toBeCloseTo(start, 0);
  });
});
