import { expect, test, type Page } from '@playwright/test';
import { fresh, type Made } from '../../src/games/kitchen/make/made';
import { PIZZA } from '../../src/games/kitchen/recipes/pizza';
import { clips, openParentArea, pick, recordSounds } from './helpers';

// Kitchen (ADR 0044): a pizza made step by step with the fingers. The rules have unit tests
// (src/games/kitchen/kitchen.test.ts); these check the screen: touches reach the right step, next and back work,
// and what is being made is kept.

type Pt = { x: number; y: number };

/** Opens the app. Kitchen shows on the home screen by default (ADR 0045). */
async function openApp(page: Page): Promise<void> {
  await page.goto('/');
}

/** Writes the Star kid's pizza in progress straight into the app's storage (it is read when Kitchen opens). */
async function seedPizza(page: Page, made: Made): Promise<void> {
  await expect(page.getByRole('button', { name: 'Star kid' })).toBeVisible();
  await page.evaluate(async (made) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('crayon-box');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put({ kind: 'json', json: JSON.stringify(made) }, 'games/kitchen/kids/star/making/pizza.json');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, made);
}

const counter = (page: Page) => page.locator('[data-screen="kitchen-counter"]');
const onStep = (page: Page, id: string) => expect(counter(page)).toHaveAttribute('data-step', id);
const progress = async (page: Page) => Number(await counter(page).getAttribute('data-progress'));

const start = (page: Page) => page.locator('[data-screen="kitchen-start"]');

/** Picks the Star kid, opens Kitchen, and picks a thing to make from its start screen. */
async function openKitchen(page: Page, thing: 'Pizza' | 'Cupcake' = 'Pizza'): Promise<void> {
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).tap();
  await expect(start(page)).toBeVisible();
  await start(page).getByRole('button', { name: thing, exact: true }).tap();
  await expect(counter(page)).toBeVisible();
}

/** One finger held still at a place for a while, with raw touch events. */
async function hold(page: Page, at: Pt, ms: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const s = await toScreen(page, at);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s.x, y: s.y, id: 1, radiusX: 4, radiusY: 4 }] });
  await page.waitForTimeout(ms);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** The pizza's own units (0,0 is its middle, 250 its edge) to viewport coordinates. */
async function toScreen(page: Page, p: Pt): Promise<Pt> {
  const box = await page.locator('.kitchen-canvas').boundingBox();
  if (!box) throw new Error('No counter on screen');
  const unit = Math.min(box.width, box.height) / 720;
  return { x: box.x + box.width / 2 + p.x * unit, y: box.y + box.height / 2 + p.y * unit };
}

async function tapAt(page: Page, p: Pt): Promise<void> {
  const s = await toScreen(page, p);
  await page.touchscreen.tap(s.x, s.y);
}

/** One finger along a path, with raw touch events; `radius` is the finger's size (a palm is big). */
async function rub(page: Page, path: Pt[], radius = 4): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const screen = await Promise.all(path.map((p) => toScreen(page, p)));
  const at = (p: Pt) => [{ x: p.x, y: p.y, id: 1, radiusX: radius, radiusY: radius }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(screen[0]) });
  for (const p of screen.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(p) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** A zigzag over the whole pizza, a point every 40 units. */
function zigzag(): Pt[] {
  const path: Pt[] = [];
  for (let row = 0, y = -180; y <= 180; y += 60, row++) {
    for (let x = -180; x <= 180; x += 40) path.push({ x: row % 2 ? -x : x, y });
  }
  return path;
}

/**
 * Taps the next arrow where it is. It pulses once a step is done enough, and `tap()` would wait for it to hold
 * still; a finger doesn't. The pulse grows from the middle, so the middle stays put.
 */
async function next(page: Page): Promise<void> {
  const box = await page.getByRole('button', { name: 'Next', exact: true }).boundingBox();
  if (!box) throw new Error('No next arrow on screen');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('a pizza made by hand: dough, sauce, cheese, toppings, the oven, a bite, and it is kept', async ({ page }) => {
  // The whole pizza in one test, with four seconds of oven in the middle: longer than the usual 30 s when the
  // machine is busy with the rest of the suite.
  test.setTimeout(90_000);
  await openApp(page);
  await openKitchen(page);

  // No words on a kid screen (ADR 0003 rule 1).
  expect((await counter(page).innerText()).trim()).toBe('');

  // Dough: every pat squashes it; eight make it flat. A palm does nothing.
  await onStep(page, 'dough');
  await rub(page, [{ x: 0, y: 0 }], 60);
  expect(await progress(page)).toBe(0);
  const dough = PIZZA.steps[0];
  const pats = dough.verb === 'press' ? dough.pats : 0;
  expect(pats).toBeGreaterThan(0);
  for (let i = 0; i < pats; i++) {
    await expect(counter(page)).toHaveAttribute('data-done', 'false');
    await tapAt(page, { x: 20 * i - 60, y: 0 });
  }
  await expect(counter(page)).toHaveAttribute('data-done', 'true');
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveClass(/is-ready/);

  // Sauce: three in the rail, tomato picked; a pick fires on the touch; rubbing covers the base.
  await next(page);
  await onStep(page, 'sauce');
  const sauces = page.getByRole('group', { name: 'Sauces' }).getByRole('button');
  await expect(sauces).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Tomato sauce' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Green sauce' }).tap();
  await expect(page.getByRole('button', { name: 'Green sauce' })).toHaveAttribute('aria-pressed', 'true');
  await rub(page, zigzag());
  await expect(counter(page)).toHaveAttribute('data-done', 'true');

  // Cheese: it falls where the finger goes.
  await next(page);
  await onStep(page, 'cheese');
  await expect(page.getByRole('group', { name: 'Sauces' })).toBeHidden();
  await rub(page, zigzag());
  await expect(counter(page)).toHaveAttribute('data-done', 'true');

  // Toppings: eight in the rail; a touch drops the picked one; off the pizza it misses.
  await next(page);
  await onStep(page, 'toppings');
  await expect(page.getByRole('group', { name: 'Toppings' }).getByRole('button')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'Pepperoni' })).toHaveAttribute('aria-pressed', 'true');
  await tapAt(page, { x: 0, y: 0 });
  await expect(counter(page)).toHaveAttribute('data-count', '1');
  await page.getByRole('button', { name: 'Mushroom' }).tap();
  await tapAt(page, { x: 90, y: -60 });
  await tapAt(page, { x: 300, y: 0 });
  await expect(counter(page)).toHaveAttribute('data-count', '2');
  // A drag drops a trail, one every 70 units.
  await rub(page, [-160, -120, -80, -40, 0, 40, 80, 120, 160].map((x) => ({ x, y: 110 })));
  await expect(counter(page)).toHaveAttribute('data-count', '7');

  // The oven bakes by itself, then the pizza is on the plate.
  await next(page);
  await onStep(page, 'oven');
  await expect(counter(page)).toHaveAttribute('data-step', 'eat', { timeout: 30_000 });

  // A bite, then away and back: the pizza is as it was left.
  await tapAt(page, { x: 200, y: 0 });
  await expect.poll(() => progress(page)).toBeGreaterThan(0);
  const eaten = await progress(page);
  await pick(page, 'Back');
  // Back on the counter is the start screen, not the home screen.
  await expect(start(page)).toBeVisible();
  await start(page).getByRole('button', { name: 'Pizza', exact: true }).tap();
  await onStep(page, 'eat');
  expect(await progress(page)).toBe(eaten);
});

test('the start screen has a tile for each thing to make, and its back leaves the game', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Kitchen', exact: true }).tap();
  await expect(start(page).getByRole('button', { name: 'Pizza', exact: true })).toBeVisible();
  await expect(start(page).getByRole('button', { name: 'Cupcake', exact: true })).toBeVisible();
  expect((await start(page).innerText()).trim()).toBe('');
  await page.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});

test('a cupcake made by hand: a wrapper, batter, the oven, frosting, sprinkles, a topper, a bite, and it is kept', async ({ page }) => {
  test.setTimeout(90_000);
  await openApp(page);
  await openKitchen(page, 'Cupcake');
  const ON_FROSTING = { x: 0, y: -80 }, ON_WRAPPER = { x: 0, y: 150 };

  // A wrapper: only a pick, so it is done at once.
  await onStep(page, 'wrapper');
  await expect(page.getByRole('group', { name: 'Wrappers' }).getByRole('button')).toHaveCount(4);
  await expect(counter(page)).toHaveAttribute('data-done', 'true');
  await page.getByRole('button', { name: 'Pink wrapper' }).tap();
  await expect(page.getByRole('button', { name: 'Pink wrapper' })).toHaveAttribute('aria-pressed', 'true');

  // Batter: each touch pours a splash, wherever it lands; ten fill it.
  await next(page);
  await onStep(page, 'batter');
  await tapAt(page, ON_WRAPPER);
  await expect.poll(() => progress(page)).toBe(10);
  for (let i = 0; i < 9; i++) await tapAt(page, { x: 200, y: -200 });
  await expect(counter(page)).toHaveAttribute('data-done', 'true');

  // The oven bakes by itself; then the frosting, squeezed on by a held finger.
  await next(page);
  await onStep(page, 'oven');
  await expect(counter(page)).toHaveAttribute('data-step', 'frosting', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Chocolate frosting' }).tap();
  await hold(page, ON_FROSTING, 1200);
  const squeezed = await progress(page);
  expect(squeezed).toBeGreaterThan(20);
  expect(squeezed).toBeLessThan(100);
  await hold(page, ON_FROSTING, 2600);
  await expect(counter(page)).toHaveAttribute('data-done', 'true');

  // Sprinkles land on the frosting only.
  await next(page);
  await onStep(page, 'sprinkles');
  await rub(page, [{ x: -60, y: 160 }, { x: 60, y: 160 }]);
  expect(await progress(page)).toBe(0);
  await rub(page, [...[-90, -60, -30, 0, 30, 60, 90].map((x) => ({ x, y: -78 })), ...[100, 60, 20, -20, -60, -100].map((x) => ({ x, y: -24 })), ...[-50, 0, 50].map((x) => ({ x, y: -128 }))]);
  await expect(counter(page)).toHaveAttribute('data-done', 'true');

  // A topper: on the frosting it lands, on the wrapper it misses.
  await next(page);
  await onStep(page, 'toppers');
  await expect(page.getByRole('group', { name: 'Toppers' }).getByRole('button')).toHaveCount(8);
  await tapAt(page, { x: 0, y: -150 });
  await tapAt(page, ON_WRAPPER);
  await expect(counter(page)).toHaveAttribute('data-count', '1');

  // A bite, then away and back: the cupcake is as it was left, and the pizza is its own thing.
  await next(page);
  await onStep(page, 'eat');
  await tapAt(page, ON_WRAPPER);
  await expect.poll(() => progress(page)).toBeGreaterThan(0);
  const eaten = await progress(page);
  await pick(page, 'Back');
  await start(page).getByRole('button', { name: 'Pizza', exact: true }).tap();
  await onStep(page, 'dough');
  await pick(page, 'Back');
  await start(page).getByRole('button', { name: 'Cupcake', exact: true }).tap();
  await onStep(page, 'eat');
  expect(await progress(page)).toBe(eaten);
});

test('next on an untouched pizza: every step does itself, and the last next starts again', async ({ page }) => {
  await openApp(page);
  await openKitchen(page);
  for (const id of ['dough', 'sauce', 'cheese', 'toppings']) {
    await onStep(page, id);
    await next(page);
  }
  await onStep(page, 'oven');
  // Next in the oven doesn't wait for it.
  await next(page);
  await onStep(page, 'eat');
  expect(await progress(page)).toBe(0);
  await next(page);
  await onStep(page, 'dough');
  expect(await progress(page)).toBe(0);
});

test('every game shows by default, and the home screen keeps all four tiles on the screen', async ({ page }) => {
  // Two visits and the parent gate between them: more than the usual 30 s when the machine is busy.
  test.setTimeout(60_000);
  await openApp(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  const home = page.locator('[data-screen="home"]');
  await expect(home).toBeVisible();
  const view = page.viewportSize()!;
  const boxes: { x: number; y: number; width: number; height: number }[] = [];
  for (const name of ['Coloring', 'Driving', 'Letters', 'Kitchen']) {
    const tile = home.getByRole('button', { name, exact: true });
    await tile.hover(); // waits until the screen has stopped sliding in
    const box = (await tile.boundingBox())!;
    expect(box.x, name).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, name).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height, name).toBeLessThanOrEqual(view.height);
    boxes.push(box);
  }
  // Four games: big picture tiles, two across and two down (ADR 0047), each filled by its picture.
  expect(boxes[1].y).toBe(boxes[0].y);
  expect(boxes[1].x).toBeGreaterThan(boxes[0].x + boxes[0].width);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
  expect(boxes[3].y).toBe(boxes[2].y);
  expect(boxes[0].width).toBeGreaterThan(400);
  const picture = (await home.getByRole('button', { name: 'Kitchen', exact: true }).locator('svg').boundingBox())!;
  expect(picture.width).toBeGreaterThan(boxes[3].width - 20);
  expect(picture.height).toBeGreaterThan(boxes[3].height - 20);
  // The back button and the lock stay clear of the tiles.
  const apart = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
  const back = (await home.getByRole('button', { name: 'Back', exact: true }).boundingBox())!;
  const lock = (await home.getByRole('button', { name: 'Grown-ups: press and hold' }).boundingBox())!;
  for (const box of boxes) {
    expect(apart(back, box)).toBe(true);
    expect(apart(lock, box)).toBe(true);
  }

  // A parent can hide Kitchen.
  await page.goto('/');
  await openParentArea(page);
  await page.getByText('Show Kitchen').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(home.getByRole('button', { name: 'Coloring', exact: true })).toBeVisible();
  await expect(home.getByRole('button', { name: 'Kitchen', exact: true })).toHaveCount(0);
});

test('the narrator: a line as a step opens, and a picked thing named for its first three picks', async ({ page }) => {
  await recordSounds(page);
  await openApp(page);
  await openKitchen(page);
  // A new pizza: the recipe's line, then the step's.
  await expect.poll(() => clips(page, 'cook-lets-make-pizza')).toBe(1);
  await expect.poll(() => clips(page, 'cook-pat-dough')).toBe(1);

  // Next tapped quickly: only the step the kid lands on is said, not a queue of the ones skipped.
  await next(page);
  await next(page);
  await next(page);
  await onStep(page, 'toppings');
  await expect.poll(() => clips(page, 'cook-pick-topping')).toBe(1);
  expect(await clips(page, 'cook-sprinkle-cheese')).toBe(0);

  // A pick says the thing's name, cutting in; the fourth pick of the same thing is only its sound (ADR 0038).
  const pickIt = (name: string) => page.getByRole('button', { name, exact: true }).tap();
  for (let i = 1; i <= 3; i++) {
    await pickIt('Mushroom');
    await expect.poll(() => clips(page, 'food-mushroom')).toBe(i);
    await pickIt('Olive');
    await expect.poll(() => clips(page, 'food-olive')).toBe(i);
  }
  await pickIt('Mushroom');
  await pickIt('Basil');
  await expect.poll(() => clips(page, 'food-basil')).toBe(1);
  expect(await clips(page, 'food-mushroom')).toBe(3);

  // The oven says when it is ready, and the empty plate ends on one of its lines.
  await next(page);
  await expect.poll(() => clips(page, 'cook-ready'), { timeout: 20_000 }).toBe(1);
});

test('eating it all leaves an empty plate, then a new lump of dough', async ({ page }) => {
  await page.goto('/');
  const made = fresh(PIZZA);
  made.step = PIZZA.steps.length - 1;
  made.pressed.dough = 1;
  made.cooked.oven = 1;
  await seedPizza(page, made);
  await openApp(page);
  await openKitchen(page);
  await onStep(page, 'eat');
  bites: for (let y = -225; y <= 225; y += 75) {
    for (let x = -225; x <= 225; x += 75) {
      if ((await counter(page).getAttribute('data-step')) !== 'eat') break bites;
      await tapAt(page, { x, y });
    }
  }
  await onStep(page, 'dough');
  await expect(counter(page)).toHaveAttribute('data-progress', '0');
});
