// Toys (driving-assets.md, category 2): light things placed in the car's way to knock about; they always come
// back. This is each toy's definition for the simulation; its look is in look/toys.ts.

/**
 * How a toy reacts to a bump (driving-assets.md, "Knock behaviours"). Built so far: tumble (pushed, spins,
 * bounces, settles, returns), roll (a low hop, then it rolls along the ground, slows and returns), and the
 * targets' two (ADR 0041): topple (a stack falls apart, then rebuilds bottom first) and collect (the kid's car
 * takes it as it drives through; it spins off and comes back).
 */
export type KnockBehaviour = 'tumble' | 'roll' | 'topple' | 'collect';

/** The sound a toy makes when bumped (sound.ts): a plastic ping, a wooden knock, a rubber boing, a soft thump. */
export type BumpSound = 'ping' | 'knock' | 'boing' | 'thump';

/** A target's celebration sound when the kid's car gets it (ADR 0041): a silly boing, or a twinkle. */
export type TargetSound = 'silly' | 'twinkle';

export interface ToyDef {
  /** Half its height, which is also its reach when the car bumps it, in metres. */
  half: number;
  behaviour: KnockBehaviour;
  bump: BumpSound;
  /**
   * A target (ADR 0041): when the kid's car gets it there is a confetti burst and this sound instead of the bump.
   * Targets are placed by a map's `targets`, not scattered with the other toys.
   */
  target?: TargetSound;
}

export const TOYS = {
  'toy/cone': { half: 0.55, behaviour: 'tumble', bump: 'ping' },
  'toy/crate': { half: 0.5, behaviour: 'tumble', bump: 'knock' },
  'toy/beach-ball': { half: 0.6, behaviour: 'roll', bump: 'boing' },
  'toy/hay-bale': { half: 0.45, behaviour: 'tumble', bump: 'thump' },
  // Targets (ADR 0041). The stack's look is one of its boxes; the simulation places six of them as a pyramid.
  'toy/box-stack': { half: 0.375, behaviour: 'topple', bump: 'knock', target: 'silly' },
  'toy/star': { half: 0.5, behaviour: 'collect', bump: 'ping', target: 'twinkle' },
} as const satisfies Record<`toy/${string}`, ToyDef>;

export type ToyId = keyof typeof TOYS;
export const TOY_IDS = Object.keys(TOYS) as ToyId[];

/** The toys that are targets (ADR 0041): what a map's `targets` may place. */
export type TargetId = 'toy/box-stack' | 'toy/star';
export const TARGET_IDS = TOY_IDS.filter((id): id is TargetId => 'target' in TOYS[id]);

/** A stack of boxes (ADR 0041): rows from the bottom, how many boxes in each, the pyramid's shape. */
export const STACK_ROWS = [3, 2, 1] as const;
/** How high a star floats, at its middle, in metres: about a car's roof. */
export const STAR_HEIGHT = 1.35;
/** Seconds before a collected star comes back (once the kid's car is away from it). */
export const STAR_BACK = 10;
/** How far the kid's car must be from a target's home before it comes back, in metres: the star and the stack. */
export const STAR_CLEAR = 6;
export const STACK_CLEAR = 5;
