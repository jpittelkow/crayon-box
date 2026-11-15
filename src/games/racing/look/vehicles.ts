// Vehicles as die-cast toys (ADR 0025), built in code. Front is +z, wheels sit on y = 0. Original designs
// (ADR 0011). Each vehicle's body is baked to one mesh per material; wheels stay separate so they can turn.
import * as THREE from 'three';
import type { VehicleKind } from '../sim/sim';
import { bakedGroup, chrome, glass, lamp, paint, part, plastic, rbox, ROUND, wheel } from './kit';

export interface VehicleModel {
  group: THREE.Group;
  /** Turn these about their x axis by the distance rolled. */
  wheels: THREE.Object3D[];
  /** Called each frame with the game's clock: flashing lamps. */
  animate?(time: number): void;
}

export function buildVehicle(kind: VehicleKind, color: THREE.ColorRepresentation): VehicleModel {
  switch (kind) {
    case 'car': return finish(car(color, false));
    case 'police': return finish(car(0x16181d, true));
    case 'monster': return finish(monster(color));
    case 'bus': return finish(bus());
  }
}

interface Parts { body: THREE.Group; wheels: THREE.Object3D[]; live: THREE.Object3D[]; animate?(time: number): void }

function finish(p: Parts): VehicleModel {
  const group = new THREE.Group();
  group.add(bakedGroup(p.body), ...p.wheels, ...p.live);
  return { group, wheels: p.wheels, animate: p.animate };
}

function lights(body: THREE.Group, w: number, y: number, front: number, back: number, r = 0.15): void {
  const lens = new THREE.CylinderGeometry(r, r, 0.08, ROUND).rotateX(Math.PI / 2);
  const head = lamp(0xfff4d0, 1.4), tail = lamp(0xff2a1a, 1.2);
  for (const side of [-1, 1]) {
    body.add(part(lens, head, side * w, y, front));
    body.add(part(new THREE.BoxGeometry(r * 2.4, r * 1.1, 0.07), tail, side * w, y, back));
  }
}

function wheelSet(radius: number, width: number, x: number, zs: number[]): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (const z of zs) {
    for (const side of [-1, 1]) {
      const w = wheel(radius, width);
      w.position.set(side * x, radius, z);
      out.push(w);
    }
  }
  return out;
}

/** A chunky toy car. The police version is black with white doors and a light bar that flashes red and blue. */
function car(color: THREE.ColorRepresentation, police: boolean): Parts {
  const body = new THREE.Group();
  const live: THREE.Object3D[] = [];
  const main = paint(color);
  const top = police ? paint(0xf4f5f7) : main;
  body.add(part(rbox(1.9, 0.62, 4.0, 0.22), main, 0, 0.74, 0));
  // The cabin: glass with painted pillars at the corners and between the doors, under a roof.
  body.add(part(rbox(1.56, 0.56, 1.9, 0.05), glass(), 0, 1.31, -0.3));
  for (const side of [-1, 1]) {
    for (const z of [0.6, -0.3, -1.2]) body.add(part(new THREE.BoxGeometry(0.1, 0.58, z === -0.3 ? 0.1 : 0.14), top, side * 0.75, 1.31, z));
  }
  for (const z of [0.62, -1.22]) body.add(part(new THREE.BoxGeometry(1.56, 0.1, 0.1), top, 0, 1.08, z));
  body.add(part(rbox(1.72, 0.12, 2.04, 0.06), top, 0, 1.64, -0.3));
  const trim = plastic(0x26292e, 0.5);
  body.add(part(rbox(1.98, 0.26, 0.34, 0.11), trim, 0, 0.5, 1.98));
  body.add(part(rbox(1.98, 0.26, 0.34, 0.11), trim, 0, 0.5, -1.98));
  body.add(part(new THREE.BoxGeometry(0.9, 0.16, 0.05), trim, 0, 0.78, 2.01));
  lights(body, 0.66, 0.84, 2.0, -2.0, 0.13);
  const arch = plastic(0x15171a, 0.9);
  for (const side of [-1, 1]) {
    body.add(part(rbox(0.12, 0.16, 0.24, 0.05), top, side * 1.0, 1.12, 0.62));
    body.add(part(new THREE.BoxGeometry(0.03, 0.05, 0.22), chrome(), side * 0.965, 0.9, -0.2));
    for (const z of [1.3, -1.3]) {
      const g = new THREE.CylinderGeometry(0.56, 0.56, 0.04, ROUND, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(Math.PI / 2);
      body.add(part(g, arch, side * 0.955, 0.45, z));
    }
  }
  let animate: Parts['animate'];
  if (police) {
    for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.04, 0.5, 1.9), top, side * 0.955, 0.8, -0.1));
    body.add(part(rbox(1.3, 0.14, 0.42, 0.06), plastic(0x202328, 0.4), 0, 1.78, -0.3));
    // The light bar stays out of the baked body, so its lamps can flash.
    const red = lamp(0xff1a1a, 2.6), blue = lamp(0x1a5cff, 2.6);
    const redLamp = part(rbox(0.58, 0.16, 0.36, 0.06), red, -0.33, 1.9, -0.3);
    const blueLamp = part(rbox(0.58, 0.16, 0.36, 0.06), blue, 0.33, 1.9, -0.3);
    const redLight = new THREE.PointLight(0xff2020, 6, 7, 2);
    redLight.position.set(-0.4, 2.1, -0.3);
    const blueLight = new THREE.PointLight(0x2050ff, 6, 7, 2);
    blueLight.position.set(0.4, 2.1, -0.3);
    live.push(redLamp, blueLamp, redLight, blueLight);
    animate = (time) => {
      const on = Math.floor(time * 4) % 2 === 0;
      red.emissiveIntensity = on ? 3 : 0.3;
      blue.emissiveIntensity = on ? 0.3 : 3;
      redLight.intensity = on ? 7 : 0;
      blueLight.intensity = on ? 0 : 7;
    };
  }
  return { body, wheels: wheelSet(0.45, 0.4, 0.98, [1.3, -1.3]), live, animate };
}

/** A pickup on huge tyres, with roof lamps and a visible chassis. */
function monster(color: THREE.ColorRepresentation): Parts {
  const body = new THREE.Group();
  const main = paint(color);
  const dark = plastic(0x23262b, 0.6);
  const lift = 1.25;
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.18, 0.2, 4.2), dark, side * 0.6, lift, 0));
  const spring = paint(0xffc400);
  for (const z of [1.55, -1.55]) {
    body.add(part(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 12).rotateZ(Math.PI / 2), dark, 0, 0.95, z));
    for (const side of [-1, 1]) body.add(part(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), spring, side * 0.6, 1.2, z));
  }
  body.add(part(rbox(2.1, 0.7, 1.5, 0.22), main, 0, lift + 0.6, 1.75));
  body.add(part(rbox(2.1, 1.05, 1.8, 0.24), main, 0, lift + 0.78, 0.2));
  body.add(part(rbox(1.86, 0.62, 1.6, 0.18), glass(), 0, lift + 1.3, 0.2));
  body.add(part(rbox(1.96, 0.12, 1.5, 0.05), main, 0, lift + 1.65, 0.15));
  body.add(part(rbox(2.1, 0.62, 2.0, 0.16), main, 0, lift + 0.58, -1.65));
  body.add(part(new THREE.BoxGeometry(1.8, 0.1, 1.7), dark, 0, lift + 0.86, -1.65));
  body.add(part(rbox(2.2, 0.3, 0.3, 0.12), chrome(), 0, lift + 0.25, 2.55));
  lights(body, 0.72, lift + 0.6, 2.51, -2.66, 0.16);
  const roofLamp = lamp(0xfff6d8, 1.4);
  for (let i = 0; i < 4; i++) {
    body.add(part(new THREE.CylinderGeometry(0.11, 0.11, 0.1, ROUND).rotateX(Math.PI / 2), roofLamp, -0.6 + i * 0.4, lift + 1.82, 0.85));
  }
  return { body, wheels: wheelSet(0.95, 0.75, 1.25, [1.55, -1.55]), live: [] };
}

/** A school bus: short hood, a row of windows, black stripes, a stop arm and amber and red lamps that flash. */
function bus(): Parts {
  const body = new THREE.Group();
  const yellow = paint(0xf7b500);
  const black = plastic(0x1a1b1e, 0.5);
  body.add(part(rbox(2.4, 2.1, 7.6, 0.3), yellow, 0, 1.7, -0.4));
  body.add(part(rbox(2.1, 0.95, 1.3, 0.25), yellow, 0, 1.1, 3.95));
  body.add(part(new THREE.BoxGeometry(1.6, 0.18, 0.06), black, 0, 1.15, 4.61));
  const pane = glass();
  body.add(part(rbox(2.43, 0.72, 6.6, 0.08), pane, 0, 2.15, -0.6));
  body.add(part(rbox(2.2, 0.85, 0.08, 0.04), pane, 0, 2.05, 3.31));
  for (let i = 0; i <= 9; i++) body.add(part(new THREE.BoxGeometry(2.46, 0.74, 0.12), yellow, 0, 2.15, 2.6 - (i / 9) * 6.4));
  for (const y of [1.45, 1.2]) body.add(part(new THREE.BoxGeometry(2.44, 0.07, 7.4), black, 0, y, -0.4));
  body.add(part(rbox(2.5, 0.3, 0.3, 0.1), black, 0, 0.62, 4.62));
  body.add(part(rbox(2.5, 0.3, 0.3, 0.1), black, 0, 0.62, -4.25));
  lights(body, 0.8, 1.2, 4.61, -4.21, 0.16);
  body.add(part(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 8).rotateZ(Math.PI / 2), paint(0xd8141c), -1.3, 1.75, 2.6));
  body.add(part(new THREE.BoxGeometry(0.05, 0.08, 0.35), paint(0xffffff), -1.33, 1.75, 2.6));
  // Top lamps, red on one side and amber on the other, flashing in turn.
  const red = lamp(0xff2010, 2.2), amber = lamp(0xffa000, 2.2);
  const live: THREE.Object3D[] = [];
  for (const z of [3.3, -4.1]) {
    live.push(part(new THREE.SphereGeometry(0.13, 12, 8), red, -0.85, 2.72, z));
    live.push(part(new THREE.SphereGeometry(0.13, 12, 8), amber, 0.85, 2.72, z));
  }
  const animate = (time: number) => {
    const on = Math.floor(time * 2) % 2 === 0;
    red.emissiveIntensity = on ? 2.4 : 0.2;
    amber.emissiveIntensity = on ? 0.2 : 2.4;
  };
  return { body, wheels: wheelSet(0.55, 0.45, 1.08, [3.1, -2.7]), live, animate };
}
