// Shapes built as plain triangle lists, so three.js and Babylon.js are handed the very same vertex data.
// Everything is flat shaded: each triangle has its own three vertices and its own normal.

export type V3 = [number, number, number];
export type Tri = [V3, V3, V3];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  triangles: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function faceNormal(t: Tri): V3 {
  const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / len, n[1] / len, n[2] / len];
}

/** Adds a triangle wound so its front faces along `out`. Triangles with no area are dropped. */
function add(tris: Tri[], a: V3, b: V3, c: V3, out: V3): void {
  const n = cross(sub(b, a), sub(c, a));
  if (Math.hypot(n[0], n[1], n[2]) < 1e-9) return;
  tris.push(dot(n, out) >= 0 ? [a, b, c] : [a, c, b]);
}

function quad(tris: Tri[], a: V3, b: V3, c: V3, d: V3, out: V3): void {
  add(tris, a, b, c, out);
  add(tris, a, c, d, out);
}

export function box(w: number, h: number, d: number, cx = 0, cy = 0, cz = 0): Tri[] {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  const t: Tri[] = [];
  quad(t, [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]);
  quad(t, [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0]);
  quad(t, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0]);
  quad(t, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
  quad(t, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  quad(t, [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1]);
  return t;
}

/** A cylinder or cone standing on the y axis: radius r0 at y0, r1 at y1. */
export function cylinder(r0: number, r1: number, y0: number, y1: number, sides: number): Tri[] {
  const t: Tri[] = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
    const b0: V3 = [Math.sin(a0) * r0, y0, Math.cos(a0) * r0], b1: V3 = [Math.sin(a1) * r0, y0, Math.cos(a1) * r0];
    const t0: V3 = [Math.sin(a0) * r1, y1, Math.cos(a0) * r1], t1: V3 = [Math.sin(a1) * r1, y1, Math.cos(a1) * r1];
    quad(t, b0, b1, t1, t0, [Math.sin(am), 0.0001, Math.cos(am)]);
    add(t, [0, y1, 0], t0, t1, [0, 1, 0]);
    add(t, [0, y0, 0], b0, b1, [0, -1, 0]);
  }
  return t;
}

export function sphere(r: number, cols: number, rows: number): Tri[] {
  const t: Tri[] = [];
  const p = (c: number, row: number): V3 => {
    const lat = (row / rows) * Math.PI, lon = (c / cols) * Math.PI * 2;
    return [Math.sin(lat) * Math.sin(lon) * r, Math.cos(lat) * r, Math.sin(lat) * Math.cos(lon) * r];
  };
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < cols; c++) {
      const a = p(c, row), b = p(c + 1, row), cc = p(c + 1, row + 1), d = p(c, row + 1);
      const mid: V3 = [(a[0] + b[0] + cc[0] + d[0]) / 4, (a[1] + b[1] + cc[1] + d[1]) / 4, (a[2] + b[2] + cc[2] + d[2]) / 4];
      quad(t, a, b, cc, d, mid);
    }
  }
  return t;
}

/** A flat ring on the ground, facing up. An inner radius of 0 makes a disc. */
export function ring(rIn: number, rOut: number, sides: number, y: number): Tri[] {
  const t: Tri[] = [];
  for (let i = 0; i < sides; i++) {
    const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
    const i0: V3 = [Math.sin(a0) * rIn, y, Math.cos(a0) * rIn], i1: V3 = [Math.sin(a1) * rIn, y, Math.cos(a1) * rIn];
    const o0: V3 = [Math.sin(a0) * rOut, y, Math.cos(a0) * rOut], o1: V3 = [Math.sin(a1) * rOut, y, Math.cos(a1) * rOut];
    quad(t, i0, o0, o1, i1, [0, 1, 0]);
  }
  return t;
}

export function move(tris: Tri[], x: number, y: number, z: number): Tri[] {
  return tris.map((t) => t.map((v) => [v[0] + x, v[1] + y, v[2] + z]) as Tri);
}

/** Turns a shape a quarter turn about z, so a y-axis cylinder lies along x (a wheel). */
export function layAlongX(tris: Tri[]): Tri[] {
  return tris.map((t) => t.map((v) => [v[1], -v[0], v[2]]) as Tri);
}

export function toMesh(tris: Tri[]): MeshData {
  const positions = new Float32Array(tris.length * 9);
  const normals = new Float32Array(tris.length * 9);
  const indices = new Uint32Array(tris.length * 3);
  tris.forEach((t, i) => {
    const n = faceNormal(t);
    for (let k = 0; k < 3; k++) {
      positions.set(t[k]!, i * 9 + k * 3);
      normals.set(n, i * 9 + k * 3);
      indices[i * 3 + k] = i * 3 + k;
    }
  });
  return { positions, normals, indices, triangles: tris.length };
}

/**
 * The ink outline, as an "inverted hull": the same shape pushed outward along its smoothed normals and turned
 * inside out, so only its far side shows as a dark rim around the real shape. Neither library's own outline
 * feature is used, so both draw exactly this.
 */
export function hull(tris: Tri[], thickness: number): MeshData {
  const key = (v: V3) => `${Math.round(v[0] * 1000)},${Math.round(v[1] * 1000)},${Math.round(v[2] * 1000)}`;
  const corners = new Map<string, { sum: V3; seen: Set<string> }>();
  for (const t of tris) {
    const n = faceNormal(t);
    for (const v of t) {
      let c = corners.get(key(v));
      if (!c) corners.set(key(v), (c = { sum: [0, 0, 0], seen: new Set() }));
      // Count each face direction once per corner, however many triangles the face is split into.
      if (c.seen.has(key(n))) continue;
      c.seen.add(key(n));
      c.sum[0] += n[0]; c.sum[1] += n[1]; c.sum[2] += n[2];
    }
  }
  const grown = (v: V3): V3 => {
    const s = corners.get(key(v))!.sum;
    const len = Math.hypot(s[0], s[1], s[2]) || 1;
    return [v[0] + (s[0] / len) * thickness, v[1] + (s[1] / len) * thickness, v[2] + (s[2] / len) * thickness];
  };
  return toMesh(tris.map((t) => [grown(t[0]), grown(t[2]), grown(t[1])] as Tri));
}
