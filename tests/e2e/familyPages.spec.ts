// Phase F: family pages from files (ADR 0005). Real files go through the parent area's Add pages screen, then
// show up in the kids' library under Our pages (or a chosen theme).
import { expect, test, type Page } from '@playwright/test';
import { openParentArea, pick } from './helpers';

/** A drawing made in the page: closed shapes in black on white, as a PNG. */
async function drawingPng(page: Page): Promise<Buffer> {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 900;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 1200, 900);
    g.strokeStyle = '#111';
    g.lineWidth = 14;
    g.strokeRect(100, 150, 400, 400);
    g.beginPath();
    g.arc(820, 350, 220, 0, Math.PI * 2);
    g.stroke();
    return c.toDataURL('image/png');
  });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

const SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">',
  '<rect width="800" height="600" fill="#fff"/>',
  '<circle cx="400" cy="300" r="200" fill="none" stroke="#000" stroke-width="10"/>',
  '<rect x="300" y="200" width="200" height="200" fill="none" stroke="#000" stroke-width="10"/>',
  '</svg>',
].join('');

/** A one-page PDF with a square and a triangle drawn as vector strokes. */
function tinyPdf(): Buffer {
  const content = '6 w 120 200 300 300 re S 400 200 m 560 500 l 240 500 l h S';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 700 700] /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function openAddPages(page: Page): Promise<void> {
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Add pages' }).click();
  await expect(page.getByRole('heading', { name: 'Add a page from a file' })).toBeVisible();
}

const status = (page: Page) => page.locator('[data-add-status]');

test('a drawing becomes a page in Our pages, and a kid can color it', async ({ page }) => {
  await openAddPages(page);
  await page.getByLabel('Choose a file').setInputFiles({ name: 'my-dragon.png', mimeType: 'image/png', buffer: await drawingPng(page) });
  await expect(status(page)).toHaveAttribute('data-add-status', 'ready', { timeout: 20_000 });
  await expect(page.getByText(/areas to color/)).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('My dragon');
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await expect(status(page)).toHaveText('Added “My dragon” to Our pages.');

  // In the library: Our pages comes first in the strip, with the page in it.
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  const ours = page.locator('.theme-strip [data-theme="our-pages"]');
  await expect(ours).toBeVisible();
  await ours.tap();
  await page.getByRole('button', { name: 'My dragon page' }).tap();
  await expect(page.locator('.coloring-page')).toHaveAttribute('data-ready', 'true');
  await pick(page, 'Back');
});

test('an SVG goes to the theme a parent picks', async ({ page }) => {
  await openAddPages(page);
  await page.getByLabel('Choose a file').setInputFiles({ name: 'target.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  await expect(status(page)).toHaveAttribute('data-add-status', 'ready', { timeout: 20_000 });
  await page.getByLabel('Theme').selectOption({ label: 'Shapes' });
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await expect(status(page)).toHaveText('Added “Target” to Shapes.');
  await page.locator('.pw-nav').getByRole('button', { name: 'Page library' }).click();
  await expect(page.locator('[data-page^="family:target-"]')).toBeVisible();
});

test('the first page of a PDF becomes a page', async ({ page }) => {
  await openAddPages(page);
  await page.getByLabel('Choose a file').setInputFiles({ name: 'worksheet.pdf', mimeType: 'application/pdf', buffer: tinyPdf() });
  await expect(status(page)).toHaveAttribute('data-add-status', 'ready', { timeout: 30_000 });
  await expect(page.getByText(/areas to color/)).toBeVisible();
});

test('a file with no lines is said in words', async ({ page }) => {
  await openAddPages(page);
  const blank = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/png');
  });
  await page.getByLabel('Choose a file').setInputFiles({ name: 'blank.png', mimeType: 'image/png', buffer: Buffer.from(blank.split(',')[1], 'base64') });
  await expect(status(page)).toHaveAttribute('data-add-status', 'problem', { timeout: 20_000 });
  await expect(status(page)).toHaveText(/No lines were found/);
});

test('a family page can be hidden and removed', async ({ page }) => {
  await openAddPages(page);
  await page.getByLabel('Choose a file').setInputFiles({ name: 'boat.png', mimeType: 'image/png', buffer: await drawingPng(page) });
  await expect(status(page)).toHaveAttribute('data-add-status', 'ready', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Add to the library' }).click();
  await page.locator('.pw-nav').getByRole('button', { name: 'Page library' }).click();
  const row = page.locator('[data-page^="family:boat-"]');
  await row.getByRole('switch', { name: 'Show Boat' }).click();
  await page.getByRole('button', { name: 'Back to the kids' }).click();
  await page.getByRole('button', { name: 'Star kid' }).tap();
  // Hidden: Our pages has nothing to show, so it has no button.
  await expect(page.locator('[data-screen="page-library"]')).toBeVisible();
  await expect(page.locator('.theme-strip [data-theme="our-pages"]')).toHaveCount(0);
  await page.goto('/');
  await openParentArea(page);
  await page.locator('.pw-nav').getByRole('button', { name: 'Page library' }).click();
  await row.getByRole('button', { name: 'Remove Boat' }).click();
  await row.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(row).toHaveCount(0);
});
