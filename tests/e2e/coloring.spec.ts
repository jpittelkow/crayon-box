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
  await expect(page.locator('[data-screen="page-picker"]')).toBeVisible();
  await expect(page.locator('[data-page]')).toHaveCount(3);
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#app')).toHaveCSS('background-color', 'rgb(232, 220, 250)'); // kid-purple-tint
  await expect(page.locator('#app')).toHaveText('');
  // All 24 swatches on screen at the minimum target size (ADR 0003, 0016).
  const swatches = page.locator('.color-rail button');
  await expect(swatches).toHaveCount(24);
  for (const box of await swatches.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
    expect(box.width).toBeGreaterThanOrEqual(80);
    expect(box.bottom).toBeLessThanOrEqual(800);
  }

  await pick(page, 'Back to the pages');
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

  await pick(page, 'Back to the pages');
  // The started page shows the kid's coloring under its lines.
  await expect(page.getByRole('button', { name: SHAPES.title }).locator('img')).toHaveCount(2);

  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expectPaint(page, SHAPES.inCircle, RED);
  await expect(page.getByRole('button', { name: 'Stay in the lines' })).toHaveAttribute('aria-pressed', 'true');

  // Another kid's pages are their own.
  await pick(page, 'Back to the pages');
  await pick(page, 'Back');
  await openShapesPageFor(page, 'Moon kid');
  await expectBlank(page, SHAPES.inCircle);
});

async function openShapesPageFor(page: import('@playwright/test').Page, kid: string) {
  await page.getByRole('button', { name: kid }).tap();
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
}
