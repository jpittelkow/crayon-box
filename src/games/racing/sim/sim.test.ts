import { describe, expect, it } from 'vitest';
import { DRIVE_KEYS, driveInput } from './input';
import { buildScene } from './scene';
import { FLOOD_SPEED, LAND_R, MAX_SPEED, ROAD_R, ROAD_W, makeWorld, step, waterAt, type Input, type World } from './sim';

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
  it('a finger makes the car go and steers toward its side', () => {
    expect(driveInput(undefined, new Set())).toEqual({ go: false, brake: false, steer: 0 });
    expect(driveInput(0.5, new Set())).toMatchObject({ go: true, steer: 0.65 });
    expect(driveInput(-1, new Set()).steer).toBe(-1);
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
  it('goes when touched, turns toward the finger, and rolls to a stop when let go', () => {
    const w = makeWorld(7, 0);
    const start = w.cars[0].heading;
    run(w, 1, driveInput(0.8, new Set()));
    expect(w.cars[0].speed).toBeGreaterThan(5);
    // Positive steer turns right, which lowers the heading.
    expect(w.cars[0].heading).toBeLessThan(start);
    run(w, 4, driveInput(undefined, new Set()));
    expect(w.cars[0].speed).toBe(0);
  });

  it('never leaves the island, however it is driven', () => {
    const w = makeWorld(7, 150);
    let far = 0;
    run(w, 60, (world, i) => {
      far = Math.max(far, Math.hypot(world.cars[0].x, world.cars[0].z));
      return { go: true, brake: false, steer: i % 600 < 300 ? 0.15 : -0.1 };
    });
    expect(far).toBeLessThan(LAND_R);
  });

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
  });

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

describe('things to knock around', () => {
  it('fly when hit, then go back home', () => {
    const w = makeWorld(7, 150);
    const prop = w.props.find((p) => Math.abs(Math.hypot(p.homeX, p.homeZ) - ROAD_R) < 3)!;
    const car = w.cars[0];
    // Line the car up to drive straight through the prop.
    const a = Math.atan2(prop.homeX, prop.homeZ);
    car.x = prop.homeX - Math.cos(a) * 6;
    car.z = prop.homeZ + Math.sin(a) * 6;
    car.heading = Math.atan2(prop.homeX - car.x, prop.homeZ - car.z);
    car.speed = 12;
    let flew = false;
    run(w, 1, () => {
      flew ||= prop.y > 1.5;
      return GO;
    });
    expect(flew).toBe(true);
    car.speed = 0;
    run(w, 12, { go: false, brake: true, steer: 0 });
    expect(prop.x).toBeCloseTo(prop.homeX, 5);
    expect(prop.z).toBeCloseTo(prop.homeZ, 5);
    expect(prop.scale).toBe(1);
  });
});

describe('traffic', () => {
  it('drives along with a nearby kid car, never blocks it, and goes back to its own pace', () => {
    const w = makeWorld(7, 0);
    const kid = w.cars[0];
    const other = w.cars[1];
    // Park the kid right next to a traffic car, then drive along the road at a steady speed.
    kid.x = Math.sin(other.angle) * ROAD_R;
    kid.z = Math.cos(other.angle) * ROAD_R;
    kid.heading = other.angle + Math.PI / 2;
    let closest = Infinity;
    run(w, 3, (world, i) => {
      // They start side by side; after the first second traffic has made room and stays clear.
      if (i > 60) closest = Math.min(closest, Math.hypot(world.cars[1].x - world.cars[0].x, world.cars[1].z - world.cars[0].z));
      return { go: true, brake: false, steer: 0 };
    });
    expect(Math.abs(other.speed - kid.speed)).toBeLessThan(3);
    expect(closest).toBeGreaterThan(3);
    // Kid stops; traffic drives off and settles back to its own pace and lane.
    run(w, 12, { go: false, brake: true, steer: 0 });
    expect(other.speed).toBeCloseTo(other.cruise, 0);
    expect(other.lane).toBeCloseTo(other.home, 1);
  });
});

describe('scene data', () => {
  it('paints the kid car in the kid color and keeps the camera behind it', () => {
    const w = makeWorld(7, 150);
    const scene = buildScene(w, [1, 0, 0]);
    expect(scene.batches.find((b) => b.name === 'body-0')!.color).toEqual([1, 0, 0]);
    run(w, 2, GO);
    scene.update(w);
    const car = w.cars[0];
    const [ex, , ez] = scene.camera.eye;
    const behind = (car.x - ex) * Math.sin(w.camHeading) + (car.z - ez) * Math.cos(w.camHeading);
    expect(behind).toBeGreaterThan(5);
    for (const b of scene.batches) expect(b.matrices.every(Number.isFinite)).toBe(true);
  });

  it('shrinks a tree that stands between the camera and the car', () => {
    const w = makeWorld(7, 0);
    const scene = buildScene(w, [1, 0, 0]);
    const car = w.cars[0];
    // Plant the first tree halfway between the camera and the car.
    w.trees[0].x = car.x - Math.sin(w.camHeading) * 5;
    w.trees[0].z = car.z - Math.cos(w.camHeading) * 5;
    for (let i = 0; i < 20; i++) scene.update(w);
    const canopies = scene.batches.find((b) => b.name === 'canopies')!;
    expect(Math.abs(canopies.matrices[0])).toBeLessThan(1e-6);
    expect(Math.abs(canopies.matrices[16])).toBeGreaterThan(0.5);
  });
});
