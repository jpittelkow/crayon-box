// Mud (ADR 0042): a patch of mud slows every vehicle to a squelchy crawl and covers it in mud, flicking bits up off
// the wheels; the car stays muddy until a car wash or clean water washes it; muddy water makes it a little muddy.
import { describe, expect, it } from 'vitest';
import { RING } from '../maps/ring';
import type { MapDef } from './map';
import { MUD_SPEED, MUD_WATER } from './mud';
import { pointAt } from './roads';
import { VEHICLE_FEEL, makeWorld, step, type Input, type VehicleKind, type World } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const STOP: Input = { go: false, brake: true, steer: 0 };
const at = (angle: number, offset = 0) => ({ road: 0, at: angle / (Math.PI * 2), offset });

/** The ring with a patch of mud at 1.1 rad, its car wash at 5.2 and no puddles or flood to wash the mud off. */
const MUDDY: MapDef = {
  ...RING, id: 'mud-test',
  zones: [{ kind: 'mud', on: at(1.1), r: 6 }, { kind: 'car-wash', on: at(5.2), r: 4 }],
  water: { pools: [], puddles: [] },
};

function run(w: World, seconds: number, input: Input, each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, input, DT);
    each?.(w);
  }
}

/** The kid's car on the ring `angle` round, facing along the road, at `speed`. */
function kidAt(w: World, angle: number, speed: number): void {
  const p = pointAt(w.roads[0]!, (angle / (Math.PI * 2)) * w.roads[0]!.length);
  Object.assign(w.cars[0]!, { x: p.x, z: p.z, heading: p.heading, speed });
  w.camHeading = p.heading;
  w.follow = null; // "follows the road" picks the road up afresh, the way the car now faces
}
const mudZone = (w: World) => w.zones.find((z) => z.kind === 'mud')!;
const inside = (w: World, i = 0, pad = 0) => Math.hypot(w.cars[i]!.x - mudZone(w).x, w.cars[i]!.z - mudZone(w).z) < mudZone(w).r + pad;

/** Drives a kid's vehicle through the mud at full speed ("follows the road"): its fastest well inside, and more. */
function throughTheMud(kind: VehicleKind) {
  const w = makeWorld(7, 0, 'road', MUDDY, kind);
  w.cars = w.cars.slice(0, 1);
  kidAt(w, 1.1 - 25 / 38, 17);
  let fastestInside = 0, inFor = 0, mudBits = 0, after = 0;
  run(w, 4, GO, (world) => {
    inFor = inside(world) ? inFor + DT : 0;
    if (inFor > 0.4) fastestInside = Math.max(fastestInside, world.cars[0]!.speed);
    mudBits = Math.max(mudBits, world.muds.filter((m) => m.life > 0).length);
  });
  const muddy = w.cars[0]!.mud;
  run(w, 3, GO, (world) => (after = Math.max(after, world.cars[0]!.speed)));
  return { fastestInside, mudBits, muddy, after, w };
}

describe('mud (ADR 0042)', () => {
  it('slows the kid\'s car to a crawl inside, flicks mud up off the wheels, and it comes out covered', () => {
    const { fastestInside, mudBits, muddy, after } = throughTheMud('car');
    expect(fastestInside).toBeGreaterThan(MUD_SPEED - 1.5); // never stuck: it keeps going through
    expect(fastestInside).toBeLessThanOrEqual(MUD_SPEED + 0.01);
    expect(mudBits).toBeGreaterThan(5);
    expect(muddy).toBe(1);
    expect(after).toBeGreaterThan(MUD_SPEED + 5); // back up to speed once out
  });

  it('a vehicle that wades well (ADR 0035) goes through mud faster', () => {
    const monster = throughTheMud('monster');
    expect(VEHICLE_FEEL.monster.wade).toBeGreaterThan(0);
    expect(monster.fastestInside).toBeGreaterThan(MUD_SPEED + 1);
    expect(monster.fastestInside).toBeLessThanOrEqual(MUD_SPEED + VEHICLE_FEEL.monster.wade + 0.01);
  });

  it('stays muddy until it is washed: time doesn\'t wash it, the car wash does', () => {
    const { w } = throughTheMud('car');
    const kid = w.cars[0]!;
    // Parked well away from everything for half a minute: still covered.
    Object.assign(kid, { x: 0, z: 0, speed: 0 });
    run(w, 30, STOP);
    expect(kid.mud).toBe(1);
    // Through the car wash: clean.
    kidAt(w, 5.2 - 15 / 38, 10);
    let washedAt = -1;
    run(w, 6, GO, (world) => {
      if (washedAt < 0 && world.cars[0]!.mud === 0) washedAt = world.time;
    });
    expect(kid.mud).toBe(0);
    expect(washedAt).toBeGreaterThan(0);
  });

  it('clean water washes mud off; muddy water makes a clean car a little muddy, never a covered one cleaner', () => {
    const pool = (mud: boolean): MapDef => ({ ...MUDDY, water: { pools: [{ on: at(3.6), r: 5, deep: false, mud }], puddles: [] } });
    const parkIn = (mud: boolean, start: number) => {
      const w = makeWorld(7, 0, 'free', pool(mud));
      w.cars = w.cars.slice(0, 1);
      kidAt(w, 3.6, 0);
      w.cars[0]!.mud = start;
      run(w, 3, STOP);
      return w.cars[0]!.mud;
    };
    expect(parkIn(false, 1)).toBe(0);
    expect(parkIn(true, 0)).toBeCloseTo(MUD_WATER, 5);
    expect(parkIn(true, 1)).toBe(1);
  });

  it('traffic slows through the mud too, comes out muddy, and keeps going', () => {
    const w = makeWorld(7, 0, 'free', { ...MUDDY, traffic: [{ kind: 'police', on: at(0.2, 2.2), cruise: 9.5 }] });
    Object.assign(w.cars[0]!, { x: 0, z: 0 }); // the kid parked off the road
    const police = w.cars[1]!;
    let fastestInMiddle = 0, muddy = 0;
    run(w, 25, STOP, (world) => {
      if (inside(world, 1, -mudZone(world).r * 0.6)) fastestInMiddle = Math.max(fastestInMiddle, police.speed);
      muddy = Math.max(muddy, police.mud);
    });
    expect(fastestInMiddle).toBeGreaterThan(0);
    expect(fastestInMiddle).toBeLessThanOrEqual(MUD_SPEED + 0.5);
    expect(muddy).toBe(1);
    expect(police.speed).toBeGreaterThan(MUD_SPEED); // back to its own pace after
  });
});
