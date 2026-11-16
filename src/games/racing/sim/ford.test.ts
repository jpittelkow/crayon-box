// A ford (ADR 0042): a shallow stream crossing a road. The stream is shallow water all along, on the land only; at
// the ford every vehicle slows to a splashy wade, throws a bow wave going in, gets wet and comes out clean of mud.
import { describe, expect, it } from 'vitest';
import { RING, acrossRing } from '../maps/ring';
import { FORD_SPEED } from './ford';
import { onLand } from './land';
import type { MapDef } from './map';
import { pointAt } from './roads';
import { makeWorld, step, waterAt, type Input, type World } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const STOP: Input = { go: false, brake: true, steer: 0 };
const at = (angle: number, offset = 0) => ({ road: 0, at: angle / (Math.PI * 2), offset });

/** The ring with a stream across the road at 1.1 rad, from inside the ring out past the shore, and its ford. */
const FORDED: MapDef = {
  ...RING, id: 'ford-test',
  zones: [{ kind: 'ford', on: at(1.1), r: 6 }],
  water: { pools: [], puddles: [], streams: [{ points: acrossRing(1.1, 20, 70), width: 6 }] },
};

function run(w: World, seconds: number, input: Input, each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, input, DT);
    each?.(w);
  }
}
const ford = (w: World) => w.zones.find((z) => z.kind === 'ford')!;
const near = (w: World, i: number, pad: number) => Math.hypot(w.cars[i]!.x - ford(w).x, w.cars[i]!.z - ford(w).z) < ford(w).r + pad;

describe('a ford (ADR 0042)', () => {
  it('the stream is shallow water all along its path, and only on the land', () => {
    const w = makeWorld(7, 0, 'free', FORDED);
    const stream = w.waters.filter((p) => p.stream);
    expect(stream.length).toBeGreaterThan(10);
    for (const p of stream) expect(onLand(w.land, p.x, p.z)).toBe(true);
    for (let s = 0; s < w.streams[0]!.length; s += 0.5) {
      const p = pointAt(w.streams[0]!, s);
      if (onLand(w.land, p.x, p.z)) expect(waterAt(w, p.x, p.z), `${s} m along`).toBe(1);
    }
  });

  it('the kid\'s car splashes in, slows to a wade, gets wet, and comes out clean of mud and back up to speed', () => {
    const w = makeWorld(7, 0, 'road', FORDED);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!;
    const p = pointAt(w.roads[0]!, ((1.1 - 25 / 38) / (Math.PI * 2)) * w.roads[0]!.length);
    Object.assign(kid, { x: p.x, z: p.z, heading: p.heading, speed: 17, mud: 1 });
    let splashes = 0, drops = 0, wet = false, inFor = 0, fastestInside = 0, slowest = 99;
    run(w, 4, GO, (world) => {
      splashes += world.splashes.length;
      drops = Math.max(drops, world.drops.filter((d) => d.life > 0).length);
      wet ||= kid.wet === 1;
      inFor = near(world, 0, 0) ? inFor + DT : 0;
      if (inFor > 0.4) fastestInside = Math.max(fastestInside, kid.speed);
      if (near(world, 0, 0)) slowest = Math.min(slowest, kid.speed);
    });
    expect(splashes).toBeGreaterThanOrEqual(1);
    expect(drops).toBeGreaterThan(20); // a bow wave and spray, more than a puddle's
    expect(wet).toBe(true);
    expect(fastestInside).toBeLessThanOrEqual(FORD_SPEED + 0.01);
    expect(slowest).toBeGreaterThan(FORD_SPEED - 2); // a wade, never a stop
    expect(kid.mud).toBe(0);
    let after = 0;
    run(w, 2, GO, () => (after = Math.max(after, kid.speed)));
    expect(after).toBeGreaterThan(FORD_SPEED + 4);
  });

  it('traffic wades through the ford slowly and splashes, and keeps going', () => {
    const w = makeWorld(7, 0, 'free', { ...FORDED, traffic: [{ kind: 'police', on: at(0.2, 2.2), cruise: 9.5 }] });
    Object.assign(w.cars[0]!, { x: 0, z: 0 }); // the kid parked off the road, inside the ring
    const police = w.cars[1]!;
    let fastestInMiddle = 0, drops = 0, crossed = 0, was = false;
    run(w, 40, STOP, (world) => {
      const inside = near(world, 1, -3);
      if (inside) fastestInMiddle = Math.max(fastestInMiddle, police.speed);
      if (near(world, 1, 0)) drops = Math.max(drops, world.drops.filter((d) => d.life > 0).length);
      if (was && !inside) crossed++;
      was = inside;
    });
    expect(crossed).toBeGreaterThanOrEqual(1);
    expect(fastestInMiddle).toBeGreaterThan(0);
    expect(fastestInMiddle).toBeLessThanOrEqual(FORD_SPEED + 0.5);
    expect(drops).toBeGreaterThan(5);
  });

  it('a car anywhere in the stream is never stuck: it drives out', () => {
    const w = makeWorld(7, 0, 'free', FORDED);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!;
    // In the stream inside the ring, facing along it toward the road, standing still.
    const s = w.streams[0]!, p = pointAt(s, 4);
    Object.assign(kid, { x: p.x, z: p.z, heading: p.heading, speed: 0 });
    run(w, 3, GO);
    expect(Math.hypot(kid.x - p.x, kid.z - p.z)).toBeGreaterThan(15);
  });
});
