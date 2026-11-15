// Draws the world in the polished toy look (ADR 0025) with three.js. Everything that repeats (props, trees,
// splashes) is one batch per material; the few vehicles are drawn piece by piece. One sun shadow follows the car.
// Loaded only when the game opens.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildGround } from './look/island';
import { buildSetPieces } from './look/setpieces';
import { sceneryPieces } from './look/scenery';
import { toyPieces, type Pieces } from './look/toys';
import { OWN_COLOR, buildKidVehicle, buildVehicle, type VehicleModel } from './look/vehicles';
import type { SceneryId } from './sim/assets/scenery';
import type { ToyId } from './sim/assets/toys';
import { DROP_LIFE, RIPPLE_LIFE, type World } from './sim/sim';
import { CAMERA_FOV, chaseView, stepTreeSizes, type View } from './sim/view';

/** The most real pixels drawn per CSS pixel. Built-in laptop graphics (ADR 0021) get no more than this. */
export const MAX_PIXEL_RATIO = 1.5;

const WATER_Y = 0.09;

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  /** Brings every moving thing up to date with the world, then draws. */
  /** `view` is for dev tools (the asset gallery); the game always uses the chase camera. */
  render(world: World, view?: View): void;
  dispose(): void;
}

function skyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5fa8e8');
  grad.addColorStop(1, '#dcefff');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** One instanced mesh per piece, `count` copies, with shadows. */
function batch(pieces: Pieces, count: number): THREE.InstancedMesh[] {
  return pieces.map(({ geometry, material }) => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    m.count = count;
    return m;
  });
}

export function createRenderer(canvas: HTMLCanvasElement, world: World, kidColor: THREE.ColorRepresentation): Renderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.86;

  const scene = new THREE.Scene();
  const sky = skyTexture();
  scene.background = sky;
  scene.fog = new THREE.Fog(0xdcefff, 90, 340);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.45;

  scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x7a6a4c, 0.9));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 200 });
  scene.add(sun, sun.target);

  const setPieces = buildSetPieces(world);
  scene.add(buildGround(world), setPieces.group);
  let lastTime = world.time;

  // Trees: one batch per kind on this map; each tree can shrink away from the camera (ADR 0021).
  const treeBatches = new Map<SceneryId, THREE.InstancedMesh[]>();
  for (const id of new Set(world.trees.map((t) => t.kind))) {
    treeBatches.set(id, batch(sceneryPieces(id), world.trees.filter((t) => t.kind === id).length));
  }
  [...treeBatches.values()].flat().forEach((m) => scene.add(m));
  const treeSizes = world.trees.map(() => 1);

  // Toys: one batch per kind on this map.
  const toyBatches = new Map<ToyId, THREE.InstancedMesh[]>();
  for (const id of new Set(world.props.map((p) => p.toy))) {
    toyBatches.set(id, batch(toyPieces(id), world.props.filter((p) => p.toy === id).length));
  }
  [...toyBatches.values()].flat().forEach((m) => scene.add(m));
  const placed = new Map<string, number>();

  // Vehicles: the kid's car in their colour, traffic in its own colours.
  const vehicles: VehicleModel[] = world.cars.map((c, i) => {
    // The kid's vehicle in their colour, or with their flag (milestone-3 B5); traffic in its own colours.
    const v = i === 0 ? buildKidVehicle(c.kind, kidColor) : buildVehicle(c.kind, OWN_COLOR[c.kind]);
    v.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(v.group);
    return v;
  });

  // Splashes, dust and wake rings.
  const effect = (geo: THREE.BufferGeometry, color: number, count: number) => {
    const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.3 }), count);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const puffs = effect(new THREE.IcosahedronGeometry(1, 1), 0xffffff, world.puffs.length);
  const drops = effect(new THREE.SphereGeometry(1, 8, 6), 0xd6efff, world.drops.length);
  const ripples = effect(new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2), 0xffffff, world.ripples.length);
  // Car wash bubbles: pale, see-through and shiny.
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0x9ab8cc, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8 }), world.bubbles.length);
  bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbles.frustumCulled = false;
  scene.add(bubbles);

  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.5, 900);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);

  const place = (meshes: THREE.InstancedMesh[], i: number, matrix: THREE.Matrix4) => {
    for (const mesh of meshes) mesh.setMatrixAt(i, matrix);
  };
  const dirty = (meshes: THREE.InstancedMesh[]) => {
    for (const mesh of meshes) mesh.instanceMatrix.needsUpdate = true;
  };

  const update = (w: World, view: View = chaseView(w)) => {
    // Trees
    stepTreeSizes(w, treeSizes);
    placed.clear();
    const next = (id: string) => {
      const n = placed.get(id) ?? 0;
      placed.set(id, n + 1);
      return n;
    };
    w.trees.forEach((t, i) => {
      const size = t.scale * treeSizes[i]!;
      m.compose(v.set(t.x, 0, t.z), q.identity(), s.setScalar(size));
      place(treeBatches.get(t.kind)!, next(t.kind), size > 0 ? m : zero);
    });
    treeBatches.forEach(dirty);

    // Toys
    for (const p of w.props) {
      m.compose(v.set(p.x, p.y, p.z), q.set(p.qx, p.qy, p.qz, p.qw), s.setScalar(p.scale));
      place(toyBatches.get(p.toy)!, next(p.toy), p.scale > 0 ? m : zero);
    }
    toyBatches.forEach(dirty);

    // Vehicles
    w.cars.forEach((c, i) => {
      const model = vehicles[i]!;
      model.group.position.set(c.x, c.y + c.h, c.z);
      // Nose up while climbing a ramp or rising from it, down while coming down (never enough to look like a flip).
      model.group.rotation.set(-Math.max(-0.35, Math.min(0.35, Math.atan2(c.vy, Math.max(c.speed, 2)))), c.heading, 0, 'YXZ');
      // The simulation's spin is for a wheel 0.45 m across; bigger wheels turn slower for the same distance.
      for (const wheel of model.wheels) wheel.rotation.x = (c.spin * 0.45) / wheel.position.y;
      model.animate?.(w.time);
    });

    // Effects
    w.puffs.forEach((p, i) => puffs.setMatrixAt(i, p.life > 0 ? m.compose(v.set(p.x, p.y, p.z), q.identity(), s.setScalar(0.32 * (p.life / 0.5))) : zero));
    w.drops.forEach((d, i) => drops.setMatrixAt(i, d.life > 0 ? m.compose(v.set(d.x, d.y, d.z), q.identity(), s.setScalar(0.07 + 0.1 * (d.life / DROP_LIFE))) : zero));
    w.ripples.forEach((r, i) => {
      const size = r.size * (1 + 2.2 * (1 - r.life / RIPPLE_LIFE));
      ripples.setMatrixAt(i, r.life > 0 ? m.compose(v.set(r.x, WATER_Y + 0.012, r.z), q.identity(), s.setScalar(size)) : zero);
    });
    // Bubbles swell a little, then shrink away as they rise.
    w.bubbles.forEach((b, i) => bubbles.setMatrixAt(i, b.life > 0 ? m.compose(v.set(b.x, b.y, b.z), q.identity(), s.setScalar(0.12 + 0.16 * Math.min(1, b.life))) : zero));
    for (const e of [puffs, drops, ripples, bubbles]) e.instanceMatrix.needsUpdate = true;

    // Moving set pieces (car wash brushes).
    setPieces.animate(w, Math.max(0, Math.min(0.1, w.time - lastTime)));
    lastTime = w.time;

    // Camera, and the sun's shadow centred on the car.
    camera.position.set(...view.eye);
    camera.lookAt(...view.target);
    const kid = w.cars[0]!;
    sun.target.position.set(kid.x, 0, kid.z);
    sun.position.set(kid.x + 45, 80, kid.z + 36);
  };
  update(world);

  return {
    resize(cssWidth, cssHeight, pixelRatio) {
      renderer.setPixelRatio(Math.min(pixelRatio, MAX_PIXEL_RATIO));
      renderer.setSize(cssWidth, cssHeight, false);
      camera.aspect = cssWidth / Math.max(1, cssHeight);
      camera.updateProjectionMatrix();
    },
    render(w, view) {
      update(w, view);
      renderer.render(scene, camera);
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const mat of [o.material].flat()) mat.dispose();
        }
      });
      env.dispose();
      sky.dispose();
      renderer.dispose();
    },
  };
}
