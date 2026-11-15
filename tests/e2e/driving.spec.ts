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

test('the screen is a joystick: up and right goes and turns right, down backs up, lifting stops', async ({ page }) => {
  // Several drives in one test. On CI's software graphics game time runs about ten times slower than the clock (the
  // loop catches up at most five steps a frame), so this test gets more time than the others.
  test.setTimeout(240_000);
  await turnOnDriving(page);
  await openDriving(page);
  const start = await car(page);
  const box = (await page.locator('.driving-canvas').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const at = (x: number, y: number) => ({ x: box.x + box.width * x, y: box.y + box.height * y, id: 1, radiusX: 4, radiusY: 4 });

  // A finger up and to the right of the middle (ADR 0036): it goes and turns right; the ring and the dot show.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0.8, 0.1)] });
  await expect(page.locator('.driving-stick')).toBeVisible();
  await expect(page.locator('.driving-stick-dot')).toBeVisible();
  await expect.poll(async () => (await car(page)).speed, { timeout: 60_000 }).toBeGreaterThan(4);
  await expect.poll(async () => (await car(page)).heading, { timeout: 60_000 }).toBeLessThan(start.heading - 0.2); // right

  // Slid to the bottom: it brakes, then backs up.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(0.5, 0.95)] });
  await expect.poll(async () => (await car(page)).speed, { timeout: 90_000 }).toBeLessThan(-1);

  // Lifted: it rolls to a stop, and the ring goes.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(page.locator('.driving-stick')).toBeHidden();
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

test('the picker paints the vehicles in a colour the kid picks, and remembers it (playtest, 2026-11-15)', async ({ page }) => {
  await turnOnDriving(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  const picker = page.locator('.driving-picker');
  await expect(picker).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
  await expect(page.locator('.car-color')).toHaveCount(8);
  await expect(page.getByRole('button', { name: 'My colour' })).toHaveAttribute('aria-pressed', 'true');
  await expect(picker).toHaveAttribute('data-pictures', 'true', { timeout: 60_000 });
  const before = await picker.locator('[data-vehicle="car"] img').getAttribute('src');
  await page.getByRole('button', { name: 'Colour 8' }).tap();
  await expect(page.getByRole('button', { name: 'Colour 8' })).toHaveAttribute('aria-pressed', 'true');
  // The pictures are painted again in the new colour.
  await expect(picker).toHaveAttribute('data-pictures', 'true', { timeout: 60_000 });
  expect(await picker.locator('[data-vehicle="car"] img').getAttribute('src')).not.toBe(before);
  // Kept for next time.
  await page.getByRole('button', { name: 'Car', exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  await page.getByRole('button', { name: 'Back', exact: true }).tap();
  await expect(picker).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  await expect(page.getByRole('button', { name: 'Colour 8' })).toHaveAttribute('aria-pressed', 'true');
});

test('a tray in the game swaps the vehicle on the spot (playtest, 2026-11-15)', async ({ page }) => {
  await turnOnDriving(page);
  await openDriving(page);
  const tray = page.locator('.driving-tray');
  await expect(tray).toBeHidden();
  await page.getByRole('button', { name: 'Change vehicle' }).tap();
  await expect(tray).toBeVisible();
  await expect(tray.locator('.driving-tray-tile')).toHaveCount(14);
  await expect(tray.getByRole('button', { name: 'Car', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tray.getByRole('button', { name: 'Digger', exact: true }).tap();
  await expect(tray).toBeHidden();
  const kind = () => page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { cars: { kind: string }[] } };
    return canvas.drivingWorld!.cars[0]!.kind;
  });
  expect(await kind()).toBe('digger');
  // A tap beside the tray closes it without a change.
  await page.getByRole('button', { name: 'Change vehicle' }).tap();
  await expect(tray).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(tray).toBeHidden();
  expect(await kind()).toBe('digger');
});
