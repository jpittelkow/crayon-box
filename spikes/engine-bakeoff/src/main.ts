// The test page: one simulation, drawn by three.js, by Babylon.js, or by both side by side.
import type { EngineRenderer } from './renderer';
import { buildScene } from './scene';
import { autopilot, makeWorld, step, type Input } from './sim';
import { bonk, horn, splash, unlockSound } from './sound';

type EngineId = 'three' | 'babylon';

const params = new URLSearchParams(location.search);
const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly string[]).includes(params.get(name) ?? '') ? (params.get(name) as T) : fallback;

const config = {
  engine: pick('engine', ['three', 'babylon', 'both'] as const, 'both'),
  props: Number(pick('props', ['150', '600', '2400'] as const, '150')),
  instanced: pick('draw', ['instanced', 'separate'] as const, 'instanced') === 'instanced',
  outlines: pick('ink', ['on', 'off'] as const, 'on') === 'on',
  scale: Number(pick('scale', ['1', '0.75', '0.5'] as const, '1')),
  ownWater: pick('water', ['cartoon', 'own'] as const, 'cartoon') === 'own',
};
const SEED = 7;
const WARMUP_S = 2, MEASURE_S = 15;

let world = makeWorld(SEED, config.props);
const scene = buildScene(world, { outlines: config.outlines, ownWater: config.ownWater });

const loaders: Record<EngineId, () => Promise<{ createRenderer: typeof import('./three-renderer').createRenderer }>> = {
  three: () => import('./three-renderer'),
  babylon: () => import('./babylon-renderer'),
};

// ---- page -----------------------------------------------------------------------------------------------

const stage = document.getElementById('stage')!;
const panel = document.getElementById('panel')!;
const ids: EngineId[] = config.engine === 'both' ? ['three', 'babylon'] : [config.engine];

interface View { id: EngineId; canvas: HTMLCanvasElement; renderer: EngineRenderer; renderMs: number[] }
const views: View[] = [];

for (const id of ids) {
  const pane = document.createElement('div');
  pane.className = 'pane';
  const canvas = document.createElement('canvas');
  const tag = document.createElement('div');
  tag.className = 'tag';
  pane.append(canvas, tag);
  stage.append(pane);
  const { createRenderer } = await loaders[id]();
  const renderer = await createRenderer(canvas, scene, { instanced: config.instanced });
  tag.textContent = renderer.label;
  views.push({ id, canvas, renderer, renderMs: [] });
}

function resize(): void {
  const ratio = Math.min(window.devicePixelRatio || 1, 2) * config.scale;
  for (const v of views) {
    const w = Math.max(1, Math.round(v.canvas.clientWidth * ratio)), h = Math.max(1, Math.round(v.canvas.clientHeight * ratio));
    v.renderer.resize(w, h);
  }
}
window.addEventListener('resize', resize);
resize();

// ---- controls: touch to go toward the finger, arrows or WASD, space for the horn ---------------------------

const fingers = new Map<number, number>(); // pointer id -> where across its picture the finger is, -1 .. 1
const keys = new Set<string>();
let useAutopilot = params.get('auto') === '1';

/** Where across its picture the finger is. Side by side, each picture steers from its own middle. */
const fingerX = (e: PointerEvent): number => {
  const rects = views.map((v) => v.canvas.getBoundingClientRect());
  const r = rects.find((b) => e.clientX >= b.left && e.clientX <= b.right) ?? rects[0]!;
  return ((e.clientX - r.left) / r.width) * 2 - 1;
};
stage.addEventListener('pointerdown', (e) => {
  unlockSound();
  try { stage.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
  fingers.delete(e.pointerId);
  fingers.set(e.pointerId, fingerX(e));
});
stage.addEventListener('pointermove', (e) => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, fingerX(e));
});
const lift = (e: PointerEvent) => fingers.delete(e.pointerId);
stage.addEventListener('pointerup', lift);
stage.addEventListener('pointercancel', lift);

const DRIVE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH') panel.hidden = !panel.hidden;
  if (!DRIVE_KEYS.includes(e.code)) return;
  e.preventDefault();
  unlockSound();
  if (e.code === 'Space' && !e.repeat) horn();
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
document.getElementById('horn')!.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  unlockSound();
  horn();
});

function readInput(): Input {
  if (useAutopilot) return autopilot(world);
  const input: Input = { go: false, brake: false, steer: 0 };
  // The newest finger still down is the one the car follows.
  const newest = [...fingers.values()].at(-1);
  if (newest !== undefined) {
    input.go = true;
    input.steer = Math.max(-1, Math.min(1, newest * 1.3));
  }
  if (keys.has('ArrowUp') || keys.has('KeyW')) input.go = true;
  if (keys.has('ArrowDown') || keys.has('KeyS')) input.brake = true;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) input.steer -= 1;
  if (keys.has('ArrowRight') || keys.has('KeyD')) input.steer += 1;
  return input;
}

// ---- measuring ------------------------------------------------------------------------------------------

interface Result {
  engine: string; props: number; draw: string; ink: string; water?: string; size: string;
  fps: number; low: number; renderMs: number; calls: number;
}
const RESULTS_KEY = 'bakeoff-results';
const loadResults = (): Result[] => {
  try { return JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]') as Result[]; } catch { return []; }
};
const saveResults = (r: Result[]) => { try { localStorage.setItem(RESULTS_KEY, JSON.stringify(r)); } catch { /* no storage */ } };

/** The loop's clock: when the last frame started. */
let last = performance.now();

const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
let bench: { started: number; frames: number[] } | null = null;
const recent: number[] = [];
let simMsRecent: number[] = [];

function startBenchmark(): void {
  // A fresh world and the autopilot make every run the same drive.
  world = makeWorld(SEED, config.props);
  useAutopilot = true;
  for (const v of views) v.renderMs = [];
  bench = { started: last, frames: [] };
  drawPanel();
}

function finishBenchmark(): void {
  if (!bench) return;
  const frames = bench.frames.slice().sort((a, b) => b - a);
  const worst = frames.slice(0, Math.max(1, Math.round(frames.length / 100)));
  const results = loadResults();
  for (const v of views) {
    results.push({
      engine: v.renderer.label + (views.length === 2 ? ' (side by side)' : ''),
      props: config.props, draw: config.instanced ? 'instanced' : 'separate', ink: config.outlines ? 'on' : 'off',
      water: config.ownWater ? 'its own' : 'cartoon',
      size: `${v.canvas.width}×${v.canvas.height}`,
      fps: 1000 / mean(frames), low: 1000 / mean(worst), renderMs: mean(v.renderMs), calls: v.renderer.drawCalls(),
    });
  }
  saveResults(results);
  bench = null;
  drawPanel();
}

// ---- the panel ------------------------------------------------------------------------------------------

function link(label: string, changes: Record<string, string>, active: boolean): string {
  const p = new URLSearchParams(location.search);
  for (const [k, v] of Object.entries(changes)) p.set(k, v);
  return `<a class="${active ? 'on' : ''}" href="?${p.toString()}">${label}</a>`;
}

function drawPanel(): void {
  const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const rows = loadResults().map((r) => `<tr><td>${esc(r.engine)}</td><td>${esc(r.props)}</td><td>${esc(r.draw)}</td><td>${esc(r.ink)}</td><td>${esc(r.water ?? 'none')}</td><td>${esc(r.size)}</td>
    <td>${Number(r.fps).toFixed(1)}</td><td>${Number(r.low).toFixed(1)}</td><td>${Number(r.renderMs).toFixed(2)}</td><td>${esc(r.calls)}</td></tr>`).join('');
  panel.innerHTML = `
    <div class="row"><b>Draw with</b>
      ${link('three.js', { engine: 'three' }, config.engine === 'three')}
      ${link('Babylon.js', { engine: 'babylon' }, config.engine === 'babylon')}
      ${link('Both, side by side', { engine: 'both' }, config.engine === 'both')}</div>
    <div class="row"><b>Things to knock</b>
      ${[150, 600, 2400].map((n) => link(String(n), { props: String(n) }, config.props === n)).join('')}</div>
    <div class="row"><b>Props drawn as</b>
      ${link('batches (instanced)', { draw: 'instanced' }, config.instanced)}
      ${link('separate objects', { draw: 'separate' }, !config.instanced)}</div>
    <div class="row"><b>Ink outlines</b>
      ${link('on', { ink: 'on' }, config.outlines)}${link('off', { ink: 'off' }, !config.outlines)}
      <b class="gap">Picture size</b>
      ${['1', '0.75', '0.5'].map((s) => link(`${Number(s) * 100}%`, { scale: s }, config.scale === Number(s))).join('')}</div>
    <div class="row"><b>Water</b>
      ${link('cartoon (shared)', { water: 'cartoon' }, !config.ownWater)}
      ${link("each library's own", { water: 'own' }, config.ownWater)}</div>
    <div class="row">
      <button id="auto">${useAutopilot ? 'Stop self-driving' : 'Self-drive'}</button>
      <button id="bench" ${bench ? 'disabled' : ''}>${bench ? 'Measuring…' : `Measure ${MEASURE_S} s`}</button>
      <button id="clear">Clear results</button>
      <span class="hint">Touch or arrows / WASD to drive, space for the horn, H hides this panel.</span></div>
    <div class="row stats" id="stats"></div>
    ${rows ? `<table><tr><th>Library</th><th>Props</th><th>Drawn as</th><th>Ink</th><th>Water</th><th>Pixels</th><th>Avg fps</th>
      <th>Worst 1% fps</th><th>Draw work, ms</th><th>Draw calls</th></tr>${rows}</table>` : ''}`;
  document.getElementById('auto')!.onclick = () => { useAutopilot = !useAutopilot; drawPanel(); };
  document.getElementById('bench')!.onclick = startBenchmark;
  document.getElementById('clear')!.onclick = () => { saveResults([]); drawPanel(); };
}
panel.addEventListener('pointerdown', (e) => e.stopPropagation());
drawPanel();

// ---- the loop -------------------------------------------------------------------------------------------

const STEP = 1 / 60;
let owed = 0;
let statsAt = 0;

function frame(now: number): void {
  const elapsed = now - last;
  last = now;
  owed = Math.min(owed + elapsed / 1000, STEP * 5);

  const t0 = performance.now();
  while (owed >= STEP) {
    step(world, readInput(), STEP);
    for (const kind of world.knocks) bonk(kind);
    for (const depth of world.splashes) splash(depth === 2);
    owed -= STEP;
  }
  scene.update(world);
  const simMs = performance.now() - t0;

  for (const v of views) {
    const r0 = performance.now();
    v.renderer.render();
    v.renderMs.push(performance.now() - r0);
    if (!bench && v.renderMs.length > 120) v.renderMs.shift();
  }

  recent.push(elapsed);
  if (recent.length > 120) recent.shift();
  simMsRecent.push(simMs);
  if (simMsRecent.length > 120) simMsRecent = simMsRecent.slice(-120);

  if (bench) {
    const t = (now - bench.started) / 1000;
    if (t < WARMUP_S) for (const v of views) v.renderMs = [];
    else bench.frames.push(elapsed);
    if (t >= WARMUP_S + MEASURE_S) finishBenchmark();
  }

  if (now - statsAt > 400) {
    statsAt = now;
    const stats = document.getElementById('stats');
    if (stats) {
      stats.textContent = `${(1000 / mean(recent)).toFixed(0)} fps · ${scene.triangles().toLocaleString()} triangles · simulation ${mean(simMsRecent).toFixed(2)} ms · `
        + views.map((v) => `${v.id} draw ${mean(v.renderMs).toFixed(2)} ms, ${v.renderer.drawCalls()} calls`).join(' · ');
    }
  }
}
function loop(now: number): void {
  requestAnimationFrame(loop);
  frame(now);
}
requestAnimationFrame(loop);

// For checking the test itself from the browser console. `tick` runs one frame by hand, which is the only way
// to move things while the page is hidden and the browser has paused its animation frames.
Object.assign(window, { bakeoff: { world: () => world, scene, views, config, tick: (ms = 1000 / 60) => frame(last + ms) } });
