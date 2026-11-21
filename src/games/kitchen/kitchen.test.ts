import { describe, expect, it } from 'vitest';
import { optionArt } from './look/art';
import { cells, fresh, GRID, readMade, stepOf, type Made } from './make/made';
import {
  bite,
  cook,
  covered,
  doneEnough,
  eaten,
  finish,
  next,
  pick,
  place,
  press,
  pressedRadius,
  progress,
  spread,
  sprinkle,
  touch,
  type Rand,
} from './make/verbs';
import { railOf, type Recipe, type Step } from './recipe';
import { PIZZA } from './recipes/pizza';

/** The same "random" numbers every run. */
function seeded(seed = 1): Rand {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const step = <V extends Step['verb']>(verb: V) => PIZZA.steps.find((s) => s.verb === verb) as Extract<Step, { verb: V }>;
const DOUGH = step('press'), SAUCE = step('spread'), CHEESE = step('sprinkle'), TOPPINGS = step('place'), OVEN = step('cook'), EAT = step('eat');
const MIDDLE = { x: 0, y: 0 };

describe('the pizza recipe (ADR 0044)', () => {
  it('names only things the game has: unique step ids, rails of at most eight, art for every option', () => {
    const ids = PIZZA.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of PIZZA.steps) {
      const rail = railOf(s);
      if (!rail) continue;
      expect(rail.options.length, s.id).toBeGreaterThan(0);
      expect(rail.options.length, s.id).toBeLessThanOrEqual(8);
      for (const o of rail.options) expect(optionArt(o.id), `${s.id}: ${o.id}`).toBeDefined();
    }
  });

  it('starts as a lump of dough with the first sauce and the first topping picked', () => {
    const made = fresh(PIZZA);
    expect(stepOf(PIZZA, made)).toBe(DOUGH);
    expect(made.picked).toEqual({ sauce: 'tomato-sauce', toppings: 'pepperoni' });
    expect(PIZZA.steps.map((s) => progress(PIZZA, made, s))).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('press: patting the dough', () => {
  it('each pat squashes it flatter, and the set number of pats makes it flat', () => {
    const made = fresh(PIZZA);
    for (let i = 0; i < DOUGH.pats; i++) {
      expect(doneEnough(PIZZA, made, DOUGH)).toBe(false);
      expect(press(PIZZA, made, DOUGH, MIDDLE)).toBe(true);
    }
    expect(made.pressed.dough).toBe(1);
    expect(doneEnough(PIZZA, made, DOUGH)).toBe(true);
    expect(press(PIZZA, made, DOUGH, MIDDLE)).toBe(false);
  });

  it('a pat beside the lump does nothing, and the lump grows as it flattens', () => {
    const made = fresh(PIZZA);
    const beside = { x: pressedRadius(PIZZA, 0) + 60, y: 0 };
    expect(press(PIZZA, made, DOUGH, beside)).toBe(false);
    expect(pressedRadius(PIZZA, 1)).toBe(PIZZA.r);
    expect(pressedRadius(PIZZA, 0)).toBeLessThan(pressedRadius(PIZZA, 0.5));
  });
});

describe('spread: rubbing the sauce on', () => {
  it('covers what is under the finger, only inside the crust', () => {
    const made = fresh(PIZZA);
    expect(spread(PIZZA, made, SAUCE, MIDDLE)).toBe(true);
    const some = covered(PIZZA, made, 'sauce');
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(0.2);
    // The same spot again covers nothing new.
    expect(spread(PIZZA, made, SAUCE, MIDDLE)).toBe(false);
    // On the crust, well outside the inner edge: nothing.
    expect(spread(PIZZA, made, SAUCE, { x: PIZZA.r + 60, y: 0 })).toBe(false);
    const inner = new Set(cells(PIZZA).inner);
    [...made.spread.sauce].forEach((c, i) => {
      if (c === '1') expect(inner.has(i)).toBe(true);
    });
  });

  it('is done enough once most of it is covered', () => {
    const made = fresh(PIZZA);
    for (let y = -200; y <= 200 && !doneEnough(PIZZA, made, SAUCE); y += 40) {
      for (let x = -200; x <= 200; x += 40) spread(PIZZA, made, SAUCE, { x, y });
    }
    expect(doneEnough(PIZZA, made, SAUCE)).toBe(true);
    expect(covered(PIZZA, made, 'sauce')).toBeGreaterThanOrEqual(SAUCE.enough);
  });
});

describe('sprinkle: cheese under the finger', () => {
  it('drops bits near the finger, inside the crust, and keeps only so many', () => {
    const made = fresh(PIZZA), rand = seeded();
    expect(sprinkle(PIZZA, made, CHEESE, { x: 50, y: 40 }, rand)).toBe(true);
    for (const b of made.bits.cheese) expect(Math.hypot(b.x - 50, b.y - 40)).toBeLessThanOrEqual(31);
    expect(sprinkle(PIZZA, made, CHEESE, { x: PIZZA.r + 100, y: 0 }, rand)).toBe(false);
    for (let i = 0; i < 400; i++) sprinkle(PIZZA, made, CHEESE, { x: (i % 20) * 10 - 100, y: 0 }, rand);
    expect(made.bits.cheese.length).toBe(CHEESE.most);
    for (const b of made.bits.cheese) expect(Math.hypot(b.x, b.y)).toBeLessThan(PIZZA.inner);
    expect(doneEnough(PIZZA, made, CHEESE)).toBe(true);
  });
});

describe('place: toppings', () => {
  it('puts the picked topping where the finger is; off the pizza it misses', () => {
    const made = fresh(PIZZA), rand = seeded();
    expect(doneEnough(PIZZA, made, TOPPINGS)).toBe(false);
    expect(place(PIZZA, made, TOPPINGS, { x: 30, y: -40 }, rand)).toBe('placed');
    expect(pick(made, TOPPINGS, 'mushroom')).toBe(true);
    expect(place(PIZZA, made, TOPPINGS, { x: -80, y: 10 }, rand)).toBe('placed');
    expect(place(PIZZA, made, TOPPINGS, { x: PIZZA.r, y: 0 }, rand)).toBe('off');
    expect(made.placed.toppings.map((p) => [p.kind, p.x, p.y])).toEqual([
      ['pepperoni', 30, -40],
      ['mushroom', -80, 10],
    ]);
    expect(doneEnough(PIZZA, made, TOPPINGS)).toBe(true);
  });

  it('a pick the rail does not have is refused, and only so many pieces are kept', () => {
    const made = fresh(PIZZA), rand = seeded();
    expect(pick(made, TOPPINGS, 'anchovy')).toBe(false);
    expect(pick(made, DOUGH, 'pepperoni')).toBe(false);
    expect(made.picked.toppings).toBe('pepperoni');
    for (let i = 0; i < TOPPINGS.most + 5; i++) place(PIZZA, made, TOPPINGS, { x: i, y: 0 }, rand);
    expect(made.placed.toppings.length).toBe(TOPPINGS.most);
    expect(made.placed.toppings[0].x).toBe(5);
  });
});

describe('cook: the oven', () => {
  it('takes its seconds, says so once, and can not overcook', () => {
    const made = fresh(PIZZA);
    expect(cook(made, OVEN, OVEN.seconds / 2)).toBe(false);
    expect(made.cooked.oven).toBeCloseTo(0.5);
    expect(cook(made, OVEN, OVEN.seconds)).toBe(true);
    expect(made.cooked.oven).toBe(1);
    expect(cook(made, OVEN, 1)).toBe(false);
  });
});

describe('eat: bites', () => {
  it('a touch takes a bite; where nothing is left, or off the plate, it takes none', () => {
    const made = fresh(PIZZA);
    expect(bite(PIZZA, made, EAT, MIDDLE)).toBe(true);
    const one = eaten(PIZZA, made, 'eat');
    expect(one).toBeGreaterThan(0);
    expect(bite(PIZZA, made, EAT, MIDDLE)).toBe(false);
    expect(bite(PIZZA, made, EAT, { x: PIZZA.r + EAT.bite + 20, y: 0 })).toBe(false);
    // A bite at the rim takes the edge.
    expect(bite(PIZZA, made, EAT, { x: PIZZA.r, y: 0 })).toBe(true);
    expect(eaten(PIZZA, made, 'eat')).toBeGreaterThan(one);
  });

  it('enough bites finish it, and the list of bites stays bounded', () => {
    const made = fresh(PIZZA);
    for (let y = -250; y <= 250; y += 50) for (let x = -250; x <= 250; x += 50) bite(PIZZA, made, EAT, { x, y });
    expect(doneEnough(PIZZA, made, EAT)).toBe(true);
    expect(made.bites.eat.length).toBeLessThanOrEqual(GRID * GRID);
  });
});

describe('a step skipped does itself (ADR 0044)', () => {
  it('next on an untouched pizza gives a flat base, all the sauce and plenty of cheese, and no toppings', () => {
    let made = fresh(PIZZA);
    const rand = seeded(7);
    made = next(PIZZA, made, rand); // dough → sauce
    expect(made.pressed.dough).toBe(1);
    made = next(PIZZA, made, rand); // sauce → cheese
    expect(covered(PIZZA, made, 'sauce')).toBe(1);
    made = next(PIZZA, made, rand); // cheese → toppings
    expect(made.bits.cheese.length).toBeGreaterThanOrEqual(CHEESE.enough);
    for (const b of made.bits.cheese) expect(Math.hypot(b.x, b.y)).toBeLessThan(PIZZA.inner);
    made = next(PIZZA, made, rand); // toppings → oven
    expect(made.placed.toppings).toBeUndefined();
    expect(stepOf(PIZZA, made)).toBe(OVEN);
    made = next(PIZZA, made, rand); // oven → eat
    expect(made.cooked.oven).toBe(1);
    expect(stepOf(PIZZA, made)).toBe(EAT);
    expect(made.bites.eat).toBeUndefined();
  });

  it('what the kid did is kept: finishing adds to it and never replaces it', () => {
    const made = fresh(PIZZA), rand = seeded();
    for (let i = 0; i < 60; i++) sprinkle(PIZZA, made, CHEESE, { x: -100, y: 0 }, rand);
    const mine = [...made.bits.cheese];
    finish(PIZZA, made, CHEESE, rand);
    expect(made.bits.cheese).toEqual(mine);
  });

  it('next after the last step starts a new one', () => {
    const made = fresh(PIZZA);
    made.step = PIZZA.steps.length - 1;
    made.pressed.dough = 1;
    const again = next(PIZZA, made, seeded());
    expect(again).not.toBe(made);
    expect(again).toEqual(fresh(PIZZA));
  });
});

describe('touch: one finger, whichever step is open', () => {
  it('does the open step and nothing else', () => {
    const made = fresh(PIZZA), rand = seeded();
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('pressed');
    made.step = PIZZA.steps.indexOf(SAUCE);
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('spread');
    made.step = PIZZA.steps.indexOf(CHEESE);
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('sprinkled');
    made.step = PIZZA.steps.indexOf(TOPPINGS);
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('placed');
    expect(touch(PIZZA, made, { x: 400, y: 0 }, rand)).toBe('off');
    made.step = PIZZA.steps.indexOf(OVEN);
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('nothing');
    made.step = PIZZA.steps.indexOf(EAT);
    expect(touch(PIZZA, made, MIDDLE, rand)).toBe('bitten');
    expect(made.pressed.dough).toBeCloseTo(1 / DOUGH.pats);
  });
});

describe('choose: a step that is only a pick', () => {
  const CUP: Recipe = {
    id: 'cup',
    label: 'Cup',
    r: 100,
    inner: 90,
    steps: [
      { id: 'wrapper', label: 'Pick a wrapper', verb: 'choose', rail: { label: 'Wrappers', options: [{ id: 'blue', label: 'Blue' }, { id: 'red', label: 'Red' }] } },
      { id: 'eat', label: 'Eat it', verb: 'eat', bite: 40, enough: 0.9 },
    ],
  };
  it('is always done enough, keeps its pick, and a touch on the thing does nothing', () => {
    const made = fresh(CUP);
    expect(doneEnough(CUP, made, CUP.steps[0])).toBe(true);
    expect(touch(CUP, made, MIDDLE, seeded())).toBe('nothing');
    expect(pick(made, CUP.steps[0], 'red')).toBe(true);
    expect(next(CUP, made, seeded()).picked.wrapper).toBe('red');
  });
});

describe('what is saved (ADR 0024)', () => {
  function busy(): Made {
    const made = fresh(PIZZA), rand = seeded(3);
    finish(PIZZA, made, DOUGH, rand);
    spread(PIZZA, made, SAUCE, MIDDLE);
    pick(made, SAUCE, 'green-sauce');
    sprinkle(PIZZA, made, CHEESE, MIDDLE, rand);
    place(PIZZA, made, TOPPINGS, { x: 10, y: 20 }, rand);
    cook(made, OVEN, 1);
    bite(PIZZA, made, EAT, { x: 200, y: 0 });
    made.step = 3;
    return made;
  }

  it('comes back as it was', () => {
    const made = busy();
    expect(readMade(JSON.parse(JSON.stringify(made)), PIZZA)).toEqual(made);
  });

  it('anything that does not fit is dropped, never thrown on', () => {
    expect(readMade(undefined, PIZZA)).toEqual(fresh(PIZZA));
    expect(readMade('pizza', PIZZA)).toEqual(fresh(PIZZA));
    expect(readMade({ ...busy(), recipe: 'cake' }, PIZZA)).toEqual(fresh(PIZZA));
    expect(readMade({ ...busy(), v: 2 }, PIZZA)).toEqual(fresh(PIZZA));
    const odd = readMade(
      {
        v: 1,
        recipe: 'pizza',
        step: 99,
        pressed: { dough: 7 },
        spread: { sauce: '101' },
        bits: { cheese: [{ x: 'a' }, { x: 1, y: 2, a: 0.5, l: 20 }] },
        placed: { toppings: [{ kind: 'anchovy', x: 0, y: 0, rot: 0 }, { kind: 'olive', x: 5, y: 6, rot: 90 }] },
        picked: { sauce: 'gravy', toppings: 'basil' },
        cooked: { oven: -3 },
        bites: 'lots',
      },
      PIZZA,
    );
    expect(odd.step).toBe(PIZZA.steps.length - 1);
    expect(odd.pressed.dough).toBe(1);
    expect(odd.spread.sauce).toBeUndefined();
    expect(odd.bits.cheese).toEqual([{ x: 1, y: 2, a: 0.5, l: 20 }]);
    expect(odd.placed.toppings).toEqual([{ kind: 'olive', x: 5, y: 6, rot: 90 }]);
    expect(odd.picked).toEqual({ sauce: 'tomato-sauce', toppings: 'basil' });
    expect(odd.cooked.oven).toBeUndefined();
    expect(odd.bites.eat).toBeUndefined();
  });
});
