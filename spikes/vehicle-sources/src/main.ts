// Vehicle sources: the same fire truck made three ways, shown on the driving game's own island with its own lights,
// so the owner can choose where new vehicles come from (milestone 3, phase A1). Throwaway; not part of the app.
//
//   ?view=lineup              the three trucks side by side, with the game's bus and police car for scale
//   ?view=drive&truck=code    drive one of them (code, kit, kit-toy, ai, ai-lite) with arrows/WASD or touch
//   &bench=1                  time the draw cost of each truck into window.bench
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { buildGround, propShapes, treeShapes } from '../../../src/games/racing/look/island';
import { buildVehicle } from '../../../src/games/racing/look/vehicles';
import { makeWorld, step, type Input, type World } from '../../../src/games/racing/sim/sim';
import { chaseView } from '../../../src/games/racing/sim/view';
import { codeFiretruck, type Sample } from './firetruck';

/** Every truck is scaled to this length, the size of the code one, so they compare fairly. */
const LENGTH = 7.5;

type TruckId = 'code' | 'kit' | 'kit-toy' | 'ai' | 'ai-lite';
const NAMES: Record<TruckId, string> = {
  code: '1. Built in code (game toy kit)',
  kit: '2. CC0 kit (Kenney Car Kit), as it comes',
  'kit-toy': '2b. CC0 kit, with the game\'s toy paint',
  ai: '3. AI-made (text → image → TRELLIS.2)',
  'ai-lite': '3b. AI-made, cut to 15k triangles',
};
const FILES: Partial<Record<TruckId, string>> = {
  kit: './models/kenney-firetruck.glb',
  'kit-toy': './models/kenney-firetruck.glb',
  ai: './models/ai-firetruck.glb',
  'ai-lite': './models/ai-firetruck.glb',
};

const params = new URLSearchParams(location.search);
const view = params.get('view') ?? 'lineup';
const canvas = document.getElementById('view') as HTMLCanvasElement;
const panel = document.getElementById('panel')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;

// The game's scene setup (src/games/racing/render.ts): sky, haze, room reflections, sky light and one sun.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ccbf2);
scene.fog = new THREE.Fog(0xdcefff, 90, 340);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;
scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x7a6a4c, 0.9));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.9);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 200 });
scene.add(sun, sun.target);

const world: World = makeWorld(7, view === 'drive' ? 150 : 0, 'free');
world.cars[0]!.kind = 'bus'; // a truck-sized body for bumping
scene.add(buildGround(world));
const trees = treeShapes();
world.trees.forEach((t, i) => {
  if (view === 'lineup' && Math.hypot(t.x, t.z - 38) < 22) return;
  for (const { geometry, material } of trees[i % 3 === 0 ? 1 : 0]!) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(t.x, 0, t.z);
    m.scale.setScalar(t.scale);
    m.castShadow = m.receiveShadow = true;
    scene.add(m);
  }
});

function shadows(o: THREE.Object3D): void {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) c.castShadow = c.receiveShadow = true;
  });
}

/** Stats for the panel. */
interface Stats { triangles: number; meshes: number; materials: number; textures: string; bytes: number }

function count(root: THREE.Object3D, bytes: number): Stats {
  let triangles = 0, meshes = 0;
  const mats = new Set<THREE.Material>();
  const tex = new Set<string>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    meshes++;
    const g = o.geometry as THREE.BufferGeometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    for (const m of [o.material].flat() as THREE.MeshStandardMaterial[]) {
      mats.add(m);
      for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) if (t?.image) tex.add(`${(t.image as { width: number }).width}²`);
    }
  });
  return { triangles: Math.round(triangles), meshes, materials: mats.size, textures: [...tex].join(', ') || 'none', bytes };
}

/** Scales a loaded model to LENGTH along its longest side, front toward +z, wheels on y = 0. */
function fit(root: THREE.Object3D, turn: number): THREE.Group {
  root.rotation.y = turn;
  const holder = new THREE.Group().add(root);
  const box = new THREE.Box3().setFromObject(holder);
  const size = box.getSize(new THREE.Vector3());
  const k = LENGTH / Math.max(size.x, size.z);
  root.scale.multiplyScalar(k);
  box.setFromObject(holder);
  const c = box.getCenter(new THREE.Vector3());
  root.position.set(-c.x, -box.min.y, -c.z);
  return new THREE.Group().add(holder);
}

/** The game's clear-coat toy paint over the kit's own colour map. */
function toyPaint(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const old = o.material as THREE.MeshStandardMaterial;
    o.material = new THREE.MeshPhysicalMaterial({ map: old.map, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.07 });
  });
}

/** Cuts every mesh to about `target` triangles in all, keeping UV seams, with meshoptimizer's simplifier. */
async function simplify(root: THREE.Object3D, target: number): Promise<void> {
  await MeshoptSimplifier.ready;
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
  let total = 0;
  for (const m of meshes) total += (m.geometry.index?.count ?? 0) / 3;
  for (const m of meshes) {
    const g = m.geometry as THREE.BufferGeometry;
    if (!g.index) continue;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const flat = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) flat.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
    const want = Math.max(3, Math.floor(((g.index.count / 3) * target) / total) * 3);
    const [indices] = MeshoptSimplifier.simplify(new Uint32Array(g.index.array), flat, 3, want, 0.05, ['LockBorder']);
    g.setIndex(new THREE.BufferAttribute(indices, 1));
  }
}

async function load(id: TruckId): Promise<{ sample: Sample; stats: Stats }> {
  if (id === 'code') {
    const s = codeFiretruck();
    shadows(s.group);
    return { sample: s, stats: count(s.group, 0) };
  }
  const url = FILES[id]!;
  const bytes = Number((await fetch(url, { method: 'HEAD' })).headers.get('content-length') ?? 0);
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  if (id === 'kit-toy') toyPaint(root);
  if (id === 'ai-lite') await simplify(root, 15000);
  // Kenney's trucks face +z already; TRELLIS's face +x (set by eye in the line-up).
  const turn = id.startsWith('ai') ? Number(params.get('aiturn') ?? Math.PI / 2) : 0;
  const group = fit(root, turn);
  shadows(group);
  const wheels: THREE.Object3D[] = [];
  root.traverse((o) => o.name.startsWith('wheel') && wheels.push(o));
  return { sample: { group, wheels }, stats: count(group, bytes) };
}

const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 900);
function resize(): void {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/** Average draw time of the scene in ms, forced to finish each frame with a one-pixel read. */
function drawTime(frames: number): number {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  for (let i = 0; i < 5; i++) renderer.render(scene, camera);
  const t = performance.now();
  for (let i = 0; i < frames; i++) {
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  }
  return (performance.now() - t) / frames;
}

function row(name: string, s: Stats, extra = ''): string {
  const kb = s.bytes ? `${Math.round(s.bytes / 1024)} kB` : 'code (no file)';
  return `<tr><td>${name}</td><td>${s.triangles.toLocaleString()}</td><td>${s.meshes}</td><td>${s.materials}</td><td>${s.textures}</td><td>${kb}</td><td>${extra}</td></tr>`;
}
const HEAD = '<tr><th>Truck</th><th>Triangles</th><th>Meshes</th><th>Materials</th><th>Textures</th><th>Download</th><th>Draw ms</th></tr>';

async function lineup(): Promise<void> {
  const ids: TruckId[] = ['code', 'kit-toy', 'ai'];
  const loaded: { id: TruckId; sample: Sample; stats: Stats }[] = [];
  for (const id of ids) {
    try {
      loaded.push({ id, ...(await load(id)) });
    } catch (e) {
      console.warn('could not load', id, e);
    }
  }
  // On the road on the near side of the island, facing the camera at three-quarters.
  loaded.forEach(({ sample }, i) => {
    sample.group.position.set((i - (loaded.length - 1) / 2) * 8, 0, 38);
    sample.group.rotation.y = 0.55;
    scene.add(sample.group);
  });
  for (const [kind, x] of [['bus', -17], ['police', 16]] as const) {
    const v = buildVehicle(kind, 0xf7b500);
    shadows(v.group);
    v.group.position.set(x, 0, 36);
    v.group.rotation.y = 0.55;
    scene.add(v.group);
  }
  const shot = params.get('shot') ?? 'front';
  const eye = shot === 'side' ? [24, 6, 38] : shot === 'top' ? [0, 30, 54] : shot === 'back' ? [-10, 7, 20] : [3, 6.5, 56];
  camera.position.set(eye[0]!, eye[1]!, eye[2]!);
  camera.lookAt(0, 1.6, 38);
  sun.target.position.set(0, 0, 38);
  sun.position.set(45, 80, 74);

  panel.innerHTML = `<h1>Fire truck, three ways</h1><p>Left to right: ${loaded.map((l) => NAMES[l.id]).join(' · ')}. School bus and police car from the game for scale.</p>`
    + `<table>${HEAD}${loaded.map((l) => row(NAMES[l.id], l.stats)).join('')}</table>`;

  if (params.has('bench')) {
    const bench: Record<string, number> = {};
    for (const l of loaded) l.sample.group.visible = false;
    const base = drawTime(60);
    bench.none = base;
    // Twenty copies of each, standing in for busy traffic, so the truck's own cost shows above the noise.
    for (const l of loaded) {
      const copies = Array.from({ length: 20 }, (_, i) => {
        const c = l.sample.group.clone();
        c.position.set(-28 + (i % 10) * 6.2, 0, 30 + Math.floor(i / 10) * 9);
        scene.add(c);
        return c;
      });
      bench[l.id] = (drawTime(60) - base) / 20;
      for (const c of copies) scene.remove(c);
    }
    for (const l of loaded) l.sample.group.visible = true;
    (window as unknown as { bench: unknown }).bench = bench;
    panel.querySelector('table')!.innerHTML = HEAD + loaded.map((l) => row(NAMES[l.id], l.stats, bench[l.id]!.toFixed(3))).join('');
  }
  let frames = 0;
  const loop = (t: number) => {
    for (const l of loaded) l.sample.animate?.(t / 1000);
    renderer.render(scene, camera);
    if (++frames === 10) (window as unknown as { shotReady: boolean }).shotReady = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function drive(): Promise<void> {
  const id = (params.get('truck') ?? 'code') as TruckId;
  const { sample, stats } = await load(id);
  scene.add(sample.group);
  panel.innerHTML = `<h1>${NAMES[id]}</h1><p>Arrows or WASD, or touch and hold. Other trucks: ${(Object.keys(NAMES) as TruckId[]).map((t) => `<a href="?view=drive&truck=${t}">${t}</a>`).join(' · ')} · <a href="?view=lineup">line-up</a></p><table>${HEAD}${row(NAMES[id], stats)}</table>`;

  // Traffic and props from the game, drawn simply.
  const traffic = world.cars.slice(1).map((c) => {
    const v = buildVehicle(c.kind, ({ car: 0xe8402c, police: 0x16181d, monster: 0xd8342c, bus: 0xf7b500 })[c.kind]);
    shadows(v.group);
    scene.add(v.group);
    return v;
  });
  const props = propShapes().map((pieces) => pieces.map(({ geometry, material }) => {
    const m = new THREE.InstancedMesh(geometry, material, world.props.length);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }));

  const keys = new Set<string>();
  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  let touch: { x: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => (touch = { x: e.clientX }));
  canvas.addEventListener('pointermove', (e) => touch && (touch.x = e.clientX));
  addEventListener('pointerup', () => (touch = null));

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let last = performance.now(), acc = 0, frames = 0;
  let auto = Number(params.get('auto') ?? 0);
  const loop = (now: number) => {
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    const k = (a: string, b: string) => keys.has(a) || keys.has(b);
    const input: Input = {
      go: !!touch || k('arrowup', 'w') || k('arrowleft', 'a') || k('arrowright', 'd'),
      brake: k('arrowdown', 's'),
      steer: touch ? Math.max(-1, Math.min(1, ((touch.x / innerWidth) - 0.5) * 2.4)) : (k('arrowright', 'd') ? 1 : 0) - (k('arrowleft', 'a') ? 1 : 0),
    };
    // ?auto=N drives N simulated seconds by itself before the first frame (for screenshots).
    if (auto > 0) {
      for (let i = 0; i < auto * 60; i++) step(world, { go: true, brake: false, steer: Math.sin(i / 200) * 0.25 }, 1 / 60);
      auto = 0;
      acc = 0;
    }
    while (acc >= 1 / 60) {
      step(world, input, 1 / 60);
      acc -= 1 / 60;
    }
    const kid = world.cars[0]!;
    sample.group.position.set(kid.x, kid.y, kid.z);
    sample.group.rotation.y = kid.heading;
    for (const w of sample.wheels) w.rotation.x = kid.spin * 0.45 / 0.58;
    sample.animate?.(world.time);
    world.cars.slice(1).forEach((c, i) => {
      traffic[i]!.group.position.set(c.x, c.y, c.z);
      traffic[i]!.group.rotation.y = c.heading;
      traffic[i]!.animate?.(world.time);
    });
    const n = [0, 0, 0, 0];
    for (const p of world.props) {
      m4.compose(v.set(p.x, p.y, p.z), q.set(p.qx, p.qy, p.qz, p.qw), s.setScalar(p.scale));
      for (const mesh of props[p.kind]!) mesh.setMatrixAt(n[p.kind]!, m4);
      n[p.kind]!++;
    }
    for (const kind of props) for (const mesh of kind) mesh.instanceMatrix.needsUpdate = true;
    const cv = chaseView(world);
    // A truck is taller than the game's car, so the camera sits a little further back and higher.
    camera.position.set(cv.eye[0] + (cv.eye[0] - kid.x) * 0.3, cv.eye[1] + 1.5, cv.eye[2] + (cv.eye[2] - kid.z) * 0.3);
    camera.lookAt(...cv.target);
    sun.target.position.set(kid.x, 0, kid.z);
    sun.position.set(kid.x + 45, 80, kid.z + 36);
    renderer.render(scene, camera);
    if (++frames === 10) (window as unknown as { shotReady: boolean }).shotReady = true;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

void (view === 'drive' ? drive() : lineup());
