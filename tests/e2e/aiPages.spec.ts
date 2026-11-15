// AI pages through the family server (ADR 0029). A real sync server runs inside the test with a fake OpenRouter
// behind it; the app connects, asks for a page, and adds it to the library.
import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AiConfig } from '../../server/src/ai';
import { handler } from '../../server/src/http';
import { Store } from '../../server/src/store';
import { openParentArea } from './helpers';

const LINE_ART = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1536" viewBox="0 0 2048 1536">',
  '<rect width="2048" height="1536" fill="#fff"/>',
  '<circle cx="700" cy="768" r="400" fill="none" stroke="#000" stroke-width="18"/>',
  '<rect x="1250" y="400" width="500" height="700" fill="none" stroke="#000" stroke-width="18"/>',
  '</svg>',
].join('');

let dir: string;
let store: Store;
let server: Server;
let address: string;
const asked: string[] = [];

/** OpenRouter's model list, for the Model dropdown (ADR 0032). */
const MODEL_LIST = [
  { id: 'img/model', name: 'Default Image', architecture: { input_modalities: ['text', 'image'], output_modalities: ['image', 'text'] }, pricing: { image_output: '0.00003' } },
  { id: 'other/image', name: 'Other Image', architecture: { input_modalities: ['text'], output_modalities: ['image'] }, pricing: { image_output: '0.000002' } },
  { id: 'draw/model', name: 'Default Drawer', architecture: { input_modalities: ['text'], output_modalities: ['text'] }, pricing: { completion: '0.0000025' } },
];

/** OpenRouter stand-in: the model list; an "image" for idea and photo (an SVG data URL here), SVG text for draw. */
const fakeOpenRouter = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).endsWith('/api/v1/models')) {
    return new Response(JSON.stringify({ data: MODEL_LIST }), { headers: { 'content-type': 'application/json' } });
  }
  const body = JSON.parse(String(init?.body)) as { model: string; modalities?: string[] };
  asked.push(body.model);
  const message = body.modalities
    ? { content: '', images: [{ image_url: { url: `data:image/svg+xml;base64,${Buffer.from(LINE_ART).toString('base64')}` } }] }
    : { content: LINE_ART };
  return new Response(JSON.stringify({ choices: [{ message }] }), { headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

async function startServer(ai?: AiConfig): Promise<void> {
  dir = mkdtempSync(join(tmpdir(), 'cb-e2e-ai-'));
  store = Store.open(dir);
  server = createServer(handler({ store, version: 'e2e', pairingCode: 'ABCD-EFGH', ai }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  address = `127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test.afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
  asked.length = 0;
});

async function connectAndOpenAddPages(page: Page): Promise<void> {
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Family sync' }).click();
  await page.getByLabel('Server address').fill(address);
  await page.getByLabel(/Pairing code/).fill('ABCD-EFGH');
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'ok');
  await page.locator('.pw-nav').getByRole('button', { name: 'Add pages' }).click();
}

const aiStatus = (page: Page) => page.locator('[data-ai-status]');

test('a page from an idea, made on the server, goes into the library', async ({ page }) => {
  await startServer({ key: 'sk-test', imageModel: 'img/model', drawModel: 'draw/model', dailyLimit: 5, fetchFn: fakeOpenRouter });
  await connectAndOpenAddPages(page);
  await expect(page.getByRole('heading', { name: 'Make a page with AI' })).toBeVisible();
  await expect(page.getByText('Today: 0 of 5 AI pages used.')).toBeVisible();
  await page.getByLabel('What should it be?').fill('a fire truck');
  await page.getByRole('button', { name: 'Make it' }).click();
  await expect(aiStatus(page)).toHaveAttribute('data-ai-status', 'ready', { timeout: 30_000 });
  await expect(page.getByText('Today: 1 of 5 AI pages used.')).toBeVisible();
  expect(asked).toEqual(['img/model']);
  await expect(page.getByLabel('Name').first()).toHaveValue('A fire truck');
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await expect(aiStatus(page)).toHaveText('Added “A fire truck” to Our pages.');
  await page.locator('.pw-nav').getByRole('button', { name: 'Page library' }).click();
  await expect(page.locator('[data-page^="family:a-fire-truck-"]')).toBeVisible();
});

test('a picked model makes the page, is remembered, and can be a family favorite', async ({ page }) => {
  await startServer({ key: 'sk-test', imageModel: 'img/model', drawModel: 'draw/model', dailyLimit: 5, fetchFn: fakeOpenRouter });
  await connectAndOpenAddPages(page);
  const model = page.getByLabel('Model', { exact: true });
  await expect(model).toHaveValue('');
  await expect(model.locator('option').first()).toHaveText('Server default: Default Image');
  await model.selectOption('other/image');
  await expect(page.locator('[data-ai-price]')).toHaveText('Price: $2 per million image tokens.');
  await page.locator('[data-ai-star]').click();
  await expect(page.locator('[data-ai-star]')).toHaveText('★ Remove from favorites');
  expect(store.aiFavorites()).toEqual(['other/image']);
  await expect(model.locator('optgroup[label="Favorites"] option')).toHaveText(['★ Other Image ($2 per million image tokens)']);
  await page.getByLabel('What should it be?').fill('a cat');
  await page.getByRole('button', { name: 'Make it' }).click();
  await expect(aiStatus(page)).toHaveAttribute('data-ai-status', 'ready', { timeout: 30_000 });
  await expect(aiStatus(page)).toContainText('Made by Other Image.');
  expect(asked).toEqual(['other/image']);

  // Drawing lists only text models; back on ideas, the pick is remembered.
  await page.getByRole('group', { name: 'How to make it' }).getByRole('button', { name: 'Drawn simply' }).click();
  await expect(model.locator('option')).toHaveText(['Server default: Default Drawer', 'Default Drawer ($2.5 per million tokens out)']);
  await page.getByRole('group', { name: 'How to make it' }).getByRole('button', { name: 'From an idea' }).click();
  await expect(model).toHaveValue('other/image');
  await page.locator('.pw-nav').getByRole('button', { name: 'Page library' }).click();
  await page.locator('.pw-nav').getByRole('button', { name: 'Add pages' }).click();
  await expect(page.getByLabel('Model', { exact: true })).toHaveValue('other/image');

  // The search narrows the list.
  await page.getByLabel('Search models').fill('default');
  await expect(page.getByLabel('Model', { exact: true }).locator('optgroup[label^="Matching"] option')).toHaveText(['Default Image ($30 per million image tokens)']);
});

test('drawn simply uses the drawing model and an SVG', async ({ page }) => {
  await startServer({ key: 'sk-test', imageModel: 'img/model', drawModel: 'draw/model', dailyLimit: 5, fetchFn: fakeOpenRouter });
  await connectAndOpenAddPages(page);
  await page.getByRole('group', { name: 'How to make it' }).getByRole('button', { name: 'Drawn simply' }).click();
  await page.getByLabel('What should it be?').fill('a boat');
  await page.getByRole('button', { name: 'Make it' }).click();
  await expect(aiStatus(page)).toHaveAttribute('data-ai-status', 'ready', { timeout: 30_000 });
  expect(asked).toEqual(['draw/model']);
  await expect(page.getByText(/areas to color/).first()).toBeVisible();
});

test('the daily limit is said in words', async ({ page }) => {
  await startServer({ key: 'sk-test', imageModel: 'img/model', drawModel: 'draw/model', dailyLimit: 0, fetchFn: fakeOpenRouter });
  await connectAndOpenAddPages(page);
  await page.getByLabel('What should it be?').fill('a cat');
  await page.getByRole('button', { name: 'Make it' }).click();
  await expect(aiStatus(page)).toHaveAttribute('data-ai-status', 'problem');
  await expect(aiStatus(page)).toHaveText(/used up/);
  expect(asked).toEqual([]);
});

test('without a key on the server, the screen says what AI pages need', async ({ page }) => {
  await startServer();
  await connectAndOpenAddPages(page);
  await expect(page.locator('[data-ai-off]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Make it' })).toHaveCount(0);
});
