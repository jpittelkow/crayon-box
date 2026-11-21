// Dev tool: frame times for a driving map (docs/highway-map-plan.md, phase 1), drawn by the game's own renderer. The
// kid's car follows the road round the map with every vehicle switched on, at the game's fixed step (at most five
// steps a frame, as in the game), and a readout shows the frame time, the time a step and a draw take, and what
// the graphics card was sent. Open http://localhost:5173/tools/driving-frames.html?map=stress (or island, site) while
// `npm run dev` runs; `tools/measure-frames.mjs` reads the numbers for several maps. Nothing here ships in the app.
import { MAPS } from '../games/racing/maps';
import { STRESS } from '../games/racing/maps/stress';
import { createRenderer } from '../games/racing/render';
import { VEHICLES } from '../games/racing/settings';
import { makeWorld, step, type Input } from '../games/racing/sim/sim';
import { MAX_PIXEL_RATIO } from '../games/racing/render';

declare global {
  interface Window {
    /** The numbers so far, for a script: frames counted, and the mean and slowest-in-twenty frame, step and draw. */
    drivingFrames?: Report;
  }
}

interface Report {
  map: string; frames: number; seconds: number; fps: number;
  frame: { mean: number; p95: number }; step: { mean: number; p95: number }; draw: { mean: number; p95: number };
  calls: number; triangles: number; toys: number; trees: number; traffic: number;
}

const STEP = 1 / 60;
const GO: Input = { go: true, brake: false, steer: 0 };
const params = new URLSearchParams(location.search);
const id = params.get('map') ?? 'stress';
const map = [...MAPS, STRESS].find((m) => m.id === id) ?? STRESS;

const canvas = document.querySelector('canvas')!;
const readout = document.querySelector<HTMLDivElement>('#readout')!;
const world = makeWorld(1, map.propCount ?? 150, 'road', map, 'car', VEHICLES);
const renderer = createRenderer(canvas, world, 0xff8a1f);
const resize = () => renderer.resize(canvas.clientWidth || 1, canvas.clientHeight || 1, Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
new ResizeObserver(resize).observe(canvas);
resize();

// The first second is left out: shaders compile and the batches fill.
const WARM = 1000;
const frames: number[] = [], steps: number[] = [], draws: number[] = [];
const started = performance.now();
let last = started, owed = 0;
const mean = (list: number[]) => list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
const p95 = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length * 0.95)] ?? 0;

const tick = (now: number) => {
  requestAnimationFrame(tick);
  const dt = now - last;
  last = now;
  owed = Math.min(owed + dt / 1000, STEP * 5);
  const s0 = performance.now();
  let n = 0;
  while (owed >= STEP) {
    step(world, GO, STEP);
    owed -= STEP;
    n++;
  }
  const s1 = performance.now();
  renderer.render(world);
  const s2 = performance.now();
  if (now - started < WARM) return;
  frames.push(dt);
  if (n) steps.push((s1 - s0) / n);
  draws.push(s2 - s1);
  const { calls, triangles } = renderer.stats?.() ?? { calls: 0, triangles: 0 };
  const report: Report = {
    map: map.id, frames: frames.length, seconds: (now - started - WARM) / 1000, fps: 1000 / mean(frames),
    frame: { mean: mean(frames), p95: p95(frames) }, step: { mean: mean(steps), p95: p95(steps) }, draw: { mean: mean(draws), p95: p95(draws) },
    calls, triangles, toys: world.props.length, trees: world.trees.length, traffic: world.cars.length - 1,
  };
  window.drivingFrames = report;
  if (frames.length % 15 === 0) {
    readout.textContent = [
      `${map.id}: ${report.fps.toFixed(0)} frames a second`,
      `frame ${report.frame.mean.toFixed(1)} ms (slowest 5%: ${report.frame.p95.toFixed(1)})`,
      `step  ${report.step.mean.toFixed(2)} ms (${report.step.p95.toFixed(2)})`,
      `draw  ${report.draw.mean.toFixed(1)} ms (${report.draw.p95.toFixed(1)}) of the main thread`,
      `${calls} draw calls, ${(triangles / 1000).toFixed(0)}k triangles`,
      `${report.toys} toys, ${report.trees} trees, ${report.traffic} traffic`,
    ].join('\n');
  }
};
requestAnimationFrame(tick);
