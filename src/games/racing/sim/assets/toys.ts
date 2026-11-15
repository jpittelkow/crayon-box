// Toys (driving-assets.md, category 2): light things placed in the car's way to knock about; they always come
// back. This is each toy's definition for the simulation; its look is in look/toys.ts.

/**
 * How a toy reacts to a bump (driving-assets.md, "Knock behaviours"). Built so far: tumble (pushed, spins,
 * bounces, settles, returns) and roll (a low hop, then it rolls along the ground, slows and returns).
 */
export type KnockBehaviour = 'tumble' | 'roll';

/** The sound a toy makes when bumped (sound.ts): a plastic ping, a wooden knock, a rubber boing, a soft thump. */
export type BumpSound = 'ping' | 'knock' | 'boing' | 'thump';

export interface ToyDef {
  /** Half its height, which is also its reach when the car bumps it, in metres. */
  half: number;
  behaviour: KnockBehaviour;
  bump: BumpSound;
}

export const TOYS = {
  'toy/cone': { half: 0.55, behaviour: 'tumble', bump: 'ping' },
  'toy/crate': { half: 0.5, behaviour: 'tumble', bump: 'knock' },
  'toy/beach-ball': { half: 0.6, behaviour: 'roll', bump: 'boing' },
  'toy/hay-bale': { half: 0.45, behaviour: 'tumble', bump: 'thump' },
} as const satisfies Record<`toy/${string}`, ToyDef>;

export type ToyId = keyof typeof TOYS;
export const TOY_IDS = Object.keys(TOYS) as ToyId[];
