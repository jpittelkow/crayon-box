import { expect, test } from '@playwright/test';
import { openParentArea } from './helpers';

// Maps from the device's maps folder (ADR 0043). The browser has no folder; on the dev server `?fake-maps` stands in
// for it (`src/shell/fakeMapsFolder.ts`) with the generic example map and a file that isn't a map.

// The picker test draws the folder map's picture and drives it, in software graphics: one at a time, with time
// to spare (as in driving.spec.ts).
test.describe.configure({ mode: 'serial', timeout: 180_000 });
const SLOW = { timeout: 60_000 };

async function openDrivingSettings(page: import('@playwright/test').Page): Promise<void> {
  await openParentArea(page);
  await page.getByRole('navigation', { name: 'Parent area' }).getByRole('button', { name: 'Driving', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Driving', level: 1 })).toBeVisible();
}

test('the parent Driving screen lists folder maps with a switch, and says why a file was left out', async ({ page }) => {
  await page.goto('/?fake-maps');
  await openDrivingSettings(page);
  await expect(page.getByRole('heading', { name: 'Maps from the folder' })).toBeVisible();
  const map = page.locator('[data-folder-map="test-loop.json"]');
  await expect(map).toContainText('Test loop');
  await expect(map.getByRole('switch')).toBeChecked();
  const problem = page.locator('[data-map-problem="broken.json"]');
  await expect(problem).toHaveText('broken.json was left out. map: needs to be an object { }.');
  await expect(problem).toHaveAttribute('role', 'alert');

  // The switch is kept (on this device), and the folder opens.
  await map.getByRole('switch').click();
  await page.getByRole('button', { name: 'Open the maps folder' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fakeMapsOpened?: number }).__fakeMapsOpened)).toBe(1);
  const nav = page.getByRole('navigation', { name: 'Parent area' });
  await expect(async () => {
    await nav.getByRole('button', { name: 'Settings', exact: true }).click();
    await nav.getByRole('button', { name: 'Driving', exact: true }).click();
    await expect(page.locator('[data-folder-map="test-loop.json"]').getByRole('switch')).not.toBeChecked({ timeout: 2000 });
  }).toPass();
});

test('a file the test puts in the folder shows its own problem; the browser without a folder shows nothing', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __fakeMaps: { name: string; text: string }[] }).__fakeMaps = [
      { name: 'newer.json', text: JSON.stringify({ format: 'crayon-box-map', version: 2, name: 'Newer', map: {} }) },
    ];
  });
  await page.goto('/?fake-maps');
  await openDrivingSettings(page);
  await expect(page.locator('[data-map-problem="newer.json"]')).toContainText('made for a newer version of the app');
  await expect(page.locator('[data-folder-map]')).toHaveCount(0);

  await page.goto('/');
  await openDrivingSettings(page);
  await expect(page.getByRole('heading', { name: 'Vehicles' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maps from the folder' })).toHaveCount(0);
});

test('a folder map joins the picker after the built-in maps, with its picture, and drives', async ({ page }) => {
  await page.goto('/?fake-maps');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Driving', exact: true }).tap();
  const picker = page.locator('.driving-picker');
  await expect(picker).toHaveAttribute('data-ready', 'true', { timeout: 40_000 });
  await expect(picker.locator('.map-tile')).toHaveCount(3);
  await expect(picker.locator('.map-tile').nth(2)).toHaveAttribute('data-map', 'folder:test-loop');
  // Its picture is drawn on the device (none ships for it), like a built-in map's would be if it were missing.
  await expect(picker).toHaveAttribute('data-pictures', 'true', SLOW);
  await expect(picker.locator('.map-tile[data-map="folder:test-loop"] img')).toHaveAttribute('src', /^data:image\/png/);
  // Three tiles share the row, inside the screen.
  const boxes = await picker.locator('.map-tile').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
  expect(Math.max(...boxes)).toBeLessThan(1280);

  await page.getByRole('button', { name: 'Test loop', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Test loop', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Car', exact: true }).tap();
  await expect(page.locator('.driving')).toHaveAttribute('data-ready', 'true', SLOW);
  const id = await page.evaluate(() => {
    const canvas = document.querySelector('.driving-canvas') as HTMLCanvasElement & { drivingWorld?: { map: { id: string } } };
    return canvas.drivingWorld!.map.id;
  });
  expect(id).toBe('folder:test-loop');
});
