// Set pieces in the toy look (milestone-3 phase B3; driving-assets.md category 7). Built from the map's zones; the
// simulation decides what each one does (sim/ramps.ts for ramps).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { guardAt, type Guard } from '../sim/ground';
import type { HillDef } from '../sim/map';
import { RAMP } from '../sim/ramps';
import { pointAt } from '../sim/roads';
import type { World, Zone } from '../sim/sim';
import { part, plastic, rbox } from './kit';
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
  const skin = new THREE.MeshStandardMaterial({ color: 0x5ea347, roughness: 0.95, transparent: true });
  const stone = plastic(0x8d8f93, 0.85);
  stone.transparent = true;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), skin);
  dome.scale.set(h.rx, h.height, h.rz);
  dome.position.set(h.x, -0.05, h.z);
  dome.castShadow = dome.receiveShadow = true;
  g.add(dome);
  const tunnel = world.guards.find((t) => t.kind === 'tunnel');
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

/** Every set piece on the map, and a step for the ones that move. */
export function buildSetPieces(world: World): { group: THREE.Group; animate(w: World, dt: number): void } {
  const g = new THREE.Group();
  const washes: { zone: Zone; brushes: THREE.Object3D[]; roof: THREE.Material[] }[] = [];
  const sheds: { zone: Zone; roof: THREE.Material[] }[] = [];
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
  for (const guard of world.guards) if (guard.kind === 'bridge') g.add(bridge(world, guard));
  const hills = (world.map.hills ?? []).map((h) => hill(world, h));
  for (const h of hills) g.add(h.group);
  return {
    group: g,
    animate(w, dt) {
      const kid = w.cars[0]!;
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
