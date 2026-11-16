// The colour wheel (ADR 0038 part 5, phase E): 12 in-between hues under the colour rail, shown on the family laptop's
// 1920 × 1080 screen and hidden on the 1280 × 800 reference screen, where it would make the page smaller.
import { expect, test, type Page } from '@playwright/test';
import { WHEEL } from '../../src/ui/palette';
import { segmentCentre } from '../../src/games/coloring/wheel';
import {
  SHAPES,
  clips,
  expectBlank,
  expectPaint,
  openShapesPage,
  pick,
  recordSounds,
  tapPage,
  touchStrokes,
  type Pt,
} from './helpers';

const rgba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);

/** Where segment `i`'s 64 px tap circle is centred, on screen. */
async function segmentAt(page: Page, i: number): Promise<Pt> {
  const box = (await page.locator('.color-wheel svg').boundingBox())!;
  const c = segmentCentre(i);
  return { x: box.x + box.width / 2 + c.x, y: box.y + box.height / 2 + c.y };
}

async function tapSegment(page: Page, i: number): Promise<void> {
  const at = await segmentAt(page, i);
  await page.touchscreen.tap(at.x, at.y);
}

test.describe('on the family laptop, 1920 × 1080', () => {
  // Twelve fills and a few strokes: generous on CI's software graphics.
  test.describe.configure({ timeout: 120_000 });
  test.use({ viewport: { width: 1920, height: 1080 } });

  test('the wheel shows beside the page, which keeps its size; every segment is a 64 px target', async ({ page }) => {
    await openShapesPage(page);
    const wheel = page.locator('.color-wheel');
    await expect(wheel).toBeVisible();
    await expect(page.locator('.coloring')).toHaveAttribute('data-wheel', 'true');
    await expect(wheel.getByRole('button')).toHaveCount(12);
    // No text on a kid screen (ADR 0003 rule 1).
    await expect(page.locator('#app')).toHaveText('');

    // The page is as big as its height allows, as it is without the wheel (ADR 0019): (1080 − 32 − 120 − 18) × 4/3.
    const pageBox = (await page.locator('.coloring-page').boundingBox())!;
    expect(pageBox.width).toBeGreaterThanOrEqual(1212);
    // The 24 swatches are all there at 64 px.
    for (const box of await page.locator('.color-rail button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))) {
      expect(box.width).toBeGreaterThanOrEqual(64);
    }
    // Off the screen's very edge, where wrists rest.
    const box = (await wheel.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(1080 - 48);
    expect(box.x + box.width).toBeLessThanOrEqual(1920 - 24);
    expect(box.x).toBeGreaterThan(pageBox.x + pageBox.width);

    // A 64 px circle around each segment's tap point lands on that segment all the way round.
    const hits = await page.evaluate(
      (points) =>
        points.map(({ x, y }) =>
          [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            const hit = document.elementFromPoint(x + 31 * Math.cos(a), y + 31 * Math.sin(a));
            return hit?.getAttribute('data-index') ?? null;
          }),
        ),
      await Promise.all(WHEEL.map((_, i) => segmentAt(page, i))),
    );
    hits.forEach((ring, i) => expect(ring, `segment ${i}`).toEqual(Array(8).fill(String(i))));
  });

  test('every segment fills with its colour', async ({ page }) => {
    await openShapesPage(page);
    await pick(page, 'Paint bucket');
    for (const [i, color] of WHEEL.entries()) {
      await tapSegment(page, i);
      await expect(page.getByRole('button', { name: color.label, exact: true })).toHaveAttribute('aria-pressed', 'true');
      // Alternate the circle and the square, so each fill lands on paper or on the last colour.
      await tapPage(page, i % 2 ? SHAPES.inSquare : SHAPES.inCircle);
      await expectPaint(page, i % 2 ? SHAPES.inSquare : SHAPES.inCircle, rgba(color.value));
    }
    // A rail colour takes the ring off the wheel.
    await pick(page, 'Red');
    await expect(page.locator('.wheel-segment[aria-pressed="true"]')).toHaveCount(0);
  });

  test('a wheel colour works with the brush and the eraser, and says its colour word', async ({ page }) => {
    await recordSounds(page);
    await openShapesPage(page);
    const magenta = WHEEL.findIndex((c) => c.token === 'magenta');
    await pick(page, 'Brush');
    await tapSegment(page, magenta);
    // Magenta has no clip of its own: it says "Pink", on its own count.
    await expect.poll(() => clips(page, '/voice/color-pink.mp3'), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('.wheel-middle')).toHaveCSS('background-color', 'rgb(216, 27, 132)');
    const across: [Pt, Pt] = [
      { x: SHAPES.inSquare.x - 250, y: SHAPES.inSquare.y },
      { x: SHAPES.inSquare.x + 250, y: SHAPES.inSquare.y },
    ];
    await touchStrokes(page, [across]);
    await expectPaint(page, SHAPES.inSquare, rgba(WHEEL[magenta]!.value));

    // Picking a colour keeps the eraser the tool, as a swatch does.
    await pick(page, 'Eraser');
    await tapSegment(page, magenta + 1);
    await expect(page.getByRole('button', { name: 'Eraser', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await touchStrokes(page, [across]);
    await expectBlank(page, SHAPES.inSquare);
  });
});

test('on the 1280 × 800 reference screen the wheel is hidden, and the page keeps its size', async ({ page }) => {
  await openShapesPage(page);
  await expect(page.locator('.coloring')).toHaveAttribute('data-wheel', 'false');
  await expect(page.locator('.color-wheel')).toBeHidden();
  // About 840 px wide, as before the wheel (ADR 0019).
  expect((await page.locator('.coloring-page').boundingBox())!.width).toBeGreaterThanOrEqual(830);
  await expect(page.locator('.color-rail button')).toHaveCount(24);
});
