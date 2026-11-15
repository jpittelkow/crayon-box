// Draws the world in the polished toy look (ADR 0025) with three.js. Everything that repeats (props, trees,
// splashes) is one batch per material; the few vehicles are drawn piece by piece. One sun shadow follows the car.
// Loaded only when the game opens.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildGround, propShapes, treeShapes, type Pieces } from './look/island';
import { buildVehicle, type VehicleModel } from './look/vehicles';
import { DROP_LIFE, PROP_KINDS, RIPPLE_LIFE, type VehicleKind, type World } from './sim/sim';
import { chaseView, stepTreeSizes } from './sim/view';

/** The most real pixels drawn per CSS pixel. Built-in laptop graphics (ADR 0021) get no more than this. */
export const MAX_PIXEL_RATIO = 1.5;

/** Traffic colours: none is a kid profile colour, so the kid's own car is never mistaken for another. */
const TRAFFIC_COLOR: Record<VehicleKind, number> = { car: 0xe8402c, police: 0x16181d, monster: 0xd8342c, bus: 0xf7b500 };
const WATER_Y = 0.09;

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  /** Brings every moving thing up to date with the world, then draws. */
  render(world: World): void;
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

  scene.add(buildGround(world));

  // Trees: two kinds, batched; each tree can shrink away from the camera (ADR 0021).
  const treeKinds = treeShapes();
  const treeOf = world.trees.map((_, i) => (i % 3 === 0 ? 1 : 0));
  const treeBatches = treeKinds.map((pieces, k) => batch(pieces, treeOf.filter((t) => t === k).length));
  treeBatches.flat().forEach((m) => scene.add(m));
  const treeSizes = world.trees.map(() => 1);

  // Props: four kinds, batched.
  const propKinds = propShapes();
  const kindCount = new Array<number>(PROP_KINDS).fill(0);
  for (const p of world.props) kindCount[p.kind]++;
  const propBatches = propKinds.map((pieces, k) => batch(pieces, kindCount[k]!));
  propBatches.flat().forEach((m) => scene.add(m));

  // Vehicles: the kid's car in their colour, traffic in its own colours.
  const vehicles: VehicleModel[] = world.cars.map((c, i) => {
    const v = buildVehicle(c.kind, i === 0 ? kidColor : TRAFFIC_COLOR[c.kind]);
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

  const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 900);
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

  const update = (w: World) => {
    // Trees
    stepTreeSizes(w, treeSizes);
    const treeIndex = [0, 0];
    w.trees.forEach((t, i) => {
      const k = treeOf[i]!;
      const size = t.scale * treeSizes[i]!;
      m.compose(v.set(t.x, 0, t.z), q.identity(), s.setScalar(size));
      place(treeBatches[k]!, treeIndex[k]!++, size > 0 ? m : zero);
    });
    treeBatches.forEach(dirty);

    // Props
    kindCount.fill(0);
    for (const p of w.props) {
      m.compose(v.set(p.x, p.y, p.z), q.set(p.qx, p.qy, p.qz, p.qw), s.setScalar(p.scale));
      place(propBatches[p.kind]!, kindCount[p.kind]!++, p.scale > 0 ? m : zero);
    }
    propBatches.forEach(dirty);

    // Vehicles
    w.cars.forEach((c, i) => {
      const model = vehicles[i]!;
      model.group.position.set(c.x, c.y, c.z);
      model.group.rotation.y = c.heading;
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
    for (const e of [puffs, drops, ripples]) e.instanceMatrix.needsUpdate = true;

    // Camera, and the sun's shadow centred on the car.
    const view = chaseView(w);
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
    render(w) {
      update(w);
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
