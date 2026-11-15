// Phase D: sounds with a parent switch, the optional gate PIN, and "reduce motion" (ADR 0008, 0016).
import { expect, test, type Page } from '@playwright/test';
import { RED, SHAPES, expectPaint, holdLock as holdTheLock, openShapesPage, pick, tapPage } from './helpers';

// The parent area's way back. Its label is being reworded in another branch of work, so both are accepted.
const BACK_TO_KIDS = /^Back to (coloring|the kids)$/;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

async function holdLock(page: Page): Promise<void> {
  await holdTheLock(page);
  await expect(page.locator('[data-screen="parent-gate"]')).toBeVisible();
}

async function tapDigits(page: Page, digits: string): Promise<void> {
  for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click();
}

async function openWithWords(page: Page): Promise<void> {
  await holdLock(page);
  const words = (await page.locator('[data-words]').getAttribute('data-words'))!.split(' ');
  await tapDigits(page, words.map((w) => String(WORDS.indexOf(w))).join(''));
  await expect(page.locator('[data-screen="parent-area"]')).toBeVisible();
}

/** Counts the tones the app starts, by wrapping the Web Audio API before the app loads. */
async function countTones(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __tones: number };
    w.__tones = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args: Parameters<typeof start>) {
      w.__tones++;
      return start.apply(this, args);
    };
  });
}
const tones = (page: Page) => page.evaluate(() => (window as unknown as { __tones: number }).__tones);

test('a parent sets a PIN; the gate then asks for it, and a wrong PIN goes back to the kids', async ({ page }) => {
  await page.goto('/');
  await openWithWords(page);
  await page.getByText('Use a PIN instead of number words').click();
  await page.getByLabel('PIN (4 digits)').fill('58a');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The PIN is 4 digits' })).toBeVisible();
  await page.getByLabel('PIN (4 digits)').fill('5831');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await expect(page.getByText('PIN saved.')).toBeVisible();
  await page.getByRole('button', { name: BACK_TO_KIDS }).click();

  await holdLock(page);
  await expect(page.locator('[data-screen="parent-gate"]')).toHaveAttribute('data-mode', 'pin');
  await expect(page.locator('[data-words]')).toHaveCount(0);
  await tapDigits(page, '1111');
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();

  await holdLock(page);
  await tapDigits(page, '5831');
  await expect(page.locator('[data-screen="parent-area"]')).toBeVisible();

  // Turning it off goes back to number words.
  await page.getByText('Use a PIN instead of number words').click();
  await page.getByRole('button', { name: BACK_TO_KIDS }).click();
  await holdLock(page);
  await expect(page.locator('[data-screen="parent-gate"]')).toHaveAttribute('data-mode', 'words');
});

test('kid touches make sounds, until a parent turns them off', async ({ page }) => {
  await countTones(page);
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  expect(await tones(page)).toBeGreaterThan(0);

  // Coloring screen, then the library, then the start screen (the kid has a picture now), then the kid picker.
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'Back');
  await openWithWords(page);
  await page.getByRole('switch', { name: /^Sounds/ }).click();
  await page.getByRole('button', { name: BACK_TO_KIDS }).click();
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();

  const before = await tones(page);
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await pick(page, 'My pictures');
  await page.getByRole('button', { name: 'Circle, square and triangle picture' }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Paint bucket');
  await pick(page, 'Blue');
  await tapPage(page, SHAPES.inSquare);
  await pick(page, 'Undo');
  expect(await tones(page)).toBe(before);
});

/** Records the name of every CSS animation that starts (the press is a transition, not an animation). */
async function recordAnimations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __animations: string[] };
    w.__animations = [];
    document.addEventListener('animationstart', (e) => w.__animations.push(e.animationName), true);
  });
}
const animations = (page: Page) => page.evaluate(() => (window as unknown as { __animations: string[] }).__animations);

async function pickThings(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Eraser');
  await pick(page, 'Big brush');
  await pick(page, 'Stay in the lines');
  await expect(page.getByRole('button', { name: 'Stay in the lines' })).toHaveAttribute('aria-pressed', 'true');
}

test('with reduce motion on, picks and screens do not pop or slide (ADR 0016)', async ({ page }) => {
  await recordAnimations(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await pickThings(page);
  expect(await animations(page)).toEqual([]);
});

test('without reduce motion, picks pop and new screens slide in', async ({ page }) => {
  await recordAnimations(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await pickThings(page);
  const names = await animations(page);
  expect(names).toContain('cb-slide');
  expect(names).toContain('cb-pop');
});
