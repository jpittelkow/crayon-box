// Set pieces in the toy look (milestone-3 phase B3; driving-assets.md category 7). Built from the map's zones; the
// simulation decides what each one does (sim/ramps.ts for ramps).
import * as THREE from 'three';
import { RAMP } from '../sim/ramps';
import type { World, Zone } from '../sim/sim';
import { part, plastic, rbox } from './kit';

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

/** Every set piece on the map, and a step for the ones that move. */
export function buildSetPieces(world: World): { group: THREE.Group; animate(w: World, dt: number): void } {
  const g = new THREE.Group();
  const washes: { zone: Zone; brushes: THREE.Object3D[]; roof: THREE.Material[] }[] = [];
  for (const zone of world.zones) {
    if (zone.kind === 'ramp') g.add(ramp(zone));
    if (zone.kind === 'car-wash') {
      const wash = carWash(zone);
      g.add(wash.group);
      washes.push({ zone, brushes: wash.brushes, roof: wash.roof });
    }
  }
  return {
    group: g,
    animate(w, dt) {
      const kid = w.cars[0]!;
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
