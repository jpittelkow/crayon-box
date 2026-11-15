// The page check (ADR 0005), run on every built-in page in CI. Each page is rendered at 2048 x 1536 in the same
// browser and with the same region code the app uses, then checked for open shapes (a failure) and very small
// areas (a warning, shown as a test annotation).
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const root = join(process.cwd(), 'pages');
const dirs = (p: string) => readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory());
const pages = dirs(root).flatMap((theme) =>
  dirs(join(root, theme)).map((page) => {
    const file = existsSync(join(root, theme, page, 'page.svg')) ? 'page.svg' : 'page.png';
    return { id: `${theme}/${page}`, url: `/pages/${theme}/${page}/${file}` };
  }),
);

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

for (const p of pages) {
  test(`page ${p.id} has closed shapes`, async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async (url) => {
      const regions = await import('/src/games/coloring/engine/regions.ts' as string);
      const check = await import('/src/games/coloring/engine/pageCheck.ts' as string);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 2048;
      canvas.height = 1536;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, 2048, 1536);
      const { walls } = regions.wallsFromRgba(ctx.getImageData(0, 0, 2048, 1536).data, 2048, 1536);
      return check.checkPage(walls, 2048, 1536) as { regions: number; openShapes: Box[]; smallRegions: Box[] };
    }, p.url);

    const where = (b: Box) => `the area at x ${b.x}–${b.x + b.width}, y ${b.y}–${b.y + b.height}`;
    for (const b of result.smallRegions) {
      test.info().annotations.push({ type: 'warning', description: `${p.id}: small area, ${where(b)}` });
    }
    expect(result.regions, `${p.id} has nothing to color`).toBeGreaterThan(1);
    expect(
      result.openShapes.map(where),
      `${p.id}: a gap of up to 6 px in the lines around these areas lets paint leak out (ADR 0005)`,
    ).toEqual([]);
  });
}
