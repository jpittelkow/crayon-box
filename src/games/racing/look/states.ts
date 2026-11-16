// How the vehicle states look (driving-assets.md: muddy, bubbly and wet are states every vehicle has, not assets).
// Muddy (ADR 0042): brown splats stuck to a vehicle's sides, wheels and ends, more of them the muddier it is.
import * as THREE from 'three';
import type { VehicleKind } from '../sim/sim';

/** Splats on a vehicle: as many as it shows when fully muddy. */
const SPLATS = 36;

/** A vehicle's coat of mud: one mesh of splats; `show(mud)` shows the first ones, lowest first, up to all at 1. */
export interface MudCoat { mesh: THREE.Mesh; show(mud: number): void }

/**
 * Builds a vehicle's coat of mud by casting rays at its model from the sides and the ends, low down where wheels
 * throw mud, and sticking a flat splat where each lands. The model must sit at the origin, unturned.
 */
export function mudCoat(vehicle: THREE.Object3D, kind: VehicleKind, material: THREE.Material): MudCoat {
  vehicle.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(vehicle);
  let seed = [...kind].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) | 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const low = 0.22, high = Math.min(1.5, box.min.y + (box.max.y - box.min.y) * 0.55);
  const ray = new THREE.Raycaster();
  const spots: { from: THREE.Vector3; dir: THREE.Vector3; order: number }[] = [];
  for (let i = 0; i < SPLATS; i++) {
    const y = low + rand() * (high - low);
    // Most on the sides, some on the ends: more at the back, which the chase camera sees.
    if (i % 3 === 2) {
      const end = rand() < 0.7 ? -1 : 1;
      spots.push({ from: new THREE.Vector3((rand() - 0.5) * (box.max.x - box.min.x) * 0.7, y, end * 20), dir: new THREE.Vector3(0, 0, -end), order: y + rand() * 0.4 });
    } else {
      const side = i % 2 ? -1 : 1;
      const z = box.min.z + 0.3 + rand() * (box.max.z - box.min.z - 0.6);
      spots.push({ from: new THREE.Vector3(side * 20, y, z), dir: new THREE.Vector3(-side, 0, 0), order: y + rand() * 0.4 });
    }
  }
  spots.sort((a, b) => a.order - b.order);
  const pieces: THREE.BufferGeometry[] = [];
  const face = new THREE.Quaternion(), out = new THREE.Vector3(0, 0, 1), normal = new THREE.Vector3();
  for (const spot of spots) {
    ray.set(spot.from, spot.dir);
    const hit = ray.intersectObject(vehicle, true).find((h) => h.object instanceof THREE.Mesh);
    if (!hit) continue;
    normal.copy(spot.dir).negate();
    const r = 0.17 + rand() * 0.17;
    face.setFromUnitVectors(out, normal);
    const g = new THREE.SphereGeometry(1, 8, 5).scale(r * (1 + rand() * 0.6), r, 0.05).toNonIndexed();
    g.deleteAttribute('uv');
    g.applyQuaternion(face).translate(hit.point.x, hit.point.y, hit.point.z);
    pieces.push(g);
  }
  const geometry = new THREE.BufferGeometry();
  const per = pieces[0]?.getAttribute('position').count ?? 0;
  const pos = new Float32Array(pieces.length * per * 3), nor = new Float32Array(pieces.length * per * 3);
  pieces.forEach((p, i) => {
    pos.set(p.getAttribute('position').array as Float32Array, i * per * 3);
    nor.set(p.getAttribute('normal').array as Float32Array, i * per * 3);
  });
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const show = (mud: number) => {
    const n = Math.round(Math.max(0, Math.min(1, mud)) * pieces.length);
    mesh.visible = n > 0;
    geometry.setDrawRange(0, n * per);
  };
  show(0);
  return { mesh, show };
}
