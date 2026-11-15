// Batch version of the clean-up dev tool (tools/clean-page.html, ADR 0005, 0022): runs every image in a folder
// through the app's own clean-up and page check, in a real browser, and writes the cleaned page.png files plus a
// report. Run from the repo root:
//
//   node tools/clean-pages.mjs <in-folder> <out-folder> [--gap 6] [--trim 1.5] [--join 15]
//
// --trim cuts that percentage off every edge first: AI images often have a faint frame at the very edge.
// --join closes shapes cut by an edge: two lines meeting an edge less than that percentage apart are joined along it.
//
// Each <name>.png|jpg|webp becomes <out-folder>/<name>.png; report.json lists areas, open shapes, small areas, and
// how much line touches the picture's edge (a shape cut by the edge is left open once the page margin is added).
import { chromium } from '@playwright/test';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { gap: { type: 'string', default: '6' }, trim: { type: 'string', default: '1.5' }, join: { type: 'string', default: '15' } } });
const [input, output] = positionals.map((p) => resolve(p));
if (!input || !output) {
  console.error('Usage: node tools/clean-pages.mjs <in-folder> <out-folder> [--gap 6] [--trim 1.5] [--join 15]');
  process.exit(1);
}
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const files = readdirSync(input).filter((f) => MIME[extname(f).toLowerCase()]);
mkdirSync(output, { recursive: true });

const PORT = 5187;
const server = await createServer({ logLevel: 'error', server: { port: PORT, strictPort: true, host: 'localhost' } });
await server.listen();
const browser = await chromium.launch();
const report = {};
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/tools/clean-page.html`);
  for (const f of files) {
    const src = `data:${MIME[extname(f).toLowerCase()]};base64,${readFileSync(join(input, f)).toString('base64')}`;
    const r = await page.evaluate(
      async ({ src, gap, trim, maxJoin }) => {
        const cleanup = await import('/src/games/coloring/engine/cleanup.ts');
        const check = await import('/src/games/coloring/engine/pageCheck.ts');
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        const tx = Math.round((img.naturalWidth * trim) / 100);
        const ty = Math.round((img.naturalHeight * trim) / 100);
        c.width = img.naturalWidth - 2 * tx;
        c.height = img.naturalHeight - 2 * ty;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, -tx, -ty);
        // A shape cut by the picture's edge (a tail or a wing running off it) would be left open once the page
        // margin is added. Where two lines meet the same edge close together, join them along that edge.
        let px = ctx.getImageData(0, 0, c.width, c.height);
        const dark = (x, y) => {
          const o = (y * c.width + x) * 4;
          return px.data[o + 3] > 128 && px.data[o] + px.data[o + 1] + px.data[o + 2] < 384;
        };
        const t = Math.max(4, Math.round(Math.min(c.width, c.height) * 0.008));
        const sides = [
          { len: c.width, at: (i) => [i, 0], box: (a, b) => [a, 0, b - a, t] },
          { len: c.width, at: (i) => [i, c.height - 1], box: (a, b) => [a, c.height - t, b - a, t] },
          { len: c.height, at: (i) => [0, i], box: (a, b) => [0, a, t, b - a] },
          { len: c.height, at: (i) => [c.width - 1, i], box: (a, b) => [c.width - t, a, t, b - a] },
        ];
        const joins = [];
        let edgeInk = 0;
        for (const side of sides) {
          const runs = [];
          for (let i = 0; i < side.len; i++) {
            if (!dark(...side.at(i))) continue;
            edgeInk++;
            const last = runs[runs.length - 1];
            if (last && last[1] === i - 1) last[1] = i;
            else runs.push([i, i]);
          }
          for (let r = 1; r < runs.length; r++)
            if (runs[r][0] - runs[r - 1][1] < side.len * maxJoin) joins.push(side.box(runs[r - 1][0], runs[r][1] + 1));
        }
        ctx.fillStyle = '#000';
        for (const b of joins) ctx.fillRect(...b);
        if (joins.length) px = ctx.getImageData(0, 0, c.width, c.height);
        const result = cleanup.cleanUpLineArt(px.data, c.width, c.height, { gap });
        const res = check.checkPage(result.ink, result.width, result.height);
        const out = document.createElement('canvas');
        out.width = result.width;
        out.height = result.height;
        out.getContext('2d').putImageData(new ImageData(result.rgba, result.width, result.height), 0, 0);
        return {
          png: out.toDataURL('image/png'),
          threshold: result.threshold,
          regions: res.regions,
          openShapes: res.openShapes,
          smallRegions: res.smallRegions.length,
          edgeInk,
          joins: joins.length,
        };
      },
      { src, gap: Number(values.gap), trim: Number(values.trim), maxJoin: Number(values.join) / 100 },
    );
    const name = `${basename(f, extname(f))}.png`;
    writeFileSync(join(output, name), Buffer.from(r.png.split(',')[1], 'base64'));
    const { png: _png, ...rest } = r;
    report[name] = rest;
    console.log(`${r.openShapes.length ? 'OPEN' : 'ok  '} ${name}: ${r.regions} areas, ${r.smallRegions} small, ${r.openShapes.length} open${r.edgeInk ? `, ${r.edgeInk} px of line at the edge` : ''}${r.joins ? `, ${r.joins} cut shape(s) closed` : ''}`);
  }
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  await server.close();
}
