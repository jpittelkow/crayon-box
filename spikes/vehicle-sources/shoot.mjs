// Screenshots of the three fire trucks into spikes/vehicle-sources/shots/, plus the measured draw costs.
// Run from the repo root:  node spikes/vehicle-sources/shoot.mjs [shot,shot]
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'shots');
mkdirSync(out, { recursive: true });
const PORT = 5185;
const only = process.argv[2]?.split(',');

const SHOTS = {
  'lineup-front': '?view=lineup&shot=front&bench=1',
  'lineup-side': '?view=lineup&shot=side',
  'lineup-back': '?view=lineup&shot=back',
  'drive-code': '?view=drive&truck=code&auto=6',
  'drive-kit': '?view=drive&truck=kit&auto=6',
  'drive-kit-toy': '?view=drive&truck=kit-toy&auto=6',
  'drive-ai': '?view=drive&truck=ai&auto=6',
  'drive-ai-lite': '?view=drive&truck=ai-lite&auto=6',
};

const server = await createServer({ root: here, logLevel: 'error', server: { port: PORT, strictPort: true, host: 'localhost' } });
await server.listen();
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => m.type() === 'warning' && console.warn('page:', m.text()));
  for (const [name, query] of Object.entries(SHOTS)) {
    if (only && !only.includes(name)) continue;
    await page.goto(`http://localhost:${PORT}/${query}`);
    await page.waitForFunction(() => window.shotReady === true, null, { timeout: 180_000 });
    await page.screenshot({ path: join(out, `${name}.png`) });
    if (query.includes('bench')) {
      const result = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        const ext = gl?.getExtension('WEBGL_debug_renderer_info');
        return { bench: window.bench, gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown', table: document.querySelector('#panel')?.innerText };
      });
      writeFileSync(join(out, 'bench.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
    }
    console.log('shot', name);
  }
} finally {
  await browser.close();
  await server.close();
}
