// Renders every sample to spikes/realism/shots/ and lays them out on one grading sheet (sheet.png).
// Run from the repo root:  node spikes/realism/shoot.mjs
// Optional measured costs are read from shots/bench.json ({ "1": { "msPerFrame": .., "calls": .. }, ... }).
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'shots');
mkdirSync(out, { recursive: true });

const PORT = 5182;
const only = process.argv[2]?.split(','); // e.g. "2-car,3-car" to redo some shots

const LEVELS = [
  {
    level: 0, name: 'Today', shots: ['play', 'car'],
    effort: 'Done. What the prototype draws now.',
    detail: 'Boxes and cones built in code, flat colours, ink outlines, round blob shadows.',
  },
  {
    level: 1, name: 'Toy, simple', shots: ['play', 'car', 'lineup'],
    effort: 'Easy. All built in code, about a session. A new vehicle is an hour or two.',
    detail: 'Rounded bodies, real wheels, glass, lamps; real shadows from the sun; plain paint.',
  },
  {
    level: 2, name: 'Toy, polished', shots: ['play', 'car', 'lineup'],
    effort: 'Moderate. Built in code, a few sessions. A new vehicle is a few hours.',
    detail: 'Level 1 plus shiny clear-coat paint with reflections, spoked rims and tread, mirrors, '
      + 'edge lines, patchy grass, bushes, a sky and haze. Police lamps light the car.',
  },
  {
    level: 3, name: 'Near-photo', shots: ['play', 'car', 'lineup'],
    effort: 'Hard. To look truly real it needs proper 3D models and textures from a kit or an artist; '
      + 'what is here is level 2 with the effects turned up. Many sessions.',
    detail: 'Textured asphalt, grass, sand and wood, kerbs, grass tufts and flowers, reflecting sea, '
      + 'soft contact shadows and a glow on lamps. Heaviest on the graphics chip.',
  },
];
const SHOT_NAMES = { play: 'Driving camera', car: "The kid's car", lineup: 'Vehicle line-up' };

const server = await createServer({
  root: here,
  logLevel: 'error',
  server: { port: PORT, strictPort: true, host: 'localhost' },
});
await server.listen();
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  for (const { level, shots } of LEVELS) {
    for (const shot of shots) {
      const name = `${level}-${shot}`;
      if (only && !only.includes(name)) continue;
      const started = Date.now();
      await page.goto(`http://localhost:${PORT}/?level=${level}&shot=${shot}`);
      await page.waitForFunction(() => window.shotReady === true, null, { timeout: 180_000 });
      await page.locator('#view').screenshot({ path: join(out, `${name}.png`) });
      console.log(`${name}.png  ${((Date.now() - started) / 1000).toFixed(1)} s`);
    }
  }

  // ---- The grading sheet ----
  const bench = existsSync(join(out, 'bench.json')) ? JSON.parse(readFileSync(join(out, 'bench.json'), 'utf8')) : {};
  const img = (name) => existsSync(join(out, `${name}.png`))
    ? `<img src="data:image/png;base64,${readFileSync(join(out, `${name}.png`)).toString('base64')}">`
    : '<div class="none">Not drawn: only one kind of car exists today</div>';
  const cost = (level) => {
    const b = bench[level];
    if (!b) return '';
    const base = bench[0]?.msPerFrame;
    const times = base ? ` (${(b.msPerFrame / base).toFixed(1)}× today)` : '';
    return `<p class="cost">Drawing cost: ${b.msPerFrame.toFixed(1)} ms a frame${times}, ${b.calls} draw calls.</p>`;
  };
  const rows = LEVELS.map(({ level, name, effort, detail }) => `
    <section>
      <header><h2>${level}. ${name}</h2><p class="effort">${effort}</p><p>${detail}</p>${cost(level)}</header>
      <div class="shots">${['play', 'car', 'lineup'].map((s) => `<figure>${img(`${level}-${s}`)}<figcaption>${SHOT_NAMES[s]}</figcaption></figure>`).join('')}</div>
    </section>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 28px; width: 1600px; background: #f1f3f6; color: #1d2733;
      font: 16px/1.4 'Segoe UI', system-ui, sans-serif; }
    h1 { margin: 0 0 4px; font-size: 30px; } .sub { margin: 0 0 22px; color: #55606d; }
    section { background: #fff; border-radius: 14px; padding: 18px 20px; margin-bottom: 18px; }
    h2 { margin: 0 0 4px; font-size: 22px; } header p { margin: 2px 0; } .effort { font-weight: 600; }
    .cost { color: #55606d; }
    .shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    figure { margin: 0; } img { width: 100%; border-radius: 8px; display: block; }
    figcaption { color: #55606d; font-size: 14px; margin-top: 4px; }
    .none { aspect-ratio: 16 / 10; border-radius: 8px; background: #e6e9ee; color: #7a8592; display: grid;
      place-items: center; font-size: 14px; padding: 12px; text-align: center; }
  </style></head><body>
    <h1>Driving game: how real should it look?</h1>
    <p class="sub">The same island and the same moment at each level. Vehicles are built in code; none come from a model kit yet.<br>Drawing cost was measured on the dev machine's fast desktop graphics card; a laptop's built-in graphics are many times slower. A smooth game needs under 16.7 ms a frame. The samples draw every piece separately; the game would batch them, which cuts levels 1 to 3 a lot.</p>
    ${rows}
  </body></html>`;
  writeFileSync(join(out, 'sheet.html'), html);
  const sheet = await browser.newPage({ viewport: { width: 1656, height: 900 } });
  await sheet.setContent(html, { waitUntil: 'load' });
  await sheet.screenshot({ path: join(out, 'sheet.png'), fullPage: true });
  console.log('sheet.png');
} finally {
  await browser.close();
  await server.close();
}
