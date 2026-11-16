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
  // Coloring and Driving on (Driving shows by default), Letters not.
  await expect(page.locator('[data-screen="home"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Letters', exact: true })).toHaveCount(0);
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

/** Records every clip the app plays through an audio element (the narrator and parent recordings). */
async function logClips(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __clips: string[] };
    w.__clips = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      w.__clips.push(this.currentSrc || this.src);
      return play.call(this);
    };
  });
}

/** The narrator's clips played so far, by name (`letter-L`, `sound-L`, `praise-wow`). */
async function clipsSaid(page: Page): Promise<string[]> {
  const all = await page.evaluate(() => (window as unknown as { __clips: string[] }).__clips);
  return all.map((c) => /\/voice\/([A-Za-z0-9-]+)\.mp3/.exec(c)?.[1] ?? c);
}

const isPraise = (c: string) => c.startsWith('praise-');

test("a finished letter: the narrator says its name, then a word of praise (ADR 0032)", async ({ page }) => {
  await logClips(page);
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  await traceAndConfirm(page, 'L');
  await expect.poll(async () => (await clipsSaid(page)).some(isPraise)).toBe(true);
  const said = await clipsSaid(page);
  const name = said.lastIndexOf('letter-L');
  const praise = said.findIndex(isPraise);
  expect(name).toBeGreaterThanOrEqual(0);
  expect(praise).toBeGreaterThan(name);
});

test("a letter's name is said as it opens, from the grid and from the next arrow (ADR 0037)", async ({ page }) => {
  await logClips(page);
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  await expect.poll(() => clipsSaid(page)).toEqual(['letter-L']);
  await traceAndConfirm(page, 'L');
  await page.getByRole('button', { name: 'Next letter' }).tap();
  await expect.poll(async () => (await clipsSaid(page)).at(-1)).toBe('letter-M');
  // Name by default: no letter sounds.
  expect((await clipsSaid(page)).filter((c) => c.startsWith('sound-'))).toEqual([]);
});

test('the parent setting says the name then the sound, or the sound alone (ADR 0037)', async ({ page }) => {
  await logClips(page);
  await turnOnLetters(page);
  await openParentArea(page);
  await page.getByRole('button', { name: 'Letters', exact: true }).click();
  const saying = page.getByRole('group', { name: 'What is said with a letter' });
  await expect(saying.getByRole('button', { name: 'Its name' })).toHaveAttribute('aria-pressed', 'true');
  await saying.getByRole('button', { name: 'Name, then sound' }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();

  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  await expect.poll(() => clipsSaid(page)).toEqual(['letter-L', 'sound-L']);
  await traceAndConfirm(page, 'L');
  await expect.poll(async () => (await clipsSaid(page)).some(isPraise), { timeout: 15_000 }).toBe(true);
  expect((await clipsSaid(page)).slice(2)).toEqual(['letter-L', 'sound-L', expect.stringMatching(/^praise-/)]);

  // Sound only.
  await page.goto('/');
  await openParentArea(page);
  await page.getByRole('button', { name: 'Letters', exact: true }).click();
  await page.getByRole('group', { name: 'What is said with a letter' }).getByRole('button', { name: 'Its sound' }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await openLetters(page);
  await page.evaluate(() => ((window as unknown as { __clips: string[] }).__clips = []));
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter B', exact: true }).tap();
  await expect.poll(() => clipsSaid(page)).toEqual(['sound-B']);
});

/**
 * Moves one finger with synthetic pointer events, all in one go so no timer runs in between, and reads after each
 * step whether the drawing sound is on (the trace screen's `data-drawing`).
 */
async function drawingWhile(page: Page, steps: { type: 'down' | 'move' | 'up'; at: Pt }[]): Promise<string[]> {
  const screen = await toScreen(page, steps.map((s) => s.at));
  return page.evaluate(
    ({ steps, screen }) => {
      const svg = document.querySelector('.letters-svg')!;
      const host = document.querySelector<HTMLElement>('[data-screen="letters-trace"]')!;
      return steps.map((s, i) => {
        const type = s.type === 'down' ? 'pointerdown' : s.type === 'move' ? 'pointermove' : 'pointerup';
        const at = { clientX: screen[i].x, clientY: screen[i].y };
        svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 5, width: 10, height: 10, ...at }));
        return host.dataset.drawing ?? '';
      });
    },
    { steps, screen },
  );
}

test('the drawing sound plays only while a finger moves on the road, and just stops off it (ADR 0037)', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter L', exact: true }).tap();
  const down = glyph('L').strokes[0];
  const on = (i: number) => down[i];
  const off = (p: Pt) => ({ x: p.x + 40, y: p.y });
  const states = await drawingWhile(page, [
    { type: 'down', at: on(10) },
    { type: 'move', at: on(20) },
    { type: 'move', at: on(30) },
    { type: 'move', at: off(on(40)) },
    { type: 'move', at: off(on(50)) },
    { type: 'move', at: on(60) },
    { type: 'up', at: on(60) },
  ]);
  expect(states).toEqual(['false', 'true', 'true', 'false', 'false', 'true', 'false']);
  // Held still on the road, it stops too.
  await drawingWhile(page, [
    { type: 'down', at: on(10) },
    { type: 'move', at: on(20) },
  ]);
  await expect(traceScreen(page)).toHaveAttribute('data-drawing', 'false');
});

test('a chime for each finished stroke, but not the last: the letter itself is ready then (ADR 0037)', async ({ page }) => {
  await turnOnLetters(page);
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter E', exact: true }).tap();
  await expect(traceScreen(page)).not.toHaveAttribute('data-chimes');
  await drag(page, [glyph('E').strokes[0].filter((_, i, a) => i % 4 === 0 || i === a.length - 1)]);
  await expect(traceScreen(page)).toHaveAttribute('data-chimes', '1');
  await traceAndConfirm(page, 'E');
  await expect(traceScreen(page)).toHaveAttribute('data-chimes', String(glyph('E').strokes.length - 1));
});

test("the app's Sounds switch silences the narrator, the drawing sound and the chimes (ADR 0037)", async ({ page }) => {
  await logClips(page);
  await turnOnLetters(page);
  await openParentArea(page);
  await page.getByRole('switch', { name: /^Sounds/ }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await openLetters(page);
  await page.getByRole('button', { name: 'Practice' }).tap();
  await page.getByRole('button', { name: 'Letter E', exact: true }).tap();
  const down = glyph('E').strokes[0];
  const states = await drawingWhile(page, [
    { type: 'down', at: down[5] },
    { type: 'move', at: down[15] },
    { type: 'up', at: down[15] },
  ]);
  expect(states).toEqual(['false', 'false', 'false']);
  await page.getByRole('button', { name: 'Wipe' }).tap();
  await traceAndConfirm(page, 'E');
  await expect(traceScreen(page)).not.toHaveAttribute('data-chimes');
  // Give a praise clip time to have started, then check nothing was said.
  await page.waitForTimeout(1500);
  expect(await clipsSaid(page)).toEqual([]);
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
