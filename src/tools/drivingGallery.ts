// Dev tool: the driving game's asset gallery (driving-assets.md, "How a new asset gets made"). Every registered
// asset, by category, drawn by the game's own renderer on a small gallery map, labelled with its id and triangle
// count. Open http://localhost:5173/tools/driving-gallery.html while `npm run dev` runs; add ?row=vehicles (or
// toys, scenery, effects) to look closer at one row. Nothing here ships in the app.
import * as THREE from 'three';
import { DECOR_LOOKS, SCENERY_LOOKS } from '../games/racing/look/scenery';
import { TOY_LOOKS } from '../games/racing/look/toys';
import { buildVehicle } from '../games/racing/look/vehicles';
import { createRenderer } from '../games/racing/render';
import { CATEGORIES } from '../games/racing/sim/assets';
import { SCENERY_IDS } from '../games/racing/sim/assets/scenery';
import { STACK_ROWS, STAR_HEIGHT, TOYS, TOY_IDS } from '../games/racing/sim/assets/toys';
import { roundOutline } from '../games/racing/sim/land';
import type { MapDef } from '../games/racing/sim/map';
import { smoothPath } from '../games/racing/sim/roads';
import { CONFETTI_LIFE, DROP_LIFE, makeWorld, type Prop, type VehicleKind } from '../games/racing/sim/sim';
import type { View } from '../games/racing/sim/view';

/** Rows, front to back; the camera looks at them from +z. */
const ROW = { vehicles: -16, toys: -6, scenery: 4, effects: 13 } as const;
type RowName = keyof typeof ROW;
/** ?row=toys looks at one row, close up, with the other rows taken away so nothing stands in front of it. */
const only = new URLSearchParams(location.search).get('row') as RowName | null;
const showRow = (row: RowName) => !only || !(only in ROW) || only === row;

/** A small map that shows the ground, a road, water, sand, sea, bushes and sky as the game draws them. */
const GALLERY: MapDef = {
  id: 'gallery',
  land: { outline: roundOutline(0, 0, 62), beach: 8 },
  roads: [{ kind: 'street', width: 9, closed: true, points: smoothPath([[-42, -26], [0, -34], [42, -26], [46, 18], [0, 30], [-46, 18]], true) }],
  spawn: { road: 0, at: 0 },
  traffic: [],
  water: { pools: [{ on: { road: 0, at: 0.62 }, r: 7, deep: true }], puddles: [{ road: 0, at: [0.3], spread: 0, size: [2.6, 0] }] },
  trees: { kinds: [{ id: 'scenery/pine', share: 1 }], count: 0, scale: [1, 0], roadGap: 2, waterGap: 2, edgeGap: 5 },
  props: { kinds: [{ id: 'toy/cone', share: 1 }], nearRoad: 0, spread: 0, edgeGap: 5, spawnGap: 0 },
  // Bushes in the overview and the scenery close-up only, so none stands in front of another row.
  decor: !only || only === 'scenery' ? [{ id: 'decor/bush', clumps: 14, perClump: 3 }] : [],
};

const triangles = (root: THREE.Object3D) => {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const g = o.geometry as THREE.BufferGeometry;
      n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    }
  });
  return Math.round(n);
};

const world = makeWorld(1, 0, 'free', GALLERY);
const labels: { id: string; note: string; x: number; y: number; z: number; row: RowName }[] = [];
const spaced = (count: number, gap: number) => (i: number) => (i - (count - 1) / 2) * gap;

// Vehicles: the kid's car first, then one of every other kind, facing the camera.
const kinds = CATEGORIES.find((c) => c.id === 'vehicles')!.assets.map((id) => id.slice('vehicle/'.length) as VehicleKind);
const vx = spaced(kinds.length, 9);
const proto = world.cars[0]!;
// The renderer always needs a kid's car (cars[0]); off the vehicles row it is parked out of sight behind the camera.
world.cars = kinds.map((kind, i) => ({ ...proto, kind, x: vx(i), z: ROW.vehicles, heading: 0, speed: 0, cruise: 0 }));
if (!showRow('vehicles')) world.cars = [{ ...world.cars[0]!, z: 200 }];
kinds.forEach((kind, i) => labels.push({ id: `vehicle/${kind}`, note: `${triangles(buildVehicle(kind, 0xff0000).group).toLocaleString()} tris`, x: vx(i), y: 4.2, z: ROW.vehicles, row: 'vehicles' }));

// Toys, standing at home: a stack as its whole pyramid of boxes (ADR 0041), a star floating at its height.
const tx = spaced(TOY_IDS.length, 3.8);
const standing = (toy: (typeof TOY_IDS)[number], x: number, y: number, extra: Partial<Prop> = {}): Prop => ({
  toy, homeX: x, homeZ: ROW.toys, homeY: y, homeYaw: 0.5, stack: -1, level: 0, slot: 0, x, y, z: ROW.toys, vx: 0, vy: 0, vz: 0,
  qx: 0, qy: Math.sin(0.25), qz: 0, qw: Math.cos(0.25), wx: 0, wy: 0, wz: 0, scale: 1, state: 0, timer: 0, cool: 0, ...extra,
});
world.props = TOY_IDS.flatMap((toy, i) => {
  if (toy === 'toy/star') return [standing(toy, tx(i), STAR_HEIGHT)];
  if (toy !== 'toy/box-stack') return [standing(toy, tx(i), TOYS[toy].half)];
  // Across the camera's view, so every box shows.
  const half = TOYS[toy].half;
  let slot = 0;
  return STACK_ROWS.flatMap((n, level) => Array.from({ length: n }, (_, j) => standing(toy, tx(i) + (j - (n - 1) / 2) * (half * 2 + 0.04),
    half + level * half * 2, { homeYaw: 0, qy: 0, qw: 1, stack: 0, level, slot: slot++ })));
});
if (!showRow('toys')) world.props = [];
TOY_IDS.forEach((toy, i) => labels.push({
  id: toy, note: `${triangles(TOY_LOOKS[toy]())} tris${toy === 'toy/box-stack' ? ' a box' : ''} · ${TOYS[toy].behaviour}`,
  x: tx(i), y: toy === 'toy/box-stack' ? 2.8 : toy === 'toy/star' ? 2.4 : 1.9, z: ROW.toys, row: 'toys',
}));

// Solid scenery, then decor (drawn by the map as bushes beside the road; labelled where the first one is).
const sx = spaced(SCENERY_IDS.length, 7);
world.trees = SCENERY_IDS.map((kind, i) => ({ kind, x: sx(i), z: ROW.scenery, scale: 1 }));
if (!showRow('scenery')) world.trees = [];
SCENERY_IDS.forEach((id, i) => labels.push({ id, note: `${triangles(SCENERY_LOOKS[id]())} tris`, x: sx(i), y: 5.6, z: ROW.scenery, row: 'scenery' }));
const bushTris = triangles(new THREE.Mesh(new THREE.BufferGeometry().copy(DECOR_LOOKS['decor/bush'].clump(() => 0.5, 0, 0, 1)[0]!)));
labels.push({ id: 'decor/bush', note: `${bushTris} tris a piece · scattered on the map`, x: 10, y: 1.6, z: ROW.scenery, row: 'scenery' });

// Effects, frozen mid-splash: a ring of drops, a puff and a ripple.
if (showRow('effects')) world.drops.slice(0, 14).forEach((d, i) => {
  const a = (i / 14) * Math.PI * 2;
  Object.assign(d, { x: -9 + Math.sin(a) * 1.4, y: 0.8 + (i % 3) * 0.35, z: ROW.effects + Math.cos(a) * 1.4, life: DROP_LIFE * 0.8 });
});
if (showRow('effects')) world.puffs.slice(0, 3).forEach((p, i) => Object.assign(p, { x: -3 + i * 0.5, y: 0.6 + i * 0.3, z: ROW.effects, life: 0.4 }));
if (showRow('effects')) Object.assign(world.ripples[0]!, { x: 3, z: ROW.effects, life: 0.6, size: 1.6 });
labels.push({ id: 'fx/drop', note: 'splash and spray', x: -9, y: 2.4, z: ROW.effects, row: 'effects' });
labels.push({ id: 'fx/puff', note: 'dust', x: -2.5, y: 2.2, z: ROW.effects, row: 'effects' });
labels.push({ id: 'fx/ripple', note: 'wake', x: 3, y: 1.2, z: ROW.effects, row: 'effects' });
// Confetti (ADR 0041), frozen mid-burst: pieces spread in a loose ball, each turned its own way.
if (showRow('effects')) world.confetti.slice(0, 40).forEach((c, i) => {
  const a = i * 2.4, r = 0.4 + (i % 5) * 0.25;
  Object.assign(c, { x: 9 + Math.sin(a) * r, y: 1.2 + ((i * 7) % 10) * 0.12, z: ROW.effects + Math.cos(a) * r, life: CONFETTI_LIFE * 0.6, turn: 6, phase: i * 0.9 });
});
labels.push({ id: 'fx/confetti', note: 'targets', x: 9, y: 2.8, z: ROW.effects, row: 'effects' });

// The overview labels each row once; a close-up labels every asset in its row.
const ROW_NAMES: Record<RowName, string> = { vehicles: 'Vehicles', toys: 'Toys', scenery: 'Solid scenery and decor', effects: 'Effects' };
const shown = only && only in ROW
  ? labels.filter((l) => l.row === only)
  : (Object.keys(ROW) as RowName[]).map((row) => {
    const inRow = labels.filter((l) => l.row === row);
    return { id: ROW_NAMES[row], note: `?row=${row} · ${inRow.length} assets`, x: 24, y: 2, z: ROW[row], row };
  });

// ---- Page ----
document.body.style.cssText = 'margin: 0; background: #1d2733; font: 13px/1.4 system-ui, sans-serif; overflow: hidden';
const canvas = document.createElement('canvas');
canvas.style.cssText = 'display: block; width: 100vw; height: 100vh';
const overlay = document.createElement('div');
overlay.style.cssText = 'position: fixed; inset: 0; pointer-events: none';
// Every category and its ids, folded away in a corner so it never covers the assets.
const panel = document.createElement('details');
panel.style.cssText = 'position: fixed; left: 8px; top: 8px; max-width: 340px; max-height: calc(100vh - 16px); overflow: auto; font-size: 12px; '
  + 'background: rgb(255 255 255 / 0.9); color: #1d2733; padding: 8px 12px; border-radius: 8px';
document.body.append(canvas, overlay, panel);

const shownBy: Record<string, string> = {
  vehicles: 'front row', toys: 'second row', scenery: 'third row', decor: 'bushes on the map', roads: 'the road loop',
  ground: 'the map: grass, sand, a puddle, the flood, the sea', setpieces: 'none built yet', animals: 'none built yet',
  effects: 'back row', sky: 'the sky',
};
const title = document.createElement('summary');
title.textContent = `All assets (${CATEGORIES.reduce((n, c) => n + c.assets.length, 0)} in ${CATEGORIES.length} categories)`;
title.style.cssText = 'font-weight: 600; cursor: pointer';
panel.append(title);
for (const c of CATEGORIES) {
  const row = document.createElement('p');
  row.style.margin = '0 0 4px';
  const name = document.createElement('b');
  name.textContent = `${c.name} (${c.assets.length})`;
  row.append(name, ` · ${shownBy[c.id] ?? ''}`);
  if (c.assets.length) row.append(document.createElement('br'), c.assets.join(', '));
  panel.append(row);
}

const tags = shown.map((l) => {
  const tag = document.createElement('div');
  tag.style.cssText = 'position: absolute; transform: translate(-50%, -100%); white-space: nowrap; text-align: center; '
    + 'background: rgb(29 39 51 / 0.82); color: #fff; padding: 2px 6px; border-radius: 6px; font-size: 12px';
  const id = document.createElement('b');
  id.textContent = l.id;
  tag.append(id, document.createElement('br'), l.note);
  overlay.append(tag);
  return tag;
});

const renderer = createRenderer(canvas, world, '#3a86ff');
const view: View = only && only in ROW
  ? { eye: [0, 6, ROW[only] + ({ vehicles: 30, toys: 14, scenery: 18, effects: 14 } as const)[only]], target: [0, 1.2, ROW[only]] }
  : { eye: [4, 24, 40], target: [4, 0, -2] };
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);

function frame(): void {
  const w = innerWidth, h = innerHeight;
  renderer.resize(w, h, devicePixelRatio);
  renderer.render(world, view);
  // Labels follow the same camera as the renderer's.
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camera.position.set(...view.eye);
  camera.lookAt(...view.target);
  camera.updateMatrixWorld();
  const p = new THREE.Vector3();
  shown.forEach((l, i) => {
    p.set(l.x, l.y, l.z).project(camera);
    const tag = tags[i]!;
    tag.style.display = p.z < 1 ? '' : 'none';
    tag.style.left = `${((p.x + 1) / 2) * w}px`;
    tag.style.top = `${((1 - p.y) / 2) * h}px`;
  });
}
addEventListener('resize', frame);
frame();
(window as unknown as { galleryReady: boolean }).galleryReady = true;
