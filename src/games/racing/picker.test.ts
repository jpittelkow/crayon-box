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
    storage.blobs.set(picturePath('0.6.0', 'map-island'), new Blob(['old']));
    await cachedPicture('map-island', () => png, storage, '0.7.1');
    await new Promise((r) => setTimeout(r, 50));
    expect([...storage.blobs.keys()]).toEqual([picturePath('0.7.1', 'map-island')]);
    // The next session finds it on the device and doesn't draw it.
    forgetPictures();
    let draws = 0;
    const url = await cachedPicture('map-island', () => (draws++, png), storage, '0.7.1');
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
