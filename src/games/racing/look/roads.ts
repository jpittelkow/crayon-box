// Roads in the toy look (driving-assets.md, category 5): the surface, centre dashes about every 6 m and edge
// lines, all built along each road's centre line from the map, so any road shape draws the same way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pointAt, type Road } from '../sim/roads';

/**
 * A flat strip along a road, from `left` to `right` metres off its centre line (right is positive), every
 * `step` metres, lying at height y. For the road surface and its painted lines.
 */
function roadStrip(road: Road, left: number, right: number, y: number, step = 1.5): THREE.BufferGeometry {
  const n = Math.max(2, Math.ceil(road.length / step));
  const count = n + 1;
  const pos = new Float32Array(count * 2 * 3);
  for (let i = 0; i < count; i++) {
    const s = road.def.closed && i === n ? 0 : (i / n) * road.length;
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
  for (const road of roads) {
    const half = road.def.width / 2;
    surfaces.push(roadStrip(road, -half, half, 0.04));
    const count = Math.max(1, Math.round(road.length / 6));
    for (let i = 0; i < count; i++) {
      const p = pointAt(road, ((i + 0.5) / count) * road.length);
      lines.push(new THREE.BoxGeometry(0.3, 0.03, 2.2).rotateY(p.heading).translate(p.x, 0.06, p.z).toNonIndexed());
    }
    for (const side of [-1, 1]) {
      const at = side * (half - 0.45);
      lines.push(roadStrip(road, at - 0.1, at + 0.1, 0.055));
    }
  }
  // Dashes are boxes with normals and uvs; the strips have normals only. Merging needs the same attributes.
  for (const geo of lines) if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
  if (surfaces.length) add(mergeGeometries(surfaces)!, asphalt);
  if (lines.length) add(mergeGeometries(lines)!, white);
  return g;
}
