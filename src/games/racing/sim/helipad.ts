// A helicopter pad (ADR 0048, `setpiece/helipad`): a round pad beside a road with a helicopter standing on it, its
// rotor turning lazily. For show: when the kid's car comes near, the rotor spins up and the helicopter lifts off and
// hovers over the pad, turning slowly; when the kid drives away it comes down again. The pad is flat ground a car
// can cross, and the helicopter is never in a car's way: it is in the air before the fastest car can reach it.
// Traffic doesn't set it off. Plain TypeScript.

export const HELIPAD = {
  /** The kid's car nearer the pad's middle than this, in metres: the helicopter takes off. */
  near: 40,
  /** Further away than this: it lands. Between the two it stays as it is, so it doesn't dither at one distance. */
  far: 55,
  /** How high it hovers, and how fast it climbs and comes down, metres and metres a second. */
  hover: 7,
  climb: 4.5,
  sink: 2.5,
  /** The rotor's speed standing on the pad, as a share of full speed; and how fast it speeds up and slows, a second. */
  idle: 0.12,
  spinUp: 1.3,
  spinDown: 0.35,
  /** The rotor speed it needs before it leaves the ground. */
  liftAt: 0.8,
  /** How fast it turns while in the air, radians a second. */
  turn: 0.35,
} as const;

/** Higher than every vehicle (the tallest is under 5 m): a car under a helicopter this high passes beneath it. */
export const CLEAR_HEIGHT = 5;

/** A pad's helicopter: its zone (an index into `World.zones`), how high it is, its rotor's speed and the way it faces. */
export interface Chopper {
  zone: number;
  /** Metres above the pad; 0 standing on it. */
  height: number;
  /** The rotor's speed, 0 to 1. */
  rotor: number;
  heading: number;
  /** Whether it is up, or on its way up, because the kid's car is near. */
  flying: boolean;
}

export function chopper(zone: number, heading: number): Chopper {
  return { zone, height: 0, rotor: HELIPAD.idle, heading, flying: false };
}

/** One step of a helicopter, with the kid's car `dist` metres from the middle of its pad. */
export function stepChopper(c: Chopper, dist: number, dt: number): void {
  if (dist < HELIPAD.near) c.flying = true;
  else if (dist > HELIPAD.far) c.flying = false;
  // The rotor runs at full speed whenever it is, or should be, off the ground.
  const want = c.flying || c.height > 0 ? 1 : HELIPAD.idle;
  c.rotor += Math.max(-HELIPAD.spinDown * dt, Math.min(HELIPAD.spinUp * dt, want - c.rotor));
  if (c.flying) {
    if (c.rotor >= HELIPAD.liftAt) c.height = Math.min(HELIPAD.hover, c.height + HELIPAD.climb * dt);
  } else {
    c.height = Math.max(0, c.height - HELIPAD.sink * dt);
  }
  if (c.height > 1) c.heading = (c.heading + HELIPAD.turn * dt) % (Math.PI * 2);
}
