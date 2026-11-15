// Animals in the simulation (driving-assets.md, category 8; milestone-3 B3): each wanders near its herd's spot,
// steps aside well before the kid's car can reach it, and answers the horn with a hop and its call. An animal is
// never hit: if the car is somehow on top of one, it is moved out of the way. Plain TypeScript.
import { ANIMALS, HEARS_HORN, type AnimalCall, type AnimalId } from './assets/animals';

export interface Animal {
  id: AnimalId;
  /** Its herd's spot and how far it may wander from it. */
  homeX: number; homeZ: number; roam: number;
  x: number; z: number; heading: number; speed: number;
  /** Where it is walking to, and how long it waits there before choosing the next spot. */
  tx: number; tz: number; wait: number;
  /** A hop: height above the ground and upward speed. */
  h: number; vy: number;
  /** Seconds until it answers the horn (each a little after the last, so a herd answers in turn); -1 for none. */
  answerIn: number;
}

/** No animal comes closer to the car than this, in metres. */
export const ANIMAL_CLEAR = 2.2;

export function makeAnimals(herds: { id: AnimalId; x: number; z: number; count: number; roam: number }[] | undefined, rand: () => number): Animal[] {
  const out: Animal[] = [];
  for (const herd of herds ?? []) {
    for (let i = 0; i < herd.count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * herd.roam;
      const x = herd.x + Math.sin(a) * r, z = herd.z + Math.cos(a) * r;
      out.push({ id: herd.id, homeX: herd.x, homeZ: herd.z, roam: herd.roam, x, z, heading: rand() * Math.PI * 2, speed: 0, tx: x, tz: z, wait: rand() * 2, h: 0, vy: 0, answerIn: -1 });
    }
  }
  return out;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Moves every animal one step. `honked` is true on the step the kid sounded the horn; the calls of the animals
 * answering in this step are pushed onto `calls`, for the sounds.
 */
export function stepAnimals(animals: Animal[], kid: { x: number; z: number; speed: number }, honked: boolean, dt: number, rand: () => number, calls: AnimalCall[]): void {
  for (const an of animals) {
    const def = ANIMALS[an.id];
    const dx = an.x - kid.x, dz = an.z - kid.z, d = Math.hypot(dx, dz);
    let want = 0;
    if (d < def.shy) {
      // Step aside: hurry away from the car.
      an.heading += wrap(Math.atan2(dx, dz) - an.heading) * Math.min(1, 8 * dt);
      want = def.pace * 2 + kid.speed * 0.15;
      an.wait = 0.5;
      an.tx = an.x + Math.sin(an.heading) * 3;
      an.tz = an.z + Math.cos(an.heading) * 3;
    } else if (an.wait > 0) {
      an.wait -= dt;
      if (an.wait <= 0) {
        // A new spot to wander to, near home.
        const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * an.roam;
        an.tx = an.homeX + Math.sin(a) * r;
        an.tz = an.homeZ + Math.cos(a) * r;
      }
    } else {
      const tx = an.tx - an.x, tz = an.tz - an.z;
      if (Math.hypot(tx, tz) < 0.3) an.wait = 1 + rand() * 3;
      else {
        an.heading += wrap(Math.atan2(tx, tz) - an.heading) * Math.min(1, 4 * dt);
        want = def.pace;
      }
    }
    an.speed += Math.max(-4 * dt, Math.min(4 * dt, want - an.speed));
    an.x += Math.sin(an.heading) * an.speed * dt;
    an.z += Math.cos(an.heading) * an.speed * dt;
    // Never hit: the car can't be on top of an animal.
    const nd = Math.hypot(an.x - kid.x, an.z - kid.z);
    if (nd < ANIMAL_CLEAR) {
      const k = ANIMAL_CLEAR / Math.max(nd, 1e-6);
      an.x = kid.x + (an.x - kid.x) * k;
      an.z = kid.z + (an.z - kid.z) * k;
    }

    // The horn: animals that hear it answer, one after another.
    if (honked && d < HEARS_HORN && an.answerIn < 0) an.answerIn = 0.15 + rand() * 0.6;
    if (an.answerIn >= 0) {
      an.answerIn -= dt;
      if (an.answerIn < 0 && an.h === 0) {
        an.vy = def.hop;
        calls.push(def.call);
      }
    }
    if (an.h > 0 || an.vy > 0) {
      an.vy -= 20 * dt;
      an.h = Math.max(0, an.h + an.vy * dt);
      if (an.h === 0) an.vy = 0;
    }
  }
}
