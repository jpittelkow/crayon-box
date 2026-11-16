// Coloring buttons a kid can work out (ADR 0038): each button's own sound and name (phase B), and the tool at the
// finger (phase C).
import { expect, test, type CDPSession, type Page } from '@playwright/test';
import {
  BACK_TO_KIDS,
  RED,
  SHAPES,
  clips,
  expectBlank,
  expectPaint,
  openParentArea,
  openShapesPage,
  pick,
  recordSounds,
  sounds,
  tapPage,
  toScreen,
  type Pt,
} from './helpers';

test('a pick plays its own sound and says its name the first 3 times, then only the sound', async ({ page }) => {
  await recordSounds(page);
  await openShapesPage(page);
  for (let i = 1; i <= 4; i++) {
    await pick(page, 'Paint bucket');
    await expect.poll(() => sounds(page, '/drive/splash.wav'), { timeout: 10_000 }).toBe(i);
    if (i <= 3) await expect.poll(() => clips(page, '/voice/tool-bucket.mp3'), { timeout: 10_000 }).toBe(i);
  }
  // The name waits a moment after the sound; give the fourth pick well over that to say nothing.
  await page.waitForTimeout(800);
  expect(await clips(page, '/voice/tool-bucket.mp3')).toBe(3);

  // Colors and sizes are named too, each on its own count.
  await pick(page, 'Red');
  await expect.poll(() => clips(page, '/voice/color-red.mp3'), { timeout: 10_000 }).toBe(1);
  await pick(page, 'Big brush');
  await expect.poll(() => clips(page, '/voice/size-big.mp3'), { timeout: 10_000 }).toBe(1);
  await pick(page, 'Stay in the lines');
  await expect.poll(() => clips(page, '/voice/mode-lines.mp3'), { timeout: 10_000 }).toBe(1);

  // The count is kept for the kid: back in a new picture, the bucket still says nothing.
  await pick(page, 'Back');
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Paint bucket');
  await expect.poll(() => sounds(page, '/drive/splash.wav'), { timeout: 10_000 }).toBe(5);
  await page.waitForTimeout(800);
  expect(await clips(page, '/voice/tool-bucket.mp3')).toBe(3);
});

test('a parent can turn button names off; the sounds stay', async ({ page }) => {
  await recordSounds(page);
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Coloring', exact: true }).click();
  const names = page.getByRole('group', { name: 'Say button names' });
  await expect(names.getByRole('button', { name: 'First 3 times' })).toHaveAttribute('aria-pressed', 'true');
  await names.getByRole('button', { name: 'Never' }).click();
  await expect(names.getByRole('button', { name: 'Never' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: BACK_TO_KIDS }).click();

  await openShapesPage(page);
  await pick(page, 'Eraser');
  await expect.poll(() => sounds(page, '/ui/crayon.wav'), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(800);
  // No name; the show-how's "what it does" line isn't a name and may still play.
  expect(await clips(page, '/voice/tool-')).toBe(0);
});

/** A finger that stays down until `up` is called, through Chrome's touch events. */
async function finger(page: Page, at: Pt): Promise<{ cdp: CDPSession; move(to: Pt): Promise<void>; up(): Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  const point = (p: Pt) => [{ x: p.x, y: p.y, id: 0, radiusX: 4, radiusY: 4 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(at) });
  return {
    cdp,
    move: (to) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(to) }).then(() => {}),
    up: async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    },
  };
}

async function centre(page: Page, selector: string): Promise<Pt> {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('picks fire as the finger touches; undo waits for the lift', async ({ page }) => {
  await openShapesPage(page);
  const red = await finger(page, await centre(page, '[data-color="red"]'));
  await expect(page.getByRole('button', { name: 'Red', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await red.up();
  const bucket = await finger(page, await centre(page, '[data-tool="bucket"]'));
  await expect(page.getByRole('button', { name: 'Paint bucket' })).toHaveAttribute('aria-pressed', 'true');
  await bucket.up();

  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  const undo = await finger(page, await centre(page, '.tool-rail [aria-label="Undo"]'));
  await page.waitForTimeout(300);
  await expectPaint(page, SHAPES.inCircle, RED);
  await undo.up();
  await expectBlank(page, SHAPES.inCircle);
});

test('a badge of the tool and color follows a finger on the page', async ({ page }) => {
  await openShapesPage(page);
  const badge = page.locator('.tool-badge');
  await expect(badge).toBeHidden();
  await pick(page, 'Red');
  await pick(page, 'Brush');

  const a = await toScreen(page, SHAPES.inCircle);
  const touch = await finger(page, a);
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute('data-tool', 'brush');
  await expect(badge).toHaveCSS('background-color', 'rgb(242, 59, 47)');
  await expect(badge.locator('svg')).toHaveCount(1);
  // Near the finger, above it and to the side, so the finger doesn't cover it.
  const at = await centre(page, '.tool-badge');
  expect(at.y).toBeLessThan(a.y - 30);
  expect(Math.hypot(at.x - a.x, at.y - a.y)).toBeLessThan(140);

  const b = await toScreen(page, SHAPES.inSquare);
  await touch.move(b);
  await expect
    .poll(async () => {
      const now = await centre(page, '.tool-badge');
      return Math.round(Math.hypot(now.x - at.x - (b.x - a.x), now.y - at.y - (b.y - a.y)));
    })
    .toBeLessThan(3);
  await touch.up();
  await expect(badge).toBeHidden();

  // The eraser's dot is white; the bigger the size, the bigger the dot.
  await pick(page, 'Small brush');
  await pick(page, 'Eraser');
  const rub = await finger(page, a);
  await expect(badge).toHaveAttribute('data-tool', 'eraser');
  await expect(badge).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect.poll(async () => (await badge.boundingBox())!.width).toBeLessThan(72);
  await rub.up();
  await pick(page, 'Big brush');
  const big = await finger(page, a);
  await expect(badge).toHaveAttribute('data-tool', 'eraser');
  await expect.poll(async () => (await badge.boundingBox())!.width).toBeGreaterThan(90);
  await big.up();

  // Near the top of the page the badge goes below the finger, so it stays on screen.
  await pick(page, 'Paint bucket');
  const top = await toScreen(page, { x: 1000, y: 40 });
  const pour = await finger(page, top);
  await expect(badge).toHaveAttribute('data-tool', 'bucket');
  expect((await centre(page, '.tool-badge')).y).toBeGreaterThan(top.y + 30);
  await pour.up();
});

test('the picked tool is bigger, and the sizes grey out under the bucket', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Eraser');
  const width = async (name: string) => (await page.getByRole('button', { name, exact: true }).boundingBox())!.width;
  // Both read together each time: the tool just let go shrinks back over a short transition.
  await expect.poll(async () => (await width('Eraser')) / (await width('Brush')), { timeout: 15_000 }).toBeGreaterThan(1.08);
  await expect(page.locator('.sizes')).not.toHaveClass(/is-faded/);
  await expect(page.locator('.sizes [aria-pressed="true"]')).toHaveCount(1);

  await pick(page, 'Paint bucket');
  await expect(page.locator('.sizes')).toHaveClass(/is-faded/);
  await expect(page.locator('.sizes')).toHaveCSS('filter', 'grayscale(1)');
  await expect(page.locator('.sizes [aria-pressed="true"]')).toHaveCount(0);
});
