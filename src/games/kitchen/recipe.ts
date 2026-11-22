// What a recipe is (ADR 0044): a thing to make, as a list of steps. Each step names a verb the game knows; the verbs
// are written once (make/verbs.ts) and a recipe is data. How a thing looks is its own module under look/.

/** What a touch does in a step. */
export type Verb = 'press' | 'spread' | 'pour' | 'sprinkle' | 'place' | 'choose' | 'cook' | 'eat';

/** One of a step's choices, shown as a round button in the rail. `label` is for screen readers and tests only. */
export interface Option {
  id: string;
  label: string;
  /** The narrator's clip that names it, when it isn't `food-<id>` (a wrapper's colour is `color-blue`). */
  say?: string;
}

/** A step's choices: at most eight, all on screen (ADR 0044). The first is picked to begin with. */
export interface Rail {
  label: string;
  options: readonly Option[];
}

/** An oval part of the thing, in its own units. */
export interface Oval {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
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
  /** A finger held down fills it up: `seconds` of holding fills it, and each touch adds a splash. */
  | (StepBase & { verb: 'pour'; seconds: number; rail?: Rail })
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
  /** Half the width of the square the thing fits in, in its own units; touches arrive in these units, from its middle. */
  r: number;
  /** The radius layers and pieces stay inside, for a round thing (a pizza's crust is the ring outside it). */
  inner: number;
  /**
   * Where layers, bits and pieces go when that isn't a circle round the middle: one or more ovals, taken together
   * (a cupcake's frosting is a stack of swirls).
   */
  area?: readonly Oval[];
  /** The whole thing, for eating, when it isn't a circle of radius `r` (a cupcake, seen from the side). */
  body?: Oval;
  steps: readonly Step[];
  /** The narrator's line before the first step of a new one ("Let's make a pizza!"), the first few times. */
  sayStart?: string;
  /** One of these when it has all been eaten ("Yum!"), every time. */
  sayGone?: readonly string[];
}

/** A step's rail, when it has one. */
export function railOf(step: Step): Rail | undefined {
  return 'rail' in step ? step.rail : undefined;
}

/** The narrator's clip that names a rail option. */
export const nameClipOf = (option: Option): string => option.say ?? `food-${option.id}`;

/** Where layers, bits and pieces go: the ovals that make it up. */
export const areasOf = (recipe: Recipe): readonly Oval[] => recipe.area ?? [{ cx: 0, cy: 0, rx: recipe.inner, ry: recipe.inner }];
/** The whole thing. */
export const bodyOf = (recipe: Recipe): Oval => recipe.body ?? { cx: 0, cy: 0, rx: recipe.r, ry: recipe.r };

/** Whether a place is inside an oval, staying `margin` units in from its edge (or past it, when negative). */
export function inOval(oval: Oval, x: number, y: number, margin = 0): boolean {
  const rx = oval.rx - margin, ry = oval.ry - margin;
  if (rx <= 0 || ry <= 0) return false;
  const dx = (x - oval.cx) / rx, dy = (y - oval.cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** Whether a place is where layers, bits and pieces go, staying `margin` units in from the edge. */
export function inArea(recipe: Recipe, x: number, y: number, margin = 0): boolean {
  return areasOf(recipe).some((o) => inOval(o, x, y, margin));
}

/**
 * A place picked at random where bits and pieces go, `margin` in from the edge: a bigger oval gets more of them.
 * `reach` below 1 keeps it nearer each oval's middle.
 */
export function pointInArea(recipe: Recipe, rand: () => number, margin = 0, reach = 1): { x: number; y: number } {
  const ovals = areasOf(recipe);
  const sizes = ovals.map((o) => Math.max(0, o.rx - margin) * Math.max(0, o.ry - margin));
  let at = rand() * sizes.reduce((a, b) => a + b, 0), i = 0;
  while (i < ovals.length - 1 && at >= sizes[i]) at -= sizes[i++];
  const o = ovals[i], far = reach * Math.sqrt(rand()), turn = rand() * Math.PI * 2;
  return { x: o.cx + Math.max(0, o.rx - margin) * far * Math.cos(turn), y: o.cy + Math.max(0, o.ry - margin) * far * Math.sin(turn) };
}

/** Every narrator clip a recipe names, for the check that each one ships. */
export function clipsOf(recipe: Recipe): string[] {
  const keys = [recipe.sayStart, ...(recipe.sayGone ?? [])];
  for (const step of recipe.steps) {
    keys.push(step.say);
    if (step.verb === 'cook') keys.push(step.sayDone);
    for (const option of railOf(step)?.options ?? []) keys.push(nameClipOf(option));
  }
  return keys.filter((k): k is string => !!k);
}
