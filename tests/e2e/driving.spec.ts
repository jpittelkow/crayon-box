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

async function turnOnDriving(page: Page): Promise<void> {
  await page.goto('/');
  await openParentArea(page);
  await page.getByText('Show Driving').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
}

async function openDriving(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
}

test('the driving game stays hidden until a parent turns it on', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  // One game on: straight into coloring, no home screen (ADR 0012).
  await expect(page.locator('[data-screen="game-coloring"]')).toBeVisible();

  await turnOnDriving(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Driving', exact: true })).toBeVisible();
});

test('a touch drives the car toward the finger, and lifting stops it', async ({ page }) => {
  await turnOnDriving(page);
  await openDriving(page);
  const start = await car(page);
  const box = (await page.locator('.driving-canvas').boundingBox())!;

  // Hold a finger on the right of the picture.
  const cdp = await page.context().newCDPSession(page);
  const finger = { x: box.x + box.width * 0.85, y: box.y + box.height * 0.6, id: 1, radiusX: 4, radiusY: 4 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [finger] });
  await expect.poll(async () => (await car(page)).speed).toBeGreaterThan(4);
  const moving = await car(page);
  expect(Math.hypot(moving.x - start.x, moving.z - start.z)).toBeGreaterThan(1);
  expect(moving.heading).toBeLessThan(start.heading); // turning right
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  // Coasting from top speed takes about 3 s of game time. With software WebGL (CI) frames are slow and the loop
  // catches up at most five steps a frame, so game time runs well behind the clock: allow plenty.
  await expect.poll(async () => (await car(page)).speed, { timeout: 30_000 }).toBe(0);
});

test('arrow keys and WASD drive; back returns to the home screen', async ({ page }) => {
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
