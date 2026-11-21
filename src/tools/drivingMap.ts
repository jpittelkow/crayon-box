// Dev tool: the map viewer (docs/highway-map-plan.md, phase 5; docs/recipes/maps.md). Any driving map from straight
// above, drawn by the game's own renderer, with layers on top to switch on and off: road numbers and lengths, set
// pieces, targets, the start and traffic, a grid in the map file's own x and z, and the places a kid can reach that
// are too far from a road, in red. Open http://localhost:5173/tools/driving-map.html?map=island (or site, test-loop,
// editor for the map editor's "look", or a .json file's address on the dev server). Scroll to zoom, drag to move.
// `tools/shoot-map.mjs` takes pictures of it. Nothing here ships in the app.
import { farFromRoad, ROAD_REACH } from '../games/racing/maps/check';
import { parseMapFile } from '../games/racing/maps/file';
import { createRenderer, type Renderer } from '../games/racing/render';
import { buildRoad } from '../games/racing/sim/roads';
import { makeWorld, type World } from '../games/racing/sim/sim';
import { CAMERA_FOV, type View } from '../games/racing/sim/view';
import {
  drawFar, drawGrid, drawProblems, drawRoadLabels, drawTargets, drawThings, drawZones, fitFrame, toMap, zoomAt, type Frame,
} from './mapDraw';
import { allProblems, docFromMap, type Problem } from './mapEdit';
import { builtInMaps, loadMap, type NamedMap } from './mapSource';

declare global {
  interface Window {
    /** Set once the map is drawn, for tools/shoot-map.mjs and the tests. */
    mapViewReady?: boolean;
    mapView?: { name: string; problems: Problem[]; far: number };
  }
}

const LAYERS = { roads: 'Roads: numbers, lengths, ends', zones: 'Set pieces', targets: 'Targets', things: 'Start, traffic, herds', grid: 'Grid', far: 'Too far from a road', problems: 'Problems' } as const;
type Layer = keyof typeof LAYERS;

const params = new URLSearchParams(location.search);
/** ?layers=roads,far picks the layers to start with (all but the grid when left out). */
const shown = new Set<Layer>((params.get('layers')?.split(',') ?? Object.keys(LAYERS).filter((l) => l !== 'grid')) as Layer[]);
/** The camera's furthest reach (render.ts): a frame is never zoomed out further than this allows. */
const CAMERA_FAR = 880;
const TAN = Math.tan((CAMERA_FOV * Math.PI) / 360);

document.title = 'Driving map viewer';
document.body.style.cssText = 'margin:0;font:14px system-ui,sans-serif;background:#222;color:#eee;display:flex;flex-direction:column;height:100vh;overflow:hidden';
document.body.innerHTML = `
  <header style="display:flex;gap:12px;align-items:center;padding:6px 10px;background:#111;flex-wrap:wrap">
    <strong>Map viewer</strong>
    <label>Map <select id="pick"></select></label>
    <label>Open a file <input id="file" type="file" accept=".json,application/json"></label>
    <span id="layers" style="display:flex;gap:10px;flex-wrap:wrap"></span>
    <label>Reach <input id="reach" type="number" min="5" max="200" step="5" value="${ROAD_REACH}" style="width:4em"> m</label>
    <span id="status" style="margin-left:auto;opacity:.8"></span>
  </header>
  <main style="flex:1;display:flex;min-height:0">
    <div id="stage" style="position:relative;flex:1;min-width:0;cursor:grab">
      <canvas id="three" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
      <canvas id="over" style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    </div>
    <aside style="width:300px;overflow:auto;padding:8px 10px;background:#1a1a1a;font-size:13px">
      <h3 style="margin:4px 0">Problems</h3><ol id="problems" style="padding-left:20px;margin:0"></ol>
      <h3 style="margin:12px 0 4px">Roads</h3><table id="roads" style="border-collapse:collapse;width:100%"></table>
    </aside>
  </main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLDivElement>('stage');
const three = $<HTMLCanvasElement>('three');
const over = $<HTMLCanvasElement>('over');
const status = $<HTMLSpanElement>('status');

const pick = $<HTMLSelectElement>('pick');
for (const [id, m] of Object.entries(builtInMaps())) pick.add(new Option(`${m.name} (${id})`, id));
pick.add(new Option('From the editor (look)', 'editor'));
const current = params.get('map') ?? 'island';
if (![...pick.options].some((o) => o.value === current)) pick.add(new Option(current, current));
pick.value = current;
pick.onchange = () => {
  params.set('map', pick.value);
  location.search = params.toString();
};

for (const [layer, name] of Object.entries(LAYERS) as [Layer, string][]) {
  const box = document.createElement('label');
  box.innerHTML = `<input type="checkbox" data-layer="${layer}" ${shown.has(layer) ? 'checked' : ''}> ${name}`;
  box.querySelector('input')!.onchange = (e) => {
    if ((e.target as HTMLInputElement).checked) shown.add(layer);
    else shown.delete(layer);
    if (layer === 'far') far = null;
    draw();
  };
  $('layers').append(box);
}

let named: NamedMap | null = null;
let world: World | null = null;
let renderer: Renderer | null = null;
let frame: Frame | null = null;
let problems: Problem[] = [];
let far: { points: [number, number][]; step: number } | null = null;

const size = () => ({ w: stage.clientWidth, h: stage.clientHeight });

/** The camera straight above the frame's middle, high enough that the ground in view is the frame. */
function viewOf(f: Frame): View {
  const up = f.h / 2 / f.scale / TAN;
  // A hair south of straight down, so north is up in the picture.
  return { eye: [f.cx, up, f.cz - up * 1e-4], target: [f.cx, 0, f.cz] };
}

/** Keeps a frame zoomed in enough for the camera to reach the ground. */
const reachable = (f: Frame): Frame => ({ ...f, scale: Math.max(f.scale, f.h / 2 / TAN / CAMERA_FAR) });

function draw(): void {
  if (!named || !world || !renderer || !frame) return;
  const { w, h } = size();
  renderer.resize(w, h, devicePixelRatio);
  renderer.render(world, viewOf(frame));
  const ratio = devicePixelRatio;
  over.width = Math.round(w * ratio);
  over.height = Math.round(h * ratio);
  const g = over.getContext('2d')!;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, w, h);
  const map = named.map, roads = world.roads;
  if (shown.has('grid')) drawGrid(g, frame);
  if (shown.has('far')) {
    const reach = Number($<HTMLInputElement>('reach').value) || ROAD_REACH;
    const span = Math.max(world.land.maxX - world.land.minX, world.land.maxZ - world.land.minZ);
    const step = Math.max(2, Math.round(span / 120));
    far ??= { points: farFromRoad(world, step, reach), step };
    drawFar(g, frame, far.points, far.step);
  }
  if (shown.has('zones')) drawZones(g, frame, map, roads);
  if (shown.has('targets')) drawTargets(g, frame, map, roads);
  if (shown.has('things')) drawThings(g, frame, map, roads);
  if (shown.has('roads')) drawRoadLabels(g, frame, roads);
  if (shown.has('problems')) drawProblems(g, frame, problems);
  const farText = far ? ` · ${far.points.length} cells (${far.step} m) over ${$<HTMLInputElement>('reach').value} m from a road` : '';
  status.textContent = `${named.name} (${map.id}) · ${problems.length} problem${problems.length === 1 ? '' : 's'}${farText}`;
  window.mapView = { name: named.name, problems, far: far?.points.length ?? 0 };
}

function show(m: NamedMap): void {
  renderer?.dispose();
  named = m;
  world = makeWorld(7, m.map.propCount ?? 150, 'free', m.map);
  renderer = createRenderer(three, world, '#e94b3c');
  const { w, h } = size();
  frame = reachable(fitFrame(m.map, w, h));
  problems = allProblems(docFromMap(m.map, m.name));
  far = null;
  const list = $<HTMLOListElement>('problems');
  list.innerHTML = '';
  for (const p of problems) list.append(Object.assign(document.createElement('li'), { textContent: p.text }));
  if (!problems.length) list.innerHTML = '<li style="list-style:none;margin-left:-20px;color:#8f8">None.</li>';
  const table = $<HTMLTableElement>('roads');
  table.innerHTML = '<tr><th align=left>Road</th><th align=left>Kind</th><th align=right>Length</th><th align=left>Joins</th></tr>';
  m.map.roads.forEach((def, i) => {
    const len = buildRoad(def).length;
    const joins = def.closed ? (def.oneWay ? 'one-way loop' : 'loop') : `${def.from ?? 'dead end'} → ${def.to ?? 'dead end'}`;
    table.insertAdjacentHTML('beforeend', `<tr><td>${i}</td><td>${def.kind}, ${def.width} m</td><td align=right>${len.toFixed(0)} m</td><td>${joins}</td></tr>`);
  });
  draw();
  window.mapViewReady = true;
  stage.dataset.ready = 'true';
}

$<HTMLInputElement>('reach').onchange = () => {
  far = null;
  draw();
};

$<HTMLInputElement>('file').onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const parsed = parseMapFile(await file.text());
  if (parsed.ok) show({ name: parsed.name, map: parsed.map });
  else status.textContent = `${file.name}: ${parsed.reason}`;
};

// Scroll to zoom about the pointer; drag to move.
stage.addEventListener('wheel', (e) => {
  if (!frame) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect();
  frame = reachable(zoomAt(frame, e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015)));
  draw();
}, { passive: false });
let drag: { x: number; y: number; f: Frame } | null = null;
stage.addEventListener('pointerdown', (e) => {
  if (!frame) return;
  drag = { x: e.clientX, y: e.clientY, f: frame };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (!frame) return;
    const r = stage.getBoundingClientRect();
    const [x, z] = toMap(frame, e.clientX - r.left, e.clientY - r.top);
    stage.title = `x ${x.toFixed(1)}, z ${z.toFixed(1)}`;
    return;
  }
  const s = drag.f.scale;
  frame = { ...drag.f, cx: drag.f.cx + (e.clientX - drag.x) / s, cz: drag.f.cz + (e.clientY - drag.y) / s };
  draw();
});
stage.addEventListener('pointerup', () => {
  drag = null;
});
window.addEventListener('resize', () => {
  if (!frame) return;
  const { w, h } = size();
  frame = reachable({ ...frame, w, h });
  draw();
});

void loadMap(current).then((m) => {
  if ('error' in m) {
    status.textContent = m.error;
    window.mapViewReady = true;
    stage.dataset.ready = 'error';
    return;
  }
  show(m);
});
