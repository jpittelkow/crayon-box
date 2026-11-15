// One still picture of the driving game's island at a chosen realism level, for the owner to grade.
//   ?level=0  today's look (the app's own renderer)
//   ?level=1  toy, simple    ?level=2  toy, polished    ?level=3  near-photo
//   ?shot=play (the driving camera) | car (close-up of the kid's car) | lineup (four vehicles)
//   ?bench=1  also times 60 frames and reports the cost
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ROAD_R } from '../../../src/games/racing/maps/island';
import { makeWorld, step, type World } from '../../../src/games/racing/sim/sim';
import { buildIsland, type Clear } from './island';
import { Kit, type Level } from './kit';
import { vehicle, type VehicleKind } from './vehicles';

const params = new URLSearchParams(location.search);
const level = Math.max(0, Math.min(3, Number(params.get('level') ?? 2))) as 0 | Level;
const shot = (['play', 'car', 'lineup'].includes(params.get('shot') ?? '') ? params.get('shot') : 'play') as 'play' | 'car' | 'lineup';
const W = 1280, H = 800;
const KID_ORANGE = 0xff9f1c;

const canvas = document.getElementById('view') as HTMLCanvasElement;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;

interface View { eye: THREE.Vector3; target: THREE.Vector3; fov: number }

function world(): World {
  const w = makeWorld(7, 150, 'road');
  // The driving shot is a moment mid-drive: some props are in the air, traffic has moved.
  if (shot === 'play') for (let i = 0; i < 200; i++) step(w, { go: true, brake: false, steer: 0 }, 1 / 60);
  return w;
}

function view(w: World): View {
  const car = w.cars[0]!;
  const fx = Math.sin(w.camHeading), fz = Math.cos(w.camHeading);
  if (shot === 'play') {
    return {
      eye: new THREE.Vector3(car.x - fx * 10, 5.5, car.z - fz * 10),
      target: new THREE.Vector3(car.x + fx * 5, 1.2, car.z + fz * 5),
      fov: 55,
    };
  }
  if (shot === 'car') {
    // Front three-quarter view, a little above the roof.
    const h = car.heading, off = new THREE.Vector3(3.6, 1.7, 4.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), h);
    return { eye: new THREE.Vector3(car.x, 0, car.z).add(off), target: new THREE.Vector3(car.x, 0.85, car.z), fov: 36 };
  }
  return { eye: new THREE.Vector3(0, 3.8, LINE_Z + 17), target: new THREE.Vector3(0, 1.7, LINE_Z - 2.5), fov: 38 };
}

/** The line-up stands on the flat grass between the road and the beach. */
const LINE_Z = ROAD_R + 9;
const LINEUP: { kind: VehicleKind; x: number; z?: number; color?: number; turn?: number }[] = [
  { kind: 'bus', x: -2.2, z: -6.5, turn: -1.4 },
  { kind: 'car', x: -6.6, color: KID_ORANGE },
  { kind: 'police', x: -1.8 },
  { kind: 'monster', x: 4.4, color: 0x44b87b },
];

/** Today's look, drawn by the app's own scene and renderer. */
async function today(w: World, v: View): Promise<{ render(): void; info(): THREE.WebGLInfo['render'] | null }> {
  const { buildScene } = await import('../../../src/games/racing/sim/scene');
  const { createRenderer } = await import('../../../src/games/racing/render');
  const data = buildScene(w, [1, 0x9f / 255, 0x1c / 255]);
  data.update(w);
  data.camera.fovDeg = v.fov;
  data.camera.eye = v.eye.toArray() as [number, number, number];
  data.camera.target = v.target.toArray() as [number, number, number];
  const r = createRenderer(canvas, data);
  r.resize(W, H, 1);
  return { render: () => r.render(), info: () => null };
}

function skyTexture(top: string, horizon: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(1, horizon);
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A tiling ripple normal map for level 3's sea. */
function rippleNormals(size = 256): THREE.DataTexture {
  const waves = [[1, 2, 0.0], [3, -1, 1.3], [-2, 3, 2.1], [5, 4, 0.7], [-4, 6, 3.3], [7, -3, 4.4]] as const;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let du = 0, dv = 0;
      for (const [k, l, phase] of waves) {
        const c = Math.cos(Math.PI * 2 * ((k * x) / size + (l * y) / size) + phase) * (0.09 / Math.hypot(k, l));
        du += c * k; dv += c * l;
      }
      const len = Math.hypot(du, dv, 1), o = (y * size + x) * 4;
      data.set([(-du / len * 0.5 + 0.5) * 255, (-dv / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255, 255], o);
    }
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

async function toyOrPhoto(w: World, v: View, L: Level): Promise<{ render(): void; info(): THREE.WebGLInfo['render'] | null }> {
  const kit = new Kit(L);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  if (L >= 2) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = L === 3 ? 0.82 : 0.86;
  }

  const scene = new THREE.Scene();
  scene.background = L === 1 ? new THREE.Color(0xbfe6ff) : skyTexture('#5fa8e8', '#dcefff');
  if (L >= 2) {
    scene.fog = new THREE.Fog(0xdcefff, 90, L === 3 ? 300 : 340);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
  }

  const hemi = new THREE.HemisphereLight(0xe4f2ff, 0x7a6a4c, L === 1 ? 1.5 : 0.9);
  const sun = new THREE.DirectionalLight(0xfff4e0, L === 1 ? 2.2 : 2.9);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(L === 3 ? 4096 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const focus = shot === 'lineup' ? new THREE.Vector3(0, 0, LINE_Z) : new THREE.Vector3(w.cars[0]!.x, 0, w.cars[0]!.z);
  const cam = sun.shadow.camera;
  cam.left = cam.bottom = -32;
  cam.right = cam.top = 32;
  cam.near = 1;
  cam.far = 200;
  sun.position.copy(focus).add(new THREE.Vector3(45, 80, 36));
  sun.target.position.copy(focus);
  scene.add(hemi, sun, sun.target);

  // The sea: plain at level 1 and 2, three.js's reflecting Water at level 3.
  if (L === 3) {
    const { Water } = await import('three/addons/objects/Water.js');
    const sea = new Water(new THREE.PlaneGeometry(900, 900), {
      textureWidth: 512, textureHeight: 512, waterNormals: rippleNormals(),
      sunDirection: sun.position.clone().sub(focus).normalize(), sunColor: 0xffffff, waterColor: 0x1d6aa0,
      distortionScale: 2.2, fog: true,
    });
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.5;
    sea.material.uniforms['size']!.value = 3;
    scene.add(sea);
  } else {
    const sea = new THREE.Mesh(new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3d9fe0, roughness: L === 1 ? 0.5 : 0.12, metalness: 0.05 }));
    sea.position.y = -0.5;
    scene.add(sea);
  }

  const clear: Clear[] = shot === 'lineup' ? [{ x: 0, z: LINE_Z - 3, r: 15 }] : [];
  scene.add(buildIsland(kit, w, clear));

  if (shot === 'lineup') {
    for (const item of LINEUP) {
      const vh = vehicle(kit, item.kind, item.color);
      vh.position.set(item.x, 0, LINE_Z + (item.z ?? 0));
      vh.rotation.y = item.turn ?? 0.55;
      scene.add(vh);
    }
  } else {
    // The kid's car in their color; traffic shows the other kinds of vehicle.
    const traffic: [VehicleKind, number][] = [['bus', 0], ['police', 0], ['monster', 0x44b87b]];
    w.cars.forEach((c, i) => {
      const [kind, color] = i === 0 ? (['car', KID_ORANGE] as [VehicleKind, number]) : traffic[(i - 1) % traffic.length]!;
      const vh = vehicle(kit, kind, color);
      vh.position.set(c.x, c.y, c.z);
      vh.rotation.y = c.heading;
      scene.add(vh);
    });
  }

  const camera = new THREE.PerspectiveCamera(v.fov, W / H, 0.5, 900);
  camera.position.copy(v.eye);
  camera.lookAt(v.target);

  if (L < 3) {
    return {
      render: () => {
        renderer.info.reset();
        renderer.render(scene, camera);
      },
      info: () => renderer.info.render,
    };
  }
  // Near-photo: soft contact shadows (ambient occlusion) and a glow on bright lamps.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, W, H);
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.25, 0.4, 0.97));
  composer.addPass(new OutputPass());
  return {
    render: () => {
      renderer.info.reset();
      composer.render();
    },
    info: () => renderer.info.render,
  };
}

async function main(): Promise<void> {
  const w = world();
  const v = view(w);
  const r = level === 0 ? await today(w, v) : await toyOrPhoto(w, v, level);
  r.render();
  // Shaders compile on the first frames; draw a few more so the picture is complete.
  for (let i = 0; i < 3; i++) {
    await new Promise((res) => requestAnimationFrame(res));
    r.render();
  }

  let bench: Record<string, number> | null = null;
  if (params.get('bench') === '1') {
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGL2RenderingContext;
    const px = new Uint8Array(4);
    const t0 = performance.now();
    const N = 60;
    for (let i = 0; i < N; i++) {
      r.render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); // waits for the graphics chip to finish
    }
    const info = r.info();
    bench = { msPerFrame: (performance.now() - t0) / N, calls: info?.calls ?? -1, triangles: info?.triangles ?? -1 };
  }
  Object.assign(window, { shotReady: true, bench });
  document.body.dataset.ready = 'true';
}

void main();
