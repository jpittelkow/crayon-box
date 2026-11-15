// Toys in the toy look (driving-assets.md, category 2), one shape per toy id, each centred where the simulation
// puts it (sim/assets/toys.ts) and baked to one piece per material so the renderer can batch them.
import * as THREE from 'three';
import type { ToyId } from '../sim/assets/toys';
import { bake, part, plastic, rbox, ROUND } from './kit';

export type Pieces = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

const orange = () => plastic(0xff6a10, 0.5);
const whiteBand = () => plastic(0xf6f6f2, 0.4);

export const TOY_LOOKS: Record<ToyId, () => THREE.Group> = {
  'toy/cone'() {
    const body = orange();
    const cone = new THREE.Group();
    cone.add(part(new THREE.CylinderGeometry(0.07, 0.42, 1.0, ROUND), body, 0, 0.05, 0));
    cone.add(part(rbox(1.0, 0.1, 1.0, 0.06), body, 0, -0.45, 0));
    cone.add(part(new THREE.CylinderGeometry(0.22, 0.29, 0.2, ROUND), whiteBand(), 0, 0.12, 0));
    return cone;
  },
  'toy/crate'() {
    const wood = new THREE.MeshStandardMaterial({ color: 0xc08a4a, roughness: 0.8 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x8c5e2c, roughness: 0.85 });
    const crate = new THREE.Group().add(part(rbox(1, 1, 1, 0.04), wood));
    for (const [x, z] of [[0.48, 0.48], [-0.48, 0.48], [0.48, -0.48], [-0.48, -0.48]] as const) {
      crate.add(part(new THREE.BoxGeometry(0.08, 1.02, 0.08), woodDark, x, 0, z));
    }
    for (const y of [-0.48, 0.48]) {
      crate.add(part(new THREE.BoxGeometry(1.02, 0.08, 0.08), woodDark, 0, y, 0.48));
      crate.add(part(new THREE.BoxGeometry(1.02, 0.08, 0.08), woodDark, 0, y, -0.48));
      crate.add(part(new THREE.BoxGeometry(0.08, 0.08, 1.02), woodDark, 0.48, y, 0));
      crate.add(part(new THREE.BoxGeometry(0.08, 0.08, 1.02), woodDark, -0.48, y, 0));
    }
    return crate;
  },
  'toy/beach-ball'() {
    const ball = new THREE.MeshPhysicalMaterial({ color: 0xff4f96, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
    const g = new THREE.Group().add(part(new THREE.SphereGeometry(0.6, 24, 16), ball));
    g.add(part(new THREE.TorusGeometry(0.6, 0.04, 6, 24), whiteBand()));
    return g;
  },
  'toy/hay-bale'() {
    const straw = new THREE.MeshStandardMaterial({ color: 0xe5c25a, roughness: 0.95 });
    const twine = plastic(0x7a5a2a, 0.9);
    const bale = new THREE.Group().add(part(new THREE.CylinderGeometry(0.45, 0.45, 1.5, ROUND + 4).rotateZ(Math.PI / 2), straw));
    for (const x of [-0.4, 0.4]) bale.add(part(new THREE.TorusGeometry(0.455, 0.025, 6, ROUND + 4).rotateY(Math.PI / 2), twine, x, 0, 0));
    return bale;
  },
};

/** A toy's shape baked for batching. */
export const toyPieces = (id: ToyId): Pieces => bake(TOY_LOOKS[id]());
