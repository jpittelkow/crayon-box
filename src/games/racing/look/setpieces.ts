// Set pieces in the toy look (milestone-3 phase B3; driving-assets.md category 7). Built from the map's zones; the
// simulation decides what each one does (sim/ramps.ts for ramps).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { guardAt, hillReach, type Guard } from '../sim/ground';
import { QUAY_FACE, type Boat } from '../sim/harbour';
import { helipad, poseHelicopter, type HelipadLook } from './helipad';
import { onLand } from '../sim/land';
import { lampFor, lightsJunction, type Lamp, type Post, type Way } from '../sim/lights';
import type { HillDef } from '../sim/map';
import { RAMP } from '../sim/ramps';
import { BASIN_R, JETS, jetHeights, ringRadius } from '../sim/roundabout';
import { nearestRoad, pointAt, type Road } from '../sim/roads';
import type { World, Zone } from '../sim/sim';
import { flatShape } from './island';
import { ROUND, lamp, part, plastic, rbox } from './kit';
import { roadStrip } from './roads';

/** A ramp: a yellow plastic hump with red chevrons on both slopes, so it reads as "go over me" either way. */
function ramp(zone: Zone): THREE.Group {
  const g = new THREE.Group();
  const half = RAMP.length / 2;
  // The hump's side profile (along the road, up), pushed out across the road.
  const profile = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(0, RAMP.height), new THREE.Vector2(half, 0)]);
  const body = new THREE.ExtrudeGeometry(profile, { depth: RAMP.width, bevelEnabled: false }).translate(0, 0, -RAMP.width / 2);
  const hump = new THREE.Mesh(body, plastic(0xffc83d, 0.45));
  g.add(hump);
  // Chevrons lying on each slope.
  const slope = Math.atan2(RAMP.height, half);
  const red = plastic(0xe63946, 0.45);
  for (const side of [-1, 1]) {
    for (const at of [0.9, 1.9]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, RAMP.width * 0.86), red);
      stripe.position.set(side * at, RAMP.height * (1 - at / half) + 0.02, 0);
      stripe.rotation.z = -side * slope;
      g.add(stripe);
    }
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set(zone.x, 0, zone.z);
  // The profile runs along local x; turn it to run along the zone's heading.
  g.rotation.y = zone.heading - Math.PI / 2;
  return g;
}

/**
 * A car wash: an open arch over the road (posts, a roof with a striped band and big bubbles on top) and blue
 * brushes on both sides that spin. Nothing crosses above the car, so the camera always sees it (ADR 0021).
 */
function carWash(zone: Zone): { group: THREE.Group; brushes: THREE.Object3D[]; roof: THREE.Material[] } {
  const g = new THREE.Group();
  // Posts and brushes stand clear of the road, so traffic riding alongside the kid passes between them.
  const length = 7, across = 6.1, height = 4.4;
  const white = plastic(0xf4f6f8, 0.5), blue = plastic(0x3a86ff, 0.55), pale = plastic(0x9fd0ff, 0.6);
  // The roof's own materials, so it can fade while the camera passes it (see 'animate').
  // They are see-through-capable from the start: switching that on later would need the shader rebuilt.
  const roofWhite = plastic(0xf4f6f8, 0.5), roofRed = plastic(0xe63946, 0.45);
  for (const m of [roofWhite, roofRed]) m.transparent = true;
  for (const x of [-length / 2, length / 2]) {
    for (const z of [-across, across]) g.add(part(rbox(0.6, height, 0.6, 0.12), white, x, height / 2, z));
  }
  g.add(part(rbox(length + 0.8, 0.5, across * 2 + 0.8, 0.15), roofWhite, 0, height + 0.25, 0));
  for (const z of [-across - 0.42, across + 0.42]) g.add(part(new THREE.BoxGeometry(length + 0.8, 0.3, 0.06), roofRed, 0, height + 0.25, z));
  const bubble = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85 });
  for (const [x, r] of [[-2, 0.9], [0.2, 1.2], [2.3, 0.75]] as const) g.add(part(new THREE.SphereGeometry(r, 20, 14), bubble, x, height + 0.5 + r * 0.7, 0));
  // Brushes: a blue drum with pale fins, so the spin shows.
  const brushes: THREE.Object3D[] = [];
  for (const x of [-1.6, 1.6]) {
    for (const z of [-5.3, 5.3]) {
      const brush = new THREE.Group();
      brush.add(part(new THREE.CylinderGeometry(0.55, 0.55, 2.6, 16), blue, 0, 1.5, 0));
      for (let i = 0; i < 6; i++) {
        const fin = part(new THREE.BoxGeometry(0.06, 2.4, 0.32), pale, 0, 1.5, 0);
        fin.position.set(Math.sin((i / 6) * Math.PI * 2) * 0.62, 1.5, Math.cos((i / 6) * Math.PI * 2) * 0.62);
        fin.rotation.y = (i / 6) * Math.PI * 2;
        brush.add(fin);
      }
      brush.position.set(x, 0, z);
      brushes.push(brush);
      g.add(brush);
    }
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set(zone.x, 0, zone.z);
  g.rotation.y = zone.heading - Math.PI / 2;
  return { group: g, brushes, roof: [roofWhite, roofRed, bubble] };
}

/**
 * A bridge (milestone-3 B4): a wooden deck under the road with plank sides down toward the water, white rails on
 * posts along both edges, and round piers into the water.
 */
function bridge(world: World, guard: Guard): THREE.Group {
  const g = new THREE.Group();
  const road = world.roads[guard.road]!, half = road.def.width / 2;
  const s0 = guard.s0 - 3, s1 = guard.s1 + 3;
  const wood = plastic(0xc98b4a, 0.8), white = plastic(0xf4f6f8, 0.5), stone = plastic(0x9a9a9a, 0.9);
  const deck: THREE.BufferGeometry[] = [roadStrip(road, -half - 0.9, half + 0.9, 0.03, s0, s1)];
  const rails: THREE.BufferGeometry[] = [];
  const piers: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    // The deck's side, a band hanging down from its edge.
    const n = Math.ceil((s1 - s0) / 1.5);
    for (let i = 0; i < n; i++) {
      const a = pointAt(road, s0 + (i / n) * (s1 - s0), side * (half + 0.9)), b = pointAt(road, s0 + ((i + 1) / n) * (s1 - s0), side * (half + 0.9));
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      deck.push(new THREE.BoxGeometry(0.12, 0.7, len + 0.05).rotateY(Math.atan2(b.x - a.x, b.z - a.z)).translate((a.x + b.x) / 2, -0.32, (a.z + b.z) / 2));
    }
    // Rails: posts every 2.5 m and a top rail between them.
    const posts = Math.ceil((s1 - s0) / 2.5);
    for (let i = 0; i <= posts; i++) {
      const p = pointAt(road, s0 + (i / posts) * (s1 - s0), side * (half + 0.55));
      rails.push(new THREE.BoxGeometry(0.18, 1.0, 0.18).translate(p.x, 0.5, p.z));
      if (i === posts) continue;
      const q = pointAt(road, s0 + ((i + 1) / posts) * (s1 - s0), side * (half + 0.55));
      rails.push(new THREE.BoxGeometry(0.14, 0.14, Math.hypot(q.x - p.x, q.z - p.z) + 0.1)
        .rotateY(Math.atan2(q.x - p.x, q.z - p.z)).translate((p.x + q.x) / 2, 1.0, (p.z + q.z) / 2));
    }
  }
  for (let s = s0 + 6; s < s1 - 4; s += 8) {
    for (const side of [-1, 1]) {
      const p = pointAt(road, s, side * (half - 1));
      piers.push(new THREE.CylinderGeometry(0.45, 0.55, 3, 16).translate(p.x, -1.6, p.z));
    }
  }
  const mesh = (geos: THREE.BufferGeometry[], mat: THREE.Material) => {
    for (const geo of geos) if (geo.index) geo.copy(geo.toNonIndexed());
    for (const geo of geos) if (geo.getAttribute('uv')) geo.deleteAttribute('uv');
    const m = new THREE.Mesh(mergeGeometries(geos)!, mat);
    m.castShadow = m.receiveShadow = true;
    return m;
  };
  g.add(mesh(deck, wood), mesh(rails, white), mesh(piers, stone));
  return g;
}

/**
 * A hill (milestone-3 B4): a grassy dome. If a tunnel runs through it, stone portals frame each end, and the hill
 * turns see-through while the kid's car is inside, so the car is never hidden (ADR 0021).
 */
function hill(world: World, h: HillDef): { group: THREE.Group; skins: THREE.Material[]; tunnel: Guard | undefined } {
  const g = new THREE.Group();
  // See-through-capable from the start, as switching that later needs the shader rebuilt. The portals fade with
  // the hill: the camera passes right through one on the way in.
  const skin = new THREE.MeshStandardMaterial({ color: h.color ?? 0x5ea347, roughness: 0.95, transparent: true });
  const stone = plastic(0x8d8f93, 0.85);
  stone.transparent = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), skin);
  dome.scale.set(h.rx, h.height, h.rz);
  dome.position.set(h.x, -0.05, h.z);
  dome.castShadow = dome.receiveShadow = true;
  g.add(dome);
  // Its tunnel, if one runs through it: the tunnel's middle is inside the hill.
  const tunnel = world.guards.find((t) => {
    if (t.kind !== 'tunnel') return false;
    const mid = pointAt(world.roads[t.road]!, (t.s0 + t.s1) / 2);
    return hillReach(h, mid.x, mid.z) < 1;
  });
  if (tunnel) {
    const road = world.roads[tunnel.road]!, half = road.def.width / 2;
    for (const s of [tunnel.s0, tunnel.s1]) {
      const p = pointAt(road, s);
      const portal = new THREE.Group();
      for (const side of [-1, 1]) portal.add(part(rbox(1.0, 4.6, 1.2, 0.2), stone, side * (half + 0.5), 2.3, 0));
      portal.add(part(rbox(road.def.width + 2.2, 1.0, 1.2, 0.25), stone, 0, 4.6, 0));
      // Across the road, so the portal's local x is the road's right.
      portal.position.set(p.x, 0, p.z);
      portal.rotation.y = p.heading;
      portal.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
      });
      g.add(portal);
    }
  }
  return { group: g, skins: [skin, stone], tunnel };
}

/** Sandy places: flat sand over the grass, under the roads. */
function sand(world: World): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xecd29a, roughness: 0.95 });
  for (const s of world.sand) {
    const shape = new THREE.Shape(s.def.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, 0.015, 0), mat);
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/**
 * The garage (ADR 0035): a shed over the road with brick-red walls on both sides, a roof that fades while the
 * camera passes (like the car wash's), and a big spanner on top, so it reads as a garage without any text.
 */
function garage(zone: Zone): { group: THREE.Group; roof: THREE.Material[] } {
  const g = new THREE.Group();
  const length = 7, across = 6.1, height = 4.6;
  const brick = plastic(0xb5452f, 0.85), trim = plastic(0xf4f6f8, 0.5);
  for (const side of [-1, 1]) {
    g.add(part(rbox(length, height, 0.6, 0.12), brick, 0, height / 2, side * across));
    g.add(part(new THREE.BoxGeometry(length + 0.1, 0.25, 0.65), trim, 0, 1.2, side * across));
  }
  // See-through-capable from the start, as switching that later needs the shader rebuilt.
  const roofMat = plastic(0x5b6470, 0.6), spannerMat = plastic(0xffc400, 0.4);
  for (const m of [roofMat, spannerMat]) m.transparent = true;
  g.add(part(rbox(length + 0.8, 0.5, across * 2 + 1.2, 0.15), roofMat, 0, height + 0.25, 0));
  // The spanner: a handle and an open jaw.
  const spanner = new THREE.Group();
  spanner.add(part(rbox(3.2, 0.5, 0.25, 0.12), spannerMat, 0, 0, 0));
  spanner.add(part(new THREE.TorusGeometry(0.55, 0.22, 10, 24, Math.PI * 1.5), spannerMat, 1.85, 0, 0));
  spanner.position.set(0, height + 1.4, 0);
  spanner.rotation.set(0, Math.PI / 2, 0.35);
  g.add(spanner);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set(zone.x, 0, zone.z);
  g.rotation.y = zone.heading - Math.PI / 2;
  return { group: g, roof: [roofMat, spannerMat] };
}

/** A little moored boat, to look at (milestone-3 E): a hull, a cabin and a mast; it bobs on the water. */
function boat(x: number, z: number, heading: number, color: number): THREE.Group {
  const g = new THREE.Group();
  g.add(part(rbox(2.2, 0.8, 5.0, 0.35), plastic(color, 0.45), 0, 0.1, 0));
  g.add(part(rbox(1.6, 0.9, 1.6, 0.15), plastic(0xf4f6f8, 0.5), 0, 0.9, -0.6));
  g.add(part(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), plastic(0xc98b4a, 0.7), 0, 2.1, 0.8));
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set(x, -0.3, z);
  g.rotation.y = heading;
  return g;
}

/** A small seeded random stream, so a set piece looks the same every time it is built. */
function seeded(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One mesh from many little pieces of one material (their uvs dropped, so boxes and spheres merge). */
function merged(geos: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): THREE.Mesh {
  const flat = geos.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    return g;
  });
  const m = new THREE.Mesh(mergeGeometries(flat)!, mat);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}

/** A wobbly round outline, `r` across on average, round a middle. */
function blob(x: number, z: number, r: number, seed: number): [number, number][] {
  return Array.from({ length: 48 }, (_, i): [number, number] => {
    const a = (i / 48) * Math.PI * 2;
    const k = 1 + 0.1 * Math.sin(3 * a + seed) + 0.06 * Math.sin(7 * a + seed * 2);
    return [x + Math.sin(a) * r * k, z + Math.cos(a) * r * k];
  });
}

/** The look of mud (ADR 0042): its glossy brown and the darker brown of its rim, lumps and ruts. */
const MUD = { glossy: 0x6b4a2e, rim: 0x4a3220, lump: 0x553a24 };

/**
 * A patch of mud (ADR 0042): glossy brown over the track inside a darker wobbly rim, two ruts along the road where
 * wheels go, lumps round the edge, and mud bubbles that swell and pop (`animate`).
 */
function mudPatch(world: World, zone: Zone, seed: number): { group: THREE.Group; bubbles: THREE.Object3D[] } {
  const g = new THREE.Group();
  const r = seeded(seed * 97 + 5);
  // Wet-looking, but not so shiny that the sun turns it white.
  const glossy = new THREE.MeshPhysicalMaterial({ color: MUD.glossy, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.35 });
  const dark = plastic(MUD.rim, 0.9), lumpy = plastic(MUD.lump, 0.85);
  const ground = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    g.add(m);
  };
  ground(flatShape(blob(zone.x, zone.z, zone.r + 0.7, seed), 0.062), dark);
  ground(flatShape(blob(zone.x, zone.z, zone.r, seed + 1), 0.07), glossy);
  // Ruts where the wheels of both lanes go, along the road.
  if (zone.road !== undefined && zone.s !== undefined) {
    const road = world.roads[zone.road]!, len = zone.r * 0.8;
    const ruts = [-3.1, -1.3, 1.3, 3.1].map((at) => roadStrip(road, at - 0.3, at + 0.3, 0.074, zone.s! - len, zone.s! + len));
    g.add(merged(ruts, dark, false));
  }
  const lumps: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = zone.r * (0.88 + r() * 0.2), size = 0.22 + r() * 0.25;
    lumps.push(new THREE.SphereGeometry(1, 14, 8).scale(size * 1.3, size * 0.45, size).rotateY(r() * Math.PI)
      .translate(zone.x + Math.sin(a) * d, 0.07, zone.z + Math.cos(a) * d));
  }
  g.add(merged(lumps, lumpy));
  const bubbles: THREE.Object3D[] = [];
  const bubbleGeo = new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, d = zone.r * (0.2 + r() * 0.55);
    const b = part(bubbleGeo, glossy, zone.x + Math.sin(a) * d, 0.07, zone.z + Math.cos(a) * d);
    bubbles.push(b);
    g.add(b);
  }
  return { group: g, bubbles };
}

/**
 * A stream and its ford (ADR 0042): shallow water along the stream's path inside a muddy bank, from a round spring
 * to the shore; where a road crosses it the road shows through the water. Reeds and pebbles stand on its banks, off
 * the roads (the car drives through them), and little ripples drift downstream (`animate`).
 */
function stream(world: World, path: Road, seed: number): { group: THREE.Group; ripples: THREE.InstancedMesh; end: number } {
  const g = new THREE.Group();
  const half = path.def.width / 2;
  // Only the part on the land is water.
  let end = 0;
  while (end < path.length && onLand(world.land, pointAt(path, end).x, pointAt(path, end).z)) end += 0.5;
  end = Math.max(1, end - 0.5);
  // Not see-through: the strip folds over itself on the inside of a bend, and see-through water would show darker
  // there. A lighter blue than the flood's, as shallow water is.
  const water = new THREE.MeshPhysicalMaterial({ color: 0x45a2dc, roughness: 0.18, metalness: 0.05, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const bank = plastic(0x8a7d63, 0.9);
  const start = pointAt(path, 0);
  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material) => {
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    g.add(m);
  };
  flat(roadStrip(path, -half - 0.7, half + 0.7, 0.078, 0, end, 1), bank);
  flat(new THREE.CircleGeometry(half + 1.6, ROUND * 2).rotateX(-Math.PI / 2).translate(start.x, 0.078, start.z), bank);
  flat(roadStrip(path, -half, half, 0.088, 0, end, 1), water);
  flat(new THREE.CircleGeometry(half + 0.9, ROUND * 2).rotateX(-Math.PI / 2).translate(start.x, 0.088, start.z), water);
  // Reeds and pebbles along the banks, never on a road.
  const r = seeded(seed * 31 + 7);
  const offRoad = (x: number, z: number) => {
    const near = nearestRoad(world.roads, x, z);
    return !near || near.dist > world.roads[near.road]!.def.width / 2 + 1.5;
  };
  const reeds: THREE.BufferGeometry[] = [], tops: THREE.BufferGeometry[] = [], pebbles: THREE.BufferGeometry[] = [];
  for (let s = 2; s < end - 1; s += 2.2) {
    for (const side of [-1, 1]) {
      const p = pointAt(path, s + r() * 1.5, side * (half + 0.4 + r() * 0.6));
      if (!offRoad(p.x, p.z)) continue;
      if (r() < 0.45) {
        const size = 0.18 + r() * 0.2;
        pebbles.push(new THREE.IcosahedronGeometry(size, 0).scale(1.2, 0.55, 1).translate(p.x, 0.1, p.z));
        continue;
      }
      if (r() < 0.4) continue;
      for (let k = 0; k < 5; k++) {
        const h = 0.8 + r() * 0.6, lean = (r() - 0.5) * 0.4;
        const dx = (r() - 0.5) * 0.5, dz = (r() - 0.5) * 0.5;
        reeds.push(new THREE.ConeGeometry(0.05, h, 4).translate(0, h / 2, 0).rotateZ(lean).rotateY(r() * Math.PI).translate(p.x + dx, 0.05, p.z + dz));
        if (k < 2) tops.push(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 6).translate(0, h * 0.85, 0).rotateZ(lean).translate(p.x + dx, 0.05, p.z + dz));
      }
    }
  }
  if (reeds.length) g.add(merged(reeds, plastic(0x5c8f3a, 0.8)));
  if (tops.length) g.add(merged(tops, plastic(0x7a5230, 0.8)));
  if (pebbles.length) g.add(merged(pebbles, plastic(0xa3a6a8, 0.85)));
  // Ripples: pale rings that drift downstream, stretched along the flow.
  const ripples = new THREE.InstancedMesh(new THREE.RingGeometry(0.34, 0.44, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.7 }), Math.max(1, Math.round(end / 4)));
  ripples.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ripples.frustumCulled = false;
  g.add(ripples);
  return { group: g, ripples, end };
}

/** How fast a stream's ripples drift downstream, m/s. */
const FLOW = 1.4;

/**
 * Foam along a ford's road edges (ADR 0042): a white band where the stream runs over the road's sides, which
 * shimmers (`animate`).
 */
function fordFoam(world: World, zone: Zone): THREE.Mesh | null {
  if (zone.road === undefined || zone.s === undefined) return null;
  const road = world.roads[zone.road]!, half = road.def.width / 2;
  const across = (world.map.water.streams ?? []).reduce((w, s) => Math.max(w, s.width), 4) / 2;
  const foam = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const strips = [-1, 1].map((side) => roadStrip(road, side * half - 0.35, side * half + 0.35, 0.095, zone.s! - across, zone.s! + across, 0.5));
  return merged(strips, foam, false);
}

/** The lamps' colours lit and unlit, top to bottom. */
const LAMPS = { red: [0xff2a1a, 0x4a1410], amber: [0xffb000, 0x4a3410], green: [0x22dd55, 0x0f3a1c] } as const;

/**
 * Traffic lights (ADR 0042): a grey pole beside the road with a lamp head on top, red, amber and green under
 * visors, facing the traffic that comes at it. Pictures only, no text (ADR 0003).
 */
function lightPole(post: Post, lamps: Record<Lamp, THREE.MeshStandardMaterial>): THREE.Group {
  const g = new THREE.Group();
  const grey = plastic(0x3b4048, 0.5), head = plastic(0x24272c, 0.5), visor = plastic(0x24272c, 0.5);
  visor.side = THREE.DoubleSide;
  g.add(part(new THREE.CylinderGeometry(0.3, 0.36, 0.25, 16), grey, 0, 0.12, 0));
  g.add(part(new THREE.CylinderGeometry(0.11, 0.13, 3.4, 12), grey, 0, 1.7, 0));
  g.add(part(rbox(0.66, 1.66, 0.46, 0.12), head, 0, 3.95, 0));
  (['red', 'amber', 'green'] as const).forEach((lamp, i) => {
    const y = 4.45 - i * 0.5;
    g.add(part(new THREE.CylinderGeometry(0.19, 0.19, 0.08, 20).rotateX(Math.PI / 2), lamps[lamp], 0, y, 0.24));
    // A visor over each lamp, a half tube jutting toward the traffic.
    g.add(part(new THREE.CylinderGeometry(0.23, 0.23, 0.28, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), visor, 0, y, 0.38));
  });
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  g.position.set(post.x, 0, post.z);
  g.rotation.y = post.facing;
  return g;
}

/** Stop lines across each lane that comes into the lights (picture only: nobody has to stop at them). */
function stopLines(world: World, zone: Zone): THREE.Mesh | null {
  if (zone.road === undefined || zone.s === undefined) return null;
  const road = world.roads[zone.road]!, half = road.def.width / 2 - 0.4, d = zone.r + 0.3;
  const lines = [roadStrip(road, 0, half, 0.06, zone.s - d - 0.45, zone.s - d), roadStrip(road, -half, 0, 0.06, zone.s + d, zone.s + d + 0.45)];
  const j = lightsJunction(zone, world.junctions);
  if (j) {
    const branch = world.roads[j.road]!, bh = branch.def.width / 2 - 0.4, at = road.def.width / 2 + 0.6;
    lines.push(j.dir > 0 ? roadStrip(branch, -bh, 0, 0.06, at, at + 0.45) : roadStrip(branch, 0, bh, 0.06, branch.length - at - 0.45, branch.length - at));
  }
  return merged(lines, plastic(0xf4f4f0, 0.6), false);
}

/** A flat arrow lying on the road, pointing along `heading` (painted, no words: ADR 0003). */
function arrow(x: number, z: number, heading: number, y: number): THREE.BufferGeometry {
  const shape = new THREE.Shape([
    new THREE.Vector2(-0.22, -1.2), new THREE.Vector2(0.22, -1.2), new THREE.Vector2(0.22, 0.1), new THREE.Vector2(0.65, 0.1),
    new THREE.Vector2(0, 1.2), new THREE.Vector2(-0.65, 0.1), new THREE.Vector2(-0.22, 0.1),
  ]);
  // The shape points along its y; laid down, y becomes -z, so it is turned round to point along +z, then the heading.
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).rotateY(Math.PI + heading).translate(x, y, z);
}

/**
 * A roundabout (ADR 0042): painted arrows round its one-way ring, and in the middle a low round bed of grass and
 * flowers inside a red and white kerb, with a fountain whose jets rise and fall (`animate`). The ring itself is a
 * road, drawn with the others.
 */
function roundabout(world: World, zone: Zone, seed: number): { group: THREE.Group; jets: THREE.Object3D[] } {
  const g = new THREE.Group();
  const road = zone.ring === undefined ? undefined : world.roads[zone.ring];
  const ringR = road ? ringRadius(zone, road, zone.ring!) : zone.r - 4.5;
  const bedR = Math.max(BASIN_R + 0.8, ringR - (road ? road.def.width / 2 : 4.5));
  const r = seeded(seed * 53 + 3);
  // Arrows in both lanes, all the way round, pointing the way traffic goes.
  if (road) {
    const arrows: THREE.BufferGeometry[] = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const s = ((i + 0.5) / n) * road.length;
      for (const lane of [-2.2, 2.2]) {
        const p = pointAt(road, s, lane);
        arrows.push(arrow(p.x, p.z, p.heading, 0.062));
      }
    }
    g.add(merged(arrows, plastic(0xf4f4f0, 0.6), false));
  }
  // The bed, raised a little inside its kerb; the kerb's stones red and white in turn.
  const grass = plastic(0x6cbf45, 0.9), soil = plastic(0x7a5a3a, 0.95);
  g.add(merged([new THREE.CylinderGeometry(bedR - 0.25, bedR - 0.25, 0.16, ROUND * 2).translate(zone.x, 0.08, zone.z)], grass, false));
  const red: THREE.BufferGeometry[] = [], white: THREE.BufferGeometry[] = [];
  const stones = Math.max(12, Math.round((Math.PI * 2 * bedR) / 1.1));
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2;
    const len = (Math.PI * 2 * bedR) / stones - 0.06;
    (i % 2 ? red : white).push(new THREE.BoxGeometry(0.34, 0.2, len).rotateY(a + Math.PI / 2)
      .translate(zone.x + Math.sin(a) * bedR, 0.1, zone.z + Math.cos(a) * bedR));
  }
  g.add(merged(red, plastic(0xe63946, 0.6)), merged(white, plastic(0xf4f6f8, 0.55)));
  // Flowers between the kerb and the fountain: a stalk and a round head, in crayon colours.
  const colours = [0xff4d6d, 0xffd23f, 0xff8a1f, 0xffffff, 0xb15cff];
  const heads = colours.map(() => [] as THREE.BufferGeometry[]);
  const stalks: THREE.BufferGeometry[] = [];
  const soilRing = [new THREE.RingGeometry(BASIN_R + 0.15, BASIN_R + 0.65, ROUND * 2).rotateX(-Math.PI / 2).translate(zone.x, 0.165, zone.z)];
  const flowers = Math.round(Math.PI * (bedR * bedR - (BASIN_R + 0.4) ** 2) * 2.2);
  for (let i = 0; i < flowers; i++) {
    const a = r() * Math.PI * 2, d = BASIN_R + 0.45 + r() * (bedR - BASIN_R - 0.85);
    const x = zone.x + Math.sin(a) * d, z = zone.z + Math.cos(a) * d, h = 0.28 + r() * 0.22;
    stalks.push(new THREE.CylinderGeometry(0.025, 0.03, h, 5).translate(x, 0.16 + h / 2, z));
    heads[Math.floor(r() * heads.length)]!.push(new THREE.IcosahedronGeometry(0.11 + r() * 0.05, 0).translate(x, 0.16 + h, z));
  }
  g.add(merged(soilRing, soil, false), merged(stalks, plastic(0x3f8f2e, 0.8), false));
  heads.forEach((list, i) => {
    if (list.length) g.add(merged(list, plastic(colours[i]!, 0.5), false));
  });
  // The fountain: a stone basin full of water, a pedestal with a bowl in the middle, and jets round it.
  const stone = plastic(0xc9c3b6, 0.75);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x5ab8f0, roughness: 0.1, clearcoat: 0.6, transparent: true, opacity: 0.85 });
  const basin = new THREE.Group();
  basin.add(part(new THREE.CylinderGeometry(BASIN_R, BASIN_R + 0.08, 0.55, ROUND * 2, 1, true), stone, 0, 0.275, 0));
  basin.add(part(new THREE.TorusGeometry(BASIN_R - 0.06, 0.1, 8, ROUND * 2).rotateX(Math.PI / 2), stone, 0, 0.55, 0));
  basin.add(part(new THREE.CircleGeometry(BASIN_R - 0.05, ROUND * 2).rotateX(-Math.PI / 2), water, 0, 0.42, 0));
  basin.add(part(new THREE.CylinderGeometry(0.22, 0.3, 1.1, 16), stone, 0, 0.6, 0));
  basin.add(part(new THREE.CylinderGeometry(0.6, 0.18, 0.22, 20), stone, 0, 1.2, 0));
  basin.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = o.receiveShadow = true;
  });
  basin.position.set(zone.x, 0, zone.z);
  g.add(basin);
  // Jets: thin columns of water, scaled up and down by `animate`; their bases sit in the basin (the last on the bowl).
  const spray = new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: 0.05, transparent: true, opacity: 0.7, depthWrite: false });
  const jetGeo = new THREE.CylinderGeometry(0.03, 0.09, 1, 8).translate(0, 0.5, 0);
  const jets: THREE.Object3D[] = [];
  for (let i = 0; i <= JETS; i++) {
    const centre = i === JETS, a = (i / JETS) * Math.PI * 2, d = BASIN_R * 0.7;
    const jet = part(jetGeo, spray, zone.x + (centre ? 0 : Math.sin(a) * d), centre ? 1.3 : 0.42, zone.z + (centre ? 0 : Math.cos(a) * d));
    // Ring jets lean in a little toward the middle.
    if (!centre) jet.rotation.set(-Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25, 'YXZ');
    jets.push(jet);
    g.add(jet);
  }
  return { group: g, jets };
}

/** The tallest the fountain's jets go, metres: the ring's and the centre's. */
const JET_HEIGHT = { ring: 1.3, centre: 1.9 };

/**
 * A harbour's quay (ADR 0042): stone from the road's edge out to the quay's face over the water, a low stone edge
 * with dark bollards along the road (the car slides along it), and a few mooring posts at the face. The boats are
 * drawn by `buildSetPieces` from the simulation's (they bob, and one sails).
 */
function quay(world: World, guard: Guard): THREE.Group {
  const g = new THREE.Group();
  const road = world.roads[guard.road]!, half = road.def.width / 2, side = guard.side ?? 1;
  // Where the quay meets a bridge, the bridge's deck (3 m past its ends) takes over.
  let s0 = guard.s0, s1 = guard.s1;
  for (const b of world.guards) {
    if (b.kind !== 'bridge' || b.road !== guard.road || b.s0 - 3 >= s1 || b.s1 + 3 <= s0) continue;
    if (b.s0 > s0) s1 = Math.min(s1, b.s0 - 3);
    else s0 = Math.max(s0, b.s1 + 3);
  }
  const stone = plastic(0xa8a39a, 0.85), coping = plastic(0xd2cdc2, 0.7), iron = plastic(0x2b2f36, 0.45);
  const face = half + QUAY_FACE;
  // A strip from `a` to `b` metres off the road's centre line on the sea side, at height y.
  const band = (a: number, b: number, y: number) => (side > 0 ? roadStrip(road, a, b, y, s0, s1, 1) : roadStrip(road, -b, -a, y, s0, s1, 1));
  // The top: from the road's edge (a little under it, so the road's edge line shows) to the face.
  const flats = [band(half - 0.05, face, 0.03)];
  // The face: a wall down into the water, in short pieces along the curve, and a pale coping along its top.
  const walls: THREE.BufferGeometry[] = [], tops: THREE.BufferGeometry[] = [];
  const n = Math.ceil((s1 - s0) / 1.5);
  const piece = (at: number, i: number) => {
    const a = pointAt(road, s0 + (i / n) * (s1 - s0), side * at), b = pointAt(road, s0 + ((i + 1) / n) * (s1 - s0), side * at);
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len: Math.hypot(b.x - a.x, b.z - a.z) + 0.05, turn: Math.atan2(b.x - a.x, b.z - a.z) };
  };
  for (let i = 0; i < n; i++) {
    const p = piece(face, i);
    walls.push(new THREE.BoxGeometry(0.5, 1.0, p.len).rotateY(p.turn).translate(p.x, -0.47, p.z));
    tops.push(new THREE.BoxGeometry(0.6, 0.12, p.len).rotateY(p.turn).translate(p.x, 0.08, p.z));
  }
  // The low edge along the road, and bollards on it every 3 m.
  const edge: THREE.BufferGeometry[] = [band(half + 0.35, half + 0.85, 0.32)];
  for (const at of [half + 0.35, half + 0.85]) {
    for (let i = 0; i < n; i++) {
      const p = piece(at, i);
      edge.push(new THREE.BoxGeometry(0.04, 0.3, p.len).rotateY(p.turn).translate(p.x, 0.17, p.z));
    }
  }
  const bollards: THREE.BufferGeometry[] = [];
  const posts = Math.max(2, Math.round((s1 - s0) / 3));
  for (let i = 0; i <= posts; i++) {
    const p = pointAt(road, s0 + (i / posts) * (s1 - s0), side * (half + 0.6));
    bollards.push(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12).translate(p.x, 0.57, p.z));
    bollards.push(new THREE.SphereGeometry(0.21, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(p.x, 0.82, p.z));
  }
  // Mooring posts near the face, between the berths.
  for (let s = s0 + 3.5; s < s1 - 2; s += 7.5) {
    const p = pointAt(road, s, side * (face - 0.6));
    bollards.push(new THREE.CylinderGeometry(0.2, 0.24, 0.45, 12).translate(p.x, 0.3, p.z));
    bollards.push(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12).translate(p.x, 0.55, p.z));
  }
  g.add(merged(flats, stone, false), merged(walls, stone), merged([...tops, ...edge], coping), merged(bollards, iron));
  return g;
}

/** Every set piece on the map, and a step for the ones that move. */
export function buildSetPieces(world: World): { group: THREE.Group; animate(w: World, dt: number): void } {
  const g = new THREE.Group();
  const washes: { zone: Zone; brushes: THREE.Object3D[]; roof: THREE.Material[] }[] = [];
  const sheds: { zone: Zone; roof: THREE.Material[] }[] = [];
  const muds: THREE.Object3D[][] = [];
  const foams: THREE.Material[] = [];
  const lights: { light: number; lamps: Record<Way, Record<Lamp, THREE.MeshStandardMaterial>> }[] = [];
  const fountains: THREE.Object3D[][] = [];
  // Helicopter pads (ADR 0048), in the order of the world's helicopters.
  const pads: HelipadLook[] = world.choppers.map((c) => helipad(world.zones[c.zone]!));
  for (const pad of pads) g.add(pad.group);
  world.zones.forEach((zone, i) => {
    if (zone.kind === 'roundabout') {
      const piece = roundabout(world, zone, i);
      g.add(piece.group);
      fountains.push(piece.jets);
    }
    if (zone.kind === 'mud') {
      const patch = mudPatch(world, zone, i);
      g.add(patch.group);
      muds.push(patch.bubbles);
    }
    if (zone.kind === 'ford') {
      const foam = fordFoam(world, zone);
      if (foam) {
        g.add(foam);
        foams.push(foam.material as THREE.Material);
      }
    }
    if (zone.kind === 'lights') {
      const make = () => ({ red: lamp(LAMPS.red[0], 2.4), amber: lamp(LAMPS.amber[0], 2.4), green: lamp(LAMPS.green[0], 2.4) });
      const lamps = { main: make(), cross: make() };
      for (const post of world.posts.filter((p) => p.zone === i)) g.add(lightPole(post, lamps[post.way]));
      const lines = stopLines(world, zone);
      if (lines) g.add(lines);
      lights.push({ light: world.lights.findIndex((l) => l.zone === i), lamps });
    }
  });
  const streams = world.streams.map((path, i) => stream(world, path, i));
  for (const s of streams) g.add(s.group);
  const rippleAt = new THREE.Matrix4(), turn = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3(), size = new THREE.Vector3();
  const showLights = (w: World) => {
    for (const { light, lamps } of lights) {
      const phase = w.lights[light]?.phase ?? 0;
      for (const way of ['main', 'cross'] as const) {
        for (const name of ['red', 'amber', 'green'] as const) {
          const on = lampFor(phase, way) === name, m = lamps[way][name];
          m.color.setHex(LAMPS[name][on ? 0 : 1]);
          m.emissive.setHex(LAMPS[name][on ? 0 : 1]);
          m.emissiveIntensity = on ? 2.4 : 0.15;
        }
      }
    }
  };
  showLights(world);
  for (const zone of world.zones) {
    if (zone.kind === 'ramp') g.add(ramp(zone));
    if (zone.kind === 'garage') {
      const shed = garage(zone);
      g.add(shed.group);
      sheds.push({ zone, roof: shed.roof });
    }
    if (zone.kind === 'car-wash') {
      const wash = carWash(zone);
      g.add(wash.group);
      washes.push({ zone, brushes: wash.brushes, roof: wash.roof });
    }
  }
  g.add(sand(world));
  const boats = (world.map.boats ?? []).map((b, i) => boat(b.x, b.z, b.heading, [0xe63946, 0x3a86ff, 0xffc400][i % 3]!));
  for (const b of boats) g.add(b);
  for (const guard of world.guards) if (guard.kind === 'bridge') g.add(bridge(world, guard));
  // Harbours (ADR 0042): the quay, and the boats moored along it, which move as the simulation's do.
  for (const guard of world.guards) if (guard.kind === 'quay') g.add(quay(world, guard));
  const moored = world.boats.map((b, i) => boat(b.x, b.z, b.heading, [0x3a86ff, 0xffc400, 0xe63946, 0x2fa35f][i % 4]!));
  for (const b of moored) g.add(b);
  const placeBoats = (list: Boat[]) => list.forEach((b, i) => {
    const m = moored[i];
    if (!m) return;
    m.position.set(b.x, -0.3 + b.y, b.z);
    m.rotation.set(0, b.heading, b.roll, 'YXZ');
  });
  placeBoats(world.boats);
  const hills = (world.map.hills ?? []).map((h) => hill(world, h));
  for (const h of hills) g.add(h.group);
  return {
    group: g,
    animate(w, dt) {
      const kid = w.cars[0]!;
      // Mud bubbles swell slowly and pop, each on its own beat (ADR 0042).
      muds.forEach((bubbles, k) => bubbles.forEach((b, i) => {
        const beat = 2.1 + i * 0.37 + k * 0.23, t = ((w.time + i * 0.9 + k) % beat) / beat;
        b.scale.setScalar(t < 0.8 ? 0.2 + t : 0.01);
      }));
      // A ford's foam shimmers.
      for (const m of foams) m.opacity = 0.5 + 0.2 * Math.sin(w.time * 5);
      // Ripples drift downstream, swelling as they go, then start again upstream.
      for (const s of streams) {
        const n = s.ripples.count, path = w.streams[streams.indexOf(s)]!;
        for (let i = 0; i < n; i++) {
          const along = (i * (s.end / n) + w.time * FLOW) % s.end;
          const life = along / s.end, p = pointAt(path, along, Math.sin(i * 2.3) * path.def.width * 0.25);
          turn.setFromAxisAngle(up, p.heading);
          const grow = 0.6 + 0.6 * ((w.time * 0.7 + i * 0.37) % 1);
          rippleAt.compose(at.set(p.x, 0.092, p.z), turn, size.set(grow * 0.9, 1, grow * 2 * Math.min(1, life * 20)));
          s.ripples.setMatrixAt(i, rippleAt);
        }
        s.ripples.instanceMatrix.needsUpdate = true;
      }
      showLights(w);
      placeBoats(w.boats);
      pads.forEach((pad, i) => {
        const c = w.choppers[i];
        if (c) poseHelicopter(pad, c.height, c.heading, c.rotor, w.time, dt);
      });
      // The fountains' jets rise and fall.
      const heights = jetHeights(w.time);
      for (const jets of fountains) {
        jets.forEach((jet, i) => {
          const h = heights[i]! * (i === JETS ? JET_HEIGHT.centre : JET_HEIGHT.ring);
          jet.scale.set(1, Math.max(0.05, h), 1);
        });
      }
      boats.forEach((b, i) => {
        b.position.y = -0.3 + Math.sin(w.time * 1.3 + i) * 0.08;
        b.rotation.z = Math.sin(w.time * 0.9 + i * 2) * 0.04;
      });
      // A hill turns see-through while the kid's car is in its tunnel, or about to go in or just out.
      const inTunnel = guardAt(w.guards, w.roads, kid.x, kid.z, 6)?.guard.kind === 'tunnel';
      for (const { skins, tunnel } of hills) {
        const want = tunnel && inTunnel ? 0.3 : 1;
        for (const skin of skins) {
          skin.opacity += Math.max(-3 * dt, Math.min(3 * dt, want - skin.opacity));
          skin.depthWrite = skin.opacity > 0.999;
        }
      }
      // A garage's roof fades while the kid's car is near it, as the car wash's does.
      for (const { zone, roof } of sheds) {
        const near = Math.hypot(kid.x - zone.x, kid.z - zone.z) < zone.r + 12;
        for (const m of roof) {
          m.opacity += Math.max(-4 * dt, Math.min(4 * dt, (near ? 0.18 : 1) - m.opacity));
          m.depthWrite = m.opacity > 0.999;
        }
      }
      for (const { zone, brushes, roof } of washes) {
        // Lazily turning; fast while a car is in the arch.
        const busy = w.cars.some((c) => Math.hypot(c.x - zone.x, c.z - zone.z) < zone.r);
        brushes.forEach((b, i) => (b.rotation.y += (i % 2 ? -1 : 1) * (busy ? 9 : 1.5) * dt));
        // The camera rides just above the roof as the kid drives through, so the roof fades out of the way.
        const near = Math.hypot(kid.x - zone.x, kid.z - zone.z) < zone.r + 12;
        for (const m of roof) {
          const want = near ? 0.18 : m === roof[2] ? 0.85 : 1;
          m.opacity += Math.max(-4 * dt, Math.min(4 * dt, want - m.opacity));
          m.depthWrite = m.opacity > 0.999;
        }
      }
    },
  };
}
