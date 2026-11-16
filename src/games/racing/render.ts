// Draws the world in the polished toy look (ADR 0025) with three.js. Everything that repeats (props, trees,
// splashes) is one batch per material; the few vehicles are drawn piece by piece. One sun shadow follows the car.
// Loaded only when the game opens.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ANIMAL_LOOKS } from './look/animals';
import { buildGround } from './look/island';
import { buildSetPieces } from './look/setpieces';
import { sceneryPieces } from './look/scenery';
import { CONFETTI_COLORS, TOY_TINTS, toyPieces, type Pieces } from './look/toys';
import { OWN_COLOR, buildKidVehicle, buildVehicle, type VehicleModel } from './look/vehicles';
import type { SceneryId } from './sim/assets/scenery';
import type { ToyId } from './sim/assets/toys';
import { CONFETTI_LIFE, DROP_LIFE, RIPPLE_LIFE, type VehicleKind, type World } from './sim/sim';
import { CAMERA_FOV, chaseView, stepTreeSizes, type View } from './sim/view';

/** The most real pixels drawn per CSS pixel. Built-in laptop graphics (ADR 0021) get no more than this. */
export const MAX_PIXEL_RATIO = 1.5;

const WATER_Y = 0.09;
/** Things further than this from where the chase camera looks are not drawn (milestone-3 E). */
const HIDE_M = 150;

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  /** Brings every moving thing up to date with the world, then draws. */
  /** `view` is for dev tools (the asset gallery); the game always uses the chase camera. */
  render(world: World, view?: View): void;
  /**
   * Frees the GPU memory. `loseContext` also gives the drawing context back at once (for a throwaway canvas, such as
   * a picker picture), rather than when the canvas is collected: a browser keeps only about 16 at a time.
   */
  dispose(loseContext?: boolean): void;
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
  const haze = new THREE.Fog(0xdcefff, 90, 340);
  scene.fog = haze;
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
  // Toys in several colours (a stack's boxes, ADR 0041): each copy's colour by its place, set once. Copies are
  // placed in the order of `world.props`, so the n-th of a kind is always the same toy.
  const tint = new THREE.Color();
  for (const [id, meshes] of toyBatches) {
    const colors = TOY_TINTS[id];
    if (!colors) continue;
    world.props.filter((p) => p.toy === id).forEach((p, n) => {
      tint.set(colors[p.slot % colors.length]!);
      for (const mesh of meshes) if ((mesh.material as THREE.Material).userData.tint) mesh.setColorAt(n, tint);
    });
    for (const mesh of meshes) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  const placed = new Map<string, number>();

  // Vehicles: the kid's car in their colour, traffic in its own colours.
  // Animals (milestone-3 B3): few, each its own little model.
  const animals = world.animals.map((a) => {
    const model = ANIMAL_LOOKS[a.id]();
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(model);
    return model;
  });

  // The kid's vehicle in their colour, or with their flag (milestone-3 B5); traffic in its own colours.
  const vehicleModel = (kind: VehicleKind, kid: boolean): VehicleModel => {
    const v = kid ? buildKidVehicle(kind, kidColor) : buildVehicle(kind, OWN_COLOR[kind]);
    v.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(v.group);
    return v;
  };
  const vehicles: VehicleModel[] = world.cars.map((c, i) => vehicleModel(c.kind, i === 0));
  // The kind each model was built as: the garage (ADR 0035) changes the kid's vehicle, and its model with it.
  const builtAs = world.cars.map((c) => c.kind);

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
  // Confetti (ADR 0041, `fx/confetti`): little paper pieces, two triangles each, coloured per piece once.
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.26, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide }), world.confetti.length);
  confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  confetti.frustumCulled = false;
  world.confetti.forEach((c, i) => confetti.setColorAt(i, tint.set(CONFETTI_COLORS[c.hue % CONFETTI_COLORS.length]!)));
  scene.add(confetti);
  const turn = new THREE.Euler();

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

  const update = (w: World, given?: View) => {
    const view = given ?? chaseView(w);
    // On a big map (milestone-3 E), what is further than HIDE_M from where the chase camera looks is not drawn; the
    // haze already hides it. A dev tool's own camera sees everything.
    const hide = given ? Infinity : HIDE_M;
    // A dev tool's camera (the picker's map pictures, from high above) sees through the haze.
    scene.fog = given ? null : haze;
    const lx = view.target[0], lz = view.target[2];
    const far = (x: number, z: number) => (x - lx) ** 2 + (z - lz) ** 2 > hide * hide;
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
      place(treeBatches.get(t.kind)!, next(t.kind), size > 0 && !far(t.x, t.z) ? m : zero);
    });
    treeBatches.forEach(dirty);

    // Toys
    for (const p of w.props) {
      m.compose(v.set(p.x, p.y, p.z), q.set(p.qx, p.qy, p.qz, p.qw), s.setScalar(p.scale));
      place(toyBatches.get(p.toy)!, next(p.toy), p.scale > 0 && !far(p.x, p.z) ? m : zero);
    }
    toyBatches.forEach(dirty);

    // Animals: a little bob in their step as they walk, and their hop.
    w.animals.forEach((a, i) => {
      const model = animals[i]!;
      const bob = a.speed > 0.1 ? Math.abs(Math.sin(w.time * 9 + i)) * 0.06 : 0;
      model.visible = !far(a.x, a.z);
      model.position.set(a.x, a.h + bob, a.z);
      model.rotation.y = a.heading;
    });

    // Vehicles
    w.cars.forEach((c, i) => {
      if (c.kind !== builtAs[i]) {
        scene.remove(vehicles[i]!.group);
        vehicles[i] = vehicleModel(c.kind, i === 0);
        builtAs[i] = c.kind;
      }
      const model = vehicles[i]!;
      model.group.visible = i === 0 || !far(c.x, c.z);
      model.group.position.set(c.x, c.y + c.h, c.z);
      // Nose up while climbing a ramp or rising from it, down while coming down (never enough to look like a flip).
      model.group.rotation.set(-Math.max(-0.35, Math.min(0.35, Math.atan2(c.vy, Math.max(c.speed, 2)))), c.heading, 0, 'YXZ');
      // The simulation's spin is for a wheel 0.45 m across; bigger wheels turn slower for the same distance.
      for (const wheel of model.wheels) wheel.rotation.x = (c.spin * 0.45) / wheel.position.y;
      model.animate?.(w.time, c.speed);
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
    // Confetti turns over and over as it flutters down, lies flat once it lands, and shrinks away at the end.
    w.confetti.forEach((c, i) => {
      if (c.life <= 0) return confetti.setMatrixAt(i, zero);
      const age = CONFETTI_LIFE - c.life;
      if (c.y > 0.031) turn.set(c.phase + age * c.turn, c.phase * 2 + age * c.turn * 0.7, c.phase);
      else turn.set(-Math.PI / 2, 0, c.phase);
      confetti.setMatrixAt(i, m.compose(v.set(c.x, c.y, c.z), q.setFromEuler(turn), s.setScalar(Math.min(1, c.life / 0.3))));
    });
    for (const e of [puffs, drops, ripples, bubbles, confetti]) e.instanceMatrix.needsUpdate = true;

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
    dispose(loseContext = false) {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          for (const mat of [o.material].flat()) mat.dispose();
        }
      });
      env.dispose();
      sky.dispose();
      renderer.dispose();
      if (loseContext) renderer.forceContextLoss();
    },
  };
}
