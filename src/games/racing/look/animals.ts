// Animals in the toy look (driving-assets.md, category 8; milestone-3 B3): chunky, friendly shapes, original
// designs (ADR 0011). Each faces +z with its feet on y = 0; the renderer moves, turns and hops it.
import * as THREE from 'three';
import type { AnimalId } from '../sim/assets/animals';
import { part, plastic, rbox } from './kit';

function legs(g: THREE.Group, material: THREE.Material, x: number, front: number, back: number, height: number, r = 0.08): void {
  for (const lx of [-x, x]) for (const z of [front, back]) g.add(part(new THREE.CylinderGeometry(r, r, height, 8), material, lx, height / 2, z));
}

/** Two dark eyes, looking forward from a head at (0, y, z) of radius r. */
function eyes(g: THREE.Group, y: number, z: number, r: number): void {
  const black = plastic(0x1c1c1e, 0.3);
  for (const side of [-1, 1]) g.add(part(new THREE.SphereGeometry(r * 0.16, 10, 8), black, side * r * 0.45, y + r * 0.2, z + r * 0.85));
}

export const ANIMAL_LOOKS: Record<AnimalId, () => THREE.Group> = {
  'animal/sheep'() {
    const g = new THREE.Group();
    const wool = plastic(0xf6f4ee, 0.9), dark = plastic(0x2e2a28, 0.6);
    legs(g, dark, 0.22, 0.3, -0.3, 0.45);
    // A cloud of wool: a few round puffs.
    for (const [x, y, z, r] of [[0, 0.75, 0, 0.42], [0.2, 0.8, 0.22, 0.3], [-0.2, 0.8, 0.22, 0.3], [0.2, 0.78, -0.25, 0.3], [-0.2, 0.78, -0.25, 0.3], [0, 0.98, 0, 0.28]] as const) {
      g.add(part(new THREE.SphereGeometry(r, 10, 7), wool, x, y, z));
    }
    g.add(part(new THREE.SphereGeometry(0.2, 12, 8), dark, 0, 0.88, 0.55));
    for (const side of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.16, 0.06, 0.08), dark, side * 0.2, 0.95, 0.5));
    eyes(g, 0.88, 0.55, 0.2);
    return g;
  },
  'animal/duck'() {
    const g = new THREE.Group();
    const yellow = plastic(0xffd23f, 0.5), orange = plastic(0xff8a1f, 0.5);
    g.add(part(new THREE.SphereGeometry(0.3, 12, 9), yellow, 0, 0.32, 0).translateZ(-0.05));
    g.add(part(new THREE.SphereGeometry(0.2, 12, 9), yellow, 0, 0.62, 0.18));
    g.add(part(new THREE.BoxGeometry(0.16, 0.06, 0.18), orange, 0, 0.6, 0.38));
    for (const side of [-1, 1]) g.add(part(new THREE.BoxGeometry(0.08, 0.04, 0.16), orange, side * 0.1, 0.02, 0.05));
    eyes(g, 0.62, 0.18, 0.2);
    return g;
  },
  'animal/cow'() {
    const g = new THREE.Group();
    const white = plastic(0xf4f2ec, 0.7), black = plastic(0x2a2624, 0.6), pink = plastic(0xf3a6b6, 0.6);
    legs(g, white, 0.35, 0.6, -0.6, 0.7, 0.11);
    g.add(part(rbox(0.95, 0.75, 1.6, 0.25), white, 0, 1.05, 0));
    for (const [x, y, z] of [[0.48, 1.1, 0.2], [-0.48, 1.0, -0.35], [0.3, 1.43, -0.4]] as const) g.add(part(new THREE.BoxGeometry(0.05, 0.35, 0.4), black, x, y, z));
    g.add(part(rbox(0.55, 0.5, 0.55, 0.18), white, 0, 1.35, 0.95));
    g.add(part(new THREE.BoxGeometry(0.5, 0.25, 0.2), pink, 0, 1.2, 1.25));
    for (const side of [-1, 1]) g.add(part(new THREE.ConeGeometry(0.06, 0.2, 8), black, side * 0.2, 1.68, 0.9));
    eyes(g, 1.35, 0.95, 0.3);
    return g;
  },
};
