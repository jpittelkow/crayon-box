// The verbs (ADR 0044): what a touch does to the thing being made, written once for every recipe. Plain functions
// with no DOM, like the letters checker and the driving simulation, so they have unit tests. They change `made` in
// place (a finger rubbing calls them on every move) and say what happened.
import { inArea, pointInArea, type Recipe, type Step } from '../recipe';
import { cellAt, cells, fresh, GRID, stepOf, type Bit, type Bite, type Made, type Pt } from './made';

/** A random number from 0 up to 1, passed in so tests can fix it. */
export type Rand = () => number;

type Of<V extends Step['verb']> = Extract<Step, { verb: V }>;

/** How far a pat reaches past the thing's edge and still counts. */
const PRESS_REACH = 30;
/** Bits a finger drops each time, and how far from the finger they land. */
const BITS_A_DROP = 3;
const BIT_SCATTER = 30;
/** Bits and pieces stay this far inside the inner edge, so none hangs over it. */
const BIT_MARGIN = 8;
const PIECE_MARGIN = 10;
/** A skipped sprinkle step gives itself this share of the most it keeps (and at least "enough"), spread evenly. */
const SELF_SPRINKLE = 0.4;
/** How much one touch pours, as a share of full; holding pours the rest. */
const POUR_SPLASH = 0.1;

/** The thing's radius while it is being pressed flat: a lump at 0, its full size at 1. */
export function pressedRadius(recipe: Recipe, amount: number): number {
  return recipe.r * (0.62 + 0.38 * amount);
}

/** A pat. True when it squashed the thing further. */
export function press(recipe: Recipe, made: Made, step: Of<'press'>, at: Pt): boolean {
  const amount = made.pressed[step.id] ?? 0;
  if (amount >= 1 || Math.hypot(at.x, at.y) > pressedRadius(recipe, amount) + PRESS_REACH) return false;
  made.pressed[step.id] = Math.min(1, amount + 1 / step.pats);
  return true;
}

/** A finger on the thing: covers the cells under it. True when it covered anything new. */
export function spread(recipe: Recipe, made: Made, step: Of<'spread'>, at: Pt): boolean {
  const before = made.spread[step.id];
  const grid = before ? before.split('') : new Array<string>(GRID * GRID).fill('0');
  let changed = false;
  for (const i of cells(recipe).inner) {
    if (grid[i] === '1') continue;
    const c = cellAt(recipe, i);
    if (Math.hypot(c.x - at.x, c.y - at.y) <= step.brush) {
      grid[i] = '1';
      changed = true;
    }
  }
  if (changed) made.spread[step.id] = grid.join('');
  return changed;
}

/** How much of the inside a spread step has covered, 0 to 1. */
export function covered(recipe: Recipe, made: Made, stepId: string): number {
  const grid = made.spread[stepId];
  if (!grid) return 0;
  const inner = cells(recipe).inner;
  let n = 0;
  for (const i of inner) if (grid[i] === '1') n++;
  return n / inner.length;
}

function bit(at: Pt, rand: Rand): Bit {
  return { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, a: Math.round(rand() * 314) / 100, l: Math.round(13 + rand() * 12) };
}

/** A finger on the thing: drops a few bits round it. True when any landed. */
export function sprinkle(recipe: Recipe, made: Made, step: Of<'sprinkle'>, at: Pt, rand: Rand): boolean {
  const bits = (made.bits[step.id] ??= []);
  let landed = false;
  for (let i = 0; i < BITS_A_DROP; i++) {
    const far = BIT_SCATTER * Math.sqrt(rand()), turn = rand() * Math.PI * 2;
    const p = { x: at.x + far * Math.cos(turn), y: at.y + far * Math.sin(turn) };
    if (!inArea(recipe, p.x, p.y, BIT_MARGIN)) continue;
    bits.push(bit(p, rand));
    landed = true;
  }
  // Only so many are kept: the oldest go, and they are under the rest anyway.
  if (bits.length > step.most) bits.splice(0, bits.length - step.most);
  if (!bits.length) delete made.bits[step.id];
  return landed;
}

/** A touch with a piece picked: 'placed' when it landed on the thing, 'off' when it missed. */
export function place(recipe: Recipe, made: Made, step: Of<'place'>, at: Pt, rand: Rand): 'placed' | 'off' {
  if (!inArea(recipe, at.x, at.y, PIECE_MARGIN)) return 'off';
  const placed = (made.placed[step.id] ??= []);
  const kind = made.picked[step.id] ?? step.rail.options[0].id;
  placed.push({ kind, x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10, rot: Math.round(rand() * 360) });
  if (placed.length > step.most) placed.splice(0, placed.length - step.most);
  return 'placed';
}

/** A pick from a step's rail. True when the step has that option. */
export function pick(made: Made, step: Step, optionId: string): boolean {
  if (!('rail' in step) || !step.rail || !step.rail.options.some((o) => o.id === optionId)) return false;
  made.picked[step.id] = optionId;
  return true;
}

/** Time passing in a cook step. True the moment it is done. */
export function cook(made: Made, step: Of<'cook'>, seconds: number): boolean {
  const before = made.cooked[step.id] ?? 0;
  if (before >= 1) return false;
  made.cooked[step.id] = Math.min(1, before + seconds / step.seconds);
  return made.cooked[step.id] >= 1;
}

function gone(recipe: Recipe, bites: readonly Bite[]): number {
  let n = 0;
  for (const i of cells(recipe).whole) {
    const c = cellAt(recipe, i);
    if (bites.some((b) => Math.hypot(c.x - b.x, c.y - b.y) < b.r)) n++;
  }
  return n;
}

/** How much of the thing has been eaten, 0 to 1. */
export function eaten(recipe: Recipe, made: Made, stepId: string): number {
  return gone(recipe, made.bites[stepId] ?? []) / cells(recipe).whole.length;
}

/** A touch while eating. True when it took a bite: a touch where nothing is left takes none. */
export function bite(recipe: Recipe, made: Made, step: Of<'eat'>, at: Pt): boolean {
  const bites = made.bites[step.id] ?? [];
  const next = [...bites, { x: Math.round(at.x), y: Math.round(at.y), r: step.bite }];
  if (gone(recipe, next) === gone(recipe, bites)) return false;
  made.bites[step.id] = next;
  return true;
}

/**
 * Pouring for `seconds` (a held finger, called as time passes). True when it poured anything: a full thing takes
 * no more.
 */
export function pour(made: Made, step: Of<'pour'>, seconds: number): boolean {
  const before = made.poured[step.id] ?? 0;
  if (before >= 1 || seconds <= 0) return false;
  // Ten splashes of a tenth must come to full, whatever the sums of floats say.
  const now = before + seconds / step.seconds;
  made.poured[step.id] = now > 0.999 ? 1 : now;
  return true;
}

/** How far along a step is, 0 to 1, for the screen and for tests. */
export function progress(recipe: Recipe, made: Made, step: Step): number {
  switch (step.verb) {
    case 'press': return made.pressed[step.id] ?? 0;
    case 'spread': return covered(recipe, made, step.id);
    case 'pour': return made.poured[step.id] ?? 0;
    case 'sprinkle': return Math.min(1, (made.bits[step.id]?.length ?? 0) / step.enough);
    case 'place': return Math.min(1, (made.placed[step.id]?.length ?? 0) / step.most);
    case 'choose': return 1;
    case 'cook': return made.cooked[step.id] ?? 0;
    case 'eat': return eaten(recipe, made, step.id);
  }
}

/** Done enough: the next arrow pulses (ADR 0044). The arrow works either way. */
export function doneEnough(recipe: Recipe, made: Made, step: Step): boolean {
  switch (step.verb) {
    case 'press': return (made.pressed[step.id] ?? 0) >= 1;
    case 'spread': return covered(recipe, made, step.id) >= step.enough;
    case 'pour': return (made.poured[step.id] ?? 0) >= 1;
    case 'sprinkle': return (made.bits[step.id]?.length ?? 0) >= step.enough;
    case 'place': return (made.placed[step.id]?.length ?? 0) >= 1;
    case 'choose': return true;
    case 'cook': return (made.cooked[step.id] ?? 0) >= 1;
    case 'eat': return eaten(recipe, made, step.id) >= step.enough;
  }
}

/**
 * A step does itself (ADR 0044): whatever the kid left undone is finished, so what comes out always looks like the
 * thing. Pieces are a choice, so none are added; eating is never done for the kid.
 */
export function finish(recipe: Recipe, made: Made, step: Step, rand: Rand): void {
  switch (step.verb) {
    case 'press':
      made.pressed[step.id] = 1;
      break;
    case 'spread': {
      const grid = new Array<string>(GRID * GRID).fill('0');
      for (const i of cells(recipe).inner) grid[i] = '1';
      made.spread[step.id] = grid.join('');
      break;
    }
    case 'pour':
      made.poured[step.id] = 1;
      break;
    case 'sprinkle': {
      if (doneEnough(recipe, made, step)) break;
      const bits = (made.bits[step.id] ??= []);
      const want = Math.max(step.enough, Math.round(step.most * SELF_SPRINKLE));
      while (bits.length < want) bits.push(bit(pointInArea(recipe, rand, BIT_MARGIN), rand));
      break;
    }
    case 'cook':
      made.cooked[step.id] = 1;
      break;
    default:
      break;
  }
}

/**
 * The next arrow: the open step finishes itself and the next one opens. After the last step there is a new thing:
 * the result is that fresh thing, else `made` itself.
 */
export function next(recipe: Recipe, made: Made, rand: Rand): Made {
  finish(recipe, made, stepOf(recipe, made), rand);
  if (made.step >= recipe.steps.length - 1) return fresh(recipe);
  made.step++;
  return made;
}

/**
 * A finished one that nobody made, for a picture of the thing (a recipe's tile on the start screen): every step
 * done by itself, a few of each kind of piece placed, nothing eaten.
 */
export function sample(recipe: Recipe, rand: Rand): Made {
  const made = fresh(recipe);
  for (const step of recipe.steps) {
    if (step.verb === 'place') {
      const options = step.rail.options;
      for (let i = 0; i < Math.min(step.most, 6); i++) {
        made.picked[step.id] = options[i % options.length].id;
        place(recipe, made, step, pointInArea(recipe, rand, PIECE_MARGIN, 0.7), rand);
      }
      made.picked[step.id] = options[0].id;
    }
    finish(recipe, made, step, rand);
  }
  made.step = recipe.steps.length - 1;
  return made;
}

export type Touched = 'pressed' | 'spread' | 'poured' | 'sprinkled' | 'placed' | 'off' | 'bitten' | 'nothing';

/** A finger at `at` in the open step: whichever verb the step has. */
export function touch(recipe: Recipe, made: Made, at: Pt, rand: Rand): Touched {
  const step = stepOf(recipe, made);
  switch (step.verb) {
    case 'press': return press(recipe, made, step, at) ? 'pressed' : 'nothing';
    case 'spread': return spread(recipe, made, step, at) ? 'spread' : 'nothing';
    // A touch anywhere pours a splash; a kid doesn't have to aim at the thing.
    case 'pour': return pour(made, step, step.seconds * POUR_SPLASH) ? 'poured' : 'nothing';
    case 'sprinkle': return sprinkle(recipe, made, step, at, rand) ? 'sprinkled' : 'nothing';
    case 'place': return place(recipe, made, step, at, rand);
    case 'eat': return bite(recipe, made, step, at) ? 'bitten' : 'nothing';
    default: return 'nothing';
  }
}
