// The prototype's island, rebuilt at a chosen realism level from the game's own world data, so every sample
// shows the same place: same road, puddles, flood, trees and props.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAND_R, ROAD_R, ROAD_W } from '../../../src/games/racing/maps/island';
import type { World } from '../../../src/games/racing/sim/sim';
import type { Kit } from './kit';

/** Areas kept clear of trees and props (for the vehicle line-up). */
export interface Clear { x: number; z: number; r: number }

function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A flat ring lying on the ground at height y. */
function flatRing(inner: number, outer: number, y: number, segs = 128, rings = 1): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(inner, outer, segs, rings);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** A small tiling texture drawn on a canvas: speckles over a base color, for level 3's ground. */
function speckle(base: string, colors: string[], count: number, size: [number, number], strokes = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  const r = rng(base.length * 97 + count);
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)]!;
    g.strokeStyle = g.fillStyle;
    const x = r() * 512, y = r() * 512, s = size[0] + r() * (size[1] - size[0]);
    if (strokes) {
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * s, y - s);
      g.stroke();
    } else {
      g.fillRect(x, y, s, s);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildIsland(kit: Kit, world: World, clear: Clear[] = []): THREE.Group {
  const L = kit.level;
  const g = new THREE.Group();
  const r = rng(11);
  const isClear = (x: number, z: number, pad = 0) => clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + pad);
  const onRoad = (x: number, z: number, pad = 0) => Math.abs(Math.hypot(x, z) - ROAD_R) < ROAD_W / 2 + pad;
  const inWater = (x: number, z: number, pad = 0) => world.waters.some((p) => Math.hypot(x - p.x, z - p.z) < p.r + pad);

  // ---- Ground ----
  // From level 2 the light is brighter and tone-mapped, so the ground starts a little deeper in colour.
  const sand = new THREE.MeshStandardMaterial({ color: L === 1 ? 0xf2d9a0 : 0xe6c98c, roughness: 0.95 });
  const grass = new THREE.MeshStandardMaterial({ color: L === 1 ? 0x8fd16a : 0x5ea83c, roughness: 0.95 });
  const road = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.85 });
  if (L === 3) {
    sand.map = speckle('#ead096', ['#d9bd80', '#f6e2b2', '#cfae6c'], 9000, [1, 2]);
    sand.map.repeat.set(30, 30);
    sand.color.set(0xffffff);
    grass.map = speckle('#4f9634', ['#3f8429', '#68ab45', '#58a03b', '#7cb855', '#356f22'], 26000, [3, 9], true);
    grass.map.repeat.set(36, 36);
    grass.bumpMap = grass.map;
    grass.bumpScale = 1.5;
    grass.color.set(0xffffff);
    road.map = speckle('#53575d', ['#61656b', '#45494f', '#6c7075', '#3d4146'], 30000, [1, 2]);
    road.map.repeat.set(40, 40);
    road.bumpMap = road.map;
    road.bumpScale = 0.6;
    road.color.set(0xffffff);
  }
  const grassGeo = flatRing(0.01, LAND_R - 3, 0, 160, L === 1 ? 1 : 40);
  if (L >= 2) {
    // Patchy grass: a little lighter and darker in places, as lawns are.
    const pos = grassGeo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(L === 3 ? 0xffffff : 0x5ea83c);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + Math.sin(x * 0.05 + z * 0.07) * 0.5;
      const c = base.clone().offsetHSL(0.01 * n, 0.04 * n, 0.05 * n);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    grassGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    grass.vertexColors = true;
    if (L === 2) grass.color.set(0xffffff);
  }
  const ground = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    g.add(m);
  };
  ground(flatRing(LAND_R - 8, LAND_R + 2.5, -0.04, 160, 4), sand);
  ground(grassGeo, grass);
  ground(flatRing(ROAD_R - ROAD_W / 2, ROAD_R + ROAD_W / 2, 0.04, 200, 6), road);

  // Road markings: centre dashes at every level; edge lines from level 2; kerbs at level 3.
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 2.2), white);
    dash.position.set(Math.sin(a) * ROAD_R, 0.06, Math.cos(a) * ROAD_R);
    dash.rotation.y = a + Math.PI / 2;
    dash.receiveShadow = true;
    g.add(dash);
  }
  if (L >= 2) {
    for (const off of [-1, 1]) {
      const rr = ROAD_R + off * (ROAD_W / 2 - 0.45);
      ground(flatRing(rr - 0.1, rr + 0.1, 0.055, 200), white);
    }
  }
  if (L === 3) {
    const red = new THREE.MeshStandardMaterial({ color: 0xc8332b, roughness: 0.7 });
    for (const off of [-1, 1]) {
      const rr = ROAD_R + off * (ROAD_W / 2 + 0.25);
      const n = Math.round((2 * Math.PI * rr) / 1.2);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const kerb = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.16, 1.18, 2, 0.05), i % 2 ? white : red);
        kerb.position.set(Math.sin(a) * rr, 0.08, Math.cos(a) * rr);
        kerb.rotation.y = a + Math.PI / 2;
        kerb.receiveShadow = true;
        g.add(kerb);
      }
    }
  }

  // ---- Puddles and the flood ----
  const water = L === 1
    ? new THREE.MeshStandardMaterial({ color: 0x4aa8e0, roughness: 0.3 })
    : new THREE.MeshPhysicalMaterial({ color: 0x2f8fd0, roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: L === 1 ? 0xd7f0ff : 0x8a7d63, roughness: 0.9 });
  for (const p of world.waters) {
    const edge = new THREE.Mesh(new THREE.CircleGeometry(p.r + (L === 1 ? 0.28 : 0.5), kit.round * 2).rotateX(-Math.PI / 2), rim);
    edge.position.set(p.x, 0.075, p.z);
    edge.receiveShadow = true;
    g.add(edge);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(p.r, kit.round * 2).rotateX(-Math.PI / 2), water);
    pool.position.set(p.x, 0.09, p.z);
    pool.receiveShadow = true;
    g.add(pool);
  }

  // ---- Trees ----
  const bark = new THREE.MeshStandardMaterial({ color: 0x7a5034, roughness: 0.9 });
  const leaves = [0x3f9b4b, 0x4aa95a, 0x37894a, 0x5bb04f].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: L === 3 ? 0.85 : 0.6, flatShading: L === 2 }));
  world.trees.forEach((t, i) => {
    if (isClear(t.x, t.z, 4)) return;
    const tree = new THREE.Group();
    tree.add(kit.mesh(new THREE.CylinderGeometry(0.3, 0.38, 1.6, 10), bark, 0, 0.8, 0));
    if (L === 1) {
      tree.add(kit.mesh(new THREE.ConeGeometry(1.7, 2.6, 16), leaves[0]!, 0, 2.4, 0));
    } else if (L === 2) {
      if (i % 3 === 0) {
        tree.add(kit.mesh(new THREE.IcosahedronGeometry(1.45, 1), leaves[3]!, 0, 2.7, 0));
        tree.add(kit.mesh(new THREE.IcosahedronGeometry(0.9, 1), leaves[1]!, 0.6, 3.4, 0.3));
      } else {
        [[1.75, 1.6, 1.9], [1.35, 1.4, 2.7], [0.95, 1.2, 3.4]].forEach(([rad, h, y], k) =>
          tree.add(kit.mesh(new THREE.ConeGeometry(rad, h, 12), leaves[k % 2]!, 0, y, 0)));
      }
    } else {
      // Clumps of bumpy foliage in a few greens.
      const clumps = 5 + (i % 3);
      for (let k = 0; k < clumps; k++) {
        const geo = new THREE.IcosahedronGeometry(0.75 + r() * 0.5, 3);
        const pos = geo.getAttribute('position');
        for (let v = 0; v < pos.count; v++) {
          const s = 1 + (Math.sin(pos.getX(v) * 7 + k) * Math.cos(pos.getY(v) * 6) * Math.sin(pos.getZ(v) * 8)) * 0.12;
          pos.setXYZ(v, pos.getX(v) * s, pos.getY(v) * s, pos.getZ(v) * s);
        }
        geo.computeVertexNormals();
        const a = (k / clumps) * Math.PI * 2;
        tree.add(kit.mesh(geo, leaves[k % 4]!, Math.sin(a) * 0.7, 2.4 + r() * 1.3, Math.cos(a) * 0.7));
      }
    }
    tree.position.set(t.x, 0, t.z);
    tree.scale.setScalar(t.scale);
    g.add(tree);
  });

  // Bushes from level 2; grass tufts and flowers at level 3.
  if (L >= 2) {
    const bush = new THREE.MeshStandardMaterial({ color: 0x4c9a3e, roughness: 0.7, flatShading: L === 2 });
    for (let i = 0; i < 70; i++) {
      const a = r() * Math.PI * 2, d = 6 + r() * 48;
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (onRoad(x, z, 1.5) || inWater(x, z, 1) || isClear(x, z, 3)) continue;
      for (let k = 0; k < 3; k++) {
        g.add(kit.mesh(new THREE.IcosahedronGeometry(0.45 + r() * 0.3, L === 3 ? 2 : 1), bush, x + (r() - 0.5) * 0.9, 0.3, z + (r() - 0.5) * 0.9));
      }
    }
  }
  if (L === 3) {
    const tuft = new THREE.ConeGeometry(0.05, 0.4, 4);
    const tufts = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0x5c9e3f, roughness: 0.9 }), 6000);
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshStandardMaterial({ color: 0xfff1a8, roughness: 0.6 }), 600);
    const m = new THREE.Matrix4();
    let n = 0, f = 0;
    while (n < 6000) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (LAND_R - 4);
      const x = Math.sin(a) * d, z = Math.cos(a) * d;
      if (onRoad(x, z, 0.8) || inWater(x, z, 0.4) || isClear(x, z)) continue;
      m.makeRotationFromEuler(new THREE.Euler((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5));
      m.setPosition(x, 0.18, z);
      tufts.setMatrixAt(n++, m);
      if (f < 600 && r() < 0.1) {
        m.identity().setPosition(x + 0.1, 0.3, z);
        flowers.setMatrixAt(f++, m);
      }
    }
    tufts.receiveShadow = flowers.castShadow = true;
    g.add(tufts, flowers);
  }

  // ---- Things to knock around, where the simulation has them ----
  const shapes = propShapes(kit);
  for (const p of world.props) {
    if (isClear(p.x, p.z) || p.scale <= 0) continue;
    const prop = shapes[p.kind]!();
    prop.position.set(p.x, p.y, p.z);
    prop.quaternion.set(p.qx, p.qy, p.qz, p.qw);
    prop.scale.setScalar(p.scale);
    g.add(prop);
  }
  return g;
}

/** Cone, crate, ball, bale: each centred where the simulation puts it. */
function propShapes(kit: Kit): (() => THREE.Object3D)[] {
  const L = kit.level;
  const orange = kit.plastic(0xff6a10, 0.5);
  const whiteBand = kit.plastic(0xf6f6f2, 0.4);
  const wood = new THREE.MeshStandardMaterial({ color: 0xc08a4a, roughness: 0.8 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x8c5e2c, roughness: 0.85 });
  if (L === 3) {
    wood.map = speckle('#b98244', ['#a06a30', '#c99558', '#93612c'], 1800, [6, 30], true);
    wood.color.set(0xffffff);
  }
  const ball = L === 1 ? kit.plastic(0xff5fa2, 0.45) : new THREE.MeshPhysicalMaterial({ color: 0xff4f96, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const straw = new THREE.MeshStandardMaterial({ color: 0xe5c25a, roughness: 0.95 });
  if (L === 3) {
    straw.map = speckle('#ddb84f', ['#c99e35', '#f0d47a', '#b88c2a'], 6000, [4, 14], true);
    straw.bumpMap = straw.map;
    straw.color.set(0xffffff);
  }
  const twine = kit.plastic(0x7a5a2a, 0.9);

  return [
    () => {
      const g = new THREE.Group();
      g.add(kit.mesh(new THREE.CylinderGeometry(0.07, 0.42, 1.0, kit.round), orange, 0, 0.05, 0));
      g.add(kit.mesh(L === 1 ? new THREE.BoxGeometry(1.0, 0.1, 1.0) : kit.rbox(1.0, 0.1, 1.0, 0.06), orange, 0, -0.45, 0));
      if (L >= 2) g.add(kit.mesh(new THREE.CylinderGeometry(0.22, 0.29, 0.2, kit.round), whiteBand, 0, 0.12, 0));
      return g;
    },
    () => {
      const g = new THREE.Group();
      g.add(kit.mesh(kit.rbox(1, 1, 1, 0.04), wood));
      if (L >= 2) {
        // A darker frame on each face: the crate's boards.
        for (const [x, z] of [[0.48, 0.48], [-0.48, 0.48], [0.48, -0.48], [-0.48, -0.48]]) {
          g.add(kit.mesh(new THREE.BoxGeometry(0.08, 1.02, 0.08), woodDark, x, 0, z));
        }
        for (const y of [-0.48, 0.48]) {
          g.add(kit.mesh(new THREE.BoxGeometry(1.02, 0.08, 0.08), woodDark, 0, y, 0.48));
          g.add(kit.mesh(new THREE.BoxGeometry(1.02, 0.08, 0.08), woodDark, 0, y, -0.48));
          g.add(kit.mesh(new THREE.BoxGeometry(0.08, 0.08, 1.02), woodDark, 0.48, y, 0));
          g.add(kit.mesh(new THREE.BoxGeometry(0.08, 0.08, 1.02), woodDark, -0.48, y, 0));
        }
      }
      return g;
    },
    () => {
      const g = new THREE.Group();
      g.add(kit.mesh(new THREE.SphereGeometry(0.6, kit.round + 8, kit.round), ball));
      if (L >= 2) g.add(kit.mesh(new THREE.TorusGeometry(0.6, 0.04, 8, kit.round + 8), whiteBand));
      return g;
    },
    () => {
      const g = new THREE.Group();
      const body = new THREE.CylinderGeometry(0.45, 0.45, 1.5, kit.round + 4);
      body.rotateZ(Math.PI / 2);
      g.add(kit.mesh(body, straw));
      if (L >= 2) {
        for (const x of [-0.4, 0.4]) {
          const band = new THREE.TorusGeometry(0.455, 0.025, 6, kit.round + 4);
          band.rotateY(Math.PI / 2);
          g.add(kit.mesh(band, twine, x, 0, 0));
        }
      }
      return g;
    },
  ];
}
