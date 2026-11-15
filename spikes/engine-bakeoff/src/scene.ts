// What gets drawn, as data. A scene is a list of batches: one shape, one color, many copies. Each frame the
// copies' places are written here from the simulation, and each renderer only uploads them. Geometry, colors,
// lights and the camera are therefore identical in both libraries.

import { box, cylinder, hull, layAlongX, move, ring, sphere, toMesh, type MeshData, type Tri } from './shapes';
import { DROP_LIFE, LAND_R, PROP_HALF, PROP_KINDS, RIPPLE_LIFE, ROAD_R, ROAD_W, type World } from './sim';

export type RGB = [number, number, number];

export interface Batch {
  name: string;
  mesh: MeshData;
  color: RGB;
  /** Lit by the two lights, or a plain flat color (outlines, shadows, puffs). */
  lit: boolean;
  opacity: number;
  capacity: number;
  count: number;
  /** False when the copies never move after the scene is built. */
  dynamic: boolean;
  /** Drawn as one object per copy when instancing is switched off (the props and their outlines). */
  separable: boolean;
  /** Per copy: position x y z, rotation quaternion x y z w, scale. */
  trs: Float32Array;
  /** Per copy: the same placement as a 4 x 4 matrix, in the layout both libraries use. */
  matrices: Float32Array;
}

export interface Camera { eye: [number, number, number]; target: [number, number, number]; fovDeg: number; near: number; far: number }

/**
 * The puddles and the flood as one flat sheet, for the "each library's own water" option. Cartoon water does
 * not use it: that is ordinary batches like everything else.
 */
export interface WaterSurface {
  /** True when each library should draw this sheet with its own ready-made water. */
  own: boolean;
  /** Height of the water. The sheet's own vertices are at height 0. */
  y: number;
  color: RGB;
  mesh: MeshData;
  /** Texture coordinates for the sheet: one repeat of the ripple map every 80 m. */
  uvs: Float32Array;
  /** A tiling ripple map (a normal map), RGBA bytes, made here so both libraries get the same one. */
  ripples: { size: number; data: Uint8Array };
  time: number;
}

export interface SceneData {
  batches: Batch[];
  water: WaterSurface;
  sky: RGB;
  hemiSky: RGB;
  hemiGround: RGB;
  /** The direction the sun's light travels. */
  sunDir: [number, number, number];
  sun: number;
  camera: Camera;
  /** Refreshes every moving batch and the camera from the simulation. */
  update(world: World): void;
  triangles(): number;
}

export interface SceneOptions { outlines: boolean; ownWater: boolean }

const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
];
const INK = hex('#23201c');
const PROP_COLORS = [hex('#ff7a1a'), hex('#d9a05b'), hex('#ff5fa2'), hex('#ffd23f')];
const CAR_COLORS = [hex('#e8402c'), hex('#2f7fe0'), hex('#7b4fd0'), hex('#1fb5a8')];

/** Gentle overlapping waves that tile, as a normal map. */
function rippleMap(size: number): Uint8Array {
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
      data[o] = Math.round((-du / len * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round((-dv / len * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}

function setTRS(b: Batch, i: number, px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number, s: number): void {
  const t = b.trs, o = i * 8;
  t[o] = px; t[o + 1] = py; t[o + 2] = pz; t[o + 3] = qx; t[o + 4] = qy; t[o + 5] = qz; t[o + 6] = qw; t[o + 7] = s;
  const m = b.matrices, k = i * 16;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  m[k] = (1 - (yy + zz)) * s; m[k + 1] = (xy + wz) * s; m[k + 2] = (xz - wy) * s; m[k + 3] = 0;
  m[k + 4] = (xy - wz) * s; m[k + 5] = (1 - (xx + zz)) * s; m[k + 6] = (yz + wx) * s; m[k + 7] = 0;
  m[k + 8] = (xz + wy) * s; m[k + 9] = (yz - wx) * s; m[k + 10] = (1 - (xx + yy)) * s; m[k + 11] = 0;
  m[k + 12] = px; m[k + 13] = py; m[k + 14] = pz; m[k + 15] = 1;
}

export function buildScene(world: World, opts: SceneOptions): SceneData {
  const batches: Batch[] = [];
  const batch = (name: string, mesh: MeshData, color: RGB, capacity: number, o: Partial<Batch> = {}): Batch => {
    const b: Batch = {
      name, mesh, color, lit: true, opacity: 1, capacity, count: capacity, dynamic: false, separable: false,
      trs: new Float32Array(capacity * 8), matrices: new Float32Array(capacity * 16), ...o,
    };
    for (let i = 0; i < capacity; i++) setTRS(b, i, 0, 0, 0, 0, 0, 0, 1, 1);
    batches.push(b);
    return b;
  };
  const outline = (name: string, tris: Tri[], thickness: number, capacity: number, o: Partial<Batch> = {}): Batch | null =>
    opts.outlines ? batch(name, hull(tris, thickness), INK, capacity, { lit: false, ...o }) : null;

  // The ground, in layers a few centimetres apart.
  batch('water', toMesh(ring(0, 400, 24, -0.5)), hex('#4aa8e0'), 1);
  batch('sand', toMesh(ring(0, LAND_R + 2.5, 64, -0.04)), hex('#f2d9a0'), 1);
  batch('grass', toMesh(ring(0, LAND_R - 3, 64, 0)), hex('#8fd16a'), 1);
  batch('road', toMesh(ring(ROAD_R - ROAD_W / 2, ROAD_R + ROAD_W / 2, 64, 0.04)), hex('#5a5f66'), 1);
  const dashes = batch('dashes', toMesh(box(0.35, 0.04, 2.2)), hex('#ffffff'), 28);
  for (let i = 0; i < dashes.capacity; i++) {
    const a = (i / dashes.capacity) * Math.PI * 2, yaw = a + Math.PI / 2;
    setTRS(dashes, i, Math.sin(a) * ROAD_R, 0.07, Math.cos(a) * ROAD_R, 0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2), 1);
  }

  // Puddles and the flood, cartoon style: a pale rim with flat blue on top, the same blue as the sea.
  const WATER_Y = 0.09;
  const waterColor = hex('#4aa8e0');
  const disc = ring(0, 1, 28, 0);
  const rims = batch('water-rim', toMesh(disc), hex('#d7f0ff'), world.waters.length, { lit: false, dynamic: true });
  const pools = opts.ownWater ? null : batch('water', toMesh(disc), waterColor, world.waters.length, { dynamic: true });
  const sheet = toMesh(world.waters.flatMap((p) => move(ring(0, p.r, 28, 0), p.x, 0, p.z)));
  const water: WaterSurface = {
    own: opts.ownWater, y: WATER_Y, color: waterColor, mesh: sheet,
    uvs: Float32Array.from({ length: (sheet.positions.length / 3) * 2 }, (_, i) => sheet.positions[Math.floor(i / 2) * 3 + (i % 2) * 2]! / 80),
    ripples: { size: 256, data: rippleMap(256) }, time: 0,
  };

  // Trees: they never move.
  const canopyTris = cylinder(1.7, 0, 1.2, 3.7, 9); // kept low so a tree never hides the car from the camera
  const trunks = batch('trunks', toMesh(cylinder(0.38, 0.3, 0, 1.4, 7)), hex('#8a5a3a'), world.trees.length);
  const canopies = batch('canopies', toMesh(canopyTris), hex('#3f9b4b'), world.trees.length);
  const canopyInk = outline('canopy-ink', canopyTris, 0.08, world.trees.length);
  world.trees.forEach((t, i) => {
    for (const b of [trunks, canopies, canopyInk]) if (b) setTRS(b, i, t.x, 0, t.z, 0, 0, 0, 1, t.scale);
  });

  // Props: one batch per kind, plus its outline.
  const propTris: Tri[][] = [
    [...cylinder(0.5, 0.08, -0.5, 0.55, 10), ...box(1.1, 0.1, 1.1, 0, -0.5, 0)],
    box(1, 1, 1),
    sphere(0.6, 10, 6),
    box(1.5, 0.9, 0.9),
  ];
  const kindCount = new Array<number>(PROP_KINDS).fill(0);
  for (const p of world.props) kindCount[p.kind]!++;
  const propBatches = propTris.map((tris, k) =>
    batch(`prop-${k}`, toMesh(tris), PROP_COLORS[k]!, Math.max(1, kindCount[k]!), { dynamic: true, separable: true }));
  const propInk = propTris.map((tris, k) =>
    outline(`prop-ink-${k}`, tris, 0.06, Math.max(1, kindCount[k]!), { dynamic: true, separable: true }));

  // Cars: a body in each car's color, and a cabin and wheels shared by all.
  const bodyTris = [...box(1.9, 0.55, 4, 0, 0.72, 0), ...box(1.8, 0.25, 0.45, 0, 1.12, -1.75)];
  const cabinTris = box(1.6, 0.6, 1.9, 0, 1.295, -0.2);
  const cars = world.cars.length;
  const bodies = world.cars.map((_, i) => batch(`body-${i}`, toMesh(bodyTris), CAR_COLORS[i % CAR_COLORS.length]!, 1, { dynamic: true }));
  const cabins = batch('cabins', toMesh(cabinTris), hex('#cfeaff'), cars, { dynamic: true });
  const wheels = batch('wheels', toMesh(layAlongX(cylinder(0.45, 0.45, -0.2, 0.2, 8))), hex('#2b2b2b'), cars * 4, { dynamic: true });
  const bodyInk = outline('body-ink', bodyTris, 0.06, cars, { dynamic: true });
  const cabinInk = outline('cabin-ink', cabinTris, 0.06, cars, { dynamic: true });

  // Round blob shadows under everything, and little puffs where a prop is knocked.
  const blobs = batch('blobs', toMesh(ring(0, 1, 16, 0)), [0, 0, 0], cars + world.props.length + world.trees.length,
    { lit: false, opacity: 0.2, dynamic: true });
  const puffs = batch('puffs', toMesh(sphere(1, 6, 4)), hex('#ffffff'), world.puffs.length, { lit: false, dynamic: true });
  const drops = batch('drops', toMesh(sphere(1, 6, 4)), hex('#e6f6ff'), world.drops.length, { lit: false, dynamic: true });
  const ripples = batch('ripples', toMesh(ring(0.93, 1, 28, 0)), hex('#ffffff'), world.ripples.length, { lit: false, dynamic: true });

  const BLOB_Y = 0.115;
  const camera: Camera = { eye: [0, 6, 0], target: [0, 1, 0], fovDeg: 55, near: 1, far: 420 };
  const WHEELS = [[0.98, 1.3], [-0.98, 1.3], [0.98, -1.3], [-0.98, -1.3]] as const;

  const update = (w: World): void => {
    let blob = 0;
    w.cars.forEach((c, i) => {
      const sy = Math.sin(c.heading / 2), cy = Math.cos(c.heading / 2);
      for (const b of [bodies[i]!, cabins, bodyInk, cabinInk]) {
        if (b) setTRS(b, b === bodies[i] ? 0 : i, c.x, c.y, c.z, 0, sy, 0, cy, 1);
      }
      const sh = Math.sin(c.heading), ch = Math.cos(c.heading), sx = Math.sin(c.spin / 2), cx = Math.cos(c.spin / 2);
      WHEELS.forEach(([ox, oz], k) => {
        setTRS(wheels, i * 4 + k, c.x + ox * ch + oz * sh, 0.45 + c.y, c.z - ox * sh + oz * ch, cy * sx, sy * cx, -sy * sx, cy * cx, 1);
      });
      setTRS(blobs, blob++, c.x, BLOB_Y, c.z, 0, 0, 0, 1, 2.1);
    });

    kindCount.fill(0);
    for (const p of w.props) {
      const i = kindCount[p.kind]!++;
      setTRS(propBatches[p.kind]!, i, p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw, p.scale);
      const ink = propInk[p.kind];
      if (ink) setTRS(ink, i, p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw, p.scale);
      // The shadow shrinks as the prop flies higher.
      setTRS(blobs, blob++, p.x, BLOB_Y, p.z, 0, 0, 0, 1, PROP_HALF[p.kind]! * 1.7 * p.scale * Math.max(0.35, 1 - p.y / 7));
    }
    for (const t of w.trees) setTRS(blobs, blob++, t.x, BLOB_Y, t.z, 0, 0, 0, 1, 1.7 * t.scale);

    // The water's edge breathes a little; drops shrink as they fall; ripples spread and then vanish.
    water.time = w.time;
    w.waters.forEach((p, i) => {
      const wobble = 1 + Math.sin(w.time * 1.6 + i * 1.7) * 0.012;
      setTRS(rims, i, p.x, WATER_Y - 0.01, p.z, 0, 0, 0, 1, (p.r + 0.28) * wobble);
      if (pools) setTRS(pools, i, p.x, WATER_Y, p.z, 0, 0, 0, 1, p.r * wobble);
    });
    w.drops.forEach((d, i) => setTRS(drops, i, d.x, d.y, d.z, 0, 0, 0, 1, d.life > 0 ? 0.07 + 0.1 * (d.life / DROP_LIFE) : 0));
    w.ripples.forEach((r, i) => {
      const age = 1 - r.life / RIPPLE_LIFE;
      setTRS(ripples, i, r.x, WATER_Y + 0.012, r.z, 0, 0, 0, 1, r.life > 0 ? r.size * (1 + 2.2 * age) : 0);
    });

    w.puffs.forEach((p, i) => setTRS(puffs, i, p.x, p.y, p.z, 0, 0, 0, 1, p.life > 0 ? 0.32 * (p.life / 0.5) : 0));

    // The camera sits behind and above the kid's car and follows its heading a little late.
    const kid = w.cars[0]!, fx = Math.sin(w.camHeading), fz = Math.cos(w.camHeading);
    camera.eye = [kid.x - fx * 10, 5.5, kid.z - fz * 10];
    camera.target = [kid.x + fx * 5, 1.2, kid.z + fz * 5];
  };
  update(world);

  return {
    batches,
    water,
    sky: hex('#bfe6ff'),
    hemiSky: [0.55, 0.57, 0.6],
    hemiGround: [0.36, 0.34, 0.32],
    sunDir: [-0.45, -0.8, -0.4],
    sun: 0.45,
    camera,
    update,
    triangles: () => batches.reduce((n, b) => n + b.mesh.triangles * b.count, 0),
  };
}
