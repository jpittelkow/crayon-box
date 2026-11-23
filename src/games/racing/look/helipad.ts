// How a helicopter pad looks (ADR 0048, `setpiece/helipad`): a round pad with painted rings and lamps round its
// edge, and a toy helicopter. An original design (ADR 0011), with rings on the pad, not a letter (ADR 0003).
import * as THREE from 'three';
import type { Zone } from '../sim/sim';
import { bakedGroup, chrome, glass, lamp, paint, part, plastic, rbox } from './kit';

/** The pad's top, just above the grass. */
const PAD_Y = 0.06;

export interface HelipadLook {
  /** The pad and the helicopter, placed on the map. */
  group: THREE.Group;
  /** The helicopter: lifted to its height and turned to its heading. */
  heli: THREE.Group;
  /** The main rotor (turns about y) and the tail rotor (turns about x). */
  rotor: THREE.Group;
  tail: THREE.Group;
}

/** A flat ring painted on the pad. */
const ring = (inner: number, outer: number, y: number) => new THREE.RingGeometry(inner, outer, 56).rotateX(-Math.PI / 2).translate(0, y, 0);

export function helipad(zone: Zone): HelipadLook {
  const group = new THREE.Group();
  const r = zone.r - 0.5;
  const pad = new THREE.Group();
  pad.add(part(new THREE.CylinderGeometry(r, r, PAD_Y, 56), plastic(0xb4bac1, 0.9), 0, PAD_Y / 2, 0));
  const yellow = plastic(0xffc400, 0.7), white = plastic(0xf6f7f9, 0.7);
  pad.add(part(ring(r - 1.0, r - 0.5, PAD_Y + 0.012), yellow));
  pad.add(part(ring(r * 0.42, r * 0.5, PAD_Y + 0.012), white));
  pad.add(part(new THREE.CircleGeometry(0.8, 32).rotateX(-Math.PI / 2).translate(0, PAD_Y + 0.012, 0), white));
  const green = lamp(0x22dd55, 1.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pad.add(part(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), green, Math.sin(a) * (r - 0.22), PAD_Y, Math.cos(a) * (r - 0.22)));
  }
  const base = bakedGroup(pad);
  // The pad takes shadows but casts none worth drawing.
  base.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  group.add(base);

  // The helicopter, front toward +z, its skids on y = 0.
  const body = new THREE.Group();
  const red = paint(0xe23b2e), cream = paint(0xf6f7f9), dark = plastic(0x23262b, 0.6), metal = chrome(), pane = glass();
  body.add(part(new THREE.SphereGeometry(1.25, 24, 16).scale(1, 1, 1.55), red, 0, 1.75, 0.3));
  body.add(part(new THREE.SphereGeometry(1.25, 24, 16).scale(0.99, 0.8, 1.53), cream, 0, 1.45, 0.3));
  body.add(part(new THREE.SphereGeometry(1, 22, 14).scale(1.08, 0.88, 1.1), pane, 0, 2.0, 1.35));
  for (const side of [-1, 1]) {
    body.add(part(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateZ(Math.PI / 2), pane, side * 1.2, 2.0, -0.25));
    // Skids on two legs each.
    body.add(part(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 10).rotateX(Math.PI / 2), metal, side * 0.95, 0.07, 0.3));
    for (const z of [1.1, -0.5]) {
      const leg = part(new THREE.BoxGeometry(0.08, 0.85, 0.08), metal, side * 0.82, 0.45, z);
      leg.rotation.z = side * 0.32;
      body.add(leg);
    }
  }
  // The tail: a boom thinning toward the back, a fin, a tailplane and a red lamp.
  body.add(part(new THREE.CylinderGeometry(0.42, 0.2, 3.6, 16).rotateX(Math.PI / 2), red, 0, 2.05, -2.9));
  const fin = part(rbox(0.14, 1.5, 0.9, 0.06), cream, 0, 2.65, -4.5);
  fin.rotation.x = 0.3;
  body.add(fin);
  body.add(part(rbox(1.6, 0.1, 0.5, 0.04), cream, 0, 2.1, -4.1));
  body.add(part(new THREE.SphereGeometry(0.1, 10, 8), lamp(0xff2a1a, 2), 0, 2.45, -2.6));
  body.add(part(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 12), dark, 0, 3.15, 0.3));
  const heli = new THREE.Group();
  heli.add(bakedGroup(body));

  // Three blades with yellow tips, so the turning shows even when slow.
  const blades = new THREE.Group();
  blades.add(part(new THREE.CylinderGeometry(0.26, 0.26, 0.14, 16), dark));
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Group();
    blade.add(part(new THREE.BoxGeometry(3.3, 0.05, 0.36).translate(1.8, 0, 0), dark));
    blade.add(part(new THREE.BoxGeometry(0.5, 0.055, 0.37).translate(3.65, 0, 0), yellow));
    blade.rotation.y = (i / 3) * Math.PI * 2;
    blades.add(blade);
  }
  const rotor = bakedGroup(blades);
  rotor.position.set(0, 3.47, 0.3);
  const small = new THREE.Group();
  small.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 10).rotateZ(Math.PI / 2), dark));
  small.add(part(new THREE.BoxGeometry(0.04, 1.5, 0.16), dark));
  small.add(part(new THREE.BoxGeometry(0.04, 0.16, 1.5), dark));
  const tail = bakedGroup(small);
  tail.position.set(0.17, 2.8, -4.55);
  heli.add(rotor, tail);
  heli.position.y = PAD_Y;
  heli.rotation.y = zone.heading;
  group.add(heli);
  group.position.set(zone.x, 0, zone.z);
  return { group, heli, rotor, tail };
}

/** Places a helicopter at its height above the pad, turned to its heading, with its rotors turned on by `dt`. */
export function poseHelicopter(look: HelipadLook, height: number, heading: number, rotor: number, time: number, dt: number): void {
  // It bobs a little in the air, not on the ground.
  look.heli.position.y = PAD_Y + height + Math.sin(time * 1.7) * 0.15 * Math.min(1, height / 2);
  look.heli.rotation.y = heading;
  look.rotor.rotation.y += rotor * 24 * dt;
  look.tail.rotation.x += rotor * 30 * dt;
}
