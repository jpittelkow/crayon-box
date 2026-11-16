// Draws the driving picker's pictures once, on the dev machine, so the app ships them instead of drawing them on
// the laptop (owner, 2026-11-15): every vehicle in every colour it can be drawn in, and every map, as WebP files in
// assets/pictures/driving/. Run `npm run pictures:driving` after changing how a vehicle or a map looks; the unit
// tests fail while a picture is missing.
//
// It starts the app's own dev server, opens it in a browser that uses the graphics card, and draws with the game's
// own code (src/games/racing/look/thumbs.ts), so the pictures match the game.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const OUT = 'assets/pictures/driving';
// Another port with PICTURES_PORT=…, when several sessions run dev servers at once.
const PORT = Number(process.env.PICTURES_PORT ?? 5199);
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`);
  const pictures = await page.evaluate(async () => {
    const thumbs = await import('/src/games/racing/look/thumbs.ts');
    const { VEHICLES, PICTURE_COLORS, KID_HEX } = await import('/src/games/racing/settings.ts');
    const { MAPS } = await import('/src/games/racing/maps/index.ts');
    const { vehicleFile, mapFile } = await import('/src/games/racing/look/shippedPictures.ts');
    const out = {};
    const painter = thumbs.vehiclePainter(480, 360, 'image/webp', 0.85);
    try {
      for (const kind of VEHICLES) for (const color of PICTURE_COLORS) out[vehicleFile(kind, color)] = painter.draw(kind, color);
    } finally {
      painter.dispose();
    }
    // A map's picture shows the kid's car only as a speck: drawn once, in the first kid colour.
    for (const map of MAPS) out[mapFile(map.id)] = thumbs.mapPicture(map, KID_HEX.orange, 640, 300, 'image/webp', 0.85);
    return out;
  });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  let bytes = 0;
  for (const [name, url] of Object.entries(pictures)) {
    if (!url.startsWith('data:image/webp;base64,')) throw new Error(`${name} did not come out as WebP`);
    const data = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    bytes += data.length;
    writeFileSync(join(OUT, `${name}.webp`), data);
  }
  console.log(`${readdirSync(OUT).length} pictures, ${(bytes / 1024 / 1024).toFixed(1)} MB, in ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
