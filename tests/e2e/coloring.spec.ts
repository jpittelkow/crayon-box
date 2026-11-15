import { expect, test } from '@playwright/test';
import {
  BLUE,
  RED,
  SHAPES,
  SKY,
  expectBlank,
  expectPaint,
  openShapesPage,
  pick,
  tapPage,
  toScreen,
  touchStrokes,
} from './helpers';

test('the kid picker opens the pages, then a page, on the kid’s color', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  await expect(page.locator('[data-kid]')).toHaveCount(3);
  // No text on kid screens (ADR 0003 rule 1).
  await expect(page.locator('#app')).toHaveText('');

  await page.getByRole('button', { name: 'Heart kid' }).tap();
  // No pictures yet, so the game opens straight on the page library (ADR 0017).
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
  // The theme strip: one button per theme with pages, in theme order, then the blank page (ADR 0016).
  await expect(page.locator('[data-theme]')).toHaveCount(3);
  await expect(page.locator('[data-theme]').first()).toHaveAttribute('data-theme', 'race-cars');
  await expect(page.getByRole('button', { name: 'Blank page' })).toBeVisible();
  await expect(page.locator('[data-page]')).toHaveCount(6); // Race cars: six pages, so no "more" arrow yet
  await page.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Shapes', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(232, 220, 250)'); // kid-purple-tint
  await expect(page.locator('#app')).toHaveText('');
  // All 24 swatches on screen at 64 px (ADR 0003, 0019).
  const swatches = page.locator('.color-rail button');
  await expect(swatches).toHaveCount(24);
  for (const box of await swatches.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
    expect(box.width).toBeGreaterThanOrEqual(64);
    expect(box.bottom).toBeLessThanOrEqual(800);
  }
  // The page takes the room the rails leave: about 840 px wide on the reference screen (ADR 0019).
  const pageBox = (await page.locator('.coloring-page').boundingBox())!;
  expect(pageBox.width).toBeGreaterThanOrEqual(830);
  expect(Math.abs(pageBox.width / pageBox.height - 4 / 3)).toBeLessThan(0.01);

  await pick(page, 'Back');
  await pick(page, 'Back');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
});

test('the bucket fills one region, grows under its line, and never leaks', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await expectPaint(page, SHAPES.underCircleLine, RED);
  await expectBlank(page, SHAPES.outside);
  await expectBlank(page, SHAPES.inSquare);
  await expectBlank(page, SHAPES.between);
});

test('a fill uses the color picked when the finger touched', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  // Touch the page and pick Blue in the same task, so Blue is picked before the worker answers the fill.
  const at = await toScreen(page, SHAPES.inSquare);
  await page.evaluate(({ x, y }) => {
    const touch = (type: string, target: Element, cx: number, cy: number, id: number) =>
      target.dispatchEvent(
        new PointerEvent(type, { clientX: cx, clientY: cy, pointerId: id, pointerType: 'touch', bubbles: true }),
      );
    touch('pointerdown', document.querySelector('.coloring-page')!, x, y, 21);
    const blue = document.querySelector('[data-color="blue"]')!;
    const r = blue.getBoundingClientRect();
    touch('pointerdown', blue, r.x + r.width / 2, r.y + r.height / 2, 22);
    touch('pointerup', blue, r.x + r.width / 2, r.y + r.height / 2, 22);
  }, at);
  await expect(page.getByRole('button', { name: 'Blue', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expectPaint(page, SHAPES.inSquare, RED);
});

test('free coloring crosses lines; stay in the lines keeps a stroke in its region', async ({ page }) => {
  await openShapesPage(page);
  await expect(page.getByRole('button', { name: 'Color anywhere' })).toHaveAttribute('aria-pressed', 'true');
  await pick(page, 'Blue');
  await touchStrokes(page, [[SHAPES.inCircle, SHAPES.between]]);
  await expectPaint(page, SHAPES.inCircle, BLUE);
  await expectPaint(page, SHAPES.between, BLUE);

  await pick(page, 'Undo');
  await expectBlank(page, SHAPES.between);

  await pick(page, 'Stay in the lines');
  await touchStrokes(page, [[SHAPES.inCircle, SHAPES.between]]);
  await expectPaint(page, SHAPES.inCircle, BLUE);
  await expectBlank(page, SHAPES.between);
});

test('the mode switch only affects strokes made after it', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Blue');
  await touchStrokes(page, [[SHAPES.inCircle, SHAPES.between]]);
  await expectPaint(page, SHAPES.between, BLUE);
  await pick(page, 'Stay in the lines');
  await expectPaint(page, SHAPES.between, BLUE);
});

test('the eraser removes paint where it goes', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);

  await pick(page, 'Eraser');
  await pick(page, 'Big brush');
  await touchStrokes(page, [[{ x: 300, y: 800 }, { x: 820, y: 800 }]]);
  await expectBlank(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircleHigh, RED);
});

test('undo steps back one action at a time, and start over can be undone', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Blue');
  await tapPage(page, SHAPES.inSquare);
  await expectPaint(page, SHAPES.inSquare, BLUE);

  await pick(page, 'Undo');
  await expectBlank(page, SHAPES.inSquare);
  await expectPaint(page, SHAPES.inCircle, RED);

  await pick(page, 'Start over');
  await expectBlank(page, SHAPES.inCircle);
  await pick(page, 'Undo');
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Undo');
  await expectBlank(page, SHAPES.inCircle);
});

test('two fingers paint at once', async ({ page }) => {
  await openShapesPage(page);
  await touchStrokes(page, [
    [
      { x: 450, y: 700 },
      { x: 650, y: 700 },
    ],
    [
      { x: 1300, y: 700 },
      { x: 1650, y: 700 },
    ],
  ]);
  await expectPaint(page, { x: 550, y: 700 }, SKY);
  await expectPaint(page, { x: 1500, y: 700 }, SKY);
});

test('a size pick while the bucket is picked switches to the brush', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await expect(page.locator('.sizes')).toHaveClass(/is-faded/);
  await pick(page, 'Small brush');
  await expect(page.getByRole('button', { name: 'Brush', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.sizes')).not.toHaveClass(/is-faded/);
});

test('a picture and its mode are kept when the kid leaves and comes back', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Stay in the lines');

  await pick(page, 'Back');
  // Back in the library, the page is blank again: library tiles are always fresh pages (ADR 0017).
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
  await expect(page.getByRole('button', { name: SHAPES.title }).locator('img')).toHaveCount(1);

  // My pictures has it, drawn as it is now, and opening it continues it in its own mode.
  await pick(page, 'Back');
  await expect(page.locator('[data-screen="coloring-start"]')).toBeVisible();
  await pick(page, 'My pictures');
  const tile = page.getByRole('button', { name: 'Circle, square and triangle picture' });
  await expect(tile.locator('img')).toHaveCount(2);
  await tile.tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expectPaint(page, SHAPES.inCircle, RED);
  await expect(page.getByRole('button', { name: 'Stay in the lines' })).toHaveAttribute('aria-pressed', 'true');

  // Another kid's pictures are their own.
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'Back');
  await page.getByRole('button', { name: 'Moon kid' }).tap();
  await page.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expectBlank(page, SHAPES.inCircle);
});

test('the same page can be colored again as a new picture', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Back');

  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expectBlank(page, SHAPES.inCircle);
  await pick(page, 'Paint bucket');
  await pick(page, 'Blue');
  await tapPage(page, SHAPES.inSquare);
  await expectPaint(page, SHAPES.inSquare, BLUE);
  await pick(page, 'Back');
  await pick(page, 'Back');

  await pick(page, 'My pictures');
  await expect(page.locator('[data-picture]')).toHaveCount(2);
});

test('a page opened and left without painting adds nothing to My pictures', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Back');
  await pick(page, 'Back');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
});

test('the blank page is one big area to fill', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Blank page' }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, { x: 5, y: 5 }, RED);
  await expectPaint(page, { x: 2040, y: 1530 }, RED);
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'My pictures');
  await expect(page.getByRole('button', { name: 'Blank page picture' })).toBeVisible();
});
