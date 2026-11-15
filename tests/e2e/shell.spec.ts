import { expect, test } from '@playwright/test';
import { openParentArea } from './helpers';

// The shell's own screens (ADR 0012): getting back to the kid picker, and the app's name (ADR 0027).

test('Back on the home screen goes to the kid picker, from every game', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await page.getByText('Show Letters').click();
  await page.getByText('Show Driving').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();

  for (const game of ['Coloring', 'Letters', 'Driving']) {
    await page.getByRole('button', { name: 'Star kid' }).tap();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    await page.getByRole('button', { name: game, exact: true }).tap();
    await expect(page.locator('[data-screen^="game-"]')).toBeVisible();
    // The game's own Back goes to the home screen (a kid with no pictures starts in the page library)...
    await page.getByRole('button', { name: 'Back', exact: true }).tap();
    await expect(page.locator('[data-screen="home"]')).toBeVisible();
    // ...and the home screen's Back to the kid picker. Its game tiles used to cover this button.
    await page.getByRole('button', { name: 'Back', exact: true }).tap();
    await expect(page.locator('[data-screen="kid-picker"]')).toBeVisible();
  }
});

test('The app name shows on the kid picker, the home screen and the parent area', async ({ page }) => {
  await page.goto('/');
  const name = page.getByRole('img', { name: 'Crayon Box' });
  await expect(name).toBeVisible();

  await openParentArea(page);
  await expect(page.locator('.pw-nav').getByRole('img', { name: 'Crayon Box' })).toBeVisible();
  await page.getByText('Show Letters').click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();

  await page.getByRole('button', { name: 'Star kid' }).tap();
  await expect(page.locator('[data-screen="home"]').getByRole('img', { name: 'Crayon Box' })).toBeVisible();
});
