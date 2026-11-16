// The step-time budget (docs/highway-map-plan.md, phase 1): one simulation step of the stand-in big map
// (maps/stress.ts) must stay under 2 ms on the dev machine, as the island's did before. The numbers are written to
// the file named by BUDGET_OUT (vitest may not show console output), to copy into the plan. A slow or busy machine
// (CI draws in software and shares its cores) gets a wide margin, so the test catches the old engine's 100 ms, not
// a noisy run.
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ISLAND } from '../maps/island';
import { SITE } from '../maps/site';
import { STRESS } from '../maps/stress';
import { VEHICLES } from '../settings';
import type { MapDef } from './map';
import { makeWorld, step, type Input } from './sim';

const DT = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
/** The plan's budget for one step, in ms, and how much slower than that a shared or software runner may be. */
const BUDGET_MS = 2;
const MARGIN = process.env.CI ? 10 : 4;

/** Milliseconds to make the world, and per step of "follows the road" round the map, after a second's warm-up. */
function measure(map: MapDef, seconds: number): { make: number; step: number; cars: number; props: number } {
  const t0 = performance.now();
  const w = makeWorld(5, map.propCount ?? 150, 'road', map, 'car', VEHICLES);
  const make = performance.now() - t0;
  for (let i = 0; i < 60; i++) step(w, GO, DT);
  const n = Math.round(seconds / DT);
  const t1 = performance.now();
  for (let i = 0; i < n; i++) step(w, GO, DT);
  return { make, step: (performance.now() - t1) / n, cars: w.cars.length, props: w.props.length };
}

describe('the step-time budget', () => {
  it('the stand-in big map steps in under 2 ms (with a margin for a slow runner); today\'s maps no slower', () => {
    const results = {
      island: measure(ISLAND, 10),
      site: measure(SITE, 10),
      stress: measure(STRESS, 20),
    };
    const out = process.env.BUDGET_OUT;
    if (out) writeFileSync(out, `${JSON.stringify({ when: new Date().toISOString(), results }, null, 2)}\n`);
    expect(results.stress.step).toBeLessThan(BUDGET_MS * MARGIN);
    expect(results.island.step).toBeLessThan(BUDGET_MS * MARGIN);
    expect(results.site.step).toBeLessThan(BUDGET_MS * MARGIN);
  }, 120_000);
});
