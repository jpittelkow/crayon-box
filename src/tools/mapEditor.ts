// Dev tool: the map editor (docs/recipes/maps.md, "Making a map with the editor"; ADR 0043). A driving map drawn flat
// from above on a canvas: draw and drag roads, the shoreline, streams and sand; place set pieces, targets, water,
// traffic, herds, boats, hills and the start; see the map's problems as they happen (the same checks as a map file
// gets when the game loads it, plus the editor's own); undo; save a map file for the maps folder. "Look" shows it in
// the map viewer, drawn by the game. Open http://localhost:5173/tools/map-editor.html?map=island (or site, test-loop,
// or a .json file's address on the dev server) while `npm run dev` runs. Nothing here ships in the app.
import { farFromRoad, mapProblems } from '../games/racing/maps/check';
import { parseMapFile } from '../games/racing/maps/file';
import { ANIMAL_IDS, type AnimalId } from '../games/racing/sim/assets/animals';
import { buildLand, onLand } from '../games/racing/sim/land';
import type { MapDef, ZoneKind } from '../games/racing/sim/map';
import { buildRoad, nearestOn, type Road } from '../games/racing/sim/roads';
import { makeWorld, VEHICLE_SIZE, type VehicleKind, type World } from '../games/racing/sim/sim';
import {
  drawFar, drawGrid, drawGround, drawMarkerRing, drawProblems, drawRoadLabels, drawScatter, drawTargets, drawThings,
  drawZones, fitFrame, label, toMap, toScreen, zoomAt, type Frame,
} from './mapDraw';
import {
  addAnimals, addBoat, addHill, addPool, addPuddle, addRoad, addSand, addStream, addTarget, addTraffic, addZone,
  allProblems, deleteItem, docFromFile, docFromMap, docToFile, handles, History, insertPoint, itemValue, markers,
  moveItem, owner, setItemValue, setLand, setSettings, setSpawn, settingsValue, ZONE_R, type Doc, type Item, type PoolKind,
  type Problem, type Pt,
} from './mapEdit';
import { builtInMaps, LOOK_KEY, loadMap } from './mapSource';

declare global {
  interface Window {
    /** For the browser test: the editor's state, and the map checks to run on a saved file. */
    mapEditor?: {
      readonly doc: Doc;
      readonly problems: Problem[];
      /** True once the problems shown are for the map as it is now. */
      readonly checked: boolean;
      readonly selected: Item | null;
      /** Where a map place is on the page, in CSS pixels. */
      pageXY(x: number, z: number): [number, number];
      /** The selected line's control points (to drag), on the page. */
      handlesXY(): [number, number][];
      /** What a click at a place on the page would select. */
      itemAt(pageX: number, pageY: number): Item | null;
      /** What `maps/check.ts` and `maps/file.ts` say about a map file's text: empty when it would load. */
      checkFile(text: string): string[];
    };
  }
}

type Tool =
  | 'select' | 'road' | 'loop' | 'land' | 'stream' | 'sand' | 'zone' | 'star' | 'stack' | 'pool' | 'puddle' | 'traffic'
  | 'animal' | 'boat' | 'hill' | 'spawn';

/** The tools, with what each does (shown as the button's title). */
const TOOLS: [Tool, string, string][] = [
  ['select', 'Select / move', 'Click a thing to select it, drag it to move it. Click a road, the shore, a stream or sand to show its points; drag a point; double-click the line to add a point; Delete removes. Drag empty ground to move the view; scroll to zoom.'],
  ['road', 'Road', 'Click points, double-click (or Enter) to finish. An end on another road joins it.'],
  ['loop', 'Loop road', 'Click points round the loop, double-click (or Enter) to finish.'],
  ['land', 'Land outline', 'Click points round the new shoreline, double-click (or Enter) to finish. Replaces the old one.'],
  ['stream', 'Stream', 'Click points along it, double-click (or Enter) to finish. Place a ford where it crosses a road.'],
  ['sand', 'Sand', 'Click points round a sandy place, double-click (or Enter) to finish.'],
  ['zone', 'Set piece', 'Click a road to put the set piece there; a roundabout makes its ring where you click.'],
  ['star', 'Star row', 'Click a road: a row of four stars along it.'],
  ['stack', 'Box stack', 'Click beside a road: a stack of boxes just off it.'],
  ['pool', 'Pool', 'Click by a road: a pool there (the flood is a deep one).'],
  ['puddle', 'Puddle', 'Click a road: a puddle on it.'],
  ['traffic', 'Traffic', 'Click a road: a vehicle in the lane on that side.'],
  ['animal', 'Herd', 'Click the land: a herd that wanders there.'],
  ['boat', 'Boat', 'Click the water: a moored boat.'],
  ['hill', 'Hill', 'Click the land: a hill (change its size in the details).'],
  ['spawn', 'Start', 'Click a road: the kid\'s car starts there.'],
];
const CLOSED: Partial<Record<Tool, boolean>> = { road: false, loop: true, land: true, stream: false, sand: true };
const ZONE_KINDS: ZoneKind[] = ['ramp', 'car-wash', 'garage', 'mud', 'ford', 'lights', 'roundabout', 'harbour', 'helipad'];

/** What the editor can't make yet, shown beside it (and in recipes/maps.md). */
const NOT_YET = [
  'Bridges and tunnels: shown, and changed or deleted in the details (from, to); not drawn yet.',
  'A harbour\'s way out to sea (sail): change it in the details as points.',
  'Single trees, toys and bushes: the game scatters them by the map settings\' rules.',
  'Districts and roads on two levels: not in the map format yet.',
];

const params = new URLSearchParams(location.search);

document.title = 'Driving map editor';
document.body.style.cssText = 'margin:0;font:13px system-ui,sans-serif;background:#222;color:#eee;display:flex;flex-direction:column;height:100vh;overflow:hidden';
document.body.innerHTML = `
  <header style="display:flex;gap:10px;align-items:center;padding:6px 10px;background:#111;white-space:nowrap">
    <strong>Map editor</strong>
    <label>Open <select id="open"></select></label>
    <input id="file" type="file" accept=".json,application/json" title="Open a map file">
    <label>Name <input id="name" size="18"></label>
    <button id="undo">Undo</button><button id="redo">Redo</button>
    <button id="look" title="Show this map in the map viewer, drawn by the game">Look</button>
    <button id="save">Save map file</button>
    <span id="status" style="flex:1 1 200px;min-width:0;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right"></span>
    <span id="coords" style="opacity:.6;min-width:9em;text-align:right"></span>
  </header>
  <main style="flex:1;display:flex;min-height:0">
    <nav id="tools" style="width:150px;display:flex;flex-direction:column;gap:3px;padding:6px;background:#1a1a1a;overflow:auto"></nav>
    <div id="stage" style="position:relative;flex:1;min-width:0">
      <canvas id="map" style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>
    </div>
    <aside style="width:330px;overflow:auto;padding:6px 10px;background:#1a1a1a">
      <h3 style="margin:4px 0">Selected: <span id="what">nothing</span></h3>
      <textarea id="item" rows="9" style="width:100%;box-sizing:border-box;font:12px monospace" disabled></textarea>
      <div style="display:flex;gap:6px"><button id="apply" disabled>Apply</button><button id="delete" disabled>Delete</button></div>
      <h3 style="margin:12px 0 4px">Problems <span id="count"></span></h3>
      <ol id="problems" style="padding-left:22px;margin:0"></ol>
      <h3 style="margin:12px 0 4px">Show</h3>
      <div id="layers" style="display:flex;flex-direction:column;gap:2px"></div>
      <h3 style="margin:12px 0 4px">Map settings</h3>
      <textarea id="settings" rows="10" style="width:100%;box-sizing:border-box;font:12px monospace"></textarea>
      <button id="apply-settings">Apply settings</button>
      <h3 style="margin:12px 0 4px">Not in the editor yet</h3>
      <ul style="padding-left:18px;margin:0;opacity:.8">${NOT_YET.map((t) => `<li>${t}</li>`).join('')}</ul>
    </aside>
  </main>`;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $<HTMLDivElement>('stage');
const canvas = $<HTMLCanvasElement>('map');
const status = $<HTMLSpanElement>('status');
const say = (text: string, bad = false) => {
  status.textContent = status.title = text;
  status.style.color = bad ? '#ff8080' : '';
};

// State

let history = new History(docFromMap(builtInMaps().island!.map, 'Island'));
let frame: Frame = { cx: 0, cz: 0, scale: 2, w: 1, h: 1 };
let tool: Tool = 'select';
let selected: Item | null = null;
let drawing: Pt[] = [];
let hover: Pt | null = null;
let drag: { kind: 'item'; item: Item; from: Doc; dx: number; dz: number; moved: boolean } | { kind: 'pan'; x: number; y: number; f: Frame } | null = null;
let problems: Problem[] = [];
let checkedDoc: Doc | null = null;
let world: World | null = null;
let far: [number, number][] = [];
const layers = { labels: true, scatter: false, grid: false, far: false };

const doc = () => history.present;
const roadCache = new WeakMap<MapDef, Road[]>();
const roadsOf = (map: MapDef) => {
  let r = roadCache.get(map);
  if (!r) {
    r = map.roads.map(buildRoad);
    roadCache.set(map, r);
  }
  return r;
};
const same = (a: Item | null, b: Item | null) => JSON.stringify(a) === JSON.stringify(b);

// The tool bar

const kindSelect = (id: string, options: readonly string[]) => {
  const s = document.createElement('select');
  s.id = id;
  for (const o of options) s.add(new Option(o.replace(/^[a-z]+\//, ''), o));
  s.style.width = '100%';
  return s;
};
const toolKinds: Partial<Record<Tool, HTMLSelectElement>> = {
  road: kindSelect('road-kind', ['street', 'dirt']),
  loop: kindSelect('loop-kind', ['street', 'dirt']),
  zone: kindSelect('zone-kind', ZONE_KINDS),
  pool: kindSelect('pool-kind', ['deep', 'shallow', 'mud']),
  traffic: kindSelect('traffic-kind', Object.keys(VEHICLE_SIZE)),
  animal: kindSelect('animal-kind', ANIMAL_IDS),
};
const toolButtons = new Map<Tool, HTMLButtonElement>();
for (const [t, name, help] of TOOLS) {
  const b = document.createElement('button');
  b.textContent = name;
  b.title = help;
  b.dataset.tool = t;
  b.style.textAlign = 'left';
  b.onclick = () => setTool(t);
  toolButtons.set(t, b);
  $('tools').append(b);
  if (toolKinds[t]) $('tools').append(toolKinds[t]!);
}

function setTool(t: Tool): void {
  tool = t;
  drawing = [];
  for (const [k, b] of toolButtons) {
    b.style.background = k === t ? '#ffd23f' : '';
    b.style.fontWeight = k === t ? '700' : '';
  }
  canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
  say(TOOLS.find(([k]) => k === t)![2]);
  draw();
}

for (const [layer, name] of [['labels', 'Names and road numbers'], ['scatter', 'Trees and toys (as the game scatters them)'], ['grid', 'Grid (x, z as in the file)'], ['far', 'Too far from a road (red)']] as const) {
  const box = document.createElement('label');
  box.innerHTML = `<input type="checkbox" ${layers[layer] ? 'checked' : ''}> ${name}`;
  box.querySelector('input')!.onchange = (e) => {
    layers[layer] = (e.target as HTMLInputElement).checked;
    checkSoon();
    draw();
  };
  $('layers').append(box);
}

// Changes

/** Keeps a change as a step to undo, and shows it. */
function change(next: Doc, select?: Item | null): void {
  history.commit(next);
  if (select !== undefined) selected = select;
  // A thing deleted, or a list shortened, leaves nothing to select.
  if (selected && itemExists(selected) === false) selected = null;
  refresh();
}

/** Tries an editing operation; one that can't be done says why. */
function attempt(op: () => Doc, select?: (d: Doc) => Item | null): void {
  try {
    const next = op();
    change(next, select ? select(next) : undefined);
  } catch (err) {
    say((err as Error).message, true);
  }
}

function itemExists(item: Item): boolean {
  try {
    return itemValue(doc(), item) !== undefined && (item.type !== 'puddle' || doc().map.water.puddles[item.g]!.at[item.i] !== undefined);
  } catch {
    return false;
  }
}

/** Shows the document now: the picture, the details, the buttons; checks it again shortly. */
function refresh(): void {
  const d = doc();
  ($<HTMLButtonElement>('undo')).disabled = !history.canUndo;
  ($<HTMLButtonElement>('redo')).disabled = !history.canRedo;
  const name = $<HTMLInputElement>('name');
  if (document.activeElement !== name) name.value = d.name;
  $<HTMLTextAreaElement>('settings').value = JSON.stringify(settingsValue(d), null, 1);
  showSelected();
  checkSoon();
  draw();
}

function describe(item: Item): string {
  switch (item.type) {
    case 'spawn': return 'the start';
    case 'road': case 'roadPoint': return `road ${item.i}${item.type === 'roadPoint' ? `, point ${item.k}` : ''}`;
    case 'land': return 'the land';
    case 'landPoint': return `the shoreline, point ${item.k}`;
    case 'stream': case 'streamPoint': return `stream ${item.i}${item.type === 'streamPoint' ? `, point ${item.k}` : ''}`;
    case 'sand': case 'sandPoint': return `sand ${item.i}${item.type === 'sandPoint' ? `, point ${item.k}` : ''}`;
    case 'zone': return `set piece ${item.i} (${doc().map.zones![item.i]!.kind})`;
    case 'target': return `target ${item.i}`;
    case 'pool': return `pool ${item.i}`;
    case 'puddle': return `puddles ${item.g}, puddle ${item.i}`;
    case 'traffic': return `traffic ${item.i}`;
    case 'animal': return `herd ${item.i}`;
    case 'boat': return `boat ${item.i}`;
    case 'hill': return `hill ${item.i}`;
    case 'guard': return `${doc().map.guards![item.i]!.kind} ${item.i}`;
  }
}

function showSelected(): void {
  const box = $<HTMLTextAreaElement>('item');
  $('what').textContent = selected ? describe(selected) : 'nothing';
  box.value = selected ? JSON.stringify(itemValue(doc(), selected), null, 1) : '';
  box.disabled = !selected;
  $<HTMLButtonElement>('apply').disabled = !selected;
  $<HTMLButtonElement>('delete').disabled = !selected;
}

// Problems, checked a moment after the map changes (a drag is checked when it pauses)

let timer = 0;
function checkSoon(): void {
  clearTimeout(timer);
  timer = window.setTimeout(check, 120);
}

function check(): void {
  const d = doc();
  problems = allProblems(d);
  world = null;
  far = [];
  if (layers.scatter || layers.far) {
    try {
      world = makeWorld(7, d.map.propCount ?? 150, 'free', d.map);
      if (layers.far) far = farFromRoad(world, 3);
    } catch {
      world = null;
    }
  }
  checkedDoc = d;
  const list = $<HTMLOListElement>('problems');
  list.innerHTML = '';
  $('count').textContent = `(${problems.length})`;
  problems.forEach((p) => {
    const li = document.createElement('li');
    li.textContent = p.text;
    li.className = 'problem';
    li.style.cssText = 'color:#ffb0b0;margin-bottom:4px;cursor:pointer';
    li.onclick = () => {
      if (p.x === undefined || p.z === undefined) return;
      frame = { ...frame, cx: p.x, cz: p.z };
      draw();
    };
    list.append(li);
  });
  if (!problems.length) list.innerHTML = '<li style="list-style:none;margin-left:-22px;color:#8f8">None: this map would load in the game.</li>';
  stage.dataset.problems = String(problems.length);
  draw();
}

// Drawing

function draw(): void {
  const w = stage.clientWidth, h = stage.clientHeight, ratio = devicePixelRatio;
  frame = { ...frame, w, h };
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const g = canvas.getContext('2d')!;
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  const d = doc(), map = d.map;
  let roads: Road[];
  try {
    roads = roadsOf(map);
  } catch {
    roads = [];
  }
  drawGround(g, frame, map, roads);
  if (layers.far && checkedDoc === d) drawFar(g, frame, far, 3);
  if (layers.scatter && world && checkedDoc === d) drawScatter(g, frame, world);
  if (layers.grid) drawGrid(g, frame);
  drawZones(g, frame, map, roads);
  drawTargets(g, frame, map, roads);
  drawThings(g, frame, map, roads, layers.labels);
  if (layers.labels) drawRoadLabels(g, frame, roads);
  for (const m of markers(map, roads)) {
    if (m.item.type === 'guard' || m.item.type === 'hill' || m.item.type === 'pool' || m.item.type === 'puddle') {
      const [sx, sy] = toScreen(frame, m.x, m.z);
      g.beginPath();
      g.arc(sx, sy, 3, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
      if (layers.labels && m.item.type !== 'puddle') label(g, m.label, sx, sy + 10, '#1d2733', 10);
    }
  }
  // The selection: its line drawn over, its control points to drag, or a ring round it.
  if (selected) {
    const line = owner(selected);
    const pts = line.type === 'road' ? map.roads[line.i]?.points : line.type === 'land' ? map.land.outline : line.type === 'stream' ? map.water.streams?.[line.i]?.points : line.type === 'sand' ? map.sand?.[line.i] : undefined;
    if (pts) {
      g.beginPath();
      pts.forEach(([x, z], k) => {
        const [sx, sy] = toScreen(frame, x, z);
        if (k) g.lineTo(sx, sy);
        else g.moveTo(sx, sy);
      });
      if (line.type !== 'stream' && (line.type !== 'road' || map.roads[line.i]!.closed)) g.closePath();
      g.strokeStyle = '#ff2bd6';
      g.lineWidth = 2;
      g.stroke();
      for (const hnd of handles(d, selected)) {
        const [sx, sy] = toScreen(frame, hnd.x, hnd.z);
        g.fillStyle = same(hnd.item, selected) ? '#ff2bd6' : '#ffffff';
        g.strokeStyle = '#ff2bd6';
        g.lineWidth = 2;
        g.fillRect(sx - 5, sy - 5, 10, 10);
        g.strokeRect(sx - 5, sy - 5, 10, 10);
      }
    } else {
      const m = markers(map, roads).find((x) => same(x.item, selected));
      if (m) drawMarkerRing(g, frame, m);
    }
  }
  // A line being drawn.
  if (drawing.length) {
    const pts = hover ? [...drawing, hover] : drawing;
    g.beginPath();
    pts.forEach(([x, z], k) => {
      const [sx, sy] = toScreen(frame, x, z);
      if (k) g.lineTo(sx, sy);
      else g.moveTo(sx, sy);
    });
    if (CLOSED[tool]) g.closePath();
    g.setLineDash([6, 4]);
    g.strokeStyle = '#ff2bd6';
    g.lineWidth = 2;
    g.stroke();
    g.setLineDash([]);
    for (const [x, z] of drawing) {
      const [sx, sy] = toScreen(frame, x, z);
      g.fillStyle = '#ff2bd6';
      g.fillRect(sx - 4, sy - 4, 8, 8);
    }
  }
  drawProblems(g, frame, checkedDoc === d ? problems : []);
}

// Picking what is under the pointer

const local = (e: { clientX: number; clientY: number }): [number, number] => {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
};

function pick(sx: number, sy: number): Item | null {
  const d = doc(), map = d.map, roads = roadsOf(map);
  const [x, z] = toMap(frame, sx, sy);
  const px = (sx2: number, sy2: number) => Math.hypot(sx2 - sx, sy2 - sy);
  // The selected line's control points first.
  let best: { item: Item; d: number } | null = null;
  for (const hnd of handles(d, selected)) {
    const dd = px(...toScreen(frame, hnd.x, hnd.z));
    if (dd <= 9 && (!best || dd < best.d)) best = { item: hnd.item, d: dd };
  }
  if (best) return best.item;
  for (const m of markers(map, roads)) {
    const dd = px(...toScreen(frame, m.x, m.z));
    if (dd <= 10 && (!best || dd < best.d)) best = { item: m.item, d: dd };
  }
  if (best) return best.item;
  // Inside a set piece's zone.
  for (const [i, zone] of (map.zones ?? []).entries()) {
    const m = markers(map, roads).find((mm) => same(mm.item, { type: 'zone', i }));
    if (m && Math.hypot(m.x - x, m.z - z) <= zone.r) return { type: 'zone', i };
  }
  // On a road, a stream, sand, or near the shoreline.
  let road: { i: number; gap: number } | null = null;
  roads.forEach((r, i) => {
    const gap = nearestOn(r, i, x, z).dist * frame.scale - (r.def.width / 2) * frame.scale;
    if (gap <= 4 && (!road || gap < road.gap)) road = { i, gap };
  });
  if (road) return { type: 'road', i: (road as { i: number }).i };
  for (const [i, s] of (map.water.streams ?? []).entries()) {
    const r = buildRoad({ kind: 'street', width: s.width, closed: false, points: s.points });
    if (nearestOn(r, 0, x, z).dist * frame.scale <= (s.width / 2) * frame.scale + 4) return { type: 'stream', i };
  }
  for (const [i, s] of (map.sand ?? []).entries()) if (s.length >= 3 && onLand(buildLand({ outline: s, beach: 0 }), x, z)) return { type: 'sand', i };
  const shore = buildRoad({ kind: 'street', width: 1, closed: true, points: map.land.outline });
  if (nearestOn(shore, 0, x, z).dist * frame.scale <= 8) return { type: 'land' };
  return null;
}

/** Where a marker or control point is, for grabbing it without a jump. */
function whereIs(item: Item): Pt | null {
  const d = doc();
  const hnd = handles(d, item).find((h) => same(h.item, item)) ?? handles(d, owner(item)).find((h) => same(h.item, item));
  if (hnd) return [hnd.x, hnd.z];
  const m = markers(d.map, roadsOf(d.map)).find((mm) => same(mm.item, item));
  return m ? [m.x, m.z] : null;
}

// Placing

function place(x: number, z: number): void {
  const d = doc();
  const kind = toolKinds[tool]?.value;
  const last = (list: unknown[] | undefined) => (list?.length ?? 0) - 1;
  switch (tool) {
    case 'zone': return attempt(() => addZone(d, kind as ZoneKind, x, z), (n) => ({ type: 'zone', i: last(n.map.zones) }));
    case 'star': return attempt(() => addTarget(d, 'toy/star', x, z), (n) => ({ type: 'target', i: last(n.map.targets) }));
    case 'stack': return attempt(() => addTarget(d, 'toy/box-stack', x, z), (n) => ({ type: 'target', i: last(n.map.targets) }));
    case 'pool': return attempt(() => addPool(d, kind as PoolKind, x, z), (n) => ({ type: 'pool', i: last(n.map.water.pools) }));
    case 'puddle': return attempt(() => addPuddle(d, x, z), () => null);
    case 'traffic': return attempt(() => addTraffic(d, kind as VehicleKind, x, z), (n) => ({ type: 'traffic', i: last(n.map.traffic) }));
    case 'animal': return attempt(() => addAnimals(d, kind as AnimalId, x, z), (n) => ({ type: 'animal', i: last(n.map.animals) }));
    case 'boat': return attempt(() => addBoat(d, x, z), (n) => ({ type: 'boat', i: last(n.map.boats) }));
    case 'hill': return attempt(() => addHill(d, x, z), (n) => ({ type: 'hill', i: last(n.map.hills) }));
    case 'spawn': return attempt(() => setSpawn(d, x, z), () => ({ type: 'spawn' }));
    default: break;
  }
}

/** Ends the line being drawn and makes it. */
function finishDrawing(): void {
  // A double-click adds its point twice.
  const pts = drawing.filter((p, k) => k === 0 || Math.hypot(p[0] - drawing[k - 1]![0], p[1] - drawing[k - 1]![1]) * frame.scale > 2);
  const kind = toolKinds[tool]?.value as 'street' | 'dirt' | undefined;
  const t = tool;
  drawing = [];
  if (pts.length < 2) return draw();
  const d = doc();
  switch (t) {
    case 'road': return attempt(() => addRoad(d, pts, { kind, closed: false }), (n) => ({ type: 'road', i: n.map.roads.length - 1 }));
    case 'loop': return attempt(() => addRoad(d, pts, { kind, closed: true }), (n) => ({ type: 'road', i: n.map.roads.length - 1 }));
    case 'land': return attempt(() => setLand(d, pts), () => ({ type: 'land' }));
    case 'stream': return attempt(() => addStream(d, pts), (n) => ({ type: 'stream', i: n.map.water.streams!.length - 1 }));
    case 'sand': return attempt(() => addSand(d, pts), (n) => ({ type: 'sand', i: n.map.sand!.length - 1 }));
    default: return draw();
  }
}

// The pointer

canvas.addEventListener('pointerdown', (e) => {
  const [sx, sy] = local(e);
  canvas.setPointerCapture(e.pointerId);
  // The middle or right button always moves the view.
  if (e.button !== 0) {
    drag = { kind: 'pan', x: e.clientX, y: e.clientY, f: frame };
    return;
  }
  const [x, z] = toMap(frame, sx, sy);
  if (tool === 'select') {
    const item = pick(sx, sy);
    if (!item) {
      selected = null;
      showSelected();
      drag = { kind: 'pan', x: e.clientX, y: e.clientY, f: frame };
      draw();
      return;
    }
    selected = item;
    showSelected();
    const at = whereIs(item);
    if (at && !['road', 'land', 'stream', 'sand', 'guard'].includes(item.type)) {
      drag = { kind: 'item', item, from: doc(), dx: at[0] - x, dz: at[1] - z, moved: false };
    }
    draw();
    return;
  }
  if (CLOSED[tool] !== undefined) {
    // Clicking the first point again closes a loop.
    const first = drawing[0];
    const [fx, fy] = first ? toScreen(frame, ...first) : [Infinity, Infinity];
    if (CLOSED[tool] && drawing.length >= 3 && Math.hypot(sx - fx, sy - fy) < 10) {
      finishDrawing();
      return;
    }
    drawing.push([x, z]);
    draw();
    return;
  }
  place(x, z);
});

canvas.addEventListener('pointermove', (e) => {
  const [sx, sy] = local(e);
  const [x, z] = toMap(frame, sx, sy);
  hover = [x, z];
  if (!drag) {
    $('coords').textContent = `x ${x.toFixed(1)}, z ${z.toFixed(1)}`;
    if (drawing.length) draw();
    return;
  }
  if (drag.kind === 'pan') {
    const s = drag.f.scale;
    frame = { ...drag.f, cx: drag.f.cx + (e.clientX - drag.x) / s, cz: drag.f.cz + (e.clientY - drag.y) / s };
    draw();
    return;
  }
  try {
    history.preview(moveItem(drag.from, drag.item, x + drag.dx, z + drag.dz));
    drag.moved = true;
    showSelected();
    checkSoon();
    draw();
  } catch (err) {
    say((err as Error).message, true);
  }
});

canvas.addEventListener('pointerup', () => {
  if (drag?.kind === 'item') {
    if (drag.moved) change(history.present);
    else history.cancel();
  }
  drag = null;
});

canvas.addEventListener('dblclick', (e) => {
  if (tool !== 'select') {
    if (drawing.length) finishDrawing();
    return;
  }
  const [sx, sy] = local(e);
  const item = pick(sx, sy);
  if (!item || !selected || !same(owner(item), owner(selected)) || item.type.endsWith('Point')) return;
  const [x, z] = toMap(frame, sx, sy);
  attempt(() => insertPoint(doc(), owner(selected!), x, z));
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  frame = zoomAt(frame, ...local(e), Math.exp(-e.deltaY * 0.0015));
  draw();
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Keys and buttons

const undo = () => {
  history.undo();
  if (selected && !itemExists(selected)) selected = null;
  refresh();
};
const redo = () => {
  history.redo();
  if (selected && !itemExists(selected)) selected = null;
  refresh();
};
const remove = () => {
  if (!selected) return;
  const item = selected;
  attempt(() => deleteItem(doc(), item), () => (item.type.endsWith('Point') ? owner(item) : null));
};

window.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    remove();
  } else if (e.key === 'Enter' && drawing.length) {
    finishDrawing();
  } else if (e.key === 'Escape') {
    if (drawing.length) {
      drawing = [];
      draw();
    } else setTool('select');
  }
});

$('undo').onclick = undo;
$('redo').onclick = redo;
$('delete').onclick = remove;
$('apply').onclick = () => {
  if (!selected) return;
  const item = selected;
  try {
    const value = JSON.parse($<HTMLTextAreaElement>('item').value);
    attempt(() => setItemValue(doc(), item, value));
  } catch (err) {
    say(`The details aren't valid JSON: ${(err as Error).message}`, true);
  }
};
$('apply-settings').onclick = () => {
  try {
    const value = JSON.parse($<HTMLTextAreaElement>('settings').value);
    attempt(() => setSettings(doc(), value));
  } catch (err) {
    say(`The settings aren't valid JSON: ${(err as Error).message}`, true);
  }
};
$<HTMLInputElement>('name').onchange = (e) => {
  const name = (e.target as HTMLInputElement).value;
  change({ ...doc(), name });
};

$('save').onclick = () => {
  const d = doc();
  const text = docToFile(d);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = `${d.map.id}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const n = allProblems(d).length;
  say(n ? `Saved ${a.download}, with ${n} problem${n === 1 ? '' : 's'}: the game will leave it out until they are fixed.` : `Saved ${a.download}: drop it in the maps folder (ADR 0043).`, n > 0);
};

$('look').onclick = () => {
  try {
    localStorage.setItem(LOOK_KEY, docToFile(doc()));
  } catch (err) {
    say(`The map couldn't be handed to the viewer: ${(err as Error).message}`, true);
    return;
  }
  window.open('driving-map.html?map=editor', 'crayon-box-map-look');
};

// Opening a map

const open = $<HTMLSelectElement>('open');
for (const [id, m] of Object.entries(builtInMaps())) open.add(new Option(`${m.name} (${id})`, id));
open.onchange = () => {
  params.set('map', open.value);
  location.search = params.toString();
};

function start(d: Doc): void {
  history = new History(d);
  selected = null;
  drawing = [];
  frame = fitFrame(d.map, stage.clientWidth, stage.clientHeight);
  refresh();
  stage.dataset.ready = 'true';
}

$<HTMLInputElement>('file').onchange = async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const opened = docFromFile(await file.text());
  if ('error' in opened) say(`${file.name}: ${opened.error}`, true);
  else start(opened);
};

window.addEventListener('resize', draw);

window.mapEditor = {
  get doc() {
    return doc();
  },
  get problems() {
    return problems;
  },
  get checked() {
    return checkedDoc === doc();
  },
  get selected() {
    return selected;
  },
  pageXY(x, z) {
    const r = canvas.getBoundingClientRect();
    const [sx, sy] = toScreen(frame, x, z);
    return [r.left + sx, r.top + sy];
  },
  handlesXY() {
    return handles(doc(), selected).map((h) => this.pageXY(h.x, h.z));
  },
  itemAt(pageX, pageY) {
    const r = canvas.getBoundingClientRect();
    return pick(pageX - r.left, pageY - r.top);
  },
  checkFile(text) {
    const parsed = parseMapFile(text);
    return parsed.ok ? mapProblems(parsed.map) : [parsed.reason];
  },
};

setTool('select');
const wanted = params.get('map');
void loadMap(wanted).then((m) => {
  if ('error' in m) {
    say(m.error, true);
    start(history.present);
    return;
  }
  if (wanted && [...open.options].some((o) => o.value === wanted)) open.value = wanted;
  start(docFromMap(m.map, m.name));
});
// Keep the zone sizes in the help of the set piece tool.
toolKinds.zone!.title = Object.entries(ZONE_R).map(([k, r]) => `${k}: ${r} m`).join(', ');
