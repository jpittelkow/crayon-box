// Frame times for the driving maps (docs/highway-map-plan.md, phase 1), read from tools/driving-frames.html in a
// browser that uses the graphics card, with a screenshot of each into test-results/frames/. Run from the repo root:
//   node tools/measure-frames.mjs [seconds] [map ...]     (default: 15 s each of island, site and stress)
// Another port with FRAMES_PORT=…, when several sessions run dev servers at once.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';

const PORT = Number(process.env.FRAMES_PORT ?? 5187);
const seconds = Number(process.argv[2] ?? 15);
const maps = process.argv.length > 3 ? process.argv.slice(3) : ['island', 'site', 'stress'];
mkdirSync('test-results/frames', { recursive: true });
const server = await createServer({ logLevel: 'error', server: { port: PORT, strictPort: true, host: 'localhost' } });
await server.listen();
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  for (const map of maps) {
    await page.goto(`http://localhost:${PORT}/tools/driving-frames.html?map=${map}`);
    await page.waitForFunction((s) => (window.drivingFrames?.seconds ?? 0) >= s, seconds, { timeout: (seconds + 120) * 1000 });
    await page.screenshot({ path: `test-results/frames/${map}.png` });
    console.log(JSON.stringify(await page.evaluate(() => window.drivingFrames)));
  }
} finally {
  await browser.close();
  await server.close();
}
