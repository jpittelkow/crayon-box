import { expect, test, type Page } from '@playwright/test';
import { RED, SHAPES, expectPaint, openShapesPage, pick, tapPage } from './helpers';

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Holds the lock for longer than a second, the first step of the gate (ADR 0008). */
async function holdLock(page: Page, ms = 1200): Promise<void> {
  const box = (await page.getByRole('button', { name: 'Grown-ups: press and hold' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

async function openParentArea(page: Page): Promise<void> {
  await holdLock(page);
  const words = (await page.locator('[data-words]').getAttribute('data-words'))!.split(' ');
  for (const w of words) await page.getByRole('button', { name: String(WORDS.indexOf(w)), exact: true }).click();
  await expect(page.locator('[data-screen="parent-area"]')).toBeVisible();
}

/** A generated two-color test image: never a real photo (CLAUDE.md privacy rule). */
async function testImage(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2f6fed';
    ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(150, 100, 100, 100);
    return c.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test('a short press on the lock does nothing; a hold opens the gate', async ({ page }) => {
  await page.goto('/');
  await holdLock(page, 300);
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  await holdLock(page);
  await expect(page.locator('[data-screen="parent-gate"]')).toBeVisible();
});

test('a wrong number at the gate goes back to the kids', async ({ page }) => {
  await page.goto('/');
  await holdLock(page);
  const first = (await page.locator('[data-words]').getAttribute('data-words'))!.split(' ')[0];
  const wrong = (WORDS.indexOf(first) + 1) % 10;
  await page.getByRole('button', { name: String(wrong), exact: true }).click();
  await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
});

test('a parent names a kid and gives them a photo', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await page.getByRole('button', { name: 'Edit Star' }).click();
  await page.getByLabel('Name (optional)').fill('Sample');
  await page.getByLabel('Photo file').setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: await testImage(page),
  });
  await expect(page.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Edit Sample' })).toBeVisible();

  await page.getByRole('button', { name: 'Back to coloring' }).click();
  const badge = page.getByRole('button', { name: 'Sample kid' });
  await expect(badge.locator('img')).toHaveCount(1);
  await expect(page.locator('.kid-name')).toHaveText(['Sample']);

  // Names under the badges are a setting (ADR 0018).
  await openParentArea(page);
  await page.getByText('Show names on the kid picker').click();
  await page.getByRole('button', { name: 'Back to coloring' }).click();
  await expect(page.locator('.kid-name')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sample kid' })).toBeVisible();
});

test('a parent adds a kid and deletes one with their pictures', async ({ page }) => {
  await openShapesPage(page, 'Moon kid');
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'Back');

  await openParentArea(page);
  await page.getByRole('button', { name: 'Add a kid' }).click();
  await page.getByRole('radio', { name: 'Green' }).click();
  await page.getByRole('radio', { name: 'Sun' }).click();
  await page.getByRole('button', { name: 'Add this kid' }).click();
  await expect(page.locator('[data-kid]')).toHaveCount(4);

  await page.getByRole('button', { name: 'Edit Moon' }).click();
  await page.getByRole('button', { name: 'Delete Moon' }).click();
  await expect(page.getByText('Delete Moon and all of their pictures for good?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('[data-kid]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Back to coloring' }).click();
  await expect(page.locator('[data-screen="kid-picker"] [data-kid]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Moon kid' })).toHaveCount(0);
  await expect(page.locator('[data-screen="kid-picker"] [data-kid]').nth(2)).toHaveCSS(
    'background-color',
    'rgb(68, 184, 123)', // kid-green
  );
});

test('a hidden page leaves the library', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await page.getByRole('button', { name: 'Page library' }).click();
  await page.getByText('Show Fish').click();
  await page.getByRole('button', { name: 'Back to coloring' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  // Under the sea had only the fish, so its theme button goes too.
  await expect(page.locator('[data-theme]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Under the sea' })).toHaveCount(0);
});

test('a parent restores the previous version of a picture, and deletes one', async ({ page }) => {
  await openShapesPage(page);
  await pick(page, 'Paint bucket');
  await pick(page, 'Red');
  await tapPage(page, SHAPES.inCircle);
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Back');
  await pick(page, 'Back');
  // Reopening keeps the previous version; then the kid paints over it.
  await pick(page, 'My pictures');
  await page.getByRole('button', { name: 'Circle, square and triangle picture' }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Start over');
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'Back');

  await openParentArea(page);
  await page.getByRole('button', { name: 'Pictures' }).click();
  await page.getByRole('button', { name: 'Restore previous Circle, square and triangle' }).click();
  await page.getByRole('button', { name: 'Back to coloring' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  await pick(page, 'My pictures');
  await page.getByRole('button', { name: 'Circle, square and triangle picture' }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await expectPaint(page, SHAPES.inCircle, RED);
  await pick(page, 'Back');
  await pick(page, 'Back');
  await pick(page, 'Back');

  await openParentArea(page);
  await page.getByRole('button', { name: 'Pictures' }).click();
  await page.getByRole('button', { name: 'Delete Circle, square and triangle' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('Star has no pictures yet.')).toBeVisible();
});
