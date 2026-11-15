// Phase C2: family sync in the app (ADR 0024). A real sync server runs inside the test; two browser contexts are
// two devices, each with its own storage.
import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handler } from '../../server/src/http';
import { Store } from '../../server/src/store';
import { SHAPES, openParentArea, pick, tapPage } from './helpers';

let dir: string;
let store: Store;
let server: Server;
let address: string;

test.beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cb-e2e-sync-'));
  store = Store.open(dir);
  server = createServer(handler({ store, version: 'e2e', pairingCode: 'ABCD-EFGH' }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  address = `127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

async function connect(page: Page, code = 'ABCD-EFGH'): Promise<void> {
  await page.locator('.pw-nav').getByRole('button', { name: 'Family sync' }).click();
  await page.getByLabel('Server address').fill(address);
  await page.getByLabel(/Pairing code/).fill(code);
  await page.getByRole('button', { name: 'Connect' }).click();
}

test('asks once whether there is a family server, in the parent area only', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  const card = page.locator('[data-first-run="sync"]');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Not now' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await openParentArea(page);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(card).toHaveCount(0);
});

test('a wrong pairing code is said in words', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await connect(page, 'WRONG-CODE');
  await expect(page.locator('#sync-connect-status')).toHaveText(/pairing code isn’t right/);
});

test('a picture painted on one device shows up on another', async ({ browser }) => {
  const one = await (await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })).newPage();
  const two = await (await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } })).newPage();

  // Device one: paint, then connect (its first sync sends the picture).
  await one.goto('/');
  await one.getByRole('button', { name: 'Star kid' }).tap();
  await one.getByRole('button', { name: 'Shapes', exact: true }).tap();
  await one.getByRole('button', { name: SHAPES.title }).tap();
  await expect(one.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(one, 'Red');
  await tapPage(one, SHAPES.inCircle);
  await pick(one, 'Back');
  await one.goto('/');
  await openParentArea(one);
  await connect(one);
  await expect(one.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'ok');
  await expect(one.getByText(/Last synced today/)).toBeVisible();
  expect(store.stats().items).toBeGreaterThan(2);

  // Device two: connect, and the picture is in Star's My pictures.
  await two.goto('/');
  await openParentArea(two);
  await connect(two);
  await expect(two.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'ok');
  await two.getByRole('button', { name: 'Back to the kids' }).click();
  await two.getByRole('button', { name: 'Star kid' }).tap();
  await pick(two, 'My pictures');
  await expect(two.locator('[data-picture]')).toHaveCount(1);
});

test('a background round doesn’t wipe what a parent is typing', async ({ page }) => {
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Family sync' }).click();
  await page.getByLabel('Server address').fill(address);
  // The first background round runs 5 s after start; wait past it.
  await page.waitForTimeout(6000);
  await expect(page.getByLabel('Server address')).toHaveValue(address);
});
