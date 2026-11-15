import { expect, test, type Page } from '@playwright/test';
import { openParentArea } from './helpers';

// The driving game prototype (ADR 0021). Checks read the running simulation, not pixels: free driving can't be
// compared picture by picture.

// The browser tests draw in software, and the toy look (ADR 0025) is heavy there: one test at a time, with time
// to spare.
test.describe.configure({ mode: 'serial', timeout: 90_000 });

interface CarState { x: number; z: number; speed: number; heading: number }

function car(page: Page): Promise<CarState> {
  return page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { cars: CarState[] } };
    const c = canvas.drivingWorld!.cars[0];
    return { x: c.x, z: c.z, speed: c.speed, heading: c.heading };
  });
}

/** Opens the app. Driving shows by default (owner, 2026-11-15), so there is nothing to turn on. */
async function turnOnDriving(page: Page): Promise<void> {
  await page.goto('/');
}

/** Opens the game and picks a vehicle on the picker (milestone-3 B5), then waits for the island. */
async function openDriving(page: Page, vehicle = 'Car'): Promise<void> {
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  await expect(page.locator('.driving-picker')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  await page.getByRole('button', { name: vehicle, exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
}

test('the game opens on a vehicle picker; the pick drives, and is remembered next time', async ({ page }) => {
  await turnOnDriving(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  const picker = page.locator('.driving-picker');
  await expect(picker).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  // Fourteen vehicles (ADR 0035) on three pages: "more" to go on, "back a page" to go back (playtest, 2026-11-15).
  const more = page.getByRole('button', { name: 'More', exact: true });
  const less = page.getByRole('button', { name: 'Back a page', exact: true });
  await expect(picker.locator('.vehicle-tile')).toHaveCount(6);
  await expect(less).toHaveCount(0);
  await more.tap();
  await expect(page.getByRole('button', { name: 'Ambulance', exact: true })).toBeVisible();
  await expect(less).toBeVisible();
  await more.tap();
  await expect(page.getByRole('button', { name: 'Race car', exact: true })).toBeVisible();
  await expect(more).toHaveCount(0);
  await less.tap();
  await less.tap();
  // The pictures are drawn after the picker shows, one at a time; the car is picked to begin with.
  await expect(picker).toHaveAttribute('data-pictures', 'true', { timeout: 60_000 });
  await expect(picker.locator('.vehicle-tile img').first()).toHaveAttribute('src', /^data:image\/png/);
  await expect(page.getByRole('button', { name: 'Car', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'School bus', exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  const kinds = await page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { cars: { kind: string }[] } };
    return canvas.drivingWorld!.cars.map((c) => c.kind);
  });
  // The kid drives the bus; the car takes the bus's place in traffic.
  expect(kinds[0]).toBe('bus');
  expect(kinds.slice(1)).not.toContain('bus');
  expect(kinds.slice(1)).toContain('car');

  // Back returns to the picker (playtest, 2026-11-15), with the bus picked; the picker's Back goes home.
  await page.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(page.locator('.driving-picker')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  await expect(page.locator('.driving')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'School bus', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});

test('the driving game shows on the home screen by default, and a parent can hide it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Driving', exact: true })).toBeVisible();

  // Hidden again: one game on, so straight into coloring, no home screen (ADR 0012).
  await page.goto('/');
  await openParentArea(page);
  await page.getByText('Show Driving').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="game-coloring"]')).toBeVisible();
});

test('a touch drives the car to that spot and it stops there; lifting early stops it too', async ({ page }) => {
  // Two drives in one test. On CI's software graphics game time runs about ten times slower than the clock (the
  // loop catches up at most five steps a frame), so this test gets more time than the others.
  test.setTimeout(240_000);
  await turnOnDriving(page);
  await openDriving(page);
  const start = await car(page);
  const box = (await page.locator('.driving-canvas').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y, id: 1, radiusX: 4, radiusY: 4 });

  // Hold a finger on the ground a little ahead and to the right (ADR 0031): the car turns right, goes, and stops on
  // the spot while the finger is still down. A near spot keeps the drive short in game time.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0.7, 0.55)] });
  await expect.poll(async () => (await car(page)).speed, { timeout: 60_000 }).toBeGreaterThan(4);
  expect((await car(page)).heading).toBeLessThan(start.heading); // turning right
  await expect.poll(async () => (await car(page)).speed, { timeout: 90_000 }).toBe(0);
  const there = await car(page);
  expect(Math.hypot(there.x - start.x, there.z - start.z)).toBeGreaterThan(5);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // Touch the sky far ahead, then lift before it gets there: it rolls to a stop.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0.5, 0.1)] });
  await expect.poll(async () => (await car(page)).speed, { timeout: 60_000 }).toBeGreaterThan(4);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect.poll(async () => (await car(page)).speed, { timeout: 60_000 }).toBe(0);
});

test('arrow keys and WASD drive; back returns to the picker, then home', async ({ page }) => {
  await turnOnDriving(page);
  await openDriving(page);

  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await car(page)).speed).toBeGreaterThan(4);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('ArrowDown');
  await expect.poll(async () => (await car(page)).speed).toBe(0);
  await page.keyboard.up('ArrowDown');

  await page.keyboard.down('ArrowUp');
  await page.keyboard.down('ArrowLeft');
  const before = (await car(page)).heading;
  await expect.poll(async () => (await car(page)).heading).toBeGreaterThan(before + 0.3);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('ArrowUp');

  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.locator('.driving-picker')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
});

test('a parent sets a kid to "follows the road"', async ({ page }) => {
  await turnOnDriving(page);
  await openParentArea(page);
  await page.getByRole('button', { name: 'Driving', exact: true }).click();
  const group = page.getByRole('group', { name: 'Driving help for Star' });
  await group.getByRole('button', { name: 'Follows the road' }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();

  await openDriving(page);
  const assist = await page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { assist: string } };
    return canvas.drivingWorld!.assist;
  });
  expect(assist).toBe('road');
});

test('the picker has the maps along the top: a tap rings one, and a vehicle drives off there (ADR 0035)', async ({ page }) => {
  await turnOnDriving(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  await expect(page.locator('.driving-picker')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('.map-tile')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Island', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Building site', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Building site', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Car', exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  const map = await page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { map: { id: string } } };
    return canvas.drivingWorld!.map.id;
  });
  expect(map).toBe('site');

  // Coming back in, the building site is ringed.
  await page.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(page.locator('.driving-picker')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Building site', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
