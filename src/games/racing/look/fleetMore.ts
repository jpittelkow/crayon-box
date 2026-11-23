// Six more vehicles (ADR 0048), as toys built in code like the fourteen before them (ADR 0025, 0035): a forklift,
// a road roller, a loader, a street sweeper, a mail van and a quad bike. Original designs (ADR 0011). Front is +z,
// wheels sit on y = 0. Each has one moving thing: it does something when the vehicle stops (forks rise, a bucket
// lifts, a door rolls up) or as it drives (a drum rolls, brushes spin, springs bounce).
import * as THREE from 'three';
import { bakedGroup, chrome, glass, lamp, paint, part, plastic, rbox, ROUND } from './kit';
import { cab, easer, flashers, lights, wheelSet, type Parts } from './vehicleKit';

/** A vehicle counts as stopped below this speed, for its moving part. */
const STILL = 0.4;
const DARK = 0x23262b;

/** A cylinder with its axle along x, like a wheel's. */
const axle = (radius: number, length: number, segments = 16) => new THREE.CylinderGeometry(radius, radius, length, segments).rotateZ(Math.PI / 2);

/** A steering wheel on its column, leaning back toward the seat at (0, y, z). */
function steering(body: THREE.Group, material: THREE.Material, y: number, z: number): void {
  const column = part(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), material, 0, y - 0.3, z + 0.12);
  column.rotation.x = -0.45;
  const rim = part(new THREE.TorusGeometry(0.2, 0.04, 8, 20), material, 0, y, z);
  rim.rotation.x = Math.PI / 2 - 0.45;
  body.add(column, rim);
}

/** A seat with a backrest, its front edge toward +z. */
function seat(body: THREE.Group, material: THREE.Material, y: number, z: number): void {
  body.add(part(rbox(0.7, 0.22, 0.65, 0.08), material, 0, y, z));
  body.add(part(rbox(0.7, 0.6, 0.16, 0.07), material, 0, y + 0.36, z - 0.33));
}

/** A forklift: forks on a mast at the front, carrying a crate on a pallet, that rise when it stops. */
export function forklift(): Parts {
  const body = new THREE.Group();
  const red = paint(0xe8502a), dark = plastic(DARK, 0.6), metal = chrome();
  body.add(part(rbox(1.5, 0.9, 1.9, 0.22), red, 0, 0.95, -0.55));
  // The counterweight at the back.
  body.add(part(rbox(1.56, 0.8, 0.6, 0.22), dark, 0, 0.95, -1.62));
  seat(body, dark, 1.52, -0.75);
  steering(body, dark, 1.95, -0.05);
  // The guard over the driver: four posts and a roof of bars.
  for (const x of [-0.68, 0.68]) for (const z of [0.3, -1.3]) body.add(part(new THREE.BoxGeometry(0.09, 1.55, 0.09), dark, x, 2.17, z));
  for (const x of [-0.68, 0.68]) body.add(part(new THREE.BoxGeometry(0.1, 0.1, 1.78), dark, x, 2.95, -0.5));
  for (let i = 0; i < 5; i++) body.add(part(new THREE.BoxGeometry(1.46, 0.07, 0.1), dark, 0, 2.95, 0.34 - i * 0.42));
  body.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), lamp(0xffa000, 1.6), 0, 3.07, -1.1));
  // The mast: two uprights the carriage runs on.
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.13, 3.0, 0.16), dark, side * 0.52, 1.7, 0.72));
  for (const y of [0.45, 1.7, 3.14]) body.add(part(new THREE.BoxGeometry(1.17, 0.12, 0.14), dark, 0, y, 0.72));
  lights(body, 0.5, 1.2, 0.41, -1.93, 0.1);
  // The carriage: a back plate, two forks, and a crate on a pallet.
  const carriage = new THREE.Group();
  const wood = plastic(0xc99a5b, 0.8);
  carriage.add(part(new THREE.BoxGeometry(1.3, 0.6, 0.08), dark, 0, 0.5, 0.86));
  for (const side of [-1, 1]) carriage.add(part(new THREE.BoxGeometry(0.16, 0.07, 1.06), metal, side * 0.36, 0.2, 1.42));
  carriage.add(part(new THREE.BoxGeometry(1.1, 0.1, 0.9), wood, 0, 0.29, 1.46));
  carriage.add(part(rbox(0.84, 0.7, 0.72, 0.06), paint(0x3d8fd1), 0, 0.69, 1.46));
  for (const x of [-0.25, 0.25]) carriage.add(part(new THREE.BoxGeometry(0.07, 0.72, 0.74), wood, x, 0.69, 1.46));
  const ease = easer();
  let raised = 0;
  return {
    body, wheels: [...wheelSet(0.42, 0.34, 0.78, [0.3]), ...wheelSet(0.34, 0.3, 0.74, [-1.3])], live: [carriage],
    animate(time, speed) {
      raised = ease(raised, speed < STILL ? 1.55 : 0, 1.1, time);
      carriage.position.y = raised;
    },
  };
}

/** A road roller: a steel drum as wide as the machine at the front, turning as it drives, and a canopy on posts. */
export function roadRoller(): Parts {
  const body = new THREE.Group();
  const yellow = paint(0xf5b500), dark = plastic(DARK, 0.6), cream = paint(0xfdf6e3);
  body.add(part(rbox(1.3, 1.0, 2.6, 0.22), yellow, 0, 1.35, -0.6));
  body.add(part(rbox(1.3, 0.55, 0.9, 0.2), yellow, 0, 1.68, 0.65));
  for (const side of [-1, 1]) {
    // Mudguards over the back wheels, and the arms that hold the drum.
    body.add(part(rbox(0.56, 0.12, 1.7, 0.05), yellow, side * 0.9, 1.68, -1.25));
    body.add(part(new THREE.BoxGeometry(0.14, 0.3, 1.5), yellow, side * 1.07, 0.85, 1.0));
    body.add(part(new THREE.BoxGeometry(0.4, 0.3, 0.3), yellow, side * 0.86, 0.95, 0.4));
    body.add(part(axle(0.17, 0.1), chrome(), side * 1.1, 0.75, 1.55));
    for (const z of [0.05, -1.5]) body.add(part(new THREE.BoxGeometry(0.09, 1.3, 0.09), dark, side * 0.58, 2.5, z));
  }
  body.add(part(rbox(1.7, 0.12, 2.1, 0.05), cream, 0, 3.18, -0.72));
  seat(body, dark, 1.97, -1.0);
  steering(body, dark, 2.4, -0.3);
  body.add(part(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 10), chrome(), 0.4, 2.35, 0.7));
  body.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), lamp(0xffa000, 1.6), 0, 3.3, -1.3));
  lights(body, 0.42, 1.68, 1.11, -1.91, 0.12);
  // The drum, built like a wheel so it turns with the distance rolled; bands across it and bolts on its ends show it.
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa1aa, metalness: 0.6, roughness: 0.35 });
  const band = new THREE.MeshStandardMaterial({ color: 0x6f757d, metalness: 0.5, roughness: 0.5 });
  const R = 0.75;
  const drum = new THREE.Group();
  drum.add(part(axle(R, 2.0, ROUND + 8), steel));
  for (let i = 0; i < 6; i++) {
    const strip = part(new THREE.BoxGeometry(2.0, 0.03, 0.2).translate(0, R - 0.005, 0), band);
    strip.rotation.x = (i / 6) * Math.PI * 2;
    drum.add(strip);
  }
  for (const side of [-1, 1]) {
    drum.add(part(axle(0.5, 0.04, ROUND), dark, side * 1.0));
    for (let i = 0; i < 3; i++) {
      const bolt = part(axle(0.09, 0.05, 10).translate(0, 0.32, 0), yellow, side * 1.01);
      bolt.rotation.x = (i / 3) * Math.PI * 2;
      drum.add(bolt);
    }
  }
  const roll = bakedGroup(drum);
  roll.position.set(0, R, 1.55);
  return { body, wheels: [roll, ...wheelSet(0.8, 0.5, 0.9, [-1.25])], live: [] };
}

/** A loader: four big wheels, a cab in the middle, and a wide bucket of earth on two arms that lifts when it stops. */
export function loader(): Parts {
  const body = new THREE.Group();
  const orange = paint(0xff8f1f), dark = plastic(DARK, 0.6);
  body.add(part(rbox(1.3, 1.1, 2.4, 0.25), orange, 0, 1.5, -1.5));
  body.add(part(rbox(0.8, 0.6, 1.5, 0.2), orange, 0, 1.0, 0.9));
  body.add(part(rbox(1.3, 0.7, 0.45, 0.15), orange, 0, 1.6, 0.2));
  // The cab: glass all round between four posts, under a roof.
  body.add(part(rbox(1.4, 0.4, 1.5, 0.1), orange, 0, 2.1, -0.6));
  body.add(part(rbox(1.3, 1.1, 1.4, 0.08), glass(), 0, 2.8, -0.6));
  for (const x of [-0.66, 0.66]) for (const z of [0.1, -1.3]) body.add(part(new THREE.BoxGeometry(0.09, 1.15, 0.09), orange, x, 2.8, z));
  body.add(part(rbox(1.5, 0.12, 1.6, 0.05), orange, 0, 3.4, -0.6));
  body.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16), lamp(0xffa000, 1.6), 0, 3.52, -0.9));
  for (const side of [-1, 1]) body.add(part(rbox(0.62, 0.12, 1.9, 0.05), dark, side * 1.0, 1.72, -1.4));
  body.add(part(new THREE.CylinderGeometry(0.08, 0.08, 0.9, 10), chrome(), 0.4, 2.45, -2.1));
  body.add(part(new THREE.BoxGeometry(1.0, 0.5, 0.05), dark, 0, 1.55, -2.71));
  lights(body, 0.5, 1.2, 1.66, -2.71, 0.12);
  // The arms pivot in front of the cab; the bucket stays level as they rise, then tips back a little.
  const arm = new THREE.Group();
  for (const side of [-1, 1]) arm.add(part(new THREE.BoxGeometry(0.18, 0.26, 2.1), orange, side * 0.55, 0, 1.05));
  arm.add(part(new THREE.BoxGeometry(1.1, 0.16, 0.16), dark, 0, 0, 1.5));
  const bucket = new THREE.Group();
  bucket.add(part(rbox(2.5, 0.95, 0.12, 0.05), dark, 0, 0, 0.06));
  bucket.add(part(rbox(2.5, 0.12, 0.9, 0.05), dark, 0, -0.42, 0.5));
  for (const side of [-1, 1]) bucket.add(part(new THREE.BoxGeometry(0.1, 0.9, 0.9), dark, side * 1.2, 0, 0.5));
  bucket.add(part(new THREE.BoxGeometry(2.5, 0.06, 0.1), chrome(), 0, -0.4, 0.96));
  const earth = plastic(0x7a5230, 0.95);
  for (const [x, r] of [[-0.7, 0.42], [0.05, 0.5], [0.75, 0.4]] as const) {
    bucket.add(part(new THREE.SphereGeometry(r, 12, 8).scale(1.1, 0.75, 0.85), earth, x, -0.05, 0.5));
  }
  bucket.position.set(0, 0, 2.1);
  arm.add(bucket);
  arm.position.set(0, 1.75, 0.3);
  const ease = easer();
  let raised = 0;
  const pose = () => {
    arm.rotation.x = 0.58 - 1.18 * raised;
    bucket.rotation.x = -arm.rotation.x - 0.3 * raised;
  };
  pose();
  return {
    body, wheels: wheelSet(0.8, 0.6, 1.0, [1.2, -1.4]), live: [arm],
    animate(time, speed) {
      raised = ease(raised, speed < STILL ? 1 : 0, 0.8, time);
      pose();
    },
  };
}

/** A street sweeper: round brushes at the front corners and a roller brush at the back, spinning as it drives. */
export function streetSweeper(): Parts {
  const body = new THREE.Group();
  const lime = paint(0x9bc53d), white = paint(0xf6f7f9), dark = plastic(DARK, 0.6);
  cab(body, white, 1.35, 1.5, 2.0, 1.7, 1.5);
  body.add(part(rbox(2.0, 1.7, 2.9, 0.3), lime, 0, 1.55, -0.95));
  for (const side of [-1, 1]) body.add(part(new THREE.BoxGeometry(0.05, 0.2, 2.6), white, side * 1.0, 1.2, -0.95));
  // The hopper's lid and the pipe that fills it.
  body.add(part(rbox(1.5, 0.12, 1.6, 0.05), dark, 0, 2.43, -1.2));
  body.add(part(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 14), chrome(), 0.55, 2.55, -0.1));
  body.add(part(rbox(2.1, 0.25, 0.25, 0.1), dark, 0, 0.6, 2.12));
  lights(body, 0.7, 1.0, 2.11, -2.41, 0.13);
  const amber = flashers(0xffa000, 0xffa000, 2.45, 1.35, 1.0, 3);
  // Bristles in two colours, so a turning brush shows.
  const blue = plastic(0x2f8fe0, 0.8), pale = plastic(0xf4f6f8, 0.8);
  const disc = (x: number) => {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), dark, 0, 0.2, 0));
    for (let i = 0; i < 12; i++) {
      const tuft = part(new THREE.BoxGeometry(0.1, 0.2, 0.26).translate(0, 0, 0.27), i % 2 ? blue : pale, 0, 0.1, 0);
      tuft.rotation.y = (i / 12) * Math.PI * 2;
      g.add(tuft);
    }
    const brush = bakedGroup(g);
    brush.position.set(x, 0.02, 2.14);
    return brush;
  };
  const left = disc(-0.72), right = disc(0.72);
  for (const x of [-0.72, 0.72]) body.add(part(new THREE.BoxGeometry(0.1, 0.4, 0.1), dark, x, 0.42, 2.14));
  const roller = new THREE.Group();
  roller.add(part(axle(0.2, 1.8), dark));
  for (let i = 0; i < 10; i++) {
    const tuft = part(new THREE.BoxGeometry(1.8, 0.12, 0.1).translate(0, 0.24, 0), i % 2 ? blue : pale);
    tuft.rotation.x = (i / 10) * Math.PI * 2;
    roller.add(tuft);
  }
  const back = bakedGroup(roller);
  back.position.set(0, 0.31, -2.2);
  let turn = 0, last = -1;
  return {
    body, wheels: wheelSet(0.45, 0.4, 0.85, [1.2, -1.5]), live: [left, right, back, ...amber.live],
    animate(time, speed) {
      amber.flash(time);
      const dt = last < 0 ? 0 : Math.min(0.1, Math.max(0, time - last));
      last = time;
      // Slowly at rest, faster the faster it goes.
      turn += dt * (2 + Math.abs(speed) * 0.9);
      left.rotation.y = turn;
      right.rotation.y = -turn;
      back.rotation.x = turn * 1.5;
    },
  };
}

/** A mail van: an envelope painted on each side, and a back door that rolls up when it stops to show the parcels. */
export function mailVan(): Parts {
  const body = new THREE.Group();
  const navy = paint(0x2c4a8c), cream = paint(0xfdf6e3), dark = plastic(DARK, 0.6), yellow = paint(0xffcf3f), red = paint(0xe23b2e);
  // The box is hollow: a floor, two sides, a roof, the cab's front and a wall behind the cab.
  body.add(part(new THREE.BoxGeometry(2.1, 0.12, 3.45), dark, 0, 0.62, -0.72));
  for (const side of [-1, 1]) {
    body.add(part(rbox(0.1, 1.9, 3.45, 0.04), navy, side * 1.02, 1.6, -0.72));
    body.add(part(new THREE.BoxGeometry(0.2, 1.9, 0.1), navy, side * 0.9, 1.6, -2.4));
    body.add(part(rbox(0.06, 0.6, 0.7, 0.03), glass(), side * 1.05, 1.95, 0.5));
    body.add(part(new THREE.BoxGeometry(0.04, 0.14, 3.4), yellow, side * 1.075, 0.95, -0.72));
    // The envelope: a cream rectangle, its flap as two lines to the middle, and a red seal.
    body.add(part(new THREE.BoxGeometry(0.04, 0.8, 1.3), cream, side * 1.075, 1.6, -1.2));
    for (const lean of [-1, 1]) {
      const flap = part(new THREE.BoxGeometry(0.05, 0.05, 0.79), dark, side * 1.08, 1.775, -1.2 + lean * 0.325);
      flap.rotation.x = -lean * 0.605;
      body.add(flap);
    }
    body.add(part(axle(0.1, 0.06, 14), red, side * 1.08, 1.55, -1.2));
  }
  body.add(part(rbox(2.14, 0.12, 3.5, 0.05), cream, 0, 2.6, -0.72));
  body.add(part(new THREE.BoxGeometry(2.14, 1.9, 0.12), navy, 0, 1.6, 0.98));
  body.add(part(rbox(1.8, 0.75, 0.06, 0.03), glass(), 0, 1.95, 1.05));
  body.add(part(new THREE.BoxGeometry(2.0, 1.9, 0.06), dark, 0, 1.6, 0.1));
  body.add(part(new THREE.BoxGeometry(2.14, 0.22, 0.1), navy, 0, 2.44, -2.4));
  // The bonnet, grille and bumpers.
  body.add(part(rbox(2.1, 0.95, 1.3, 0.28), navy, 0, 1.05, 1.6));
  body.add(part(new THREE.BoxGeometry(0.9, 0.16, 0.05), dark, 0, 1.0, 2.26));
  body.add(part(rbox(2.2, 0.28, 0.28, 0.1), dark, 0, 0.55, 2.3));
  body.add(part(rbox(2.2, 0.25, 0.25, 0.1), dark, 0, 0.55, -2.42));
  const head = lamp(0xfff4d0, 1.4), tail = lamp(0xff2a1a, 1.2);
  for (const side of [-1, 1]) {
    body.add(part(new THREE.CylinderGeometry(0.13, 0.13, 0.08, ROUND).rotateX(Math.PI / 2), head, side * 0.75, 1.05, 2.26));
    body.add(part(new THREE.BoxGeometry(0.16, 0.34, 0.07), tail, side * 0.9, 1.1, -2.46));
  }
  // Parcels in the back.
  const brown = plastic(0xc99a5b, 0.8), kraft = plastic(0xa97c4a, 0.8);
  body.add(part(rbox(0.75, 0.6, 0.7, 0.04), brown, -0.38, 0.98, -1.95));
  body.add(part(rbox(0.6, 0.5, 0.6, 0.04), kraft, 0.42, 0.93, -2.0));
  body.add(part(rbox(0.5, 0.42, 0.5, 0.04), red, -0.3, 1.49, -1.95));
  body.add(part(rbox(0.55, 0.36, 0.5, 0.04), yellow, 0.4, 1.36, -1.95));
  body.add(part(rbox(1.5, 0.8, 0.9, 0.04), kraft, 0, 1.08, -1.05));
  // The door: slats hung from the top of the opening; it squashes upward to open.
  const door = new THREE.Group();
  const slat = plastic(0xe9ecef, 0.5);
  for (let i = 0; i < 8; i++) door.add(part(new THREE.BoxGeometry(1.6, 0.19, 0.05), slat, 0, -0.105 - i * 0.207, 0));
  door.add(part(new THREE.BoxGeometry(0.4, 0.07, 0.07), dark, 0, -1.5, -0.05));
  door.position.set(0, 2.33, -2.41);
  const ease = easer();
  let open = 0;
  return {
    body, wheels: wheelSet(0.47, 0.4, 0.88, [1.5, -1.6]), live: [door],
    animate(time, speed) {
      open = ease(open, speed < STILL ? 1 : 0, 1.2, time);
      door.scale.y = 1 - 0.9 * open;
    },
  };
}

/** A quad bike: four fat tyres, handlebars and racks, bouncing on its springs as it goes. Painted in the kid's colour. */
export function quadBike(color: THREE.ColorRepresentation): Parts {
  const body = new THREE.Group();
  const main = paint(color), dark = plastic(DARK, 0.6), metal = chrome(), spring = paint(0xffc400);
  for (const z of [0.95, -0.95]) {
    body.add(part(axle(0.08, 1.0, 10), dark, 0, 0.5, z));
    for (const side of [-1, 1]) body.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), spring, side * 0.28, 0.72, z));
  }
  // Everything above the axles rides on the springs.
  const top = new THREE.Group();
  top.add(part(rbox(0.6, 0.4, 2.3, 0.15), dark, 0, 0.85, 0));
  // The nose, the tank and the tail in the kid's colour, and a mudguard over each wheel.
  top.add(part(rbox(0.8, 0.45, 0.95, 0.2), main, 0, 1.1, 0.85));
  top.add(part(rbox(0.62, 0.55, 0.8, 0.22), main, 0, 1.25, 0.15));
  top.add(part(rbox(0.8, 0.36, 0.9, 0.16), main, 0, 1.05, -0.95));
  for (const z of [0.95, -0.95]) for (const side of [-1, 1]) top.add(part(rbox(0.52, 0.14, 1.0, 0.06), main, side * 0.66, 1.1, z));
  top.add(part(rbox(0.5, 0.26, 1.15, 0.11), dark, 0, 1.3, -0.65));
  const stem = part(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 10), dark, 0, 1.68, 0.5);
  stem.rotation.x = -0.35;
  top.add(stem);
  top.add(part(axle(0.045, 1.3, 10), metal, 0, 1.94, 0.4));
  for (const side of [-1, 1]) top.add(part(axle(0.07, 0.3, 10), dark, side * 0.56, 1.94, 0.4));
  // A rack on the nose and one on the tail, a bumper bar, and one big headlamp.
  for (const [y, z] of [[1.39, 0.95], [1.29, -1.05]] as const) {
    for (const x of [-0.3, 0, 0.3]) top.add(part(new THREE.BoxGeometry(0.05, 0.05, 0.7), metal, x, y, z));
    for (const dz of [-0.33, 0.33]) top.add(part(new THREE.BoxGeometry(0.7, 0.05, 0.05), metal, 0, y, z + dz));
    for (const x of [-0.3, 0.3]) for (const dz of [-0.33, 0.33]) top.add(part(new THREE.BoxGeometry(0.05, 0.1, 0.05), metal, x, y - 0.05, z + dz));
  }
  top.add(part(rbox(1.0, 0.1, 0.1, 0.04), metal, 0, 0.85, 1.4));
  top.add(part(new THREE.CylinderGeometry(0.17, 0.17, 0.1, ROUND).rotateX(Math.PI / 2), lamp(0xfff4d0, 1.4), 0, 1.12, 1.34));
  top.add(part(new THREE.BoxGeometry(0.4, 0.12, 0.07), lamp(0xff2a1a, 1.2), 0, 1.05, -1.41));
  const sprung = bakedGroup(top);
  return {
    body, wheels: wheelSet(0.5, 0.44, 0.68, [0.95, -0.95]), live: [sprung],
    animate(time, speed) {
      sprung.position.y = Math.sin(time * 11) * 0.045 * Math.min(1, Math.abs(speed) / 5);
    },
  };
}
