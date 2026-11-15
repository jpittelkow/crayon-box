import { describe, expect, it } from 'vitest';
import { guardAt, hillReach, onSand } from '../sim/ground';
import { onLand } from '../sim/land';
import { nearestOn, nearestRoad, pointAt } from '../sim/roads';
import { SAND_SPEED, makeWorld, step, type Input, type World } from '../sim/sim';
import { ISLAND } from './island';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };

function run(w: World, seconds: number, input: (w: World, i: number) => Input): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) step(w, input(w, i), DT);
}

/** On the land, or on the bridge: anywhere a car may be. */
const allowed = (w: World, x: number, z: number) => onLand(w.land, x, z) || guardAt(w.guards, w.roads, x, z)?.guard.kind === 'bridge';
/** Inside the hill, other than in its tunnel. */
const inHill = (w: World, x: number, z: number) => hillReach(ISLAND.hills![0]!, x, z) < 0.8 && !guardAt(w.guards, w.roads, x, z);

describe('the island, layout A (milestone-3 B4)', () => {
  it('has a junction at each end of the shortcut and at the spur\'s start on the loop, and the spur\'s end on the shortcut', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const ends = w.junctions[0]!.map((j) => pointAt(w.roads[0]!, j.s));
    expect(w.junctions[0]!.map((j) => [j.road, j.dir])).toEqual([[1, 1], [1, -1], [2, 1]]);
    expect(ends[0]!.z).toBeCloseTo(66.6, 0);
    expect(ends[1]!.z).toBeCloseTo(-66.6, 0);
    expect(w.junctions[1]!.map((j) => [j.road, j.dir])).toEqual([[2, -1]]);
  });

  it('traffic takes the shortcut sometimes, comes back onto the loop, and stays on the roads', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    Object.assign(w.cars[0], { x: -20, z: 20 }); // the kid out of the way
    let shortcuts = 0, rejoined = 0, worst = 0;
    const was = w.cars.map((c) => c.road);
    run(w, 180, (world) => {
      world.cars.slice(1).forEach((c, k) => {
        if (c.road !== was[k + 1]) (c.road === 1 ? shortcuts++ : rejoined++);
        was[k + 1] = c.road;
        worst = Math.max(worst, nearestRoad(world.roads, c.x, c.z)!.dist);
      });
      return { go: false, brake: true, steer: 0 };
    });
    expect(shortcuts).toBeGreaterThan(2);
    expect(rejoined).toBeGreaterThan(2);
    expect(worst).toBeLessThan(ISLAND.roads[0]!.width / 2);
  }, 30_000);

  it('"follows the road" drives both the shortcut (through the tunnel) and the bridge, and never into the sea', () => {
    const w = makeWorld(7, 0, 'road', ISLAND);
    let tunnel = 0, bridge = 0, bad = 0, off = 0;
    run(w, 240, (world) => {
      const kid = world.cars[0]!;
      const g = guardAt(world.guards, world.roads, kid.x, kid.z);
      if (g?.guard.kind === 'tunnel') tunnel++;
      if (g?.guard.kind === 'bridge') bridge++;
      if (!allowed(world, kid.x, kid.z) || inHill(world, kid.x, kid.z)) bad++;
      off = Math.max(off, nearestRoad(world.roads, kid.x, kid.z)!.dist);
      return GO;
    });
    expect(tunnel).toBeGreaterThan(60);
    expect(bridge).toBeGreaterThan(60);
    expect(bad).toBe(0);
    // It cuts the corner at a junction a little, but stays close to the road.
    expect(off).toBeLessThan(ISLAND.roads[0]!.width / 2 + 4);
  }, 30_000);

  it('after a minute of random driving the car is on the island and has gone somewhere; never in the sea or the hill', () => {
    for (const seed of [1, 2, 3]) {
      const w = makeWorld(seed, 150, 'free', ISLAND);
      let s = seed;
      const next = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
      let input = GO, travelled = 0, bad = 0;
      let px = w.cars[0]!.x, pz = w.cars[0]!.z;
      run(w, 60, (world, i) => {
        const kid = world.cars[0]!;
        if (i % 45 === 0) input = { go: next() < 0.85, brake: next() < 0.05, steer: next() * 2 - 1 };
        travelled += Math.hypot(kid.x - px, kid.z - pz);
        px = kid.x;
        pz = kid.z;
        if (!allowed(world, kid.x, kid.z) || inHill(world, kid.x, kid.z)) bad++;
        return input;
      });
      expect(bad, `seed ${seed}`).toBe(0);
      expect(travelled, `seed ${seed}`).toBeGreaterThan(200);
    }
  }, 30_000);

  it('the bridge keeps a car on it: steering hard for the side, it never ends up in the water', () => {
    for (const steer of [1, -1]) {
      const w = makeWorld(7, 0, 'free', ISLAND);
      const loop = w.roads[0]!, bridge = w.guards.find((g) => g.kind === 'bridge')!;
      // Start on the bridge, heading along it, and hold full lock for ten seconds.
      Object.assign(w.cars[0], pointAt(loop, (bridge.s0 + bridge.s1) / 2), { speed: 12 });
      let wet = 0;
      run(w, 10, (world) => {
        const kid = world.cars[0]!;
        if (!allowed(world, kid.x, kid.z)) wet++;
        return { go: true, brake: false, steer };
      });
      expect(wet, `steer ${steer}`).toBe(0);
    }
  });

  it('a car drifting toward the rail slides along it and comes off the far end', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const loop = w.roads[0]!, bridge = w.guards.find((g) => g.kind === 'bridge')!;
    Object.assign(w.cars[0], pointAt(loop, bridge.s0 - 6), { speed: 12 });
    run(w, 3.5, () => ({ go: true, brake: false, steer: 0.25 }));
    const kid = w.cars[0]!;
    expect(nearestOn(loop, 0, kid.x, kid.z).s).toBeGreaterThan(bridge.s1);
    expect(onLand(w.land, kid.x, kid.z)).toBe(true);
  });

  it('tells the sounds what is under the kid\'s car: the bridge, the tunnel, sand (milestone-3 B6)', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    const under = (x: number, z: number) => {
      Object.assign(w.cars[0], { x, z, speed: 0 });
      step(w, { go: false, brake: true, steer: 0 }, DT);
      return w.under;
    };
    const bridge = w.guards.find((g) => g.kind === 'bridge')!, tunnel = w.guards.find((g) => g.kind === 'tunnel')!;
    const onBridge = pointAt(w.roads[bridge.road]!, (bridge.s0 + bridge.s1) / 2);
    const inTunnel = pointAt(w.roads[tunnel.road]!, (tunnel.s0 + tunnel.s1) / 2);
    expect(under(onBridge.x, onBridge.z)).toEqual({ sand: false, bridge: true, tunnel: false });
    expect(under(inTunnel.x, inTunnel.z)).toEqual({ sand: false, bridge: false, tunnel: true });
    expect(under(-36, -85)).toEqual({ sand: true, bridge: false, tunnel: false });
    expect(under(-36, 36)).toEqual({ sand: false, bridge: false, tunnel: false });
  });

  it('sand on the beach slows the car and kicks up puffs', () => {
    const w = makeWorld(7, 0, 'free', ISLAND);
    w.trees.length = 0;
    // On the beach, heading east along it, at full speed.
    Object.assign(w.cars[0], { x: -36, z: -84, heading: Math.PI / 2, speed: 17 });
    expect(onSand(w.sand, -36, -84)).toBe(true);
    let puffs = 0, fastest = 0, onFor = 0;
    run(w, 2, (world) => {
      const kid = world.cars[0]!;
      puffs = Math.max(puffs, world.puffs.filter((p) => p.life > 0).length);
      // After a second without a break on the sand, it is down to sand speed.
      onFor = onSand(world.sand, kid.x, kid.z) ? onFor + 1 : 0;
      if (onFor > 60) fastest = Math.max(fastest, kid.speed);
      return GO;
    });
    expect(fastest).toBeGreaterThan(0); // it was still on the beach
    expect(fastest).toBeLessThanOrEqual(SAND_SPEED + 0.01);
    expect(puffs).toBeGreaterThan(5);
  });
});
