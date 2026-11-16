// Pictures of driving maps from above, in the map viewer (tools/driving-map.html), into test-results/map/: for a pull
// request, or for checking a map without a browser at hand. Run from the repo root:
//   node tools/shoot-map.mjs                      the island and the building site
//   node tools/shoot-map.mjs site test-loop       those maps (a built-in id, or a .json file's address on the dev server)
// Each map is shot twice: with its labels, and with the grid and "too far from a road" only.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';

// Another port with MAP_PORT=…, when several sessions take screenshots at once.
const PORT = Number(process.env.MAP_PORT ?? 5187);
const maps = process.argv.slice(2).length ? process.argv.slice(2) : ['island', 'site'];
mkdirSync('test-results/map', { recursive: true });
const server = await createServer({ logLevel: 'error', server: { port: PORT, strictPort: true, host: 'localhost' } });
await server.listen();
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  for (const map of maps) {
    for (const [suffix, layers] of [['', 'roads,zones,targets,things,problems'], ['-far', 'grid,far']]) {
      await page.goto(`http://localhost:${PORT}/tools/driving-map.html?map=${encodeURIComponent(map)}&layers=${layers}`);
      await page.waitForFunction(() => window.mapViewReady === true, null, { timeout: 120_000 });
      await page.waitForTimeout(300);
      const name = `${map.replace(/[^a-z0-9-]+/gi, '_')}${suffix}`;
      await page.screenshot({ path: `test-results/map/${name}.png` });
      console.log('shot', name, await page.locator('#status').textContent());
    }
  }
} finally {
  await browser.close();
  await server.close();
}
