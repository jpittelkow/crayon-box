// A browser that used the first web build holds a version 1 database: one store, all profiles in one file. The
// sync groundwork (ADR 0024) upgrades it in place. This runs that upgrade in a real browser.
import { expect, test } from '@playwright/test';

test('data saved by the first build survives the storage upgrade', async ({ page }) => {
  // Any same-origin page that doesn't start the app, so the old database can be written first.
  await page.goto('/pages/shapes/theme.json');
  await page.evaluate(async () => {
    const json = (v: unknown) => ({ kind: 'json', json: JSON.stringify(v) });
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('crayon-box', 1);
      open.onupgradeneeded = () => {
        const files = open.result.createObjectStore('files');
        files.put(
          json([
            { id: 'moon', color: 'teal', startMode: 'lines' },
            { id: 'kid-abc123', symbol: 'sun', color: 'green', startMode: 'free', name: 'Sample' },
          ]),
          'shell/profiles.json',
        );
        files.put(json({ showNames: true }), 'shell/settings.json');
        files.put(
          json({ pageId: 'builtin:shapes/circle-square-triangle', mode: 'lines', created: 'x', updated: '2026-11-14' }),
          'games/coloring/art/moon/old-picture/art.json',
        );
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });
  });

  await page.goto('/');
  // The two kids from the old single file, in their old order, with the name still shown.
  await expect(page.locator('[data-kid]')).toHaveCount(2);
  await expect(page.locator('[data-kid]').first()).toHaveAttribute('data-kid', 'moon');
  await expect(page.locator('.kid-name')).toHaveText(['Sample']);

  // The old picture is still in that kid's My pictures.
  await page.getByRole('button', { name: 'Moon kid' }).tap();
  await expect(page.locator('[data-screen="coloring-start"]')).toBeVisible();
  await page.getByRole('button', { name: 'My pictures' }).tap();
  await expect(page.locator('[data-picture="old-picture"]')).toBeVisible();

  // Under the hood: per-kid files, change records for everything, and a device id that is not one of them.
  const state = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('crayon-box');
      open.onsuccess = () => resolve(open.result);
    });
    const all = (store: string) =>
      new Promise<string[]>((resolve) => {
        const req = db.transaction(store).objectStore(store).getAllKeys();
        req.onsuccess = () => resolve(req.result as string[]);
      });
    const result = { version: db.version, files: await all('files'), meta: await all('meta') };
    db.close();
    return result;
  });
  expect(state.version).toBe(2);
  expect(state.files).toContain('shell/kids/moon/profile.json');
  expect(state.files).toContain('shell/kids/kid-abc123/profile.json');
  expect(state.files).not.toContain('shell/profiles.json');
  expect(state.files).toContain('shell/local/device.json');
  expect(state.meta).not.toContain('shell/local/device.json');
  expect(state.meta).toContain('games/coloring/art/moon/old-picture/art.json');
  expect(state.meta).toContain('shell/profiles.json'); // remembered as deleted
});
