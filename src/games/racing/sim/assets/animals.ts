// Animals (driving-assets.md, category 8): live things that wander, step aside before the car can reach them, and
// answer the horn. This is each animal's definition for the simulation; its look is in look/animals.ts.

/** The call an animal answers the horn with (sound.ts; a stand-in until takes of their own, milestone-3 B6). */
export type AnimalCall = 'baa' | 'quack' | 'moo';

export interface AnimalDef {
  /** How close the car may come before it steps aside, in metres. */
  shy: number;
  /** Its walking pace, in metres a second; it hurries off at twice that. */
  pace: number;
  /** How high it hops when it answers the horn, as an upward speed. */
  hop: number;
  call: AnimalCall;
}

export const ANIMALS = {
  'animal/sheep': { shy: 6, pace: 0.9, hop: 4.5, call: 'baa' },
  'animal/duck': { shy: 5, pace: 0.7, hop: 3.5, call: 'quack' },
  'animal/cow': { shy: 7, pace: 0.6, hop: 2.5, call: 'moo' },
} as const satisfies Record<`animal/${string}`, AnimalDef>;

export type AnimalId = keyof typeof ANIMALS;
export const ANIMAL_IDS = Object.keys(ANIMALS) as AnimalId[];

/** Within this distance of the kid's car, animals hear the horn and answer it. */
export const HEARS_HORN = 35;
