// The ten vehicles of milestone 3, phase D (ADR 0035), as toys built in code like the first four (ADR 0025).
// Original designs (ADR 0011). Front is +z, wheels sit on y = 0. Each has a moving part that does something when
// the vehicle stops (a ladder rises, a bed tips) or all the time (a mixer's drum), driven by `animate`.
import * as THREE from 'three';
import { chrome, glass, paint, part, plastic, rbox, ROUND } from './kit';
import { cab, easer, flashers, lights, wheelSet, type Parts } from './vehicleKit';

const dark = () => plastic(0x23262b, 0.6);
/** A vehicle counts as stopped below this speed, for its moving part. */
const STILL = 0.4;

/** A frame under a truck, front to back. */
function chassis(body: THREE.Group, length: number, y: number, z = 0): void {
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.16, 0.22, length), dark(), side * 0.55, y, z));
}

export function fireTruck(): Parts {
  const body = new THREE.Group();
  const red = paint(0xd8141c), white = plastic(0xf4f5f7, 0.5);
  chassis(body, 6.6, 0.7);
  cab(body, red, 2.45, 1.45, 2.3, 1.7, 1.8);
  body.add(part(rbox(2.4, 1.6, 4.6, 0.18), red, 0, 1.45, -1.0));
  // Lockers: chrome doors along both sides, and a white band.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) body.add(part(new THREE.BoxGeometry(0.04, 0.9, 1.3), chrome(), side * 1.21, 1.3, 0.4 - i * 1.45));
    body.add(part(new THREE.BoxGeometry(0.05, 0.14, 6.6), white, side * 1.2, 0.95, 0));
  }
  body.add(part(rbox(2.5, 0.3, 0.3, 0.1), chrome(), 0, 0.7, 3.4));
  lights(body, 0.8, 1.05, 3.36, -3.31, 0.15);
  // The ladder: two rails and rungs on a turntable at the back; it rises when the truck stops.
  const ladder = new THREE.Group();
  const metal = chrome();
  for (const side of [-1, 1]) ladder.add(part(new THREE.BoxGeometry(0.1, 0.12, 5.2), metal, side * 0.4, 0, 2.6));
  for (let i = 0; i < 9; i++) ladder.add(part(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8).rotateZ(Math.PI / 2), metal, 0, 0, 0.3 + i * 0.6));
  ladder.position.set(0, 2.4, -3.1);
  body.add(part(new THREE.CylinderGeometry(0.5, 0.5, 0.2, ROUND), dark(), 0, 2.3, -3.1));
  const lamps = flashers(0xff1a1a, 0xff1a1a, 2.4, 2.4, 1.1, 5);
  const ease = easer();
  let raised = 0;
  return {
    body, wheels: wheelSet(0.55, 0.45, 1.05, [2.4, -1.5, -2.65]), live: [ladder, ...lamps.live],
    animate(time, speed) {
      lamps.flash(time);
      raised = ease(raised, speed < STILL ? 0.55 : 0, 0.6, time);
      ladder.rotation.x = -raised;
    },
  };
}

export function ambulance(): Parts {
  const body = new THREE.Group();
  const white = paint(0xf6f7f9), red = paint(0xe23b2e);
  body.add(part(rbox(2.2, 2.0, 4.4, 0.25), white, 0, 1.55, -0.6));
  body.add(part(rbox(2.1, 1.0, 1.3, 0.25), white, 0, 1.0, 2.15));
  body.add(part(rbox(2.0, 0.75, 0.08, 0.04), glass(), 0, 1.75, 1.58));
  for (const side of [-1, 1]) {
    body.add(part(new THREE.BoxGeometry(0.05, 0.3, 4.4), red, side * 1.1, 1.25, -0.6));
    body.add(part(rbox(0.06, 0.6, 0.9, 0.03), glass(), side * 1.11, 1.9, 1.1));
  }
  body.add(part(rbox(2.3, 0.28, 0.28, 0.1), dark(), 0, 0.55, 2.8));
  lights(body, 0.75, 1.05, 2.8, -2.81, 0.14);
  const lamps = flashers(0x1a5cff, 0xff1a1a, 2.66, 1.3, 1.3, 5);
  return { body, wheels: wheelSet(0.47, 0.4, 1.0, [1.9, -1.9]), live: lamps.live, animate: (time) => lamps.flash(time) };
}

export function towTruck(color: THREE.ColorRepresentation): Parts {
  const body = new THREE.Group();
  const main = paint(color);
  chassis(body, 5.8, 0.7);
  cab(body, main, 1.6, 1.4, 2.2, 1.6, 1.9);
  body.add(part(rbox(2.2, 0.6, 1.4, 0.2), main, 0, 1.0, 2.9));
  body.add(part(rbox(2.2, 0.5, 2.8, 0.12), dark(), 0, 0.95, -1.4));
  lights(body, 0.75, 1.0, 3.6, -2.81, 0.15);
  // The crane: a boom angled up over the back, and a hook on a short cable that swings as the truck moves.
  const yellow = paint(0xffc400);
  const boom = new THREE.Mesh(rbox(0.3, 0.3, 2.6, 0.08), yellow);
  boom.position.set(0, 2.1, -1.6);
  boom.rotation.x = 0.55;
  body.add(boom);
  const hook = new THREE.Group();
  hook.add(part(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), dark(), 0, -0.5, 0));
  hook.add(part(new THREE.TorusGeometry(0.16, 0.05, 8, 16, Math.PI * 1.4), chrome(), 0, -1.05, 0));
  hook.position.set(0, 2.75, -2.75);
  const amber = flashers(0xffa000, 0xffa000, 2.32, 1.6, 1.0, 3);
  let swing = 0;
  return {
    body, wheels: wheelSet(0.5, 0.42, 1.0, [2.3, -1.8]), live: [hook, ...amber.live],
    animate(time, speed) {
      amber.flash(time);
      // A pendulum that swings more the faster the truck goes.
      swing = Math.sin(time * 3.2) * Math.min(0.5, 0.08 + speed * 0.025);
      hook.rotation.x = swing;
    },
  };
}

export function digger(): Parts {
  const body = new THREE.Group();
  const orange = paint(0xff9a1a);
  body.add(part(rbox(2.3, 1.1, 3.6, 0.25), orange, 0, 1.25, -0.4));
  body.add(part(rbox(1.7, 1.5, 1.6, 0.18), orange, 0, 2.5, -0.8));
  body.add(part(rbox(1.5, 1.0, 1.4, 0.1), glass(), 0, 2.6, -0.75));
  body.add(part(rbox(1.8, 0.12, 1.7, 0.05), orange, 0, 3.3, -0.8));
  body.add(part(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 10), chrome(), 0.7, 2.3, -1.9));
  lights(body, 0.8, 1.4, 1.41, -2.21, 0.14);
  // The arm at the front: a boom, a stick and a bucket that scoops when the digger stops.
  const arm = new THREE.Group();
  const boom = part(rbox(0.32, 0.32, 2.2, 0.08), orange, 0, 0, 1.1);
  const stick = new THREE.Group();
  stick.add(part(rbox(0.26, 0.26, 1.6, 0.07), orange, 0, 0, 0.8));
  const bucket = new THREE.Group();
  bucket.add(part(rbox(1.1, 0.6, 0.7, 0.12), dark(), 0, -0.2, 0.3));
  bucket.position.set(0, 0, 1.6);
  stick.add(bucket);
  stick.position.set(0, 0, 2.2);
  arm.add(boom, stick);
  arm.position.set(0, 1.7, 1.2);
  const ease = easer();
  let working = 0;
  return {
    body, wheels: [...wheelSet(0.75, 0.55, 1.15, [-1.4]), ...wheelSet(0.5, 0.45, 1.05, [0.9])], live: [arm],
    animate(time, speed) {
      working = ease(working, speed < STILL ? 1 : 0, 1.5, time);
      // At rest the boom is raised and the stick folded down, bucket tucked in; stopped, it digs.
      const scoop = Math.sin(time * 2.2) * 0.45 * working;
      arm.rotation.x = -0.75 + 0.45 * working;
      stick.rotation.x = 1.75 - 0.5 * working + scoop;
      bucket.rotation.x = 0.9 - scoop * 1.4;
    },
  };
}

export function dumpTruck(): Parts {
  const body = new THREE.Group();
  const yellow = paint(0xffc400), grey = plastic(0x7a7f87, 0.7);
  chassis(body, 6.4, 0.85);
  cab(body, yellow, 2.35, 1.6, 2.3, 1.7, 1.7);
  lights(body, 0.8, 1.15, 3.21, -3.11, 0.15);
  // The bed: hinged at the back; it tips when the truck stops.
  const bed = new THREE.Group();
  bed.add(part(rbox(2.4, 0.2, 4.2, 0.06), grey, 0, 0, -2.1));
  for (const side of [-1, 1]) bed.add(part(rbox(0.12, 1.1, 4.2, 0.05), grey, side * 1.14, 0.55, -2.1));
  bed.add(part(rbox(2.4, 1.3, 0.14, 0.05), grey, 0, 0.65, -0.05));
  bed.add(part(rbox(2.4, 0.4, 0.4, 0.08), yellow, 0, 1.45, 0.1));
  const pivot = new THREE.Group();
  // Hinged at its back edge: the bed reaches forward from the pivot, which sits at the back of the truck.
  bed.position.set(0, 0, 4.2);
  pivot.add(bed);
  pivot.position.set(0, 1.15, -3.15);
  const ease = easer();
  let tip = 0;
  return {
    body, wheels: wheelSet(0.6, 0.5, 1.08, [2.3, -1.5, -2.65]), live: [pivot],
    animate(time, speed) {
      tip = ease(tip, speed < STILL ? 0.55 : 0, 0.5, time);
      pivot.rotation.x = -tip;
    },
  };
}

export function cementMixer(): Parts {
  const body = new THREE.Group();
  const white = paint(0xf4f5f7), orange = paint(0xff7a1a);
  chassis(body, 6.6, 0.85);
  cab(body, white, 2.45, 1.6, 2.3, 1.7, 1.7);
  lights(body, 0.8, 1.15, 3.31, -3.31, 0.15);
  body.add(part(new THREE.BoxGeometry(0.4, 0.8, 0.3), dark(), 0, 1.4, -3.3));
  // The drum turns all the time; its stripes show it turning.
  const drum = new THREE.Group();
  drum.add(part(new THREE.CylinderGeometry(0.7, 1.15, 3.6, ROUND).rotateX(Math.PI / 2), orange));
  for (let i = 0; i < 4; i++) {
    const stripe = part(new THREE.BoxGeometry(0.12, 0.08, 3.4), white, 0, 0, 0);
    const a = (i / 4) * Math.PI * 2;
    stripe.position.set(Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0);
    stripe.rotation.z = -a;
    drum.add(stripe);
  }
  drum.position.set(0, 2.1, -1.1);
  drum.rotation.x = -0.15;
  const spinner = new THREE.Group();
  spinner.add(drum);
  return {
    body, wheels: wheelSet(0.6, 0.5, 1.08, [2.4, -1.5, -2.65]), live: [spinner],
    animate(time) {
      drum.rotation.z = time * 1.4;
    },
  };
}

export function tractor(color: THREE.ColorRepresentation): Parts {
  const body = new THREE.Group();
  const main = paint(color);
  body.add(part(rbox(1.3, 0.9, 2.2, 0.2), main, 0, 1.25, 0.9));
  body.add(part(rbox(1.6, 0.4, 1.8, 0.12), main, 0, 1.2, -0.9));
  body.add(part(new THREE.CylinderGeometry(0.07, 0.07, 1.1, 10), chrome(), 0.45, 2.1, 1.4));
  // A cab of four posts and a roof, with glass all round.
  body.add(part(rbox(1.5, 1.3, 1.4, 0.06), glass(), 0, 2.05, -0.9));
  for (const x of [-0.72, 0.72]) for (const z of [-0.2, -1.6]) body.add(part(new THREE.BoxGeometry(0.08, 1.4, 0.08), main, x, 2.05, z));
  body.add(part(rbox(1.7, 0.12, 1.7, 0.05), main, 0, 2.78, -0.9));
  lights(body, 0.45, 1.3, 2.01, -1.81, 0.12);
  return { body, wheels: [...wheelSet(0.9, 0.55, 1.05, [-0.9]), ...wheelSet(0.45, 0.32, 0.72, [1.5])], live: [] };
}

export function garbageTruck(): Parts {
  const body = new THREE.Group();
  const green = paint(0x2e9e4f), white = plastic(0xf4f5f7, 0.5);
  chassis(body, 6.6, 0.8);
  cab(body, white, 2.45, 1.55, 2.3, 1.7, 1.7);
  body.add(part(rbox(2.4, 2.1, 4.2, 0.25), green, 0, 1.85, -0.85));
  body.add(part(rbox(2.3, 1.6, 0.9, 0.3), green, 0, 1.6, -3.1));
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.05, 0.16, 4.0), white, side * 1.21, 1.5, -0.85));
  lights(body, 0.8, 1.1, 3.31, -3.56, 0.15);
  const amber = flashers(0xffa000, 0xffa000, 2.98, 1.0, 1.4, 2);
  return { body, wheels: wheelSet(0.58, 0.5, 1.08, [2.4, -1.5, -2.65]), live: amber.live, animate: (time) => amber.flash(time) };
}

export function iceCreamVan(): Parts {
  const body = new THREE.Group();
  const pink = paint(0xffc8dd), white = paint(0xfdfbf6);
  body.add(part(rbox(2.2, 2.1, 4.2, 0.3), white, 0, 1.6, -0.6));
  body.add(part(rbox(2.1, 1.0, 1.2, 0.28), pink, 0, 1.05, 2.05));
  body.add(part(rbox(2.0, 0.75, 0.08, 0.04), glass(), 0, 1.75, 1.47));
  body.add(part(new THREE.BoxGeometry(2.24, 0.5, 4.2), pink, 0, 1.0, -0.6));
  // The serving window on the kerb side, with a striped awning.
  body.add(part(rbox(0.06, 0.8, 1.8, 0.03), glass(), -1.11, 1.95, -0.8));
  for (let i = 0; i < 5; i++) body.add(part(new THREE.BoxGeometry(0.5, 0.06, 0.36), i % 2 ? white : pink, -1.3, 2.45, -1.52 + i * 0.36));
  // A big cone on the roof.
  const wafer = paint(0xe0a95c), scoop = paint(0xff8fb8), mint = paint(0x9be3c4);
  body.add(part(new THREE.ConeGeometry(0.42, 1.1, ROUND).rotateX(Math.PI), wafer, 0, 3.2, -0.6));
  body.add(part(new THREE.SphereGeometry(0.46, 18, 12), scoop, 0, 3.85, -0.6));
  body.add(part(new THREE.SphereGeometry(0.36, 18, 12), mint, 0, 4.35, -0.6));
  body.add(part(rbox(2.3, 0.28, 0.28, 0.1), dark(), 0, 0.55, 2.6));
  lights(body, 0.75, 1.05, 2.66, -2.71, 0.14);
  return { body, wheels: wheelSet(0.47, 0.4, 1.0, [1.8, -2.0]), live: [] };
}

export function raceCar(color: THREE.ColorRepresentation): Parts {
  const body = new THREE.Group();
  const main = paint(color), white = paint(0xfdfbf6);
  body.add(part(rbox(1.6, 0.5, 4.0, 0.22), main, 0, 0.6, 0));
  body.add(part(rbox(1.0, 0.36, 1.8, 0.16), main, 0, 0.55, 2.2));
  body.add(part(new THREE.BoxGeometry(0.3, 0.52, 4.6), white, 0, 0.62, 0.3));
  body.add(part(rbox(0.9, 0.42, 1.0, 0.2), glass(), 0, 1.0, -0.2));
  // Wings at the front and the back.
  body.add(part(rbox(2.2, 0.08, 0.5, 0.03), dark(), 0, 0.35, 3.05));
  body.add(part(rbox(2.0, 0.1, 0.6, 0.03), main, 0, 1.3, -2.0));
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.08, 0.6, 0.5), dark(), side * 0.7, 1.0, -2.0));
  lights(body, 0.5, 0.65, 2.01, -2.01, 0.1);
  return { body, wheels: [...wheelSet(0.48, 0.5, 0.98, [-1.3]), ...wheelSet(0.4, 0.36, 0.92, [1.5])], live: [] };
}
