// Set pieces in the toy look (milestone-3 phase B3; driving-assets.md category 7). Built from the map's zones; the
// simulation decides what each one does (sim/ramps.ts for ramps).
import * as THREE from 'three';
import { RAMP } from '../sim/ramps';
import type { World, Zone } from '../sim/sim';
import { plastic } from './kit';

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

/** Every set piece on the map. */
export function buildSetPieces(world: World): THREE.Group {
  const g = new THREE.Group();
  for (const zone of world.zones) if (zone.kind === 'ramp') g.add(ramp(zone));
  return g;
}
