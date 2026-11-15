import { describe, expect, it } from 'vitest';
import { cleanUpLineArt, fitToPage, otsuThreshold, removeSpecks, toGray } from './cleanup';
import { checkPage } from './pageCheck';
import { labelRegions } from './regions';

/** A gray picture as RGBA. */
function rgbaOf(gray: number[], alpha = 255): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length * 4);
  gray.forEach((v, i) => out.set([v, v, v, alpha], i * 4));
  return out;
}

/** A w x h picture of `paper` with a box outline of `ink`, `t` px thick, and an optional gap in its right side. */
function boxPicture(w: number, h: number, opts: { ink?: number; paper?: number; t?: number; gap?: number } = {}) {
  const { ink = 30, paper = 235, t = 3, gap = 0 } = opts;
  const g: number[] = [];
  const [x0, y0, x1, y1] = [Math.round(w * 0.25), Math.round(h * 0.25), Math.round(w * 0.75), Math.round(h * 0.75)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inBand =
        x >= x0 && x <= x1 && y >= y0 && y <= y1 && (x < x0 + t || x > x1 - t || y < y0 + t || y > y1 - t);
      const inGap = gap > 0 && x > x1 - t && y >= Math.round(h / 2) && y < Math.round(h / 2) + gap;
      g.push(inBand && !inGap ? ink : paper);
    }
  }
  return rgbaOf(g);
}

describe('toGray', () => {
  it('reads transparent pixels as white paper', () => {
    expect([...toGray(new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]), 2, 1)]).toEqual([255, 0]);
  });
});

describe('fitToPage', () => {
  it('keeps the shape and centers it with paper around', () => {
    const src = new Uint8Array(10 * 5).fill(0); // a black 2:1 picture
    const out = fitToPage(src, 10, 5, 40, 30, 4);
    // 32 wide fits; height 16; centered vertically: rows 7..22 are ink, the margins are paper.
    expect(out[0]).toBe(255);
    expect(out[15 * 40 + 20]).toBe(0);
    expect(out[3 * 40 + 20]).toBe(255);
    expect(out[15 * 40 + 2]).toBe(255);
  });
});

describe('otsuThreshold', () => {
  it('splits ink from paper even when the paper is gray', () => {
    const t = otsuThreshold(Uint8Array.from([...Array(80).fill(180), ...Array(20).fill(60)]));
    expect(t).toBeGreaterThanOrEqual(60);
    expect(t).toBeLessThan(180);
  });

  it('leaves a blank picture blank', () => {
    expect(otsuThreshold(new Uint8Array(100).fill(255))).toBe(128);
  });
});

describe('removeSpecks', () => {
  it('drops small ink blobs and fills small paper holes', () => {
    const w = 12;
    const h = 8;
    const ink = new Uint8Array(w * h);
    ink[1 * w + 1] = 1; // a one-pixel speck
    for (let y = 3; y < 8; y++) for (let x = 4; x < 11; x++) ink[y * w + x] = 1; // a big blob ...
    ink[5 * w + 7] = 0; // ... with a one-pixel hole
    const out = removeSpecks(ink, w, h, 3);
    expect(out[1 * w + 1]).toBe(0);
    expect(out[5 * w + 7]).toBe(1);
    expect(out[3 * w + 4]).toBe(1);
  });
});

describe('cleanUpLineArt', () => {
  const small = { width: 200, height: 150, margin: 10, speck: 6 };

  it('turns a gray scan of a box into black lines on white with two areas', () => {
    const r = cleanUpLineArt(boxPicture(120, 90, { ink: 70, paper: 200 }), 120, 90, { ...small, gap: 2 });
    expect(r.rgba.length).toBe(200 * 150 * 4);
    const colors = new Set<string>();
    for (let i = 0; i < r.rgba.length; i += 4) colors.add(`${r.rgba[i]},${r.rgba[i + 1]},${r.rgba[i + 2]}`);
    expect([...colors].sort()).toEqual(['255,255,255', '35,32,28']);
    expect(labelRegions(r.ink, r.width, r.height).count).toBe(2);
  });

  it('closes a small gap so the page check passes', () => {
    const picture = boxPicture(120, 90, { gap: 2 });
    // Without closing, the gap joins inside and outside.
    const open = cleanUpLineArt(picture, 120, 90, { ...small, gap: 0 });
    expect(labelRegions(open.ink, open.width, open.height).count).toBe(1);
    const closed = cleanUpLineArt(picture, 120, 90, { ...small, gap: 6 });
    expect(labelRegions(closed.ink, closed.width, closed.height).count).toBe(2);
    expect(checkPage(closed.ink, closed.width, closed.height, { gap: 6, speck: 20 }).openShapes).toEqual([]);
  });

  it('removes dust from a scan', () => {
    const picture = boxPicture(120, 90);
    // A few dark specks of dust well away from the box.
    for (const [x, y] of [
      [5, 5],
      [110, 80],
      [8, 70],
    ]) picture.set([20, 20, 20, 255], (y * 120 + x) * 4);
    const r = cleanUpLineArt(picture, 120, 90, small);
    let inkOutsideBox = 0;
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < 40; x++) inkOutsideBox += r.ink[y * r.width + x];
    }
    expect(inkOutsideBox).toBe(0);
  });

  it('fills the page size by default', () => {
    const r = cleanUpLineArt(boxPicture(40, 30), 40, 30, { speck: 6 });
    expect([r.width, r.height]).toEqual([2048, 1536]);
  });
});
