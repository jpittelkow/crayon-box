import { expect, test, type Page } from '@playwright/test';
import { glyph, type Pt } from '../../src/games/letters/glyphs';
import { openParentArea } from './helpers';

// Letter practice (ADR 0026, 0028): practice, the game path, tracing with fingers and a pen, and the parent's settings.

async function turnOnLetters(page: Page): Promise<void> {
  await page.goto('/');
  await openParentArea(page);
  await page.getByText('Show Letters').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
}

async function openLetters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Letters', exact: true }).tap();
  await expect(page.locator('[data-screen="letters-start"]')).toBeVisible();
}

/** Glyph units to viewport coordinates, through the tracing picture's own transform. */
async function toScreen(page: Page, pts: Pt[]): Promise<Pt[]> {
  return page.evaluate((pts) => {
    const svg = document.querySelector<SVGSVGElement>('.letters-svg')!;
    const m = svg.getScreenCTM()!;
    return pts.map((p) => {
      const q = new DOMPoint(p.x, p.y).matrixTransform(m);
      return { x: q.x, y: q.y };
    });
  }, pts);
}

/** One finger along each path, one after the other, with raw touch events. */
async function drag(page: Page, paths: Pt[][]): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  for (const path of paths) {
    const screen = await toScreen(page, path);
    const at = (p: Pt) => [{ x: p.x, y: p.y, id: 1, radiusX: 4, radiusY: 4 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(screen[0]) });
    for (const p of screen.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(p) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await cdp.detach();
}

/** Traces a letter as drawn: every stroke, a point every few units. */
async function trace(page: Page, ch: string): Promise<void> {
  await drag(
    page,
    glyph(ch).strokes.map((s) => s.filter((_, i) => i % 4 === 0 || i === s.length - 1)),
  );
}

const traceScreen = (page: Page) => page.locator('[data-screen="letters-trace"]');

/** Traces a letter, sees it is ready but not yet done, and taps the big check (ADR 0028). */
async function traceAndConfirm(page: Page, ch: string): Promise<void> {
  await trace(page, ch);
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready');
  await expect(page.locator('.letters-done-star')).toHaveCount(0);
  await page.getByRole('button', { name: 'Done', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'true');
}

// The pulsing stops and arrows never hold still, so Playwright could not tap them; motion is off here.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('letters stay hidden until a parent turns them on', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="game-coloring"]')).toBeVisible();
  await turnOnLetters(page);
  await openLetters(page);
  await expect(page.getByRole('button', { name: 'Practice' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Game' })).toBeVisible();
});

test('practice: every letter is open; tracing one gives it a star and the arrow goes to the next', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await expect(page.locator('.letters-tile')).toHaveCount(26);
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'L');
  // Where to start: a pulsing dot, a finger on it, and an arrow.
  await expect(page.locator('.letters-pulse')).toHaveCount(1);
  await expect(page.locator('.letters-finger')).toHaveCount(1);
  await expect(page.locator('.letters-arrows [data-stroke]')).toHaveCount(1);

  await traceAndConfirm(page, 'L');
  await expect(page.locator('.letters-finger')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next letter' }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'M');
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.getByRole('button', { name: 'Letter L, has a star' })).toBeVisible();
});

test('the game opens one letter at a time', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Game' }).tap();
  await expect(page.getByRole('button', { name: 'Letter A, next to trace' })).toBeVisible();
  await page.getByRole('button', { name: 'Letter B, locked' }).tap();
  await expect(page.locator('[data-screen="letters-path"]')).toBeVisible(); // a locked letter does nothing

  await page.getByRole('button', { name: 'Letter A, next to trace' }).tap();
  await traceAndConfirm(page, 'A');
  await page.getByRole('button', { name: 'Next letter' }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-letter', 'B');
  await page.getByRole('button', { name: 'Back' }).tap();
  await expect(page.getByRole('button', { name: 'Letter A, done' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Letter B, next to trace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Letter C, locked' })).toBeVisible();
});

test('a scribble does not finish a letter; wipe and a real trace do', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter O', exact: true }).tap();
  const zigzag: Pt[] = [];
  for (let y = -6; y <= 146; y += 5) zigzag.push({ x: -14, y }, { x: 114, y: y + 2.5 });
  await drag(page, [zigzag, zigzag.map((p) => ({ x: p.x, y: 146 - p.y }))]);
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'false');
  await page.getByRole('button', { name: 'Wipe' }).tap();
  await expect(page.locator('.letters-ink polyline')).toHaveCount(0);
  await traceAndConfirm(page, 'O');
});

test('a pen near the screen mutes touches (the resting hand)', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter I', exact: true }).tap();
  const [a, b] = await toScreen(page, [{ x: 50, y: 20 }, { x: 50, y: 60 }]);
  const lines = await page.evaluate(
    ({ a, b }) => {
      const svg = document.querySelector('.letters-svg')!;
      const fire = (type: string, pointerType: string, pointerId: number, p: { x: number; y: number }) =>
        svg.dispatchEvent(
          new PointerEvent(type, { bubbles: true, pointerType, pointerId, clientX: p.x, clientY: p.y, width: 10, height: 10 }),
        );
      fire('pointerdown', 'pen', 7, a);
      fire('pointermove', 'pen', 7, b);
      fire('pointerdown', 'touch', 8, { x: a.x + 120, y: a.y });
      fire('pointerup', 'pen', 7, b);
      // Just after the pen lifts, a touch is still taken for the resting hand.
      fire('pointerdown', 'touch', 9, { x: a.x + 140, y: a.y });
      return document.querySelectorAll('.letters-ink polyline').length;
    },
    { a, b },
  );
  expect(lines).toBe(1);
});

test('a parent turns on more sets and stroke order', async ({ page }) => {
  await turnOnLetters(page);
  await openParentArea(page);
  await page.getByRole('button', { name: 'Letters', exact: true }).click();
  const sets = page.getByRole('group', { name: 'Letter sets for Star' });
  await sets.getByRole('button', { name: 'a b c', exact: true }).click();
  await sets.getByRole('button', { name: '1 2 3', exact: true }).click();
  await page.getByRole('group', { name: 'How tracing counts for Star' }).getByRole('button', { name: 'Stroke order' }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();

  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Small letters' }).tap();
  await expect(page.locator('.letters-tile')).toHaveCount(26);
  await expect(page.getByRole('button', { name: 'Small letter a', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Numbers' }).tap();
  await expect(page.locator('.letters-tile')).toHaveCount(10);

  await page.getByRole('button', { name: 'Capital letters' }).tap();
  await page.getByRole('button', { name: 'Letter T', exact: true }).tap();
  // Stroke order: only the first stroke's dot and arrow show.
  await expect(page.locator('.letters-starts [data-start]')).toHaveCount(1);
  await expect(page.locator('.letters-arrows [data-stroke="0"]')).toHaveCount(1);
  await traceAndConfirm(page, 'T');
});

test('most of a letter is not enough: dots show what is left, then the kid confirms (ADR 0028)', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  const strokes = glyph('L').strokes;
  // Each stroke three quarters of the way.
  await drag(page, strokes.map((s) => s.slice(0, Math.floor(s.length * 0.75)).filter((_, i) => i % 4 === 0)));
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'false');
  await expect(page.locator('.letters-left circle').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
  // The rest: now it is ready, and the dots are gone.
  await drag(page, strokes.map((s) => s.slice(Math.floor(s.length * 0.7)).filter((_, i, a) => i % 4 === 0 || i === a.length - 1)));
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'ready');
  await expect(page.locator('.letters-left circle')).toHaveCount(0);
  // Wipe takes it back to the start.
  await page.getByRole('button', { name: 'Wipe' }).tap();
  await expect(traceScreen(page)).toHaveAttribute('data-done', 'false');
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);
  await traceAndConfirm(page, 'L');
  await expect(page.getByRole('button', { name: 'Next letter' })).toBeVisible();
});
