import { describe, expect, it } from 'vitest';
import { DRIVE_KEYS, driveInput, stickAt } from './input';
import { FAR_SPOT, chaseView, groundPoint, stepTreeSizes } from './view';
import { LAND_R, RING, ROAD_R, ROAD_W } from '../maps/ring';
import { TOYS } from './assets/toys';
import { nearestOn, pointAt } from './roads';
import type { MapDef } from './map';
import { ALONG, CRUISE, JOIN, LEAVE, FLOOD_SPEED, VEHICLE_SIZE, bodyPoints, MAX_SPEED, makeWorld as makeOn, step, waterAt, type Input, type World, type Assist, REVERSE_SPEED } from './sim';

/** Worlds on the ring map unless a test says otherwise (the game itself drives the island of layout A). */
const makeWorld = (seed: number, props: number, assist: Assist = 'free', map: MapDef = RING) => makeOn(seed, props, assist, map);

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };

function run(w: World, seconds: number, input: Input | ((w: World, i: number) => Input)): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(w, typeof input === 'function' ? input(w, i) : input, DT);
}

/** A repeatable stream of numbers for "random" driving. */
function randomStream(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

describe('driving input (ADR 0021)', () => {
  it('a finger is a joystick (ADR 0036); a key takes over from it', () => {
    expect(driveInput(undefined, new Set())).toEqual({ go: false, brake: false, steer: 0 });
    expect(driveInput({ x: 0.3, y: 0.8 }, new Set())).toEqual({ go: false, brake: false, steer: 0, stick: { x: 0.3, y: 0.8 } });
    expect(driveInput({ x: 0.3, y: 0.8 }, new Set(['ArrowLeft']))).toEqual({ go: false, brake: false, steer: -1 });
    expect(driveInput({ x: 0.3, y: 0.8 }, new Set(['ArrowUp']))).toEqual({ go: true, brake: false, steer: 0 });
  });

  it('a point on the screen is a joystick position from its middle', () => {
    const box = { left: 100, top: 50, width: 800, height: 600 };
    expect(stickAt(500, 350, box)).toEqual({ x: 0, y: 0 });
    expect(stickAt(900, 50, box)).toEqual({ x: 1, y: 1 });
    expect(stickAt(100, 650, box)).toEqual({ x: -1, y: -1 });
    expect(stickAt(2000, -40, box)).toEqual({ x: 1, y: 1 });
  });

  it('arrow keys and WASD drive the same', () => {
    for (const [arrow, letter] of [['ArrowUp', 'KeyW'], ['ArrowDown', 'KeyS'], ['ArrowLeft', 'KeyA'], ['ArrowRight', 'KeyD']]) {
      expect(driveInput(undefined, new Set([arrow]))).toEqual(driveInput(undefined, new Set([letter])));
    }
    expect(driveInput(undefined, new Set(['KeyW', 'KeyD']))).toEqual({ go: true, brake: false, steer: 1 });
    expect(DRIVE_KEYS).toContain('Space');
  });
});

describe('the kid car', () => {
  it('goes when steered with keys, and rolls to a stop when let go', () => {
    const w = makeWorld(7, 0);
    const start = w.cars[0].heading;
    run(w, 1, driveInput(undefined, new Set(['ArrowUp', 'ArrowRight'])));
    expect(w.cars[0].speed).toBeGreaterThan(5);
    // Steering right lowers the heading.
    expect(w.cars[0].heading).toBeLessThan(start);
    run(w, 4, driveInput(undefined, new Set()));
    expect(w.cars[0].speed).toBe(0);
  });

  it('drives to a touched spot and stops on it (ADR 0031)', () => {
    for (const [ahead, right] of [[25, 0], [12, 10], [6, -12], [-8, 3]]) {
      const w = makeWorld(7, 0);
      const car = w.cars[0];
      // Right of the heading is (-cos, sin) in x, z (steering right lowers the heading).
      const spot = {
        x: car.x + Math.sin(car.heading) * ahead - Math.cos(car.heading) * right,
        z: car.z + Math.cos(car.heading) * ahead + Math.sin(car.heading) * right,
      };
      run(w, 8, { ...GO, spot });
      expect(Math.hypot(car.x - spot.x, car.z - spot.z), `spot ${ahead} ahead, ${right} right`).toBeLessThan(4);
      expect(car.speed).toBe(0);
    }
  });

  it('gives up on a spot inside its turning circle instead of circling it forever', () => {
    const w = makeWorld(7, 0);
    const car = w.cars[0];
    car.speed = 10;
    // Just to the right, closer than the car can turn.
    const spot = { x: car.x - Math.cos(car.heading) * 3.2, z: car.z + Math.sin(car.heading) * 3.2 };
    run(w, 6, { ...GO, spot });
    expect(car.speed).toBe(0);
    expect(w.goal?.done).toBe(true);
  });

  it('a spot out at sea is pulled back onto the island', () => {
    const w = makeWorld(7, 0);
    run(w, 10, { ...GO, spot: { x: 0, z: 200 } });
    expect(Math.hypot(w.cars[0].x, w.cars[0].z)).toBeLessThan(LAND_R - 1.5);
    expect(w.cars[0].speed).toBe(0);
  });

  it('a new spot starts the car again after it arrived', () => {
    const w = makeWorld(7, 0);
    const car = w.cars[0];
    const ahead = (d: number) => ({ x: car.x + Math.sin(car.heading) * d, z: car.z + Math.cos(car.heading) * d });
    run(w, 6, { ...GO, spot: ahead(10) });
    expect(car.speed).toBe(0);
    run(w, 0.5, { ...GO, spot: ahead(15) });
    expect(car.speed).toBeGreaterThan(2);
  });

  it('drives as a joystick: higher is faster, to the side turns, the middle stops, below backs up (ADR 0036)', () => {
    const stick = (x: number, y: number): Input => driveInput({ x, y }, new Set());
    // Top edge: full speed, straight on, the same as holding the up arrow.
    let w = makeWorld(7, 0);
    let car = w.cars[0];
    run(w, 3, stick(0, 1));
    const keyed = makeWorld(7, 0);
    run(keyed, 3, driveInput(undefined, new Set(['ArrowUp'])));
    expect(car.speed).toBeGreaterThan(14);
    expect(car.heading).toBeCloseTo(keyed.cars[0].heading, 2);
    // A little above the middle: a crawl.
    w = makeWorld(7, 0);
    run(w, 3, stick(0, 0.25));
    expect(w.cars[0].speed).toBeGreaterThan(2);
    expect(w.cars[0].speed).toBeLessThan(8);
    // Up and left: turns left (the heading grows).
    w = makeWorld(7, 0);
    car = w.cars[0];
    const h1 = car.heading;
    run(w, 1.5, stick(-0.9, 0.9));
    expect(car.heading).toBeGreaterThan(h1 + 0.5);
    // Back to the middle: it rolls to a stop.
    run(w, 4, stick(0.05, 0.05));
    expect(car.speed).toBe(0);
    // Below the middle: it backs up, slowly.
    const at = { x: car.x, z: car.z }, h2 = car.heading;
    run(w, 2, stick(0, -1));
    expect(car.speed).toBeCloseTo(-REVERSE_SPEED, 1);
    const moved = { x: car.x - at.x, z: car.z - at.z };
    expect(moved.x * Math.sin(h2) + moved.z * Math.cos(h2)).toBeLessThan(-4);
    // From backing up, the top edge brakes it and drives forward again.
    run(w, 2.5, stick(0, 1));
    expect(car.speed).toBeGreaterThan(5);
  });

  it('a minute of random joystick driving stays on the island and goes somewhere, backing up too', () => {
    for (const seed of [4, 5]) {
      const w = makeWorld(seed, 150);
      const next = randomStream(seed);
      let input = GO;
      let travelled = 0, backed = 0, px = w.cars[0].x, pz = w.cars[0].z;
      run(w, 60, (world, i) => {
        if (i % 50 === 0) input = driveInput({ x: next() * 2 - 1, y: next() * 2.4 - 1 }, new Set());
        travelled += Math.hypot(world.cars[0].x - px, world.cars[0].z - pz);
        if (world.cars[0].speed < 0) backed++;
        px = world.cars[0].x;
        pz = world.cars[0].z;
        return input;
      });
      expect(Math.hypot(w.cars[0].x, w.cars[0].z)).toBeLessThan(LAND_R);
      expect(travelled).toBeGreaterThan(150);
      expect(backed).toBeGreaterThan(0);
    }
  }, 30_000);

  it('never leaves the island, however it is driven', () => {
    const w = makeWorld(7, 150);
    let far = 0;
    run(w, 60, (world, i) => {
      far = Math.max(far, Math.hypot(world.cars[0].x, world.cars[0].z));
      return { go: true, brake: false, steer: i % 600 < 300 ? 0.15 : -0.1 };
    });
    expect(far).toBeLessThan(LAND_R);
  }, 30_000);

  it('after a minute of random driving it is on land and has gone somewhere (never stuck)', () => {
    for (const seed of [1, 2, 3]) {
      const w = makeWorld(seed, 150);
      const next = randomStream(seed);
      let input = GO;
      let travelled = 0;
      let px = w.cars[0].x;
      let pz = w.cars[0].z;
      run(w, 60, (world, i) => {
        if (i % 45 === 0) input = { go: next() < 0.85, brake: next() < 0.05, steer: next() * 2 - 1 };
        travelled += Math.hypot(world.cars[0].x - px, world.cars[0].z - pz);
        px = world.cars[0].x;
        pz = world.cars[0].z;
        return input;
      });
      expect(Math.hypot(w.cars[0].x, w.cars[0].z)).toBeLessThan(LAND_R);
      expect(travelled).toBeGreaterThan(200);
    }
  }, 30_000);

  it('a car held against a tree gets steered back to the road', () => {
    const w = makeWorld(7, 0);
    const tree = w.trees[0];
    const car = w.cars[0];
    // Put the car just off the tree, nose on, and hold go with no steering.
    car.x = tree.x + 1.6;
    car.z = tree.z;
    car.heading = -Math.PI / 2;
    run(w, 8, GO);
    expect(Math.hypot(car.x - tree.x, car.z - tree.z)).toBeGreaterThan(5);
  });

  it('with "follows the road", it stays on the road whatever the finger does', () => {
    const w = makeWorld(7, 150, 'road');
    let off = 0;
    run(w, 40, (world, i) => {
      const r = Math.hypot(world.cars[0].x, world.cars[0].z);
      if (i > 120 && Math.abs(r - ROAD_R) > ROAD_W / 2 + 1) off++;
      return { go: true, brake: false, steer: Math.sin(i / 20) };
    });
    expect(off).toBe(0);
  });

  it('slows to a wade in the flood and sinks a little, but keeps moving', () => {
    const w = makeWorld(7, 0);
    const flood = w.waters.find((p) => p.deep)!;
    const car = w.cars[0];
    car.x = flood.x - flood.r - 4;
    car.z = flood.z;
    car.heading = Math.PI / 2;
    car.speed = MAX_SPEED;
    let slowest = MAX_SPEED;
    let lowest = 0;
    let splashed = false;
    run(w, 1.4, (world) => {
      if (world.cars[0].wet === 2) {
        slowest = Math.min(slowest, world.cars[0].speed);
        lowest = Math.min(lowest, world.cars[0].y);
      }
      splashed ||= world.splashes.includes(2);
      return GO;
    });
    expect(waterAt(w, car.x, car.z)).toBe(2);
    expect(splashed).toBe(true);
    expect(car.speed).toBeLessThanOrEqual(FLOOD_SPEED + 0.01);
    expect(car.speed).toBeGreaterThan(FLOOD_SPEED - 1);
    expect(lowest).toBeLessThan(-0.15);
  });
});

describe('toys to knock around', () => {
  /** Drives the kid's car through a toy near the road, then waits; reports how high and how far it went. */
  function knock(behaviour: 'tumble' | 'roll') {
    const w = makeWorld(7, 150);
    const prop = w.props.find((p) => TOYS[p.toy].behaviour === behaviour && Math.abs(Math.hypot(p.homeX, p.homeZ) - ROAD_R) < 3)!;
    const car = w.cars[0];
    // Line the car up to drive straight through the toy, along the road.
    const a = Math.atan2(prop.homeX, prop.homeZ);
    car.x = prop.homeX - Math.cos(a) * 6;
    car.z = prop.homeZ + Math.sin(a) * 6;
    car.heading = Math.atan2(prop.homeX - car.x, prop.homeZ - car.z);
    car.speed = 12;
    let high = 0, far = 0, knocked = false, cameHome = false;
    const watch = () => {
      high = Math.max(high, prop.y - TOYS[prop.toy].half);
      far = Math.max(far, Math.hypot(prop.x - prop.homeX, prop.z - prop.homeZ));
      // Home again: back at its own spot at full size. (Traffic may knock it again later; that is fine.)
      cameHome ||= knocked && far > 1 && prop.scale === 1 && Math.hypot(prop.x - prop.homeX, prop.z - prop.homeZ) < 1e-6;
    };
    run(w, 1, (world) => {
      knocked ||= world.knocks.includes(prop.toy);
      watch();
      return GO;
    });
    car.speed = 0;
    run(w, 12, () => {
      watch();
      return { go: false, brake: true, steer: 0 };
    });
    return { high, far, knocked, cameHome };
  }

  it('a tumbling toy flies up when hit, then goes back home', () => {
    const { high, knocked, cameHome } = knock('tumble');
    expect(knocked).toBe(true);
    expect(high).toBeGreaterThan(1);
    expect(cameHome).toBe(true);
  });

  it('a rolling toy only hops, rolls a long way along the ground, then goes back home', () => {
    const { high, far, knocked, cameHome } = knock('roll');
    expect(knocked).toBe(true);
    expect(high).toBeLessThan(0.5);
    expect(far).toBeGreaterThan(8);
    expect(cameHome).toBe(true);
  });
});

describe('traffic keeps the kid company (ADR 0031)', () => {
  /** The kid's car on traffic car `i`'s road, `behind` metres back from it, heading the way traffic goes. */
  function kidBehind(w: World, i: number, behind: number): void {
    const c = w.cars[i];
    Object.assign(w.cars[0], pointAt(w.roads[c.road], c.s - behind), { speed: 10 });
  }
  /** How far along the road the kid's car is ahead of traffic car `i` (negative: behind). */
  const gapTo = (w: World, i: number) => {
    const c = w.cars[i], road = w.roads[c.road];
    const g = nearestOn(road, c.road, w.cars[0].x, w.cars[0].z).s - c.s;
    return g - Math.round(g / road.length) * road.length;
  };

  it('one car catches up, rides alongside for a while, then drives off ahead', () => {
    const w = makeWorld(7, 0, 'road');
    kidBehind(w, 2, 12);
    let alongFor = 0, most = 0, closest = Infinity, joined = -1, ahead = 0;
    run(w, 20, (world) => {
      const busy = world.cars.filter((c, j) => j > 0 && (c.mode === JOIN || c.mode === ALONG));
      most = Math.max(most, busy.length);
      if (busy[0] && joined < 0) joined = world.cars.indexOf(busy[0]);
      if (joined > 0 && world.cars[joined].mode === ALONG) {
        alongFor += DT;
        expect(Math.abs(gapTo(world, joined))).toBeLessThan(4);
        closest = Math.min(closest, Math.hypot(world.cars[joined].x - world.cars[0].x, world.cars[joined].z - world.cars[0].z));
      }
      // After riding along, it leaves: how far ahead of the kid it got.
      if (alongFor > 0 && joined > 0 && world.cars[joined].mode === LEAVE) ahead = Math.max(ahead, -gapTo(world, joined));
      return GO;
    });
    expect(joined).toBeGreaterThan(0);
    expect(most).toBe(1);
    expect(alongFor).toBeGreaterThan(3.5);
    expect(alongFor).toBeLessThan(6.5);
    // Alongside means the next lane over, not in the kid's way.
    expect(closest).toBeGreaterThan(2.5);
    expect(ahead).toBeGreaterThan(8);

    // The kid stops: all traffic goes back to its own pace and lane.
    run(w, 15, { go: false, brake: true, steer: 0 });
    for (const c of w.cars.slice(1)) {
      expect(c.mode).toBe(CRUISE);
      expect(c.speed).toBeCloseTo(c.cruise, 0);
      expect(c.lane).toBeCloseTo(c.home, 1);
    }
  }, 30_000);

  it('a kid driving against the traffic gets no company, and the road stays clear', () => {
    const w = makeWorld(7, 0, 'road');
    kidBehind(w, 1, -20);
    w.cars[0].heading += Math.PI;
    let closest = Infinity;
    run(w, 15, (world) => {
      expect(world.cars.slice(1).every((c) => c.mode === CRUISE)).toBe(true);
      for (const c of world.cars.slice(1)) closest = Math.min(closest, Math.hypot(c.x - world.cars[0].x, c.z - world.cars[0].z));
      return GO;
    });
    expect(closest).toBeGreaterThan(2.3);
  });

  it('a bump shoves both cars apart and barely slows the kid', () => {
    const w = makeWorld(7, 0);
    const other = w.cars[3];
    const kid = w.cars[0];
    // Side on, from 4 m to the traffic car's right, nose toward it.
    const p = pointAt(w.roads[other.road], other.s, other.lane + 4);
    Object.assign(kid, { x: p.x, z: p.z, heading: p.heading - Math.PI / 2, speed: 12 });
    other.cruise = other.speed = 0;
    const lane = other.lane;
    let touched = false;
    run(w, 0.6, (world) => {
      touched ||= Math.abs(world.cars[3].lane - lane) > 0.3;
      return GO;
    });
    expect(touched).toBe(true);
    expect(kid.speed).toBeGreaterThan(10);
  });
});

describe('vehicles and the camera', () => {
  it('traffic is a school bus, a police car and a monster truck, and the long bus still bumps along its length', () => {
    const w = makeWorld(7, 0);
    expect(w.cars.map((c) => c.kind)).toEqual(['car', 'bus', 'police', 'monster']);
    const bus = w.cars[1];
    const points = bodyPoints(bus);
    expect(points.length).toBeGreaterThan(2);
    // Drive the kid's car at the back half of the bus, side on: it is pushed out, not let through.
    const back = points[points.length - 1];
    const kid = w.cars[0];
    kid.x = back[0] + Math.cos(bus.heading) * 4;
    kid.z = back[1] - Math.sin(bus.heading) * 4;
    kid.heading = bus.heading - Math.PI / 2;
    bus.cruise = 0;
    bus.speed = 0;
    run(w, 1.5, GO);
    const nearest = Math.min(...bodyPoints(bus).map(([x, z]) => Math.hypot(kid.x - x, kid.z - z)));
    expect(nearest).toBeGreaterThan(VEHICLE_SIZE.car.side + VEHICLE_SIZE.bus.side);
  });

  it('maps a touch on the picture to the ground the camera shows there', () => {
    const w = makeWorld(7, 0);
    const car = w.cars[0];
    w.camHeading = car.heading;
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    /** Metres ahead of the car and to its right. */
    const local = (p: { x: number; z: number }) => [(p.x - car.x) * fx + (p.z - car.z) * fz, -(p.x - car.x) * fz + (p.z - car.z) * fx];
    // The camera aims 1.2 m above the ground 5 m ahead of the car, so the middle of the picture lands on the
    // ground further on: 15 × 5.5 / 4.3 m from the camera, which sits 10 m behind the car.
    const [midAhead, midRight] = local(groundPoint(w, 0, 0, 1.6));
    expect(midAhead).toBeCloseTo((15 * 5.5) / 4.3 - 10, 3);
    expect(midRight).toBeCloseTo(0, 5);
    // Right on the picture is right of the car; higher is further ahead; the bottom edge is just behind it.
    expect(local(groundPoint(w, 0.7, -0.2, 1.6))[1]).toBeGreaterThan(4);
    expect(local(groundPoint(w, -0.7, -0.2, 1.6))[1]).toBeLessThan(-4);
    expect(local(groundPoint(w, 0, 0.3, 1.6))[0]).toBeGreaterThan(midAhead + 5);
    expect(local(groundPoint(w, 0, -1, 1.6))[0]).toBeLessThan(0);
    // The sky: a spot FAR_SPOT from the car, straight ahead.
    const [skyAhead, skyRight] = local(groundPoint(w, 0, 0.95, 1.6));
    expect(Math.hypot(skyAhead, skyRight)).toBeCloseTo(FAR_SPOT, 3);
    expect(Math.abs(skyRight)).toBeLessThan(0.01);
  });

  it('keeps the camera behind the car', () => {
    const w = makeWorld(7, 150);
    run(w, 2, GO);
    const car = w.cars[0];
    const [ex, , ez] = chaseView(w).eye;
    const behind = (car.x - ex) * Math.sin(w.camHeading) + (car.z - ez) * Math.cos(w.camHeading);
    expect(behind).toBeGreaterThan(5);
  });

  it('shrinks a tree that stands between the camera and the car, and grows it back after', () => {
    const w = makeWorld(7, 0);
    const car = w.cars[0];
    w.trees[0].x = car.x - Math.sin(w.camHeading) * 5;
    w.trees[0].z = car.z - Math.cos(w.camHeading) * 5;
    const sizes = w.trees.map(() => 1);
    for (let i = 0; i < 20; i++) stepTreeSizes(w, sizes);
    expect(sizes[0]).toBe(0);
    expect(sizes[1]).toBe(1);
    w.trees[0].x += 30;
    for (let i = 0; i < 20; i++) stepTreeSizes(w, sizes);
    expect(sizes[0]).toBe(1);
  });
});
