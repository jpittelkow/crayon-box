// Phase D: the kiosk lock (ADR 0014). The Windows app's lock is stood in for by the dev server's fake
// (`?fake-kiosk`, src/shell/fakeKiosk.ts), which records what the app asks of it.
import { expect, test, type Page } from '@playwright/test';
import { SHAPES, openParentArea, pick, tapPage } from './helpers';

type Log = { mode: string | null; locked: boolean | null; startAtSignIn: boolean; quits: number };
const log = (page: Page) =>
  page.evaluate(() => (window as unknown as { __kiosk?: Log }).__kiosk ?? ({ mode: null, locked: null, startAtSignIn: false, quits: 0 } as Log));
const laptop = (page: Page) => page.locator('.pw-nav').getByRole('button', { name: 'This laptop' });

test('the browser version has no kiosk screen', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await expect(laptop(page)).toHaveCount(0);
});

test('starts locked; the keyboard is let go in the parent area and locked again after', async ({ page }) => {
  await page.goto('/?fake-kiosk');
  await expect.poll(async () => (await log(page)).mode).toBe('kid');
  expect((await log(page)).locked).toBe(true);
  await openParentArea(page);
  await expect.poll(async () => (await log(page)).mode).toBe('off');
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await expect.poll(async () => (await log(page)).mode).toBe('kid');
});

test('a parent turns the lock off and on, and the choice is kept', async ({ page }) => {
  await page.goto('/?fake-kiosk');
  await openParentArea(page);
  await laptop(page).click();
  await expect(page.getByRole('heading', { name: 'This laptop', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Setting up the laptop' })).toBeVisible();
  await page.getByRole('switch', { name: /Keep the app full screen/ }).click();
  await expect.poll(async () => (await log(page)).locked).toBe(false);
  await page.getByRole('switch', { name: /Lock the keyboard/ }).click();
  await page.getByRole('switch', { name: /Start when Windows starts/ }).click();
  await expect.poll(async () => (await log(page)).startAtSignIn).toBe(true);
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  // Lock off: the kids' screens leave the keyboard alone.
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  expect((await log(page)).mode).toBe('off');
  await page.reload();
  await expect.poll(async () => (await log(page)).locked).toBe(false);
  expect((await log(page)).mode).toBe('off');
});

test("Quit is on the parent area's first screen and quits the app", async ({ page }) => {
  await page.goto('/?fake-kiosk');
  await openParentArea(page);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.locator('.pw-nav').getByRole('button', { name: 'Quit the app' }).click();
  await expect.poll(async () => (await log(page)).quits).toBe(1);
});

test('Ctrl+Shift+Q from a picture saves it, then quits', async ({ page }) => {
  await page.goto('/?fake-kiosk');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await page.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await page.getByRole('button', { name: SHAPES.title }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  // The keyboard hook's Ctrl+Shift+Q (with the lock on, the page never sees the keys).
  await page.evaluate(() => (window as unknown as { __kiosk: { pressQuitKeys(): void } }).__kiosk.pressQuitKeys());
  await expect.poll(async () => (await log(page)).quits).toBe(1);
  // Saved: after a reload the kid's picture is in My pictures.
  await page.goto('/');
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await pick(page, 'My pictures');
  await expect(page.locator('[data-picture]')).toHaveCount(1);
});

test('with the lock off, Ctrl+Shift+Q reaches the page and still quits', async ({ page }) => {
  await page.goto('/?fake-kiosk');
  await expect.poll(async () => (await log(page)).mode).toBe('kid');
  await page.keyboard.press('Control+Shift+Q');
  await expect.poll(async () => (await log(page)).quits).toBe(1);
});
