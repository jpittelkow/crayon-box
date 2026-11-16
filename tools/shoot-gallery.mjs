// Screenshots of the driving asset gallery (tools/driving-gallery.html) into test-results/gallery/, for checking
// it without a browser at hand. Run from the repo root:  node tools/shoot-gallery.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';

// Another port with GALLERY_PORT=…, when several sessions take screenshots at once.
const PORT = Number(process.env.GALLERY_PORT ?? 5186);
mkdirSync('test-results/gallery', { recursive: true });
const server = await createServer({ logLevel: 'error', server: { port: PORT, strictPort: true, host: 'localhost' } });
await server.listen();
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('console:', m.text()));
  // The set pieces' row, then each new set piece close up (ADR 0042).
  const pieces = ['mud', 'ford', 'lights', 'roundabout', 'harbour'].map((at) => `setpieces&at=${at}`);
  for (const row of ['', 'vehicles', 'toys', 'scenery', 'effects', 'setpieces', ...pieces]) {
    await page.goto(`http://localhost:${PORT}/tools/driving-gallery.html${row ? `?row=${row}` : ''}`);
    await page.waitForFunction(() => window.galleryReady === true, null, { timeout: 120_000 });
    await page.waitForTimeout(300);
    const name = row.replace('&at=', '-') || 'all';
    await page.screenshot({ path: `test-results/gallery/${name}.png` });
    console.log('shot', name);
  }
} finally {
  await browser.close();
  await server.close();
}
