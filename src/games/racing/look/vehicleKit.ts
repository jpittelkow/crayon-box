// Shared parts for building vehicles as toys (ADR 0025, 0035): wheels, lamps, a cab, and putting a vehicle
// together. Front is +z, wheels sit on y = 0.
import * as THREE from 'three';
import { bakedGroup, glass, lamp, part, rbox, ROUND, wheel } from './kit';

export interface VehicleModel {
  group: THREE.Group;
  /** Turn these about their x axis by the distance rolled. */
  wheels: THREE.Object3D[];
  /** Called each frame with the game's clock and the vehicle's speed: flashing lamps, a ladder that rises. */
  animate?(time: number, speed: number): void;
}

/** A vehicle's pieces: the body is baked to one mesh per material; wheels and moving parts stay separate. */
export interface Parts {
  body: THREE.Group;
  wheels: THREE.Object3D[];
  live: THREE.Object3D[];
  animate?(time: number, speed: number): void;
}

export function finish(p: Parts): VehicleModel {
  const group = new THREE.Group();
  group.add(bakedGroup(p.body), ...p.wheels, ...p.live);
  return { group, wheels: p.wheels, animate: p.animate };
}

/** Headlamps at the front and tail lamps at the back, `w` either side of the middle. */
export function lights(body: THREE.Group, w: number, y: number, front: number, back: number, r = 0.15): void {
  const lens = new THREE.CylinderGeometry(r, r, 0.08, ROUND).rotateX(Math.PI / 2);
  const head = lamp(0xfff4d0, 1.4), tail = lamp(0xff2a1a, 1.2);
  for (const side of [-1, 1]) {
    body.add(part(lens, head, side * w, y, front));
    body.add(part(new THREE.BoxGeometry(r * 2.4, r * 1.1, 0.07), tail, side * w, y, back));
  }
}

/** Pairs of wheels, `x` either side of the middle, at each of `zs`. */
export function wheelSet(radius: number, width: number, x: number, zs: number[]): THREE.Object3D[] {
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

/**
 * A truck's cab: a rounded box centred at (0, y, z), `w` wide, `h` high and `l` long, with a windscreen and side
 * windows in its top part and a roof.
 */
export function cab(body: THREE.Group, material: THREE.Material, z: number, y: number, w: number, h: number, l: number): void {
  body.add(part(rbox(w, h, l, 0.2), material, 0, y, z));
  const pane = glass();
  body.add(part(rbox(w * 0.86, h * 0.36, 0.06, 0.03), pane, 0, y + h * 0.18, z + l / 2 + 0.01));
  for (const side of [-1, 1]) body.add(part(rbox(0.06, h * 0.34, l * 0.6, 0.03), pane, side * (w / 2 + 0.01), y + h * 0.18, z + l * 0.08));
}

/** Two lamps that flash in turn, as live parts; returns them and the step that flashes them. */
export function flashers(a: THREE.ColorRepresentation, b: THREE.ColorRepresentation, y: number, z: number, apart: number, rate = 4):
  { live: THREE.Object3D[]; flash(time: number): void } {
  const ma = lamp(a, 2.4), mb = lamp(b, 2.4);
  const live = [
    part(rbox(0.5, 0.18, 0.34, 0.06), ma, -apart / 2, y, z),
    part(rbox(0.5, 0.18, 0.34, 0.06), mb, apart / 2, y, z),
  ];
  return {
    live,
    flash(time) {
      const on = Math.floor(time * rate) % 2 === 0;
      ma.emissiveIntensity = on ? 3 : 0.3;
      mb.emissiveIntensity = on ? 0.3 : 3;
    },
  };
}

/** Eases a moving part toward a target, by at most `rate` a second; `dt` from the clock between calls. */
export function easer(): (current: number, target: number, rate: number, time: number) => number {
  let last = -1;
  return (current, target, rate, time) => {
    const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, time - last));
    last = time;
    return current + Math.max(-rate * dt, Math.min(rate * dt, target - current));
  };
}
