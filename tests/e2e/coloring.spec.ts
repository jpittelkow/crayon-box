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
  openColoring,
} from './helpers';

test('the kid picker opens the pages, then a page, on the kid’s color', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  await expect(page.locator('[data-kid]')).toHaveCount(3);
  // No text on kid screens (ADR 0003 rule 1), apart from the app's name, a picture nobody has to read (ADR 0027).
  const text = await page.locator('#app').evaluate((app) => {
    const copy = app.cloneNode(true) as HTMLElement;
    copy.querySelectorAll('.wordmark').forEach((w) => w.remove());
    return copy.textContent;
  });
  expect(text).toBe('');

  await openColoring(page, 'Heart kid');
  // No pictures yet, so the game opens straight on the page library (ADR 0017).
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
  // The theme strip: one button per theme with pages, in theme order, then the blank page (ADR 0016).
  await expect(page.locator('[data-theme]')).toHaveCount(8);
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
  // Through the home screen: Driving shows by default, so there are two games.
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
  await pick(page, 'Back'); // the home screen
  await openColoring(page, 'Moon kid');
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
  // Through the home screen: Driving shows by default, so there are two games.
  await pick(page, 'Back');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  await openColoring(page, 'Star kid');
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
});

test('the blank page is one big area to fill', async ({ page }) => {
  await page.goto('/');
  await openColoring(page, 'Star kid');
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

test('undo after two fingers removes the last stroke whole, even when they overlapped in time', async ({ page }) => {
  await openShapesPage(page);
  // Finger A draws a diagonal; finger B a vertical line. A lifts first while B is still drawing, then B lifts.
  const A0 = { x: 300, y: 300 };
  const A1 = { x: 900, y: 900 };
  const B0 = { x: 800, y: 200 };
  const B1 = { x: 800, y: 1000 };
  const B2 = { x: 800, y: 1300 };
  const cdp = await page.context().newCDPSession(page);
  const pt = async (p: { x: number; y: number }, id: number) => ({ ...(await toScreen(page, p)), id, radiusX: 4, radiusY: 4 });
  const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [await pt(A0, 0), await pt(B0, 1)] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [await pt(lerp(A0, A1, i / 10), 0), await pt(lerp(B0, B1, i / 10), 1)],
    });
  }
  // A lifts; B stays down and keeps going. (The protocol lifts a finger by leaving it out of a touchMove; a
  // touchEnd must carry no points and lifts them all.)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [await pt(B1, 1)] });
  for (let i = 1; i <= 5; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [await pt(lerp(B1, B2, i / 5), 1)] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();

  const onA = { x: 600, y: 600 };
  const onBInsideABox = { x: 800, y: 400 }; // on B's line, inside A's bounding box, far from A's line
  await expectPaint(page, onA, SKY);
  await expectPaint(page, onBInsideABox, SKY);

  await pick(page, 'Undo');
  await expectBlank(page, onBInsideABox);
  await expectBlank(page, { x: 800, y: 1200 });
  await expectPaint(page, onA, SKY);

  await pick(page, 'Undo');
  await expectBlank(page, onA);
});

test('the eraser only takes paint away for real when the finger lifts, and undo brings it back', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Eraser');
  await touchStrokes(page, [[{ x: 400, y: 800 }, { x: 720, y: 800 }]]);
  await expectBlank(page, SHAPES.inCircle);
  // No stroke layers are left behind once fingers lift.
  await expect(page.locator('.layer-stroke')).toHaveCount(0);
  await pick(page, 'Undo');
  await expectPaint(page, SHAPES.inCircle, RED);
});
