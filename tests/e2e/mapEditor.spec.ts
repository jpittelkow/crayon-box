import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

// The map editor (tools/map-editor.html), a dev tool: it opens a map, a road's point can be dragged, a road dragged
// into the sea shows as a problem, and the saved file is one the game would load (maps/file.ts and maps/check.ts, run
// in the page on the file's text). The editing itself is unit-tested in src/tools/mapEdit.test.ts.

// Checking a map builds the game's world: slow in CI's software graphics, so waits get time to spare.
test.describe.configure({ timeout: 180_000 });
const SLOW = { timeout: 60_000 };

const checked = (page: Page) => page.waitForFunction(() => window.mapEditor?.checked === true, null, SLOW);

async function drag(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
}

test('the map editor opens a map, moves a road point, shows a road in the sea, and saves a file the game would load', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/tools/map-editor.html?map=island');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', SLOW);
  await checked(page);
  await expect(page.locator('#problems')).toContainText('None');

  // Click road 2 (the spur from the west of the loop to the roundabout) to show its control points.
  const before = await page.evaluate(() => window.mapEditor!.doc.map.roads[2]!.points);
  // A spot on it clear of the stars, stacks and puddles placed along it (a click there would select those).
  const spot = await page.evaluate(() => {
    const ed = window.mapEditor!;
    const pts = ed.doc.map.roads[2]!.points;
    for (let k = Math.floor(pts.length * 0.4); k < pts.length; k++) {
      const xy = ed.pageXY(...pts[k]!);
      const item = ed.itemAt(...xy);
      if (item?.type === 'road' && item.i === 2) return xy;
    }
    return null;
  });
  expect(spot).not.toBeNull();
  await page.mouse.click(...spot!);
  await expect(page.locator('#what')).toHaveText('road 2');
  const handles = await page.evaluate(() => window.mapEditor!.handlesXY());
  expect(handles.length).toBeGreaterThanOrEqual(3);

  // Its second point dragged a little way: the road follows, and the map still has no problems.
  const point = handles[1]!;
  await drag(page, point, [point[0] + 12, point[1] - 8]);
  await expect(page.locator('#what')).toHaveText('road 2, point 1');
  const moved = await page.evaluate(() => window.mapEditor!.doc.map.roads[2]!.points);
  expect(moved).not.toEqual(before);
  await checked(page);
  await expect(page.locator('#problems')).toContainText('None');

  // The same point dragged out into the sea south of the island: a problem, listed and ringed on the map.
  const sea = await page.evaluate(() => window.mapEditor!.pageXY(20, -120));
  const box = (await page.locator('#stage').boundingBox())!;
  expect(sea[0] > box.x && sea[0] < box.x + box.width && sea[1] > box.y && sea[1] < box.y + box.height).toBe(true);
  const [px, py] = (await page.evaluate(() => window.mapEditor!.handlesXY()))[1]!;
  await drag(page, [px, py], sea);
  await checked(page);
  await expect(page.locator('#problems .problem').filter({ hasText: 'roads[2] runs into the sea' })).toHaveCount(1, SLOW);
  expect(Number(await page.locator('#stage').getAttribute('data-problems'))).toBeGreaterThan(0);

  // Undo takes it back out of the sea.
  await page.getByRole('button', { name: 'Undo' }).click();
  await checked(page);
  await expect(page.locator('#problems')).toContainText('None');
  expect(await page.evaluate(() => window.mapEditor!.doc.map.roads[2]!.points)).toEqual(moved);

  // Saved: a map file with the moved road, which the game's own reading and checks accept.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save map file' }).click()]);
  expect(download.suggestedFilename()).toBe('island.json');
  const text = await readFile((await download.path())!, 'utf8');
  const file = JSON.parse(text);
  expect(file).toMatchObject({ format: 'crayon-box-map', version: 1, name: 'Island' });
  expect(file.map.roads[2].points).toEqual(moved);
  expect(await page.evaluate((t) => window.mapEditor!.checkFile(t), text)).toEqual([]);
  expect(errors).toEqual([]);
});
