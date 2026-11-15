import { describe, expect, it } from 'vitest';
import { ISLAND } from '../maps/island';
import { buildLand, keepInland, offsetOutline, onLand, randomInland, roundOutline, shore } from './land';
import type { MapDef } from './map';
import { makeWorld, step, type World } from './sim';

const round = buildLand({ outline: roundOutline(10, -5, 50), beach: 8 });
/** An L-shaped island: a 100 × 40 bar along x, and a 40 × 100 bar going up z from its left end. */
const ell = buildLand({ outline: [[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]], beach: 6 });

describe('the land as an outline (milestone-3 B2)', () => {
  it('knows how deep inland a point is, and which way inland is', () => {
    const middle = shore(round, 10, -5);
    expect(middle.depth).toBeCloseTo(50, 0);
    const nearEast = shore(round, 55, -5);
    expect(nearEast.depth).toBeCloseTo(5, 0);
    expect(nearEast.nx).toBeCloseTo(-1, 2); // inland is west
    const atSea = shore(round, 70, -5);
    expect(atSea.depth).toBeCloseTo(-10, 0);
    expect(atSea.nx).toBeCloseTo(-1, 2);
  });

  it('works for a shape with a corner cut out', () => {
    expect(onLand(ell, 20, 80)).toBe(true);
    expect(onLand(ell, 80, 80)).toBe(false); // the cut-out corner is sea
    const s = shore(ell, 70, 45); // just out to sea, above the bar
    expect(s.depth).toBeCloseTo(-5, 5);
    expect(s.nz).toBeCloseTo(-1, 5); // inland is back down onto the bar
  });

  it('moves a point inland, and picks random points away from the shore', () => {
    const p = keepInland(ell, 70, 45, 3);
    expect(shore(ell, p.x, p.z).depth).toBeGreaterThanOrEqual(3 - 1e-6);
    let s = 1;
    const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 200; i++) {
      const [x, z] = randomInland(ell, rand, 5);
      expect(shore(ell, x, z).depth).toBeGreaterThanOrEqual(5);
    }
  });

  it('grows and shrinks an outline for drawing the beach and the grass', () => {
    const out = offsetOutline(round, 2.5), inn = offsetOutline(round, -3);
    for (const [x, z] of out) expect(Math.hypot(x - 10, z + 5)).toBeCloseTo(52.5, 1);
    for (const [x, z] of inn) expect(Math.hypot(x - 10, z + 5)).toBeCloseTo(47, 1);
  });
});

describe('zones (milestone-3 B2)', () => {
  const ZONED: MapDef = {
    ...ISLAND,
    id: 'zoned-test',
    zones: [{ kind: 'car-wash', on: { road: 0, at: 0.05 }, r: 4 }, { kind: 'ramp', on: { x: 0, z: 0 }, r: 3 }],
  };
  const events = (w: World) => w.zoneEvents.map((e) => `${e.entered ? 'in' : 'out'}:${e.kind}`);

  it('places zones on a road or by their middle', () => {
    const w = makeWorld(7, 0, 'road', ZONED);
    expect(w.zones.map((z) => z.kind)).toEqual(['car-wash', 'ramp']);
    expect(Math.hypot(w.zones[0].x, w.zones[0].z)).toBeCloseTo(38, 0); // on the ring road
    expect(w.zones[1]).toMatchObject({ x: 0, z: 0, r: 3 });
  });

  it('reports the kid driving into a zone and out again, once each', () => {
    const w = makeWorld(7, 0, 'road', ZONED);
    const seen: string[] = [];
    for (let i = 0; i < 6 * 60; i++) {
      step(w, { go: true, brake: false, steer: 0 }, 1 / 60);
      seen.push(...events(w));
    }
    expect(seen).toEqual(['in:car-wash', 'out:car-wash']);
    expect(w.zone).toBe(-1);
  });
});
