// Traffic lights (ADR 0042): for show. They cycle; the kid's own way turns green as the kid's car comes near, and
// nothing about them ever slows the kid's car. Traffic waits at red (in a queue, not in a heap) and goes on green.
import { describe, expect, it } from 'vitest';
import { RING, acrossRing } from '../maps/ring';
import { HURRY, LIGHTS_NEAR, LIGHT_PHASES, lampFor, stepLight, wayAt, wayOf, type Light } from './lights';
import type { MapDef } from './map';
import { pointAt } from './roads';
import { VEHICLE_SIZE, makeWorld, step, type Input, type World } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const STOP: Input = { go: false, brake: true, steer: 0 };
const at = (angle: number, offset = 0) => ({ road: 0, at: angle / (Math.PI * 2), offset });

/** The ring with a road straight across it, joining it at 1.1 rad and opposite, and traffic lights at 1.1. */
const ACROSS = { kind: 'street' as const, width: 9, closed: false, from: 0, to: 0, points: acrossRing(1.1, 38, -38) };
const LIT: MapDef = { ...RING, id: 'lights-test', roads: [...RING.roads, ACROSS], zones: [{ kind: 'lights', on: at(1.1), r: 5 }], water: { pools: [], puddles: [] } };
const UNLIT: MapDef = { ...LIT, id: 'unlit-test', zones: [] };

function run(w: World, seconds: number, input: Input, each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, input, DT);
    each?.(w);
  }
}
const zoneOf = (w: World) => w.zones.find((z) => z.kind === 'lights')!;
const dist = (w: World, i: number) => Math.hypot(w.cars[i]!.x - zoneOf(w).x, w.cars[i]!.z - zoneOf(w).z);
/** The lamp the kid's car's way shows now. */
const kidLamp = (w: World) => lampFor(w.lights[0]!.phase, wayAt(w.lights[0]!, w.roads, w.cars[0]!.x, w.cars[0]!.z, w.cars[0]!.heading));

describe('traffic lights (ADR 0042)', () => {
  it('cycle on their own: green, amber and red each way in turn, twenty seconds round', () => {
    const light: Light = { zone: 0, phase: 0, t: 0, heading: 0, road: 0 };
    const seen: number[] = [0];
    for (let i = 0; i < 20.5 * 60; i++) if (stepLight(light, DT, null)) seen.push(light.phase);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 0]);
    expect(LIGHT_PHASES.reduce((a, b) => a + b, 0)).toBe(20);
    expect([0, 1, 2, 3, 4, 5].map((p) => lampFor(p, 'main'))).toEqual(['green', 'amber', 'red', 'red', 'red', 'red']);
    expect([0, 1, 2, 3, 4, 5].map((p) => lampFor(p, 'cross'))).toEqual(['red', 'red', 'red', 'green', 'amber', 'red']);
  });

  it('turn green quickly for a way that is wanted, and hold it green', () => {
    const light: Light = { zone: 0, phase: 0, t: 0, heading: 0, road: 0 };
    let t = 0;
    while (lampFor(light.phase, 'cross') !== 'green') {
      stepLight(light, DT, 'cross');
      t += DT;
    }
    expect(t).toBeLessThanOrEqual(HURRY.amber + HURRY.red + 0.05);
    for (let i = 0; i < 60 * 60; i++) stepLight(light, DT, 'cross');
    expect(lampFor(light.phase, 'cross')).toBe('green');
  });

  it('never slow the kid\'s car: it drives exactly as it would with no lights there', () => {
    const drive = (map: MapDef) => {
      const w = makeWorld(7, 0, 'road', map);
      w.cars = w.cars.slice(0, 1);
      const track: number[] = [];
      let redFar = false, entries = 0, greenIn = 0, was = false;
      run(w, 60, GO, (world) => {
        track.push(world.cars[0]!.x, world.cars[0]!.z, world.cars[0]!.speed);
        if (!world.lights.length) return;
        if (dist(world, 0) > LIGHTS_NEAR + 5 && kidLamp(world) === 'red') redFar = true;
        const inside = dist(world, 0) < zoneOf(world).r;
        if (inside && !was) {
          entries++;
          if (kidLamp(world) === 'green') greenIn++;
        }
        was = inside;
      });
      return { track, redFar, entries, greenIn };
    };
    const lit = drive(LIT), unlit = drive(UNLIT);
    expect(lit.track).toEqual(unlit.track);
    // It came through several times; the lights were red its way while it was far off, and green each time it came in.
    expect(lit.redFar).toBe(true);
    expect(lit.entries).toBeGreaterThan(2);
    expect(lit.greenIn).toBe(lit.entries);
  });

  it('turn the kid\'s way green as it comes, with a change the sounds hear', () => {
    const w = makeWorld(7, 0, 'road', LIT);
    w.cars = w.cars.slice(0, 1);
    w.lights[0]!.phase = 3; // the joining road's green: red along the ring
    // Coming along the ring at full speed, from just inside the distance the lights notice it at.
    const p = pointAt(w.roads[0]!, ((1.1 - LIGHTS_NEAR / 38) / (Math.PI * 2)) * w.roads[0]!.length);
    Object.assign(w.cars[0]!, { x: p.x, z: p.z, heading: p.heading, speed: 17 });
    let greenEvent = false, lampOnArrival = '';
    run(w, 4, GO, (world) => {
      greenEvent ||= world.lightChanges.some((c) => c.green);
      if (!lampOnArrival && dist(world, 0) < zoneOf(world).r + 10) lampOnArrival = kidLamp(world);
    });
    expect(greenEvent).toBe(true);
    expect(lampOnArrival).toBe('green');
  });

  it('traffic waits at red, short of the junction, then goes on green', () => {
    const w = makeWorld(7, 0, 'free', { ...LIT, traffic: [{ kind: 'police', on: at(0.3, 2.2), cruise: 9.5 }] });
    Object.assign(w.cars[0]!, { x: 0, z: 0 }); // the kid parked inside the ring, far from the lights
    const police = w.cars[1]!;
    let waited = 0, closestWaiting = 99, ranRed = 0, laps = 0, prev = police.s;
    run(w, 120, STOP, (world) => {
      const zone = zoneOf(world);
      const toward = (zone.x - police.x) * Math.sin(police.heading) + (zone.z - police.z) * Math.cos(police.heading) > 0;
      const lamp = lampFor(world.lights[0]!.phase, wayOf(world.lights[0]!.heading, police.heading));
      if (toward && police.speed < 0.3 && dist(world, 1) < 20) {
        waited++;
        closestWaiting = Math.min(closestWaiting, dist(world, 1));
      }
      // Driving into the junction on red (not one already at its edge when it changed).
      if (toward && lamp === 'red' && dist(world, 1) < zone.r && police.speed > 3) ranRed++;
      if (police.road === 0 && police.s < prev - 100) laps++;
      prev = police.s;
    });
    expect(waited).toBeGreaterThan(60);
    expect(closestWaiting).toBeGreaterThan(zoneOf(w).r);
    expect(ranRed).toBe(0);
    expect(laps + Number(police.road !== 0)).toBeGreaterThan(0); // and it went on round
  });

  it('a second car waits behind the first, not inside it', () => {
    const w = makeWorld(7, 0, 'free', {
      ...LIT, traffic: [{ kind: 'bus', on: at(0.5, 2.2), cruise: 9 }, { kind: 'police', on: at(0.2, 2.2), cruise: 9 }],
    });
    Object.assign(w.cars[0]!, { x: 0, z: 0 });
    let closest = 99;
    run(w, 90, STOP, (world) => {
      const [, a, b] = world.cars;
      const atLights = dist(world, 1) < 25 && dist(world, 2) < 25;
      if (atLights && a!.road === b!.road && Math.cos(a!.heading - b!.heading) > 0.7) closest = Math.min(closest, Math.hypot(a!.x - b!.x, a!.z - b!.z));
    });
    expect(closest).toBeGreaterThan(VEHICLE_SIZE.bus.half + VEHICLE_SIZE.police.half);
  });

  it('the kid\'s car slides past a pole it drives at, and is never stuck on it', () => {
    const w = makeWorld(7, 0, 'free', LIT);
    w.cars = w.cars.slice(0, 1);
    const kid = w.cars[0]!, post = w.posts[0]!;
    expect(w.posts).toHaveLength(3);
    // Ten metres off, aimed straight at the pole.
    const a = Math.atan2(post.x - 0, post.z - 0);
    Object.assign(kid, { x: post.x - Math.sin(a) * 10, z: post.z - Math.cos(a) * 10, heading: a, speed: 8 });
    let closest = 99;
    run(w, 3, GO, () => (closest = Math.min(closest, Math.hypot(kid.x - post.x, kid.z - post.z))));
    expect(closest).toBeGreaterThan(VEHICLE_SIZE.car.side);
    expect(Math.hypot(kid.x - post.x, kid.z - post.z)).toBeGreaterThan(8); // went on past it
  });
});
