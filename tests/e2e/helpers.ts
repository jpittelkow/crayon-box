import { expect, type Page } from '@playwright/test';

export const PAGE_W = 2048;
export const PAGE_H = 1536;

/**
 * Points on the "Circle, square and triangle" placeholder page, in page pixels. They depend on that page's
 * geometry (pages/shapes/circle-square-triangle/page.svg): circle at (560, 800) r 380, square 1140..1840 x
 * 420..1120, line width 16.
 */
export const SHAPES = {
  title: 'Circle, square and triangle page',
  inCircle: { x: 560, y: 800 },
  inCircleHigh: { x: 560, y: 560 },
  inSquare: { x: 1490, y: 770 },
  outside: { x: 1000, y: 1350 },
  between: { x: 1040, y: 800 },
  /** On the circle's line, inside the 2 px growth from the circle's inner edge. */
  underCircleLine: { x: 933, y: 800 },
};

export type Pt = { x: number; y: number };

export async function openShapesPage(page: Page, kid = 'Star kid'): Promise<void> {
  await page.goto('/');
  await openColoring(page, kid);
  // A kid with no pictures lands on the page library (ADR 0017); the shapes page is in the Shapes theme.
  await page.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
}

/** Converts page pixels to viewport coordinates. */
export async function toScreen(page: Page, p: Pt): Promise<Pt> {
  const box = await page.locator('.coloring-page').boundingBox();
  if (!box) throw new Error('No page on screen');
  return { x: box.x + (p.x / PAGE_W) * box.width, y: box.y + (p.y / PAGE_H) * box.height };
}

export async function tapPage(page: Page, p: Pt): Promise<void> {
  const s = await toScreen(page, p);
  await page.touchscreen.tap(s.x, s.y);
}

/**
 * Drags one or more fingers at the same time, each along its own straight path, using raw touch events so that
 * several touches can be down together.
 */
export async function touchStrokes(page: Page, paths: [Pt, Pt][], steps = 12): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const screen = await Promise.all(paths.map(async ([a, b]) => [await toScreen(page, a), await toScreen(page, b)]));
  const at = (t: number) =>
    screen.map(([a, b], id) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, id, radiusX: 4, radiusY: 4 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(i / steps) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** RGBA of one paint-layer pixel. */
export function paintPixel(page: Page, p: Pt): Promise<number[]> {
  return page.evaluate(({ x, y }) => {
    const c = document.querySelector<HTMLCanvasElement>('.layer-paint');
    if (!c) throw new Error('No paint layer');
    return Array.from(c.getContext('2d')!.getImageData(x, y, 1, 1).data);
  }, p);
}

/** Canvas compositing can round a channel by one or two, so colors are compared with a small tolerance. */
export async function expectPaint(page: Page, p: Pt, rgba: number[]): Promise<void> {
  await expect
    .poll(
      async () => {
        const got = await paintPixel(page, p);
        return got.every((v, i) => Math.abs(v - rgba[i]) <= 3) ? rgba : got;
      },
      { message: `pixel at ${p.x},${p.y}` },
    )
    .toEqual(rgba);
}

export async function expectBlank(page: Page, p: Pt): Promise<void> {
  await expect.poll(async () => (await paintPixel(page, p))[3], { message: `pixel at ${p.x},${p.y}` }).toBe(0);
}

export const RED = [0xf2, 0x3b, 0x2f, 255];
export const BLUE = [0x2f, 0x6f, 0xed, 255];
export const SKY = [0x4c, 0xc9, 0xf0, 255];

export const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Holds the lock for longer than a second, the first step of the gate (ADR 0008). */
export async function holdLock(page: Page, ms = 1200): Promise<void> {
  // hover() waits until the button stops moving: screens slide in, and a box read mid-slide misses the button.
  await page.getByRole('button', { name: 'Grown-ups: press and hold' }).hover();
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

export async function openParentArea(page: Page): Promise<void> {
  // Under load the first hold can land while the kid picker is still settling, and the gate never opens; hold
  // again rather than wait for a gate that isn't coming.
  const gate = page.locator('[data-screen="parent-gate"]');
  for (let attempt = 0; attempt < 3; attempt++) {
    await holdLock(page);
    try {
      await gate.waitFor({ state: 'visible', timeout: 4000 });
      break;
    } catch {
      if (attempt === 2) throw new Error('The parent gate did not open after three holds');
    }
  }
  const words = (await page.locator('[data-words]').getAttribute('data-words'))!.split(' ');
  for (const w of words) await page.getByRole('button', { name: String(WORDS.indexOf(w)), exact: true }).click();
  await expect(page.locator('[data-screen="parent-area"]')).toBeVisible();
}

export async function pick(page: Page, name: string): Promise<void> {
  if (name !== 'Back') {
    await page.getByRole('button', { name, exact: true }).tap();
    return;
  }
  // Leaving a screen can take a moment (the picture is saved first). Wait until it is gone, so that the next tap
  // reaches the next screen and not this one's Back again.
  const screen = await page.locator('[data-screen]').last().elementHandle();
  await page.getByRole('button', { name, exact: true }).tap();
  await screen?.waitForElementState('hidden');
}

/**
 * Taps a kid on the kid picker and opens coloring: straight in when it is the only game shown, through the home
 * screen when there are more (ADR 0012; Driving shows by default since milestone 3).
 */
export async function openColoring(page: Page, kid = 'Star kid'): Promise<void> {
  await page.getByRole('button', { name: kid }).tap();
  const home = page.locator('[data-screen="home"]');
  await expect(home.or(page.locator('[data-screen="game-coloring"]'))).toBeVisible();
  if (await home.isVisible()) await page.getByRole('button', { name: 'Coloring', exact: true }).tap();
}
