// Kitchen's sounds (ADR 0044, 0032): one per verb. Every one here is a STAND-IN made from a file the app already
// ships, played quieter, lower or higher, until a take of its own is made by the sounds recipe (kitchen-plan.md,
// phase C). The bell and the pop are the app's own cheer and fill.
import type { Effect } from '../../shell/types';

export const KITCHEN_SOUNDS = {
  /** A pat on the dough: the driving game's bump, soft and low. */
  pat: { file: 'drive/bump.wav', gain: 0.45, rate: 0.75, seconds: 0.25 },
  /** Cheese landing: the tap, quiet and high. */
  sprinkle: { file: 'ui/tap.wav', gain: 0.22, rate: 1.9 },
  /** A topping that missed the pizza: the tap, quiet and low (the app's "nothing"). */
  miss: { file: 'ui/tap.wav', gain: 0.4, rate: 0.75 },
  /** The pizza going into the oven: the page turn, low. */
  ovenIn: { file: 'ui/page.wav', gain: 0.7, rate: 0.7 },
  /** A bubble where the oven window is touched: the puddle, short and high. */
  bubble: { file: 'drive/puddle.wav', gain: 0.35, rate: 1.6, seconds: 0.3 },
  /** A bite: the bump, short and high. */
  munch: { file: 'drive/bump.wav', gain: 0.6, rate: 1.5, seconds: 0.14 },
} as const satisfies Record<string, Effect>;

/** Spreading sauce: the crayon loop (`Sound.scratch`), played this much lower. */
export const SPREAD_RATE = 0.55;

export const KITCHEN_SOUND_FILES: readonly string[] = [...new Set(Object.values(KITCHEN_SOUNDS).map((s) => s.file))];
