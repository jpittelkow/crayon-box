// The show-how (ADR 0038 parts 3 and 4, phase D): a tool's demo in the page's corner on the first page and the first
// pick of each tool, stopped by any touch, never changing the picture; and the parent's "Show the buttons".
import { expect, test, type Page } from '@playwright/test';
import {
  BACK_TO_KIDS,
  SHAPES,
  clips,
  expectPaint,
  openParentArea,
  openShapesPage,
  pick,
  recordSounds,
  tapPage,
} from './helpers';

/** Demos run on animation frames, which CI draws in software: be generous. */
const SLOW = { timeout: 20_000 };

/** How many paint-layer pixels have any paint on them. */
function paintedPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('.layer-paint')!;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
    return n;
  });
}

/** Counts, from before the app loads, each time a demo starts playing (`__demos`, one entry per step). */
async function recordDemos(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __demos: string[] };
    w.__demos = [];
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (!el.classList?.contains('show-how')) continue;
        const step = `${el.dataset.state}:${el.dataset.demo}`;
        if (el.dataset.state === 'playing' && el.dataset.demo && w.__demos.at(-1) !== step) w.__demos.push(step);
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-state', 'data-demo'] });
  });
}

const demos = (page: Page) => page.evaluate(() => (window as unknown as { __demos: string[] }).__demos);

test("a new kid's first page shows what the brush does, once, and leaves the picture as it was", async ({ page }) => {
  await recordSounds(page);
  await recordDemos(page);
  await openShapesPage(page);
  const demo = page.locator('.show-how');
  await expect(demo).toBeVisible(SLOW);
  await expect(demo).toHaveAttribute('data-demo', 'brush');
  // The brush in the rail is pointed at while it plays (checked first: under load the line can end the demo's
  // 2.8 s before a later check runs); the demo sits inside the page, in its corner.
  await expect(page.locator('.tool-rail [data-tool="brush"]')).toHaveClass(/is-showing/);
  const box = (await demo.boundingBox())!;
  const pageBox = (await page.locator('.coloring-page').boundingBox())!;
  expect(box.x).toBeGreaterThan(pageBox.x + pageBox.width / 2);
  expect(box.y + box.height).toBeLessThanOrEqual(pageBox.y + pageBox.height + 1);
  await expect(page.locator('.show-how-badge')).toHaveAttribute('data-tool', 'brush');
  await expect.poll(() => clips(page, '/voice/do-brush.mp3'), SLOW).toBe(1);

  await expect(demo).toBeHidden(SLOW);
  await expect(page.locator('.is-showing')).toHaveCount(0);
  expect(await paintedPixels(page)).toBe(0);
  expect(await demos(page)).toEqual(['playing:brush']);

  // Never again for this kid: not on the next page, and not on the first pick of the brush.
  await pick(page, 'Back');
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await page.waitForTimeout(3000);
  await pick(page, 'Brush');
  await page.waitForTimeout(2500);
  expect(await demos(page)).toEqual(['playing:brush']);
  expect(await clips(page, '/voice/do-')).toBe(1);
});

test('a touch stops a demo at once, and the touch still paints', async ({ page }) => {
  await recordDemos(page);
  await openShapesPage(page);
  const demo = page.locator('.show-how');
  await expect(demo).toBeVisible(SLOW);
  await tapPage(page, SHAPES.inCircle);
  await expect(demo).toBeHidden({ timeout: 1000 });
  await expect(page.locator('.is-showing')).toHaveCount(0);
  // The screen was never locked: the tap drew a dot of the current color (light blue).
  await expectPaint(page, SHAPES.inCircle, [0x4c, 0xc9, 0xf0, 255]);
  // Stopped, it doesn't come back by itself.
  await page.waitForTimeout(1500);
  await expect(demo).toBeHidden();
  expect(await demos(page)).toEqual(['playing:brush']);
});

test('the first pick of each tool shows what it does, never more than one a minute', async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install();
  await recordSounds(page);
  await recordDemos(page);
  await openShapesPage(page);
  const demo = page.locator('.show-how');
  await expect(demo).toBeVisible(SLOW);
  await expect(demo).toBeHidden(SLOW);

  // Within the minute the bucket's first pick shows nothing; it's still due later.
  await pick(page, 'Paint bucket');
  await page.waitForTimeout(2500);
  expect(await demos(page)).toEqual(['playing:brush']);

  await page.clock.fastForward(61_000);
  await pick(page, 'Eraser');
  await expect(demo).toHaveAttribute('data-demo', 'eraser', SLOW);
  await expect(demo).toBeVisible();
  await expect(page.locator('.tool-rail [data-tool="eraser"]')).toHaveClass(/is-showing/);
  await expect.poll(() => clips(page, '/voice/do-eraser.mp3'), SLOW).toBe(1);
  await expect(demo).toBeHidden(SLOW);

  await page.clock.fastForward(61_000);
  await pick(page, 'Eraser');
  await page.waitForTimeout(2000);
  expect(await demos(page)).toEqual(['playing:brush', 'playing:eraser']);
  await pick(page, 'Paint bucket');
  await expect.poll(() => demos(page), SLOW).toEqual(['playing:brush', 'playing:eraser', 'playing:bucket']);
  await expect.poll(() => clips(page, '/voice/do-bucket.mp3'), SLOW).toBe(1);
  await expect(demo).toBeHidden(SLOW);
  // The bucket's demo filled its own cloud, not the picture.
  expect(await paintedPixels(page)).toBe(0);
});

test('"Show the buttons" plays every demo in turn the next time that kid opens a page', async ({ page }) => {
  test.setTimeout(120_000);
  await recordSounds(page);
  await recordDemos(page);
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Coloring', exact: true }).click();
  await expect(page.getByText('Sit with your kid the first time. Tap each button and say what it does.')).toBeVisible();
  const row = page.locator('[data-kid]').filter({ hasText: 'Star' }).first();
  await expect(row.getByText(/Plays the next time/)).toHaveCount(0);
  await row.getByRole('button', { name: 'Show Star the buttons' }).click();
  await expect(row.getByText('Plays the next time Star opens a page.')).toBeVisible();
  await page.getByRole('button', { name: BACK_TO_KIDS }).click();

  await openShapesPage(page);
  const order = ['playing:bucket', 'playing:brush', 'playing:eraser', 'playing:undo', 'playing:start-over'];
  await expect.poll(() => demos(page), { timeout: 60_000 }).toEqual(order);
  for (const name of ['tool-bucket', 'do-bucket', 'tool-brush', 'do-brush', 'tool-eraser', 'do-eraser', 'tool-undo', 'do-undo']) {
    expect(await clips(page, `/voice/${name}.mp3`), name).toBe(1);
  }
  await expect(page.locator('.is-showing')).toHaveCount(0, SLOW);
  await expect(page.locator('.show-how')).toBeHidden();
  expect(await paintedPixels(page)).toBe(0);
  // The tour leaves the kid's tool as it was.
  await expect(page.getByRole('button', { name: 'Brush', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // Once: back in the parent area it isn't waiting any more.
  await pick(page, 'Back');
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Coloring', exact: true }).click();
  await expect(page.locator('[data-kid]').filter({ hasText: 'Star' }).first().getByText(/Plays the next time/)).toHaveCount(0);
});
