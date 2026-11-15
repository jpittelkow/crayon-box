// The island in the polished toy look (ADR 0025): ground, roads (look/roads.ts), puddles and bushes that never
// move, plus the shapes of trees and props, which the renderer draws in batches.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { nearestRoad } from '../sim/roads';
import type { World } from '../sim/sim';
import { bake, part, plastic, rbox, ROUND } from './kit';
import { buildRoads } from './roads';

function flatRing(inner: number, outer: number, y: number, segs = 128, rings = 1): THREE.BufferGeometry {
  return new THREE.RingGeometry(inner, outer, segs, rings).rotateX(-Math.PI / 2).translate(0, y, 0);
}

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Everything on the island that never moves. */
export function buildGround(world: World): THREE.Group {
  const g = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, shadows = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    m.castShadow = shadows;
    g.add(m);
  };

  const sea = new THREE.Mesh(new THREE.CircleGeometry(900, 64).rotateX(-Math.PI / 2).translate(0, -0.5, 0),
    new THREE.MeshStandardMaterial({ color: 0x3d9fe0, roughness: 0.12, metalness: 0.05 }));
  g.add(sea);
  const land = world.map.land;
  const onLand = (geo: THREE.BufferGeometry) => geo.translate(land.x, 0, land.z);
  add(onLand(flatRing(land.r - land.beach, land.r + 2.5, -0.04, 160, 4)), new THREE.MeshStandardMaterial({ color: 0xe6c98c, roughness: 0.95 }));

  // Patchy grass: lighter and darker in places, as lawns are.
  const grass = onLand(flatRing(0.01, land.r - 3, 0, 160, 40));
  const pos = grass.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + Math.sin(x * 0.05 + z * 0.07) * 0.5;
    const c = new THREE.Color(0x5ea83c).offsetHSL(0.01 * n, 0.04 * n, 0.05 * n);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  grass.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  add(grass, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));

  g.add(buildRoads(world.roads));

  // Puddles and the flood: shiny water inside a muddy rim.
  const water = new THREE.MeshPhysicalMaterial({ color: 0x2f8fd0, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x8a7d63, roughness: 0.9 });
  for (const p of world.waters) {
    add(new THREE.CircleGeometry(p.r + 0.5, ROUND * 2).rotateX(-Math.PI / 2).translate(p.x, 0.075, p.z), rim);
    add(new THREE.CircleGeometry(p.r, ROUND * 2).rotateX(-Math.PI / 2).translate(p.x, 0.09, p.z), water);
  }

  // Bushes, kept off the road and out of the water, merged into one mesh.
  const r = rng(11);
  const bushes: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 6 + r() * (land.r - 12);
    const x = land.x + Math.sin(a) * d, z = land.z + Math.cos(a) * d;
    const road = nearestRoad(world.roads, x, z);
    if (road && road.dist < world.roads[road.road]!.def.width / 2 + 1.5) continue;
    if (world.waters.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1)) continue;
    if (world.props.some((p) => Math.hypot(x - p.homeX, z - p.homeZ) < 1.5)) continue;
    for (let k = 0; k < 3; k++) {
      bushes.push(new THREE.IcosahedronGeometry(0.45 + r() * 0.3, 1).translate(x + (r() - 0.5) * 0.9, 0.3, z + (r() - 0.5) * 0.9));
    }
  }
  if (bushes.length) add(mergeGeometries(bushes)!, new THREE.MeshStandardMaterial({ color: 0x4c9a3e, roughness: 0.7, flatShading: true }), true);
  return g;
}

export type Pieces = { geometry: THREE.BufferGeometry; material: THREE.Material }[];

/** Two kinds of tree, each baked to one piece per material: a layered pine, and a round leafy tree. */
export function treeShapes(): Pieces[] {
  const bark = new THREE.MeshStandardMaterial({ color: 0x7a5034, roughness: 0.9 });
  const leaves = [0x3f9b4b, 0x4aa95a, 0x5bb04f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true }));
  const trunk = () => part(new THREE.CylinderGeometry(0.3, 0.38, 1.6, 10), bark, 0, 0.8, 0);
  const pine = new THREE.Group().add(trunk());
  ([[1.75, 1.6, 1.9], [1.35, 1.4, 2.7], [0.95, 1.2, 3.4]] as const).forEach(([rad, h, y], k) =>
    pine.add(part(new THREE.ConeGeometry(rad, h, 12), leaves[k % 2]!, 0, y, 0)));
  const round = new THREE.Group().add(trunk());
  round.add(part(new THREE.IcosahedronGeometry(1.45, 1), leaves[2]!, 0, 2.7, 0));
  round.add(part(new THREE.IcosahedronGeometry(0.9, 1), leaves[1]!, 0.6, 3.4, 0.3));
  return [bake(pine), bake(round)];
}

/** Cone, crate, ball, bale, each centred where the simulation puts it and baked to one piece per material. */
export function propShapes(): Pieces[] {
  const orange = plastic(0xff6a10, 0.5);
  const whiteBand = plastic(0xf6f6f2, 0.4);
  const wood = new THREE.MeshStandardMaterial({ color: 0xc08a4a, roughness: 0.8 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x8c5e2c, roughness: 0.85 });
  const ball = new THREE.MeshPhysicalMaterial({ color: 0xff4f96, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const straw = new THREE.MeshStandardMaterial({ color: 0xe5c25a, roughness: 0.95 });
  const twine = plastic(0x7a5a2a, 0.9);

  const cone = new THREE.Group();
  cone.add(part(new THREE.CylinderGeometry(0.07, 0.42, 1.0, ROUND), orange, 0, 0.05, 0));
  cone.add(part(rbox(1.0, 0.1, 1.0, 0.06), orange, 0, -0.45, 0));
  cone.add(part(new THREE.CylinderGeometry(0.22, 0.29, 0.2, ROUND), whiteBand, 0, 0.12, 0));

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

  const beachBall = new THREE.Group().add(part(new THREE.SphereGeometry(0.6, ROUND + 8, ROUND), ball));
  beachBall.add(part(new THREE.TorusGeometry(0.6, 0.04, 8, ROUND + 8), whiteBand));

  const bale = new THREE.Group().add(part(new THREE.CylinderGeometry(0.45, 0.45, 1.5, ROUND + 4).rotateZ(Math.PI / 2), straw));
  for (const x of [-0.4, 0.4]) bale.add(part(new THREE.TorusGeometry(0.455, 0.025, 6, ROUND + 4).rotateY(Math.PI / 2), twine, x, 0, 0));

  return [cone, crate, beachBall, bale].map(bake);
}
