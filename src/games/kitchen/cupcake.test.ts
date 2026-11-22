import { describe, expect, it } from 'vitest';
import { narratorClip } from '../../shell/soundFiles';
import { optionArt } from './look/art';
import { fresh, readMade, stepOf, untouched } from './make/made';
import { bite, doneEnough, eaten, finish, next, pick, place, pour, progress, sample, sprinkle, touch, type Rand } from './make/verbs';
import { areasOf, bodyOf, clipsOf, inArea, inOval, nameClipOf, railOf, type Step } from './recipe';
import { CUPCAKE } from './recipes/cupcake';
import { PIZZA } from './recipes/pizza';

// The cupcake (ADR 0044, plan phase F): the second recipe, and what it added to the rules: pouring, a thing that is
// not round, and options whose names are other clips.

function seeded(seed = 1): Rand {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const by = <V extends Step['verb']>(id: string, verb: V) => {
  const step = CUPCAKE.steps.find((s) => s.id === id);
  if (!step || step.verb !== verb) throw new Error(`no ${verb} step called ${id}`);
  return step as Extract<Step, { verb: V }>;
};
const BATTER = by('batter', 'pour'), FROSTING = by('frosting', 'pour'), SPRINKLES = by('sprinkles', 'sprinkle');
const TOPPERS = by('toppers', 'place'), EAT = by('eat', 'eat');
/** On the frosting, on the wrapper, and off the cupcake altogether. */
const ON_FROSTING = { x: 0, y: -80 }, ON_WRAPPER = { x: 0, y: 150 }, BESIDE = { x: 230, y: -200 };

describe('the cupcake recipe', () => {
  it('names only things the game has: unique ids, rails of at most eight, art and a narrator clip for every option', () => {
    const ids = CUPCAKE.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of CUPCAKE.steps) {
      const rail = railOf(s);
      if (!rail) continue;
      expect(rail.options.length, s.id).toBeLessThanOrEqual(8);
      for (const o of rail.options) {
        expect(optionArt(o.id), `${s.id}: ${o.id}`).toBeDefined();
        expect(narratorClip(nameClipOf(o)), `${s.id}: ${o.id}`).toBeTruthy();
      }
    }
    for (const key of clipsOf(CUPCAKE)) expect(narratorClip(key), key).toBeTruthy();
  });

  it('no option shares an id with one of the pizza: they share the art and what is saved by id', () => {
    const ids = (steps: readonly Step[]) => steps.flatMap((s) => railOf(s)?.options.map((o) => o.id) ?? []);
    const pizza = new Set(ids(PIZZA.steps));
    for (const id of ids(CUPCAKE.steps)) expect(pizza.has(id), id).toBe(false);
  });

  it('its frosting sits inside its body, and both fit the square it is drawn in', () => {
    const body = bodyOf(CUPCAKE);
    expect(areasOf(CUPCAKE).length).toBeGreaterThan(1);
    for (const area of areasOf(CUPCAKE)) {
      for (const [x, y] of [[area.cx - area.rx + 1, area.cy], [area.cx + area.rx - 1, area.cy], [area.cx, area.cy - area.ry + 1], [area.cx, area.cy + area.ry - 1]]) {
        expect(inOval(body, x, y), `${x},${y}`).toBe(true);
      }
    }
    expect(Math.abs(body.cx) + body.rx).toBeLessThanOrEqual(CUPCAKE.r);
    expect(Math.abs(body.cy) + body.ry).toBeLessThanOrEqual(CUPCAKE.r);
  });
});

describe('pour: batter and frosting', () => {
  it('a touch pours a splash wherever it lands, and holding fills it in the step\'s seconds', () => {
    const made = fresh(CUPCAKE);
    made.step = CUPCAKE.steps.indexOf(BATTER);
    expect(touch(CUPCAKE, made, BESIDE, seeded())).toBe('poured');
    const splash = made.poured.batter;
    expect(splash).toBeGreaterThan(0);
    expect(splash).toBeLessThan(0.2);
    expect(doneEnough(CUPCAKE, made, BATTER)).toBe(false);
    expect(pour(made, BATTER, BATTER.seconds / 2)).toBe(true);
    expect(made.poured.batter).toBeCloseTo(splash + 0.5);
    expect(pour(made, BATTER, BATTER.seconds)).toBe(true);
    expect(made.poured.batter).toBe(1);
    expect(doneEnough(CUPCAKE, made, BATTER)).toBe(true);
    // Full: no more goes in.
    expect(pour(made, BATTER, 1)).toBe(false);
    expect(touch(CUPCAKE, made, ON_FROSTING, seeded())).toBe('nothing');
  });

  it('batter and frosting are poured apart', () => {
    const made = fresh(CUPCAKE);
    pour(made, BATTER, BATTER.seconds);
    expect(progress(CUPCAKE, made, FROSTING)).toBe(0);
    pour(made, FROSTING, FROSTING.seconds / 4);
    expect(made.poured).toEqual({ batter: 1, frosting: 0.25 });
  });
});

describe('a thing that is not round', () => {
  it('sprinkles land on the frosting and nowhere else', () => {
    const made = fresh(CUPCAKE), rand = seeded();
    expect(sprinkle(CUPCAKE, made, SPRINKLES, ON_FROSTING, rand)).toBe(true);
    expect(sprinkle(CUPCAKE, made, SPRINKLES, ON_WRAPPER, rand)).toBe(false);
    expect(sprinkle(CUPCAKE, made, SPRINKLES, BESIDE, rand)).toBe(false);
    for (const b of made.bits.sprinkles) expect(inArea(CUPCAKE, b.x, b.y)).toBe(true);
  });

  it('a topper goes on the frosting, right up to its peak; on the wrapper, or in the air beside the peak, it misses', () => {
    const made = fresh(CUPCAKE), rand = seeded();
    expect(place(CUPCAKE, made, TOPPERS, ON_FROSTING, rand)).toBe('placed');
    expect(place(CUPCAKE, made, TOPPERS, ON_WRAPPER, rand)).toBe('off');
    expect(place(CUPCAKE, made, TOPPERS, { x: 0, y: -200 }, rand)).toBe('placed');
    expect(place(CUPCAKE, made, TOPPERS, { x: 110, y: -190 }, rand)).toBe('off');
    expect(made.placed.toppers.map((p) => p.kind)).toEqual(['cherry', 'cherry']);
  });

  it('bites take the wrapper and the frosting, and enough of them finish it', () => {
    const made = fresh(CUPCAKE);
    expect(bite(CUPCAKE, made, EAT, ON_WRAPPER)).toBe(true);
    expect(bite(CUPCAKE, made, EAT, ON_FROSTING)).toBe(true);
    expect(bite(CUPCAKE, made, EAT, BESIDE)).toBe(false);
    expect(eaten(CUPCAKE, made, 'eat')).toBeGreaterThan(0);
    for (let y = -250; y <= 250; y += 50) for (let x = -200; x <= 200; x += 50) bite(CUPCAKE, made, EAT, { x, y });
    expect(doneEnough(CUPCAKE, made, EAT)).toBe(true);
  });
});

describe('a cupcake nobody touched', () => {
  it('next on every step gives a baked, frosted, sprinkled cupcake with nothing on top', () => {
    let made = fresh(CUPCAKE);
    const rand = seeded(5);
    expect(untouched(made)).toBe(true);
    expect(pick(made, CUPCAKE.steps[0], 'pink-wrapper')).toBe(true);
    // A pick is not a touch: the recipe's first line is still due.
    expect(untouched(made)).toBe(true);
    while (stepOf(CUPCAKE, made) !== EAT) made = next(CUPCAKE, made, rand);
    expect(untouched(made)).toBe(false);
    expect(made.picked.wrapper).toBe('pink-wrapper');
    expect(made.poured).toEqual({ batter: 1, frosting: 1 });
    expect(made.cooked.oven).toBe(1);
    expect(made.bits.sprinkles.length).toBeGreaterThanOrEqual(SPRINKLES.enough);
    expect(made.bits.sprinkles.length).toBeLessThanOrEqual(SPRINKLES.most);
    for (const b of made.bits.sprinkles) expect(inArea(CUPCAKE, b.x, b.y)).toBe(true);
    expect(made.placed.toppers).toBeUndefined();
  });

  it('finishing the sprinkles keeps the ones a kid shook on', () => {
    const made = fresh(CUPCAKE), rand = seeded();
    for (let i = 0; i < 40; i++) sprinkle(CUPCAKE, made, SPRINKLES, ON_FROSTING, rand);
    const mine = [...made.bits.sprinkles];
    finish(CUPCAKE, made, SPRINKLES, rand);
    expect(made.bits.sprinkles).toEqual(mine);
  });

  it('a sample for the tile is finished, has something on top, and is the same every time', () => {
    for (const recipe of [PIZZA, CUPCAKE]) {
      const a = sample(recipe, seeded(7));
      expect(a.step, recipe.id).toBe(recipe.steps.length - 1);
      const placeStep = recipe.steps.find((s) => s.verb === 'place')!;
      expect(a.placed[placeStep.id].length, recipe.id).toBeGreaterThan(2);
      expect(Object.keys(a.bites), recipe.id).toEqual([]);
      expect(sample(recipe, seeded(7)), recipe.id).toEqual(a);
    }
  });

  it('what is saved comes back as it was', () => {
    const made = sample(CUPCAKE, seeded(2));
    made.poured.frosting = 0.5;
    bite(CUPCAKE, made, EAT, ON_FROSTING);
    expect(readMade(JSON.parse(JSON.stringify(made)), CUPCAKE)).toEqual(made);
    // A pizza's file is not a cupcake.
    expect(readMade(JSON.parse(JSON.stringify(made)), PIZZA)).toEqual(fresh(PIZZA));
  });
});
