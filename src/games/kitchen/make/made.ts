// The thing being made, as plain data (ADR 0044): small enough to save after every action, and all the look needs
// to draw it at any size. No DOM here. Places are in the thing's own units, measured from its middle.
import type { Recipe, Step } from '../recipe';
import { bodyOf, inArea, inOval, railOf } from '../recipe';

export interface Pt {
  x: number;
  y: number;
}
/** One sprinkled bit (a shred of cheese): where it lies, which way it points (radians) and how long it is. */
export interface Bit extends Pt {
  a: number;
  l: number;
}
/** One placed piece (a topping): which, where, and turned how far (degrees). */
export interface Placed extends Pt {
  kind: string;
  rot: number;
}
export interface Bite extends Pt {
  r: number;
}

/**
 * Everything is kept by step id, so a recipe can use a verb more than once. A step that hasn't been touched has no
 * entry.
 */
export interface Made {
  v: 1;
  recipe: string;
  /** Which step is open (an index into the recipe's steps). */
  step: number;
  /** Press steps: 0 (a lump) to 1 (flat). */
  pressed: Record<string, number>;
  /** Spread steps: the covered cells of the grid, as a string of 0 and 1, row by row. */
  spread: Record<string, string>;
  /** Pour steps: 0 (empty) to 1 (full). */
  poured: Record<string, number>;
  /** Sprinkle steps: the bits, oldest first. */
  bits: Record<string, Bit[]>;
  /** Place steps: the pieces, oldest first (later ones lie on top). */
  placed: Record<string, Placed[]>;
  /** The rail's pick in each step that has a rail. */
  picked: Record<string, string>;
  /** Cook steps: 0 (raw) to 1 (done). */
  cooked: Record<string, number>;
  /** Eat steps: the bites taken. */
  bites: Record<string, Bite[]>;
}

/** The spread grid is GRID cells across the thing's whole width. */
export const GRID = 32;

/** A new thing: nothing done, the first of each rail picked. */
export function fresh(recipe: Recipe): Made {
  const picked: Record<string, string> = {};
  for (const step of recipe.steps) {
    const rail = railOf(step);
    if (rail) picked[step.id] = rail.options[0].id;
  }
  return { v: 1, recipe: recipe.id, step: 0, pressed: {}, spread: {}, poured: {}, bits: {}, placed: {}, picked, cooked: {}, bites: {} };
}

/** Nothing has been done to it yet: it is on its first step, as new (a pick from a rail doesn't count). */
export function untouched(made: Made): boolean {
  const empty = (r: Record<string, unknown>) => Object.keys(r).length === 0;
  return made.step === 0 && empty(made.pressed) && empty(made.spread) && empty(made.poured) && empty(made.bits) &&
    empty(made.placed) && empty(made.cooked) && empty(made.bites);
}

export function stepOf(recipe: Recipe, made: Made): Step {
  return recipe.steps[made.step];
}

/** The middle of a grid cell, in the thing's units. */
export function cellAt(recipe: Recipe, index: number): Pt {
  const size = (2 * recipe.r) / GRID;
  return { x: ((index % GRID) + 0.5) * size - recipe.r, y: (Math.floor(index / GRID) + 0.5) * size - recipe.r };
}

const masks = new Map<string, { inner: number[]; whole: number[] }>();
/** The grid cells inside the thing: `inner` is where layers go, `whole` is all of it (for eating). */
export function cells(recipe: Recipe): { inner: number[]; whole: number[] } {
  let mask = masks.get(recipe.id);
  if (!mask) {
    mask = { inner: [], whole: [] };
    const body = bodyOf(recipe);
    for (let i = 0; i < GRID * GRID; i++) {
      const c = cellAt(recipe, i);
      if (inArea(recipe, c.x, c.y)) mask.inner.push(i);
      if (inOval(body, c.x, c.y)) mask.whole.push(i);
    }
    masks.set(recipe.id, mask);
  }
  return mask;
}

const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * What was saved, made safe to use: anything that isn't for this recipe, or doesn't fit it, is dropped, so a file
 * from an older version or another device (ADR 0024) never breaks the game. Nothing usable gives a fresh thing.
 */
export function readMade(raw: unknown, recipe: Recipe): Made {
  const made = fresh(recipe);
  const src = rec(raw);
  if (src.v !== 1 || src.recipe !== recipe.id) return made;
  const far = recipe.r * 1.5;
  made.step = Math.round(num(src.step, 0, recipe.steps.length - 1) ?? 0);
  for (const step of recipe.steps) {
    const id = step.id;
    const rail = railOf(step);
    const pick = rec(src.picked)[id];
    if (rail && rail.options.some((o) => o.id === pick)) made.picked[id] = pick as string;
    if (step.verb === 'press') {
      const v = num(rec(src.pressed)[id], 0, 1);
      if (v) made.pressed[id] = v;
    } else if (step.verb === 'spread') {
      const v = rec(src.spread)[id];
      if (typeof v === 'string' && v.length === GRID * GRID && /^[01]+$/.test(v)) made.spread[id] = v;
    } else if (step.verb === 'pour') {
      const v = num(rec(src.poured)[id], 0, 1);
      if (v) made.poured[id] = v;
    } else if (step.verb === 'sprinkle') {
      const bits: Bit[] = [];
      for (const b of list(rec(src.bits)[id]).slice(-step.most)) {
        const o = rec(b), x = num(o.x, -far, far), y = num(o.y, -far, far), a = num(o.a, -10, 10), l = num(o.l, 1, 60);
        if (x !== undefined && y !== undefined && a !== undefined && l !== undefined) bits.push({ x, y, a, l });
      }
      if (bits.length) made.bits[id] = bits;
    } else if (step.verb === 'place') {
      const placed: Placed[] = [];
      for (const p of list(rec(src.placed)[id]).slice(-step.most)) {
        const o = rec(p), x = num(o.x, -far, far), y = num(o.y, -far, far), rot = num(o.rot, -360, 360);
        if (x !== undefined && y !== undefined && rot !== undefined && step.rail.options.some((k) => k.id === o.kind)) {
          placed.push({ kind: o.kind as string, x, y, rot });
        }
      }
      if (placed.length) made.placed[id] = placed;
    } else if (step.verb === 'cook') {
      const v = num(rec(src.cooked)[id], 0, 1);
      if (v) made.cooked[id] = v;
    } else if (step.verb === 'eat') {
      const bites: Bite[] = [];
      for (const b of list(rec(src.bites)[id]).slice(0, GRID * GRID)) {
        const o = rec(b), x = num(o.x, -far, far), y = num(o.y, -far, far), r = num(o.r, 1, recipe.r);
        if (x !== undefined && y !== undefined && r !== undefined) bites.push({ x, y, r });
      }
      if (bites.length) made.bites[id] = bites;
    }
  }
  return made;
}
