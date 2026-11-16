// Ground tiles (docs/highway-map-plan.md, phase 2): what never moves (roads and their paint, puddles, bushes) is cut
// into squares of about 100 m, each its own mesh, so the camera can skip the ones out of view and the renderer the
// ones out of reach. The cut keeps every triangle as it was (each goes to the square its middle is in), so a map
// looks exactly the same; only less of it is sent to the graphics card.
import * as THREE from 'three';

/** A ground tile's size, in metres. */
export const TILE_M = 100;

/**
 * Cuts a mesh's geometry into tiles: one mesh per square of `size` metres that has any of it, with the same
 * material and shadow settings. Each tile is marked `userData.tile` with its middle and reach, for the renderer.
 */
export function tiled(mesh: THREE.Mesh, size = TILE_M): THREE.Mesh[] {
  const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const names = Object.keys(source.attributes);
  const pos = source.getAttribute('position');
  const groups = new Map<string, number[]>();
  for (let t = 0; t < pos.count / 3; t++) {
    const cx = (pos.getX(t * 3) + pos.getX(t * 3 + 1) + pos.getX(t * 3 + 2)) / 3;
    const cz = (pos.getZ(t * 3) + pos.getZ(t * 3 + 1) + pos.getZ(t * 3 + 2)) / 3;
    const key = `${Math.floor(cx / size)},${Math.floor(cz / size)}`;
    let list = groups.get(key);
    if (!list) groups.set(key, (list = []));
    list.push(t);
  }
  const out: THREE.Mesh[] = [];
  for (const triangles of groups.values()) {
    const geo = new THREE.BufferGeometry();
    for (const name of names) {
      const from = source.getAttribute(name) as THREE.BufferAttribute;
      const n = from.itemSize, data = new Float32Array(triangles.length * 3 * n);
      triangles.forEach((t, k) => data.set((from.array as Float32Array).subarray(t * 3 * n, (t + 1) * 3 * n), k * 3 * n));
      geo.setAttribute(name, new THREE.BufferAttribute(data, n));
    }
    geo.computeBoundingSphere();
    const tile = new THREE.Mesh(geo, mesh.material);
    tile.castShadow = mesh.castShadow;
    tile.receiveShadow = mesh.receiveShadow;
    const { center, radius } = geo.boundingSphere!;
    tile.userData.tile = { x: center.x, z: center.z, r: radius };
    out.push(tile);
  }
  if (source !== mesh.geometry) source.dispose();
  mesh.geometry.dispose();
  return out;
}

/** Every mesh in a group cut into tiles, in place. */
export function tileGroup(group: THREE.Group, size = TILE_M): THREE.Group {
  for (const mesh of [...group.children]) {
    if (!(mesh instanceof THREE.Mesh)) continue;
    group.remove(mesh);
    group.add(...tiled(mesh, size));
  }
  return group;
}
