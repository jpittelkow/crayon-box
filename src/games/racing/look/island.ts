// The island in the polished toy look (ADR 0025): the ground, roads (look/roads.ts), water and decor that never
// move. Trees and toys are drawn in batches by the renderer, from look/scenery.ts and look/toys.ts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { offsetOutline, randomInland } from '../sim/land';
import { nearestRoad } from '../sim/roads';
import type { World } from '../sim/sim';
import { ROUND } from './kit';
import { buildRoads } from './roads';
import { DECOR_LOOKS } from './scenery';

/** A flat shape on the ground at height `y`, from an outline in x, z. */
function flatShape(outline: [number, number][], y: number): THREE.BufferGeometry {
  // The shape is drawn in x, y and laid down; laying it down maps its y to -z, so z goes in negated.
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, y, 0);
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
  // The land from its shoreline (milestone-3 B2): sand reaching a little out into the sea, grass on top of it up
  // to the beach.
  const land = world.land;
  add(flatShape(offsetOutline(land, 2.5), -0.04), new THREE.MeshStandardMaterial({ color: 0xe6c98c, roughness: 0.95 }));

  // Patchy grass: lighter and darker in places, as lawns are. The shade comes from where a point is on the
  // ground, so any shape of land gets it.
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x5ea83c, roughness: 0.95 });
  grassMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGround;')
      .replace('#include <color_fragment>', [
        '#include <color_fragment>',
        'float patchy = sin(vGround.x * 0.21) * cos(vGround.y * 0.17) * 0.5 + sin(vGround.x * 0.05 + vGround.y * 0.07) * 0.5;',
        'diffuseColor.rgb *= 1.0 + 0.09 * patchy;',
      ].join('\n'));
  };
  add(flatShape(offsetOutline(land, -(land.def.beach - 5)), 0), grassMat);

  g.add(buildRoads(world.roads));

  // Puddles and the flood: shiny water inside a muddy rim.
  const water = new THREE.MeshPhysicalMaterial({ color: 0x2f8fd0, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x8a7d63, roughness: 0.9 });
  for (const p of world.waters) {
    add(new THREE.CircleGeometry(p.r + 0.5, ROUND * 2).rotateX(-Math.PI / 2).translate(p.x, 0.075, p.z), rim);
    add(new THREE.CircleGeometry(p.r, ROUND * 2).rotateX(-Math.PI / 2).translate(p.x, 0.09, p.z), water);
  }

  // Decor (bushes): clumps kept off the roads, out of the water and clear of toys, one mesh per kind.
  const r = rng(11);
  for (const decor of world.map.decor) {
    const look = DECOR_LOOKS[decor.id];
    const pieces: THREE.BufferGeometry[] = [];
    for (let i = 0; i < decor.clumps; i++) {
      const [x, z] = randomInland(land, r, 6);
      const road = nearestRoad(world.roads, x, z);
      if (road && road.dist < world.roads[road.road]!.def.width / 2 + 1.5) continue;
      if (world.waters.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + 1)) continue;
      if (world.props.some((p) => Math.hypot(x - p.homeX, z - p.homeZ) < 1.5)) continue;
      pieces.push(...look.clump(r, x, z, decor.perClump));
    }
    if (pieces.length) add(mergeGeometries(pieces)!, look.material(), true);
  }
  return g;
}
