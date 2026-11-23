import { describe, expect, it } from 'vitest';
import { pagesOf } from './pickerPages';
import { cachedPicture, forgetPictures, picturePath } from './look/pictureCache';
import type { GameStorage } from '../../storage/types';

describe('the vehicle picker pages', () => {
  it('fit six or fewer on one page', () => {
    expect(pagesOf(4)).toEqual([[0, 1, 2, 3]]);
    expect(pagesOf(6)).toEqual([[0, 1, 2, 3, 4, 5]]);
  });

  it('leave room for a more tile and a back tile, and show every vehicle once', () => {
    const pages = pagesOf(14);
    expect(pages).toEqual([[0, 1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12, 13]]);
    // Twenty (ADR 0048) take five pages.
    expect(pagesOf(20).map((p) => p.length)).toEqual([5, 4, 4, 4, 3]);
    for (let n = 1; n <= 30; n++) {
      const all = pagesOf(n);
      expect(all.flat()).toEqual([...Array(n).keys()]);
      // First page: vehicles and "more"; between: "back", vehicles, "more"; last: "back" and the rest. Six places.
      all.forEach((p, i) => expect(p.length + Number(i > 0) + Number(i < all.length - 1)).toBeLessThanOrEqual(6));
    }
  });
});

function memoryStorage(): GameStorage & { blobs: Map<string, Blob> } {
  const blobs = new Map<string, Blob>();
  return {
    blobs,
    getJson: async () => undefined,
    putJson: async () => {},
    getBlob: async (p) => blobs.get(p),
    putBlob: async (p, b) => void blobs.set(p, b),
    list: async (prefix) => [...blobs.keys()].filter((k) => k.startsWith(prefix)).sort(),
    delete: async (p) => void blobs.delete(p),
  };
}

describe('the picker pictures', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';

  it('are drawn once, then kept in memory', async () => {
    forgetPictures();
    let draws = 0;
    const draw = () => (draws++, png);
    expect(await cachedPicture('vehicle-car-#ff0000', draw)).toBe(png);
    expect(await cachedPicture('vehicle-car-#ff0000', draw)).toBe(png);
    expect(draws).toBe(1);
  });

  it('are kept on the device by version, and an older version is dropped', async () => {
    forgetPictures();
    const storage = memoryStorage();
    storage.blobs.set(picturePath('0.6.0', 'map-not-shipped'), new Blob(['old']));
    await cachedPicture('map-not-shipped', () => png, storage, '0.7.1');
    await new Promise((r) => setTimeout(r, 50));
    expect([...storage.blobs.keys()]).toEqual([picturePath('0.7.1', 'map-not-shipped')]);
    // The next session finds it on the device and doesn't draw it.
    forgetPictures();
    let draws = 0;
    const url = await cachedPicture('map-not-shipped', () => (draws++, png), storage, '0.7.1');
    expect(draws).toBe(0);
    expect(url).toMatch(/^blob:/);
  });
});

describe('turning the picture down on a slow computer', () => {
  it('steps down while frames are slow, never below half, and never back up', async () => {
    const { nextDetail, detailWatcher, MIN_DETAIL, DETAIL_FRAMES } = await import('./detail');
    expect(nextDetail(1, 16.7)).toBe(1);
    expect(nextDetail(1, 40)).toBe(0.8);
    expect(nextDetail(0.55, 40)).toBe(MIN_DETAIL);
    const w = detailWatcher(5);
    const changes: number[] = [];
    // Shaders compiling at first: not counted. Then slow frames, then fast ones.
    for (let i = 0; i < 5; i++) expect(w.frame(400)).toBeNull();
    for (let i = 0; i < DETAIL_FRAMES * 6; i++) {
      const c = w.frame(35);
      if (c !== null) changes.push(c);
    }
    for (let i = 0; i < DETAIL_FRAMES * 3; i++) expect(w.frame(10)).toBeNull();
    expect(changes).toEqual([0.8, 0.64, 0.51, 0.5]);
    expect(w.detail).toBe(0.5);
    // A hidden tab's long frame doesn't count.
    const h = detailWatcher(0);
    for (let i = 0; i < DETAIL_FRAMES; i++) expect(h.frame(i === 3 ? 5000 : 16)).toBeNull();
  });
});

describe('the pictures that ship with the app (owner, 2026-11-15)', () => {
  it('cover every vehicle in every colour, and every map: run `npm run pictures:driving` if one is missing', async () => {
    const { VEHICLES, PICTURE_COLORS, carColors, KID_HEX } = await import('./settings');
    const { MAPS } = await import('./maps');
    const { shippedPicture, vehicleFile, mapFile } = await import('./look/shippedPictures');
    const missing: string[] = [];
    for (const kind of VEHICLES) for (const color of PICTURE_COLORS) if (!shippedPicture(vehicleFile(kind, color))) missing.push(vehicleFile(kind, color));
    for (const map of MAPS) if (!shippedPicture(mapFile(map.id))) missing.push(mapFile(map.id));
    expect(missing).toEqual([]);
    // Every colour the picker can offer any kid is one of them.
    for (const own of Object.values(KID_HEX)) for (const c of carColors(own)) expect(PICTURE_COLORS).toContain(c);
  });

  it('a shipped picture is used before anything is drawn', async () => {
    forgetPictures();
    const { vehicleFile } = await import('./look/shippedPictures');
    let draws = 0;
    const url = await cachedPicture(vehicleFile('car', '#2B2B2B'), () => (draws++, 'data:,'));
    expect(draws).toBe(0);
    expect(url).toMatch(/vehicle-car-2b2b2b/);
  });

  it('the kid colours match the design tokens', async () => {
    const { readFileSync } = await import('node:fs');
    const { KID_HEX } = await import('./settings');
    const { KID_COLORS } = await import('../../shell/profiles');
    const css = readFileSync('src/ui/tokens.css', 'utf8');
    expect(Object.keys(KID_HEX).sort()).toEqual([...KID_COLORS].sort());
    for (const [name, hex] of Object.entries(KID_HEX)) expect(css).toContain(`--kid-${name}: ${hex};`);
  });
});
