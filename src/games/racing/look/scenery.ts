// Solid scenery and decor in the toy look (driving-assets.md, categories 3 and 4), keyed by id. Scenery shapes are
// baked for batching; decor is built as clumps that the ground merges into one mesh.
import * as THREE from 'three';
import type { DecorId, SceneryId } from '../sim/assets/scenery';
import { bake, part } from './kit';
import type { Pieces } from './toys';

const bark = () => new THREE.MeshStandardMaterial({ color: 0x7a5034, roughness: 0.9 });
const leaf = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true });
const trunk = (material: THREE.Material) => part(new THREE.CylinderGeometry(0.3, 0.38, 1.6, 10), material, 0, 0.8, 0);

export const SCENERY_LOOKS: Record<SceneryId, () => THREE.Group> = {
  /** A layered pine. */
  'scenery/pine'() {
    const pine = new THREE.Group().add(trunk(bark()));
    const leaves = [leaf(0x3f9b4b), leaf(0x4aa95a)];
    ([[1.75, 1.6, 1.9], [1.35, 1.4, 2.7], [0.95, 1.2, 3.4]] as const).forEach(([rad, h, y], k) =>
      pine.add(part(new THREE.ConeGeometry(rad, h, 12), leaves[k % 2]!, 0, y, 0)));
    return pine;
  },
  /** A round leafy tree. */
  'scenery/round-tree'() {
    const round = new THREE.Group().add(trunk(bark()));
    round.add(part(new THREE.IcosahedronGeometry(1.45, 1), leaf(0x5bb04f), 0, 2.7, 0));
    round.add(part(new THREE.IcosahedronGeometry(0.9, 1), leaf(0x4aa95a), 0.6, 3.4, 0.3));
    return round;
  },
};

/** A scenery shape baked for batching. */
export const sceneryPieces = (id: SceneryId): Pieces => bake(SCENERY_LOOKS[id]());

export interface DecorLook {
  material(): THREE.Material;
  /** One clump of `count` pieces around (x, z), using `r` for its randomness. */
  clump(r: () => number, x: number, z: number, count: number): THREE.BufferGeometry[];
}

export const DECOR_LOOKS: Record<DecorId, DecorLook> = {
  'decor/bush': {
    material: () => new THREE.MeshStandardMaterial({ color: 0x4c9a3e, roughness: 0.7, flatShading: true }),
    clump: (r, x, z, count) => Array.from({ length: count }, () =>
      new THREE.IcosahedronGeometry(0.45 + r() * 0.3, 1).translate(x + (r() - 0.5) * 0.9, 0.3, z + (r() - 0.5) * 0.9)),
  },
};
