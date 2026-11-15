// Roads in the toy look (driving-assets.md, category 5): the surface, centre dashes about every 6 m and edge
// lines, all built along each road's centre line from the map, so any road shape draws the same way. Where roads
// meet (milestone-3 B4), the joining road's surface stops at the other's edge and the edge lines leave a gap.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildJunctions, nearestOn, pointAt, wrapAlong, type Road } from '../sim/roads';

/**
 * A flat strip along a road, from `left` to `right` metres off its centre line (right is positive), every
 * `step` metres, from `s0` to `s1` metres along it, lying at height y. For the road surface and its painted lines.
 */
export function roadStrip(road: Road, left: number, right: number, y: number, s0 = 0, s1 = road.length, step = 1.5): THREE.BufferGeometry {
  const whole = road.def.closed && s0 === 0 && s1 === road.length;
  const n = Math.max(2, Math.ceil((s1 - s0) / step));
  const count = n + 1;
  const pos = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const s = whole && i === n ? 0 : s0 + (i / n) * (s1 - s0);
    const a = pointAt(road, s, left), b = pointAt(road, s, right);
    pos.set([a.x, y, a.z, b.x, y, b.z], i * 6);
  }
  const index: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    index.push(a, b, c, b, d, c); // facing up
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g.toNonIndexed();
}

/** The stretches of [0, length] left after taking out `gaps` (which may wrap round a loop's start). */
function keep(road: Road, gaps: [number, number][]): [number, number][] {
  const L = road.length;
  const cut: [number, number][] = [];
  for (const [a, b] of gaps) {
    if (!road.def.closed) cut.push([Math.max(0, a), Math.min(L, b)]);
    else if (b - a >= L) cut.push([0, L]);
    else {
      const wa = wrapAlong(road, a), wb = wa + (b - a);
      if (wb <= L) cut.push([wa, wb]);
      else cut.push([wa, L], [0, wb - L]);
    }
  }
  cut.sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = 0;
  for (const [a, b] of cut) {
    if (a > at + 0.01) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < L - 0.01) out.push([at, L]);
  return out;
}

/** Every road of a map: one mesh for the surfaces and one for all the paint. Both only take shadows. */
export function buildRoads(roads: Road[]): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    g.add(m);
  };
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  const surfaces: THREE.BufferGeometry[] = [];
  const lines: THREE.BufferGeometry[] = [];
  const junctions = buildJunctions(roads);
  roads.forEach((road, r) => {
    const half = road.def.width / 2;
    // A joining road starts and ends at the edge of the road it joins, so the two surfaces never overlap.
    const inset = (on: number | undefined) => (on === undefined ? 0 : roads[on]!.def.width / 2 - 0.2);
    const s0 = inset(road.def.from), s1 = road.length - inset(road.def.to);
    surfaces.push(roadStrip(road, -half, half, 0.04, s0, s1));
    const count = Math.max(1, Math.round((s1 - s0) / 6));
    for (let i = 0; i < count; i++) {
      const p = pointAt(road, s0 + ((i + 0.5) / count) * (s1 - s0));
      lines.push(new THREE.BoxGeometry(0.3, 0.03, 2.2).rotateY(p.heading).translate(p.x, 0.06, p.z).toNonIndexed());
    }
    // Edge lines, with a gap on the side a road joins from.
    for (const side of [-1, 1]) {
      const gaps: [number, number][] = [];
      for (const j of junctions[r]!) {
        const branch = roads[j.road]!;
        const into = pointAt(branch, j.dir > 0 ? 6 : branch.length - 6);
        if (Math.sign(nearestOn(road, r, into.x, into.z).offset) !== side) continue;
        const w = branch.def.width / 2 + 1;
        gaps.push([j.s - w, j.s + w]);
      }
      const at = side * (half - 0.45);
      for (const [a, b] of keep(road, gaps)) {
        if (Math.min(b, s1) - Math.max(a, s0) < 0.5) continue;
        lines.push(roadStrip(road, at - 0.1, at + 0.1, 0.055, Math.max(a, s0), Math.min(b, s1)));
      }
    }
  });
  // Dashes are boxes with normals and uvs; the strips have normals only. Merging needs the same attributes.
  for (const geo of lines) if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  if (surfaces.length) add(mergeGeometries(surfaces)!, asphalt);
  if (lines.length) add(mergeGeometries(lines)!, white);
  return g;
}
