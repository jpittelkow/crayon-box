// Phase E: in-app updates (ADR 0009). The real updater only runs in the Windows app; here the dev server's fake
// updater (`?fake-updates=<mode>`, src/shell/fakeUpdater.ts) stands in for it.
import { expect, test, type Page } from '@playwright/test';
import { openParentArea } from './helpers';

const navUpdates = (page: Page) => page.locator('.pw-nav').getByRole('button', { name: 'Updates' });
const state = (page: Page) => page.locator('[data-update-state]');

async function openUpdates(page: Page, mode: string): Promise<void> {
  await page.goto(`/?fake-updates=${mode}`);
  await openParentArea(page);
  await navUpdates(page).click();
  await expect(page.getByRole('heading', { name: 'Updates', level: 1 })).toBeVisible();
}

test('the browser version has no Updates screen', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await expect(navUpdates(page)).toHaveCount(0);
});

test('a newer version found at start is only shown in the parent area, then installs on request', async ({ page }) => {
  await page.goto('/?fake-updates=available');
  // Nothing about it on the kids' screens (ADR 0009).
  await page.waitForTimeout(400);
  await expect(page.getByText('9.9.9')).toHaveCount(0);
  await openParentArea(page);
  await expect(navUpdates(page)).toHaveClass(/pw-nav-dot/);
  await navUpdates(page).click();
  await expect(page.getByText('Version 0.0.0-dev')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Version 9.9.9 is ready' })).toBeVisible();
  await expect(page.getByLabel('What’s new')).toContainText('Bigger color buttons.');
  await page.getByRole('button', { name: 'Install and restart' }).click();
  await expect(state(page)).toHaveAttribute('data-update-state', 'restarting');
  await expect(page.getByText('Version 9.9.9 is installed. The app is restarting…')).toBeVisible();
});

test('the newest version says so, and can check again', async ({ page }) => {
  await openUpdates(page, 'none');
  await expect(state(page)).toHaveAttribute('data-update-state', 'upToDate');
  await expect(navUpdates(page)).not.toHaveClass(/pw-nav-dot/);
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(state(page)).toHaveAttribute('data-update-state', 'upToDate');
});

test('an unreachable release is said in words, with a way to try again', async ({ page }) => {
  await openUpdates(page, 'offline');
  await expect(page.getByText('Couldn’t reach the releases page.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('a failed install leaves this version working and can be tried again', async ({ page }) => {
  await openUpdates(page, 'broken');
  await page.getByRole('button', { name: 'Install and restart' }).click();
  await expect(page.getByText('The update didn’t install.', { exact: false })).toBeVisible();
  await expect(page.getByText('signature does not match', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Try installing again' }).click();
  await expect(page.getByText('The update didn’t install.', { exact: false })).toBeVisible();
});

test('turning off the check at start is remembered', async ({ page }) => {
  await openUpdates(page, 'none');
  const toggle = page.getByRole('switch', { name: /Check for updates when the app starts/ });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.waitForTimeout(200);
  await openUpdates(page, 'none');
  await expect(page.getByRole('switch', { name: /Check for updates when the app starts/ })).not.toBeChecked();
  // With the check off, nothing was asked: the screen waits for Check now.
  await expect(state(page)).toHaveAttribute('data-update-state', 'idle');
});
