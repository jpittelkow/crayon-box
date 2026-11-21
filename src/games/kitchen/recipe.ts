// What a recipe is (ADR 0044): a thing to make, as a list of steps. Each step names a verb the game knows; the verbs
// are written once (make/verbs.ts) and a recipe is data. How a thing looks is its own module under look/.

/** What a touch does in a step. */
export type Verb = 'press' | 'spread' | 'sprinkle' | 'place' | 'choose' | 'cook' | 'eat';

/** One of a step's choices, shown as a round button in the rail. `label` is for screen readers and tests only. */
export interface Option {
  id: string;
  label: string;
}

/** A step's choices: at most eight, all on screen (ADR 0044). The first is picked to begin with. */
export interface Rail {
  label: string;
  options: readonly Option[];
}

interface StepBase {
  /** Names the step in what is saved and in the look. */
  id: string;
  /** For screen readers and tests; never shown (ADR 0003). */
  label: string;
  /** The narrator's line when the step opens (a clip under `voice/`), said the first few times a kid gets here. */
  say?: string;
}

export type Step =
  /** Every pat squashes the thing flatter: `pats` of them make it flat. */
  | (StepBase & { verb: 'press'; pats: number })
  /** A finger covers the thing with a layer, `brush` units wide; `enough` of it (0 to 1) is done enough. */
  | (StepBase & { verb: 'spread'; brush: number; enough: number; rail?: Rail })
  /** A finger drops small bits where it is; `enough` of them is done enough, `most` is all that are kept. */
  | (StepBase & { verb: 'sprinkle'; enough: number; most: number })
  /** A touch puts one of the picked piece there; a drag puts one every `apart` units. At most `most` are kept. */
  | (StepBase & { verb: 'place'; apart: number; most: number; rail: Rail })
  /** Only a pick from the rail. */
  | (StepBase & { verb: 'choose'; rail: Rail })
  /** Nothing to do: a show that takes `seconds`. `sayDone` is the narrator's line when it ends, every time. */
  | (StepBase & { verb: 'cook'; seconds: number; sayDone?: string })
  /** A touch takes a bite `bite` units across its radius; `enough` of the thing eaten (0 to 1) ends it. */
  | (StepBase & { verb: 'eat'; bite: number; enough: number });

export interface Recipe {
  id: string;
  /** For screen readers and tests; never shown. */
  label: string;
  /** The thing's radius, in its own units; touches arrive in these units, measured from its middle. */
  r: number;
  /** The radius layers and pieces stay inside (a pizza's crust is the ring outside it). */
  inner: number;
  steps: readonly Step[];
  /** The narrator's line before the first step of a new one ("Let's make a pizza!"), the first few times. */
  sayStart?: string;
  /** One of these when it has all been eaten ("Yum!"), every time. */
  sayGone?: readonly string[];
}

/** Every narrator clip a recipe names, for the check that each one ships. Options are named `food-<id>`. */
export function clipsOf(recipe: Recipe): string[] {
  const keys = [recipe.sayStart, ...(recipe.sayGone ?? [])];
  for (const step of recipe.steps) {
    keys.push(step.say);
    if (step.verb === 'cook') keys.push(step.sayDone);
    for (const option of railOf(step)?.options ?? []) keys.push(`food-${option.id}`);
  }
  return keys.filter((k): k is string => !!k);
}

/** A step's rail, when it has one. */
export function railOf(step: Step): Rail | undefined {
  return 'rail' in step ? step.rail : undefined;
}
