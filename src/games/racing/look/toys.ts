// Toys in the toy look (driving-assets.md, category 2), one shape per toy id, each centred where the simulation
// puts it (sim/assets/toys.ts) and baked to one piece per material so the renderer can batch them.
import * as THREE from 'three';
import type { ToyId } from '../sim/assets/toys';
import { bake, part, plastic, rbox, ROUND } from './kit';

/** Confetti's colours (ADR 0041, `fx/confetti`): the crayon box's brightest, one per hue the simulation picks. */
export const CONFETTI_COLORS = [0xf23b2f, 0xff8a1f, 0xffd23f, 0x44b87b, 0x12b5b0, 0x3a86ff, 0x9b5de5, 0xff6b9d] as const;

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
  // Targets (ADR 0041). One box of a stack: a glossy toy box with a white ribbon round it both ways. Its body is
  // white here and tinted per box by the renderer (TOY_TINTS), so a stack is many colours.
  'toy/box-stack'() {
    const body = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    body.userData.tint = true;
    const ribbon = plastic(0xfafaf5, 0.45);
    const box = new THREE.Group().add(part(rbox(0.75, 0.75, 0.75, 0.07), body));
    box.add(part(new THREE.BoxGeometry(0.77, 0.77, 0.12), ribbon));
    box.add(part(new THREE.BoxGeometry(0.12, 0.77, 0.77), ribbon));
    return box;
  },
  // A gold star, upright, a point at the top, thick enough to read from the side as it turns.
  'toy/star'() {
    const gold = new THREE.MeshPhysicalMaterial({
      color: 0xffc83a, emissive: 0x7a5200, emissiveIntensity: 0.6, metalness: 0.35, roughness: 0.25, clearcoat: 1,
    });
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.24 : 0.55;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
    geo.translate(0, 0, -0.08);
    return new THREE.Group().add(part(geo, gold));
  },
};

/**
 * Toys drawn in several colours (ADR 0041): one colour per box of a stack, by its place in the stack. The tinted
 * parts are the materials marked `userData.tint`, white in the look.
 */
export const TOY_TINTS: Partial<Record<ToyId, readonly number[]>> = {
  'toy/box-stack': [0xf23b2f, 0x3a86ff, 0xffd23f, 0x44b87b, 0xff8a1f, 0x9b5de5],
};

/** A toy's shape baked for batching. */
export const toyPieces = (id: ToyId): Pieces => bake(TOY_LOOKS[id]());
