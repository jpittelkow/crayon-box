// What gets drawn, as data (ADR 0021: "the world is data"). A scene is a list of batches: one shape, one color,
// many copies. Each frame the copies' places are written here from the simulation and the renderer only uploads
// them, so this file needs no 3D library and the renderer stays small.

import { box, cylinder, hull, layAlongX, ring, sphere, toMesh, type MeshData, type Tri } from './shapes';
import { DROP_LIFE, LAND_R, PROP_HALF, PROP_KINDS, RIPPLE_LIFE, ROAD_R, ROAD_W, type World } from './sim';

export type RGB = [number, number, number];

export interface Batch {
  name: string;
  mesh: MeshData;
  color: RGB;
  /** Lit by the two lights, or a plain flat color (outlines, shadows, puffs). */
  lit: boolean;
  opacity: number;
  count: number;
  /** False when the copies never move after the scene is built. */
  dynamic: boolean;
  /** Per copy: its place as a 4 x 4 matrix, column by column. */
  matrices: Float32Array;
}

export interface Camera { eye: [number, number, number]; target: [number, number, number]; fovDeg: number; near: number; far: number }

export interface SceneData {
  batches: Batch[];
  sky: RGB;
  hemiSky: RGB;
  hemiGround: RGB;
  /** The direction the sun's light travels. */
  sunDir: [number, number, number];
  sun: number;
  camera: Camera;
  /** Refreshes every moving batch and the camera from the simulation. */
  update(world: World): void;
}

export const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255,
];
const INK = hex('#23201c');
const PROP_COLORS = [hex('#ff7a1a'), hex('#d9a05b'), hex('#ff5fa2'), hex('#ffd23f')];
/** Traffic is painted in colors no kid profile uses, so the kid's own car is never mistaken for another. */
const TRAFFIC_COLORS = [hex('#e8402c'), hex('#f4f1ea'), hex('#2b3a8c')];

function place(b: Batch, i: number, px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number, s: number): void {
  const m = b.matrices, k = i * 16;
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  m[k] = (1 - (yy + zz)) * s; m[k + 1] = (xy + wz) * s; m[k + 2] = (xz - wy) * s; m[k + 3] = 0;
  m[k + 4] = (xy - wz) * s; m[k + 5] = (1 - (xx + zz)) * s; m[k + 6] = (yz + wx) * s; m[k + 7] = 0;
  m[k + 8] = (xz + wy) * s; m[k + 9] = (yz - wx) * s; m[k + 10] = (1 - (xx + yy)) * s; m[k + 11] = 0;
  m[k + 12] = px; m[k + 13] = py; m[k + 14] = pz; m[k + 15] = 1;
}

/** Builds the island for `world`. The kid's car is painted `kidColor` (ADR 0016 rule 7). */
export function buildScene(world: World, kidColor: RGB): SceneData {
  const batches: Batch[] = [];
  const batch = (name: string, mesh: MeshData, color: RGB, count: number, o: Partial<Batch> = {}): Batch => {
    const b: Batch = { name, mesh, color, lit: true, opacity: 1, count, dynamic: false, matrices: new Float32Array(count * 16), ...o };
    for (let i = 0; i < count; i++) place(b, i, 0, 0, 0, 0, 0, 0, 1, 1);
    batches.push(b);
    return b;
  };
  /** The ink outline of a shape (ADR 0016 rule 2 carried into 3D): see `hull`. */
  const ink = (name: string, tris: Tri[], thickness: number, count: number, o: Partial<Batch> = {}): Batch =>
    batch(name, hull(tris, thickness), INK, count, { lit: false, ...o });

  // The ground, in layers a few centimetres apart.
  batch('sea', toMesh(ring(0, 400, 24, -0.5)), hex('#4aa8e0'), 1);
  batch('sand', toMesh(ring(0, LAND_R + 2.5, 64, -0.04)), hex('#f2d9a0'), 1);
  batch('grass', toMesh(ring(0, LAND_R - 3, 64, 0)), hex('#8fd16a'), 1);
  batch('road', toMesh(ring(ROAD_R - ROAD_W / 2, ROAD_R + ROAD_W / 2, 64, 0.04)), hex('#5a5f66'), 1);
  const dashes = batch('dashes', toMesh(box(0.35, 0.04, 2.2)), hex('#ffffff'), 28);
  for (let i = 0; i < dashes.count; i++) {
    const a = (i / dashes.count) * Math.PI * 2, yaw = a + Math.PI / 2;
    place(dashes, i, Math.sin(a) * ROAD_R, 0.07, Math.cos(a) * ROAD_R, 0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2), 1);
  }

  // Puddles and the flood: a pale rim with flat blue on top, the same blue as the sea.
  const WATER_Y = 0.09;
  const disc = ring(0, 1, 28, 0);
  const rims = batch('water-rim', toMesh(disc), hex('#d7f0ff'), world.waters.length, { lit: false, dynamic: true });
  const pools = batch('water', toMesh(disc), hex('#4aa8e0'), world.waters.length, { dynamic: true });

  // Trees are kept low, and one between the camera and the car shrinks away, so the car is never hidden
  // (ADR 0021).
  const canopyTris = cylinder(1.7, 0, 1.2, 3.7, 9);
  const trunks = batch('trunks', toMesh(cylinder(0.38, 0.3, 0, 1.4, 7)), hex('#8a5a3a'), world.trees.length, { dynamic: true });
  const canopies = batch('canopies', toMesh(canopyTris), hex('#3f9b4b'), world.trees.length, { dynamic: true });
  const canopyInk = ink('canopy-ink', canopyTris, 0.08, world.trees.length, { dynamic: true });
  const treeSize = world.trees.map(() => 1);

  // Things to knock around: one batch per kind (cone, crate, ball, bale), plus its outline.
  const propTris: Tri[][] = [
    [...cylinder(0.5, 0.08, -0.5, 0.55, 10), ...box(1.1, 0.1, 1.1, 0, -0.5, 0)],
    box(1, 1, 1),
    sphere(0.6, 10, 6),
    box(1.5, 0.9, 0.9),
  ];
  const kindCount = new Array<number>(PROP_KINDS).fill(0);
  for (const p of world.props) kindCount[p.kind]++;
  const props = propTris.map((tris, k) => batch(`prop-${k}`, toMesh(tris), PROP_COLORS[k], Math.max(1, kindCount[k]), { dynamic: true }));
  const propInk = propTris.map((tris, k) => ink(`prop-ink-${k}`, tris, 0.06, Math.max(1, kindCount[k]), { dynamic: true }));

  // Cars: a body in each car's color, and a cabin and wheels shared by all.
  const bodyTris = [...box(1.9, 0.55, 4, 0, 0.72, 0), ...box(1.8, 0.25, 0.45, 0, 1.12, -1.75)];
  const cabinTris = box(1.6, 0.6, 1.9, 0, 1.295, -0.2);
  const cars = world.cars.length;
  const bodies = world.cars.map((_, i) =>
    batch(`body-${i}`, toMesh(bodyTris), i === 0 ? kidColor : TRAFFIC_COLORS[(i - 1) % TRAFFIC_COLORS.length], 1, { dynamic: true }));
  const cabins = batch('cabins', toMesh(cabinTris), hex('#cfeaff'), cars, { dynamic: true });
  const wheels = batch('wheels', toMesh(layAlongX(cylinder(0.45, 0.45, -0.2, 0.2, 8))), hex('#2b2b2b'), cars * 4, { dynamic: true });
  const bodyInk = ink('body-ink', bodyTris, 0.06, cars, { dynamic: true });
  const cabinInk = ink('cabin-ink', cabinTris, 0.06, cars, { dynamic: true });

  // A round blob for each shadow (no real-time shadows, ADR 0021), dust puffs, water drops and wake rings.
  const BLOB_Y = 0.115;
  const blobs = batch('blobs', toMesh(ring(0, 1, 16, 0)), [0, 0, 0], cars + world.props.length + world.trees.length,
    { lit: false, opacity: 0.2, dynamic: true });
  const puffs = batch('puffs', toMesh(sphere(1, 6, 4)), hex('#ffffff'), world.puffs.length, { lit: false, dynamic: true });
  const drops = batch('drops', toMesh(sphere(1, 6, 4)), hex('#e6f6ff'), world.drops.length, { lit: false, dynamic: true });
  const ripples = batch('ripples', toMesh(ring(0.93, 1, 28, 0)), hex('#ffffff'), world.ripples.length, { lit: false, dynamic: true });

  const camera: Camera = { eye: [0, 6, 0], target: [0, 1, 0], fovDeg: 55, near: 1, far: 420 };
  const WHEELS = [[0.98, 1.3], [-0.98, 1.3], [0.98, -1.3], [-0.98, -1.3]] as const;

  const update = (w: World): void => {
    let blob = 0;
    w.cars.forEach((c, i) => {
      const sy = Math.sin(c.heading / 2), cy = Math.cos(c.heading / 2);
      place(bodies[i], 0, c.x, c.y, c.z, 0, sy, 0, cy, 1);
      for (const b of [cabins, bodyInk, cabinInk]) place(b, i, c.x, c.y, c.z, 0, sy, 0, cy, 1);
      const sh = Math.sin(c.heading), ch = Math.cos(c.heading), sx = Math.sin(c.spin / 2), cx = Math.cos(c.spin / 2);
      WHEELS.forEach(([ox, oz], k) => {
        place(wheels, i * 4 + k, c.x + ox * ch + oz * sh, 0.45 + c.y, c.z - ox * sh + oz * ch, cy * sx, sy * cx, -sy * sx, cy * cx, 1);
      });
      place(blobs, blob++, c.x, BLOB_Y, c.z, 0, 0, 0, 1, 2.1);
    });

    kindCount.fill(0);
    for (const p of w.props) {
      const i = kindCount[p.kind]++;
      place(props[p.kind], i, p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw, p.scale);
      place(propInk[p.kind], i, p.x, p.y, p.z, p.qx, p.qy, p.qz, p.qw, p.scale);
      // The shadow shrinks as the prop flies higher.
      place(blobs, blob++, p.x, BLOB_Y, p.z, 0, 0, 0, 1, PROP_HALF[p.kind] * 1.7 * p.scale * Math.max(0.35, 1 - p.y / 7));
    }
    // The camera for this frame, then trees: any within reach of the line from the camera to the car shrinks.
    const kid = w.cars[0], fx = Math.sin(w.camHeading), fz = Math.cos(w.camHeading);
    const ex = kid.x - fx * 10, ez = kid.z - fz * 10;
    w.trees.forEach((t, i) => {
      const along = Math.max(0, Math.min(1, ((t.x - ex) * (kid.x - ex) + (t.z - ez) * (kid.z - ez)) / 100));
      const gap = Math.hypot(t.x - (ex + (kid.x - ex) * along), t.z - (ez + (kid.z - ez) * along));
      const want = gap < 2.2 * t.scale + 0.8 ? 0 : 1;
      treeSize[i] += Math.max(-0.12, Math.min(0.12, want - treeSize[i]));
      const s = t.scale * treeSize[i];
      for (const b of [trunks, canopies, canopyInk]) place(b, i, t.x, 0, t.z, 0, 0, 0, 1, s);
      place(blobs, blob++, t.x, BLOB_Y, t.z, 0, 0, 0, 1, 1.7 * s);
    });

    // The water's edge breathes a little; drops shrink as they fall; wake rings spread and then vanish.
    w.waters.forEach((p, i) => {
      const wobble = 1 + Math.sin(w.time * 1.6 + i * 1.7) * 0.012;
      place(rims, i, p.x, WATER_Y - 0.01, p.z, 0, 0, 0, 1, (p.r + 0.28) * wobble);
      place(pools, i, p.x, WATER_Y, p.z, 0, 0, 0, 1, p.r * wobble);
    });
    w.puffs.forEach((p, i) => place(puffs, i, p.x, p.y, p.z, 0, 0, 0, 1, p.life > 0 ? 0.32 * (p.life / 0.5) : 0));
    w.drops.forEach((d, i) => place(drops, i, d.x, d.y, d.z, 0, 0, 0, 1, d.life > 0 ? 0.07 + 0.1 * (d.life / DROP_LIFE) : 0));
    w.ripples.forEach((r, i) => {
      const age = 1 - r.life / RIPPLE_LIFE;
      place(ripples, i, r.x, WATER_Y + 0.012, r.z, 0, 0, 0, 1, r.life > 0 ? r.size * (1 + 2.2 * age) : 0);
    });

    // The camera sits behind and above the kid's car and follows its heading a little late. A kid can't move it.
    camera.eye = [ex, 5.5, ez];
    camera.target = [kid.x + fx * 5, 1.2, kid.z + fz * 5];
  };
  update(world);

  return {
    batches,
    sky: hex('#bfe6ff'),
    hemiSky: [0.55, 0.57, 0.6],
    hemiGround: [0.36, 0.34, 0.32],
    sunDir: [-0.45, -0.8, -0.4],
    sun: 0.45,
    camera,
    update,
  };
}
