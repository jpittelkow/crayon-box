// A harbour (ADR 0042), on the island's bay by the bridge: a quay whose sea side holds the car like a bridge's rail,
// boats moored along it that bob, one that sails out to sea and comes back, and a ship's horn answering the kid's.
import { describe, expect, it } from 'vitest';
import { ISLAND } from '../maps/island';
import { guardAt } from './ground';
import { BERTH_GAP, HARBOUR_HEARS, SAIL, SHIP_HORN, tripAt } from './harbour';
import { onLand, shore } from './land';
import { nearestOn, nearestRoad, pointAt } from './roads';
import { honk, makeWorld, step, type Input, type World } from './sim';

const DT = 1 / 60;
const STOP: Input = { go: false, brake: true, steer: 0 };

function run(w: World, seconds: number, input: Input | ((w: World) => Input), each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, typeof input === 'function' ? input(w) : input, DT);
    each?.(w);
  }
}
const harbourOf = (w: World) => w.zones.find((z) => z.kind === 'harbour')!;
const quayOf = (w: World) => w.guards.find((g) => g.kind === 'quay')!;
/** On the land, or on the bridge: anywhere a car may be. */
const allowed = (w: World, x: number, z: number) => onLand(w.land, x, z) || guardAt(w.guards, w.roads, x, z)?.guard.kind === 'bridge';

describe('a harbour (ADR 0042)', () => {
  it('has a quay along the shore, guarded on its sea side only, and boats moored along it on the water', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const zone = harbourOf(w), quay = quayOf(w), road = w.roads[quay.road]!;
    expect(quay.road).toBe(zone.road);
    expect(quay.s1 - quay.s0).toBeCloseTo(zone.r * 2, 5);
    // The sea is on the guarded side all along the quay, a few metres past the road's edge; land on the other.
    for (let s = quay.s0 + 2; s < quay.s1 - 2; s += 2) {
      const sea = pointAt(road, s, quay.side! * (road.def.width / 2 + 3.5)), land = pointAt(road, s, -quay.side! * (road.def.width / 2 + 3.5));
      expect(onLand(w.land, sea.x, sea.z), `sea at ${s.toFixed(0)}`).toBe(false);
      expect(onLand(w.land, land.x, land.z), `land at ${s.toFixed(0)}`).toBe(true);
    }
    // The bay's boats moved into it: three moored along the quay, the last of them the one that sails.
    expect(w.boats).toHaveLength(3);
    expect(w.boats.map((b) => b.trip !== null)).toEqual([false, false, true]);
    expect(w.map.boats).toHaveLength(1);
    for (const b of w.boats) {
      expect(onLand(w.land, b.x, b.z)).toBe(false);
      // Alongside the quay: facing along the road, clear of its face, and a berth's length from the next.
      expect(shore(w.land, b.x, b.z).depth).toBeLessThan(-1.5);
      expect(Math.abs(Math.cos(b.heading - nearestOn(road, quay.road, b.x, b.z).heading))).toBeGreaterThan(0.99);
    }
    expect(Math.hypot(w.boats[0]!.x - w.boats[1]!.x, w.boats[0]!.z - w.boats[1]!.z)).toBeGreaterThan(BERTH_GAP - 1);
  });

  it('boats bob on the water, and the sailing one goes out to sea and comes back, never onto the land or a road', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    w.cars = w.cars.slice(0, 1);
    const sailor = w.boats[2]!, berth = { ...sailor.berth }, moored = w.boats[0]!;
    let low = 0, high = 0, furthest = 0, trips = 0, out = false, onLandOrRoad = 0, movedMoored = 0;
    // Two trips (the third starts at 12 s plus two of SAIL.every); the cars stay still.
    expect(sailor.trip!.length / SAIL.speed).toBeLessThan(SAIL.every - 12);
    run(w, 12 + SAIL.every * 2 - 4, STOP, (world) => {
      low = Math.min(low, moored.y);
      high = Math.max(high, moored.y);
      movedMoored = Math.max(movedMoored, Math.hypot(moored.x - moored.berth.x, moored.z - moored.berth.z));
      const d = Math.hypot(sailor.x - berth.x, sailor.z - berth.z);
      furthest = Math.max(furthest, d);
      if (d > 30) out = true;
      if (out && d < 0.5) {
        trips++;
        out = false;
      }
      const road = nearestRoad(world.roads, sailor.x, sailor.z)!;
      if (d > 3 && (onLand(world.land, sailor.x, sailor.z) || road.dist < world.roads[road.road]!.def.width / 2 + 2)) onLandOrRoad++;
    });
    expect(high - low).toBeGreaterThan(0.1);
    expect(high).toBeLessThan(0.1);
    expect(movedMoored).toBe(0);
    expect(furthest).toBeGreaterThan(50);
    expect(trips).toBe(2);
    expect(onLandOrRoad).toBe(0);
    // Home again it lies along the quay as it did.
    expect(Math.cos(sailor.heading - berth.heading)).toBeGreaterThan(0.99);
    expect(tripAt(sailor.trip!, 5)).toBeNull();
  }, 30_000);

  it('the quay keeps the car on it: steering hard for the sea, it never leaves the land', () => {
    for (const [steer, dir] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const w = makeWorld(7, 0, 'free', ISLAND);
      w.cars = w.cars.slice(0, 1);
      const quay = quayOf(w), road = w.roads[quay.road]!;
      // On the quay's middle, in the lane by the sea, heading along it either way, full lock for eight seconds.
      const p = pointAt(road, (quay.s0 + quay.s1) / 2, quay.side! * 2.2);
      Object.assign(w.cars[0]!, { x: p.x, z: p.z, heading: p.heading + (dir > 0 ? 0 : Math.PI), speed: 14 });
      let wet = 0;
      run(w, 8, { go: true, brake: false, steer }, (world) => {
        if (!allowed(world, world.cars[0]!.x, world.cars[0]!.z)) wet++;
      });
      expect(wet, `steer ${steer}, way ${dir}`).toBe(0);
    }
  });

  it('a car drifting toward the sea along the quay slides along its edge and comes off the far end', () => {
    for (const dir of [1, -1] as const) {
      const w = makeWorld(7, 0, 'free', ISLAND);
      w.cars = w.cars.slice(0, 1);
      const quay = quayOf(w), road = w.roads[quay.road]!;
      const from = dir > 0 ? quay.s0 - 6 : quay.s1 + 6;
      const p = pointAt(road, from);
      Object.assign(w.cars[0]!, { x: p.x, z: p.z, heading: p.heading + (dir > 0 ? 0 : Math.PI), speed: 12 });
      // Drifting toward the sea side: the sea is right of the road (side 1) or left; heading backward flips that.
      const steer = quay.side! * dir * 0.25;
      let edge = 0, wet = 0;
      run(w, 4.5, { go: true, brake: false, steer }, (world) => {
        const kid = world.cars[0]!, spot = nearestOn(road, quay.road, kid.x, kid.z);
        if (spot.s > quay.s0 && spot.s < quay.s1) edge = Math.max(edge, spot.offset * quay.side!);
        if (!allowed(world, kid.x, kid.z)) wet++;
      });
      const kid = w.cars[0]!, at = nearestOn(road, quay.road, kid.x, kid.z).s;
      expect(wet, `way ${dir}`).toBe(0);
      // It reached the edge and was held there, then carried on past the quay's end.
      expect(edge, `way ${dir}`).toBeGreaterThan(road.def.width / 2 - 1.2);
      expect(edge, `way ${dir}`).toBeLessThan(road.def.width / 2 - 0.7);
      expect(dir > 0 ? at > quay.s1 : at < quay.s0, `way ${dir}`).toBe(true);
    }
  });

  it('traffic drives the quay as any road', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    Object.assign(w.cars[0]!, { x: -20, z: 20 }); // the kid out of the way, inside the loop
    const quay = quayOf(w);
    let passed = 0, worst = 0;
    const was = w.cars.map(() => false);
    run(w, 120, STOP, (world) => {
      world.cars.slice(1).forEach((c, k) => {
        const on = guardAt([quay], world.roads, c.x, c.z) !== null;
        if (on) worst = Math.max(worst, nearestRoad(world.roads, c.x, c.z)!.dist);
        if (was[k + 1] && !on) passed++;
        was[k + 1] = on;
      });
    });
    expect(passed).toBeGreaterThan(2);
    expect(worst).toBeLessThan(9 / 2);
  }, 30_000);

  it('the kid\'s horn in the harbour is answered by a ship\'s horn, once, a moment later; not from far away', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const zone = harbourOf(w), kid = w.cars[0]!;
    Object.assign(kid, { x: zone.x, z: zone.z, speed: 0 });
    let answers: number[] = [];
    const listen = (world: World) => (answers = [...answers, ...world.shipHorns.map(() => world.time)]);
    honk(w);
    const at = w.time;
    run(w, 0.3, STOP, listen);
    honk(w); // a second toot before the answer: still one answer
    run(w, 2, STOP, listen);
    expect(answers).toHaveLength(1);
    expect(answers[0]! - at).toBeCloseTo(SHIP_HORN.delay, 1);
    // Honking again straight away is not answered until the ship's horn has rested.
    honk(w);
    run(w, 0.5, STOP, listen);
    expect(answers).toHaveLength(1);
    run(w, SHIP_HORN.rest, STOP);
    honk(w);
    run(w, 1, STOP, listen);
    expect(answers).toHaveLength(2);

    // Far from the harbour, nobody answers.
    const far = makeWorld(7, 0, 'free', ISLAND);
    Object.assign(far.cars[0]!, { x: zone.x + zone.r + HARBOUR_HEARS + 30, z: zone.z, speed: 0 });
    let heard = 0;
    honk(far);
    run(far, 2, STOP, (world) => (heard += world.shipHorns.length));
    expect(heard).toBe(0);
  });
});
