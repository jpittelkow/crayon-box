// Materials and shapes for the polished toy look (ADR 0025). Loaded with three.js when the game opens.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SEGS = 4;
export const ROUND = 28;

export function rbox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, SEGS, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
}

/** Glossy toy paint with a clear coat that reflects the sky. */
export const paint = (color: THREE.ColorRepresentation) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.07 });
export const plastic = (color: THREE.ColorRepresentation, roughness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness });
export const glass = () => new THREE.MeshPhysicalMaterial({ color: 0x1b2a3c, roughness: 0.04, metalness: 0.2, clearcoat: 1 });
export const chrome = () => new THREE.MeshStandardMaterial({ color: 0xe8eaee, metalness: 1, roughness: 0.18 });
export const rubber = () => new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.92 });
export const lamp = (color: THREE.ColorRepresentation, strength = 1.4) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: 0.3 });

export function part(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  return m;
}

/**
 * Merges every mesh in `root` that shares a material into one mesh, with the parts' own placements baked in, so a
 * many-part toy costs one draw per material. Returns the merged pieces; `root` is left as it was.
 */
export function bake(root: THREE.Object3D): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let g = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    // Merging needs the same attributes on every part: position, normal and uv.
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    const list = byMaterial.get(o.material as THREE.Material) ?? [];
    list.push(g);
    byMaterial.set(o.material as THREE.Material, list);
  });
  return [...byMaterial].map(([material, geometries]) => ({ geometry: mergeGeometries(geometries)!, material }));
}

/** A baked group: one mesh per material, casting and taking shadows. */
export function bakedGroup(root: THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  for (const { geometry, material } of bake(root)) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/** A wheel with its axle along x: rounded tyre with tread, a spoked chrome rim and a hub. Baked. */
export function wheel(radius: number, width: number): THREE.Group {
  const g = new THREE.Group();
  const rim = radius * 0.6;
  const c = Math.min(width * 0.3, radius * 0.25);
  const pts: THREE.Vector2[] = [new THREE.Vector2(rim, -width / 2)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - c + Math.sin(a) * c, -width / 2 + c - Math.cos(a) * c));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(radius - c + Math.cos(a) * c, width / 2 - c + Math.sin(a) * c));
  }
  pts.push(new THREE.Vector2(rim, width / 2));
  const tyreMat = rubber(), rimMat = chrome(), dark = plastic(0x2a2d31, 0.7), hubMat = plastic(0x30343a, 0.4);
  g.add(part(new THREE.LatheGeometry(pts, ROUND + 8).rotateZ(Math.PI / 2), tyreMat));
  g.add(part(new THREE.CylinderGeometry(rim * 0.92, rim * 0.92, width * 0.84, ROUND).rotateZ(Math.PI / 2), dark));
  g.add(part(new THREE.CylinderGeometry(rim * 0.32, rim * 0.38, width * 0.9, ROUND).rotateZ(Math.PI / 2), hubMat));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const spoke = part(new THREE.BoxGeometry(width * 0.08, rim * 0.95, rim * 0.22).translate(0, rim * 0.45, 0), rimMat, side * width * 0.43);
      spoke.rotation.x = (i / 5) * Math.PI * 2;
      g.add(spoke);
    }
  }
  for (let i = 0; i < 18; i++) {
    const block = part(new THREE.BoxGeometry(width * 0.7, radius * 0.06, radius * 0.16).translate(0, radius * 0.995, 0), tyreMat);
    block.rotation.x = (i / 18) * Math.PI * 2;
    g.add(block);
  }
  return bakedGroup(g);
}
