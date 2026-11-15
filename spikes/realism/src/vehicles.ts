// Vehicles built in code, as die-cast toys. Front is +z, wheels sit on y = 0. Original designs (ADR 0011).
import * as THREE from 'three';
import type { Kit } from './kit';

export type VehicleKind = 'car' | 'monster' | 'bus' | 'police';

export function vehicle(kit: Kit, kind: VehicleKind, color: THREE.ColorRepresentation = 0xff9f1c): THREE.Group {
  switch (kind) {
    case 'car': return car(kit, color, false);
    case 'police': return car(kit, 0x16181d, true);
    case 'monster': return monster(kit, color);
    case 'bus': return bus(kit);
  }
}

function lights(kit: Kit, g: THREE.Group, w: number, y: number, front: number, back: number, r = 0.15): void {
  const lens = new THREE.CylinderGeometry(r, r, 0.08, kit.round);
  lens.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    if (kit.level === 1) {
      g.add(kit.mesh(new THREE.BoxGeometry(r * 2, r * 1.3, 0.06), kit.lamp(0xfff2c0, 0.8), side * w, y, front));
      g.add(kit.mesh(new THREE.BoxGeometry(r * 2, r * 1.1, 0.06), kit.lamp(0xff3020, 0.8), side * w, y, back));
    } else {
      g.add(kit.mesh(lens, kit.lamp(0xfff4d0, 1.4), side * w, y, front));
      const tail = kit.mesh(new THREE.BoxGeometry(r * 2.4, r * 1.1, 0.07), kit.lamp(0xff2a1a, 1.2), side * w, y, back);
      g.add(tail);
    }
  }
}

function wheels(kit: Kit, g: THREE.Group, radius: number, width: number, x: number, zs: number[]): void {
  for (const z of zs) {
    for (const side of [-1, 1]) {
      const w = kit.wheel(radius, width);
      w.position.set(side * x, radius, z);
      g.add(w);
    }
  }
}

/** A chunky hatchback; the police version adds white doors and a light bar with lit red and blue. */
function car(kit: Kit, color: THREE.ColorRepresentation, police: boolean): THREE.Group {
  const g = new THREE.Group();
  const paint = kit.paint(color);
  const roofPaint = police ? kit.paint(0xf4f5f7) : paint;
  g.add(kit.mesh(kit.rbox(1.9, 0.62, 4.0, 0.22), paint, 0, 0.74, 0));
  // The cabin: a glass block with painted pillars at the corners and between the doors, under a roof, so it
  // reads as windows rather than one dark bubble.
  g.add(kit.mesh(kit.rbox(1.56, 0.56, 1.9, 0.05), kit.glass(), 0, 1.31, -0.3));
  for (const side of [-1, 1]) {
    for (const z of [0.6, -0.3, -1.2]) {
      g.add(kit.mesh(new THREE.BoxGeometry(0.1, 0.58, z === -0.3 ? 0.1 : 0.14), roofPaint, side * 0.75, 1.31, z));
    }
  }
  for (const z of [0.62, -1.22]) g.add(kit.mesh(new THREE.BoxGeometry(1.56, 0.1, 0.1), roofPaint, 0, 1.08, z));
  g.add(kit.mesh(kit.rbox(1.72, 0.12, 2.04, 0.06), roofPaint, 0, 1.64, -0.3));
  const trim = kit.plastic(0x26292e, 0.5);
  g.add(kit.mesh(kit.rbox(1.98, 0.26, 0.34, 0.11), trim, 0, 0.5, 1.98));
  g.add(kit.mesh(kit.rbox(1.98, 0.26, 0.34, 0.11), trim, 0, 0.5, -1.98));
  g.add(kit.mesh(new THREE.BoxGeometry(0.9, 0.16, 0.05), trim, 0, 0.78, 2.01));
  lights(kit, g, 0.66, 0.84, 2.0, -2.0, 0.13);

  if (kit.level >= 2) {
    // Side mirrors, door handles, a window-sill line, wheel-arch shadows.
    for (const side of [-1, 1]) {
      g.add(kit.mesh(kit.rbox(0.12, 0.16, 0.24, 0.05), roofPaint, side * 1.0, 1.12, 0.62));
      g.add(kit.mesh(new THREE.BoxGeometry(0.03, 0.05, 0.22), kit.chrome(), side * 0.965, 0.9, -0.2));
      for (const z of [1.3, -1.3]) {
        const arch = new THREE.CylinderGeometry(0.56, 0.56, 0.04, kit.round, 1, false, 0, Math.PI);
        arch.rotateZ(Math.PI / 2);
        arch.rotateX(Math.PI / 2);
        g.add(kit.mesh(arch, kit.plastic(0x15171a, 0.9), side * 0.955, 0.45, z));
      }
    }
  }
  if (police) {
    for (const side of [-1, 1]) {
      g.add(kit.mesh(new THREE.BoxGeometry(0.04, 0.5, 1.9), kit.paint(0xf4f5f7), side * 0.955, 0.8, -0.1));
    }
    g.add(kit.mesh(kit.rbox(1.3, 0.14, 0.42, 0.06), kit.plastic(0x202328, 0.4), 0, 1.78, -0.3));
    g.add(kit.mesh(kit.rbox(0.58, 0.16, 0.36, 0.06), kit.lamp(0xff1a1a, 2.6), -0.33, 1.9, -0.3));
    g.add(kit.mesh(kit.rbox(0.58, 0.16, 0.36, 0.06), kit.lamp(0x1a5cff, 2.6), 0.33, 1.9, -0.3));
    if (kit.level >= 2) {
      // The lamps light the roof and the ground around the car.
      const red = new THREE.PointLight(0xff2020, 6, 6, 2);
      red.position.set(-0.4, 2.1, -0.3);
      const blue = new THREE.PointLight(0x2050ff, 6, 6, 2);
      blue.position.set(0.4, 2.1, -0.3);
      g.add(red, blue);
    }
  }
  wheels(kit, g, 0.45, 0.4, 0.98, [1.3, -1.3]);
  return g;
}

/** A pickup on huge tyres, with roof lamps and a visible chassis. */
function monster(kit: Kit, color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const paint = kit.paint(color);
  const dark = kit.plastic(0x23262b, 0.6);
  const lift = 1.25;
  // Chassis rails, axles and springs.
  for (const side of [-1, 1]) g.add(kit.mesh(new THREE.BoxGeometry(0.18, 0.2, 4.2), dark, side * 0.6, lift, 0));
  for (const z of [1.55, -1.55]) {
    const axle = new THREE.CylinderGeometry(0.1, 0.1, 2.4, 12);
    axle.rotateZ(Math.PI / 2);
    g.add(kit.mesh(axle, dark, 0, 0.95, z));
    for (const side of [-1, 1]) {
      const spring = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12);
      g.add(kit.mesh(spring, kit.level === 1 ? kit.plastic(0xe0b100, 0.5) : kit.paint(0xffc400), side * 0.6, 1.2, z));
    }
  }
  // Body: hood, cab, bed.
  g.add(kit.mesh(kit.rbox(2.1, 0.7, 1.5, 0.22), paint, 0, lift + 0.6, 1.75));
  g.add(kit.mesh(kit.rbox(2.1, 1.05, 1.8, 0.24), paint, 0, lift + 0.78, 0.2));
  g.add(kit.mesh(kit.rbox(1.86, 0.62, 1.6, 0.18), kit.glass(), 0, lift + 1.3, 0.2));
  g.add(kit.mesh(kit.rbox(1.96, 0.12, 1.5, 0.05), paint, 0, lift + 1.65, 0.15));
  g.add(kit.mesh(kit.rbox(2.1, 0.62, 2.0, 0.16), paint, 0, lift + 0.58, -1.65));
  g.add(kit.mesh(new THREE.BoxGeometry(1.8, 0.1, 1.7), dark, 0, lift + 0.86, -1.65));
  g.add(kit.mesh(kit.rbox(2.2, 0.3, 0.3, 0.12), kit.chrome(), 0, lift + 0.25, 2.55));
  lights(kit, g, 0.72, lift + 0.6, 2.51, -2.66, 0.16);
  // Four roof lamps.
  for (let i = 0; i < 4; i++) {
    const lamp = new THREE.CylinderGeometry(0.11, 0.11, 0.1, kit.round);
    lamp.rotateX(Math.PI / 2);
    g.add(kit.mesh(lamp, kit.lamp(0xfff6d8, 1.4), -0.6 + i * 0.4, lift + 1.82, 0.85));
  }
  wheels(kit, g, 0.95, 0.75, 1.25, [1.55, -1.55]);
  return g;
}

/** A school bus with a short hood, a row of windows, black stripes, a stop arm and flashing lamps. */
function bus(kit: Kit): THREE.Group {
  const g = new THREE.Group();
  const yellow = kit.paint(0xf7b500);
  const black = kit.plastic(0x1a1b1e, 0.5);
  g.add(kit.mesh(kit.rbox(2.4, 2.1, 7.6, 0.3), yellow, 0, 1.7, -0.4));
  g.add(kit.mesh(kit.rbox(2.1, 0.95, 1.3, 0.25), yellow, 0, 1.1, 3.95));
  g.add(kit.mesh(new THREE.BoxGeometry(1.6, 0.18, 0.06), black, 0, 1.15, 4.61));
  // Windows: a glass band with yellow posts between panes.
  g.add(kit.mesh(kit.rbox(2.43, 0.72, 6.6, 0.08), kit.glass(), 0, 2.15, -0.6));
  g.add(kit.mesh(kit.rbox(2.2, 0.85, 0.08, 0.04), kit.glass(), 0, 2.05, 3.31));
  const posts = kit.level === 1 ? 6 : 9;
  for (let i = 0; i <= posts; i++) {
    g.add(kit.mesh(new THREE.BoxGeometry(2.46, 0.74, 0.12), yellow, 0, 2.15, 2.6 - (i / posts) * 6.4));
  }
  for (const y of [1.45, 1.2]) g.add(kit.mesh(new THREE.BoxGeometry(2.44, 0.07, 7.4), black, 0, y, -0.4));
  g.add(kit.mesh(kit.rbox(2.5, 0.3, 0.3, 0.1), black, 0, 0.62, 4.62));
  g.add(kit.mesh(kit.rbox(2.5, 0.3, 0.3, 0.1), black, 0, 0.62, -4.25));
  lights(kit, g, 0.8, 1.2, 4.61, -4.21, 0.16);
  // Flashing lamps across the top front and back: two lit red, two amber.
  for (const z of [3.3, -4.1]) {
    for (const side of [-1, 1]) {
      g.add(kit.mesh(new THREE.SphereGeometry(0.13, 12, 8), kit.lamp(side < 0 ? 0xff2010 : 0xffa000, 2.2), side * 0.85, 2.72, z));
    }
  }
  if (kit.level >= 2) {
    // The stop arm on the driver's side.
    const sign = new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8);
    sign.rotateZ(Math.PI / 2);
    g.add(kit.mesh(sign, kit.paint(0xd8141c), -1.3, 1.75, 2.6));
    g.add(kit.mesh(new THREE.BoxGeometry(0.05, 0.08, 0.35), kit.paint(0xffffff), -1.33, 1.75, 2.6));
  }
  wheels(kit, g, 0.55, 0.45, 1.08, [3.1, -2.7]);
  return g;
}
