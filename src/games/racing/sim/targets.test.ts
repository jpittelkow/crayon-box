// Targets (ADR 0041): a stack of boxes falls when the kid's car hits it and rebuilds bottom first; a star is taken
// once, with confetti, and comes back; traffic never takes a star and knocks a stack over without a celebration.
import { describe, expect, it } from 'vitest';
import { RING } from '../maps/ring';
import { CONFETTI_BURST, TOY_STATE, makeWorld, step, type Input, type Prop, type World } from './sim';
import { STAR_BACK, STAR_HEIGHT } from './assets/toys';
import { pointAt } from './roads';
import type { MapDef } from './map';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const STOP: Input = { go: false, brake: true, steer: 0 };

/** The ring with targets of its own, clear of its ramp (2.45 rad), car wash (5.2) and flood (π). */
const at = (angle: number, offset = 0) => ({ road: 0, at: angle / (Math.PI * 2), offset });
const WITH_TARGETS: MapDef = {
  ...RING,
  targets: [
    { id: 'toy/star', on: at(0.6), count: 3 },
    { id: 'toy/box-stack', on: at(1.9, 0) },
  ],
};

function run(w: World, seconds: number, input: Input, each?: (w: World) => void): void {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(w, input, DT);
    each?.(w);
  }
}

const stars = (w: World) => w.props.filter((p) => p.toy === 'toy/star');
const boxes = (w: World) => w.props.filter((p) => p.toy === 'toy/box-stack');
const home = (p: Prop) => p.state === TOY_STATE.HOME && p.scale === 1 && Math.hypot(p.x - p.homeX, p.z - p.homeZ) < 1e-6;
const confettiUp = (w: World) => w.confetti.filter((c) => c.life > 0).length;

/** The kid's car on the ring road, `angle` round it, facing along it, at `speed`. */
function kidAt(w: World, angle: number, speed: number, offset = 0): void {
  const p = pointAt(w.roads[0]!, (angle / (Math.PI * 2)) * w.roads[0]!.length, offset);
  Object.assign(w.cars[0]!, { x: p.x, z: p.z, heading: p.heading, speed });
  w.camHeading = p.heading;
}
/** The kid's car parked in the middle of the island, far from every target and off the road. */
const parkAway = (w: World) => Object.assign(w.cars[0]!, { x: 0, z: 0, speed: 0 });
/** Traffic out of the way, for tests of the kid's car alone. */
const noTraffic = (w: World) => void (w.cars = w.cars.slice(0, 1));

describe('targets (ADR 0041)', () => {
  it('the maps place them: six boxes in a pyramid for a stack, a row of stars floating over the road', () => {
    const w = makeWorld(7, 0, 'free', WITH_TARGETS);
    expect(stars(w)).toHaveLength(3);
    expect(boxes(w)).toHaveLength(6);
    expect(w.stacks).toEqual([boxes(w).map((b) => w.props.indexOf(b))]);
    expect(boxes(w).map((b) => b.level)).toEqual([0, 0, 0, 1, 1, 2]);
    // Each row sits on the one below.
    const heights = boxes(w).map((b) => b.homeY);
    expect(heights[3]! - heights[0]!).toBeCloseTo(0.75);
    for (const s of stars(w)) expect(s.homeY).toBe(STAR_HEIGHT);
    // Stars are 4 m apart along the road.
    const [a, b] = stars(w);
    expect(Math.hypot(a!.homeX - b!.homeX, a!.homeZ - b!.homeZ)).toBeCloseTo(4, 0);
    // A world's scattered toys don't count the targets.
    expect(makeWorld(7, 40, 'free', WITH_TARGETS).props).toHaveLength(40 + 9);
  });

  it('a stack falls apart when the kid\'s car hits it, with confetti and one cheer, and rebuilds bottom first', () => {
    const w = makeWorld(7, 0, 'free', WITH_TARGETS);
    noTraffic(w);
    kidAt(w, 1.9 - 10 / 38, 12);
    let cheers = 0, confetti = 0, far = 0, high = 0;
    run(w, 1.5, GO, (world) => {
      cheers += world.cheers.filter((c) => c.toy === 'toy/box-stack').length;
      confetti = Math.max(confetti, confettiUp(world));
      for (const b of boxes(world)) {
        far = Math.max(far, Math.hypot(b.x - b.homeX, b.z - b.homeZ));
        high = Math.max(high, b.y);
      }
    });
    expect(cheers).toBe(1);
    expect(confetti).toBeGreaterThanOrEqual(CONFETTI_BURST);
    expect(boxes(w).every((b) => !home(b))).toBe(true);
    expect(far).toBeGreaterThan(3);
    expect(high).toBeGreaterThan(2);

    // Park well away: every box comes home, and no box is home before every box under it.
    parkAway(w);
    const back: number[] = boxes(w).map(() => -1);
    run(w, 15, STOP, (world) => boxes(world).forEach((b, i) => {
      if (back[i]! < 0 && home(b)) back[i] = world.time;
    }));
    expect(back.every((t) => t > 0)).toBe(true);
    const lv = boxes(w).map((b) => b.level);
    for (let i = 0; i < back.length; i++) {
      for (let j = 0; j < back.length; j++) if (lv[j]! < lv[i]!) expect(back[j]!).toBeLessThan(back[i]!);
    }
    for (const b of boxes(w)) expect(b.y).toBeCloseTo(b.homeY);
  }, 30_000);

  it('a stack doesn\'t rebuild round the kid\'s car; it waits until the car has gone', () => {
    const w = makeWorld(7, 0, 'free', WITH_TARGETS);
    noTraffic(w);
    kidAt(w, 1.9 - 10 / 38, 12);
    run(w, 1, GO);
    // Back up to the stack's spot and stay there.
    const base = boxes(w)[1]!;
    Object.assign(w.cars[0]!, { x: base.homeX, z: base.homeZ, speed: 0 });
    run(w, 15, STOP);
    expect(boxes(w).some((b) => home(b))).toBe(false);
    parkAway(w);
    run(w, 6, STOP);
    expect(boxes(w).every(home)).toBe(true);
  }, 30_000);

  it('a star is taken once as the kid\'s car drives through it (with "follows the road" too), spins off, and comes back', () => {
    const w = makeWorld(7, 0, 'road', WITH_TARGETS);
    noTraffic(w);
    kidAt(w, 0.6 - 10 / 38, 10);
    const taken = new Map<Prop, number>();
    let confetti = 0;
    run(w, 3, GO, (world) => {
      for (const c of world.cheers) {
        const star = stars(world).find((s) => Math.hypot(s.homeX - c.x, s.homeZ - c.z) < 0.01)!;
        taken.set(star, (taken.get(star) ?? 0) + 1);
      }
      confetti = Math.max(confetti, confettiUp(world));
    });
    // All three, once each.
    expect([...taken.values()]).toEqual([1, 1, 1]);
    expect(confetti).toBeGreaterThanOrEqual(CONFETTI_BURST);
    for (const s of stars(w)) expect(s.scale).toBe(0);

    parkAway(w);
    let more = 0;
    run(w, STAR_BACK + 1, STOP, (world) => (more += world.cheers.length));
    expect(more).toBe(0);
    for (const s of stars(w)) expect(home(s)).toBe(true);
  }, 30_000);

  it('a star doesn\'t come back under the kid\'s car, so a car parked on it doesn\'t take it again and again', () => {
    const w = makeWorld(7, 0, 'free', WITH_TARGETS);
    noTraffic(w);
    const star = stars(w)[0]!;
    Object.assign(w.cars[0]!, { x: star.homeX, z: star.homeZ, speed: 0 });
    let cheers = 0;
    run(w, STAR_BACK * 2.5, STOP, (world) => (cheers += world.cheers.length));
    expect(cheers).toBe(1);
    expect(home(star)).toBe(false);
    parkAway(w);
    run(w, 1, STOP);
    expect(home(star)).toBe(true);
  }, 30_000);

  it('traffic drives through stars without taking them, and knocks stacks over without a celebration', () => {
    // Targets in the bus's lane (it starts at 1.3 rad, 2.2 m left of the centre line, going round).
    const map: MapDef = { ...RING, targets: [{ id: 'toy/star', on: at(1.6, -2.2), count: 3 }, { id: 'toy/box-stack', on: at(2.05, -2.2) }] };
    const w = makeWorld(7, 0, 'free', map);
    parkAway(w);
    let close = 0, cheers = 0, confetti = 0, toppled = false;
    run(w, 20, STOP, (world) => {
      for (const s of stars(world)) {
        if (world.cars.slice(1).some((c) => Math.hypot(c.x - s.homeX, c.z - s.homeZ) < 1)) close++;
      }
      cheers += world.cheers.length;
      confetti = Math.max(confetti, confettiUp(world));
      toppled ||= boxes(world).some((b) => b.state === TOY_STATE.FLYING);
    });
    expect(close).toBeGreaterThan(0);
    for (const s of stars(w)) expect(s.state).toBe(TOY_STATE.HOME);
    expect(toppled).toBe(true);
    expect(cheers).toBe(0);
    expect(confetti).toBe(0);
  }, 30_000);
});
