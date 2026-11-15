// Solid scenery and decor (driving-assets.md, categories 3 and 4). Solid scenery stays put and the car slides
// along it; decor the car drives straight through. Definitions for the simulation; looks are in look/scenery.ts.

export interface SceneryDef {
  /** The radius the car is kept out of, at scale 1, in metres. The car's own width is added on top. */
  radius: number;
  /** Shrinks away while it stands between the camera and the car (ADR 0021: nothing hides the car). */
  shrinks: boolean;
}

export const SCENERY = {
  'scenery/pine': { radius: 0.45, shrinks: true },
  'scenery/round-tree': { radius: 0.45, shrinks: true },
} as const satisfies Record<`scenery/${string}`, SceneryDef>;

export type SceneryId = keyof typeof SCENERY;
export const SCENERY_IDS = Object.keys(SCENERY) as SceneryId[];

/** Decor has no definition beyond its id: nothing in the simulation touches it. */
export const DECOR_IDS = ['decor/bush'] as const;
export type DecorId = (typeof DECOR_IDS)[number];
