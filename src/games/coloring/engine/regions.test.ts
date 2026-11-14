import { describe, expect, it } from 'vitest';
import { DIAGONAL, LEAKY, THICK_WALL, TWO_ROOMS, fixtureToRgba, parseFixture } from './fixtures';
import { labelRegions, regionAt, regionMask, wallsFromRgba } from './regions';

function regionsOf(art: string) {
  const f = parseFixture(art);
  return labelRegions(f.walls, f.width, f.height);
}

/** Draws a mask back as text, for readable expectations. */
function maskArt(mask: ReturnType<typeof regionMask>, width: number, height: number): string {
  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const mx = x - mask.x;
      const my = y - mask.y;
      const on = mx >= 0 && my >= 0 && mx < mask.width && my < mask.height && mask.alpha[my * mask.width + mx];
      row += on ? 'o' : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

describe('wallsFromRgba', () => {
  it('turns dark pixels into walls and white paper into transparent line pixels', () => {
    const f = parseFixture(TWO_ROOMS);
    const { walls, lines } = wallsFromRgba(fixtureToRgba(f), f.width, f.height);
    expect([...walls]).toEqual([...f.walls]);
    const wallPixel = f.walls.indexOf(1);
    const paperPixel = f.walls.indexOf(0);
    expect(lines[wallPixel * 4 + 3]).toBe(255);
    expect(lines[paperPixel * 4 + 3]).toBe(0);
  });

  it('treats transparent pixels as paper (SVG pages)', () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255, 128, 128, 128, 255]);
    const { walls } = wallsFromRgba(rgba, 3, 1);
    expect([...walls]).toEqual([0, 1, 0]);
  });
});

describe('labelRegions', () => {
  it('finds the outside and each enclosed room', () => {
    const r = regionsOf(TWO_ROOMS);
    expect(r.count).toBe(3);
    const outside = regionAt(r, 0, 0, 0);
    const left = regionAt(r, 3, 3, 0);
    const right = regionAt(r, 9, 3, 0);
    expect(new Set([outside, left, right]).size).toBe(3);
    expect(r.areas[left]).toBe(4 * 3);
    expect(r.areas[right]).toBe(5 * 3);
    expect([...r.bboxes.slice(left * 4, left * 4 + 4)]).toEqual([2, 2, 5, 4]);
  });

  it('joins areas connected through a gap in a line', () => {
    const r = regionsOf(LEAKY);
    expect(r.count).toBe(1);
  });

  it('does not connect areas that only touch diagonally', () => {
    const r = regionsOf(DIAGONAL);
    expect(regionAt(r, 0, 0, 0)).not.toBe(regionAt(r, 2, 2, 0));
    expect(regionAt(r, 2, 2, 0)).not.toBe(regionAt(r, 6, 0, 0));
  });

  it('labels every non-wall pixel and no wall pixel', () => {
    const f = parseFixture(TWO_ROOMS);
    const r = labelRegions(f.walls, f.width, f.height);
    for (let i = 0; i < f.walls.length; i++) expect(r.labels[i] === 0).toBe(f.walls[i] === 1);
  });

  it('copes with more provisional labels than its starting table', () => {
    // A comb: every other column is a wall, which makes one provisional label per open column.
    const width = 3000;
    const height = 2;
    const walls = new Uint8Array(width * height);
    for (let x = 1; x < width; x += 2) {
      walls[x] = 1;
      walls[width + x] = 1;
    }
    const r = labelRegions(walls, width, height);
    expect(r.count).toBe(1500);
  });
});

describe('regionAt', () => {
  it('picks the nearest region when the tap lands on a line', () => {
    const r = regionsOf(TWO_ROOMS);
    // (1, 3) is the left frame line; the outside (0, 3) is one pixel away, the left room (2, 3) too.
    const id = regionAt(r, 1, 3);
    expect([regionAt(r, 0, 3, 0), regionAt(r, 2, 3, 0)]).toContain(id);
    // (6, 3) is the middle line, equally near both rooms: either is fine, but it must be a room.
    expect([regionAt(r, 5, 3, 0), regionAt(r, 7, 3, 0)]).toContain(regionAt(r, 6, 3));
  });

  it('returns 0 in the middle of a line wider than the search', () => {
    const r = regionsOf(THICK_WALL);
    expect(regionAt(r, 14, 1)).toBe(0);
    expect(regionAt(r, 14, 1, 12)).not.toBe(0);
  });

  it('handles taps outside the image', () => {
    const r = regionsOf(TWO_ROOMS);
    expect(regionAt(r, -3, 0)).toBe(regionAt(r, 0, 0, 0));
    expect(regionAt(r, -50, -50)).toBe(0);
  });
});

describe('regionMask', () => {
  it('covers the room and grows into the lines around it, never into another room', () => {
    const f = parseFixture(TWO_ROOMS);
    const r = labelRegions(f.walls, f.width, f.height);
    const left = regionAt(r, 3, 3, 0);
    const mask = regionMask(r, left, 1);
    expect(maskArt(mask, f.width, f.height)).toBe(
      [
        '..............',
        '.oooooo.......',
        '.oooooo.......',
        '.oooooo.......',
        '.oooooo.......',
        '.oooooo.......',
        '..............',
      ].join('\n'),
    );
  });

  it('without growth is exactly the region (stay in the lines clip)', () => {
    const f = parseFixture(TWO_ROOMS);
    const r = labelRegions(f.walls, f.width, f.height);
    const right = regionAt(r, 9, 3, 0);
    const mask = regionMask(r, right, 0);
    let on = 0;
    for (const a of mask.alpha) if (a) on++;
    expect(on).toBe(r.areas[right]);
  });

  it('grows 2 px by default and stays inside the image', () => {
    const f = parseFixture(TWO_ROOMS);
    const r = labelRegions(f.walls, f.width, f.height);
    const outside = regionAt(r, 0, 0, 0);
    const mask = regionMask(r, outside);
    expect(mask.x).toBe(0);
    expect(mask.width).toBe(f.width);
    // The 2 px growth covers the frame and the end of the middle line, but never enters either room.
    expect(maskArt(mask, f.width, f.height)).toBe(
      [
        'oooooooooooooo',
        'oooooooooooooo',
        'oo....o.....oo',
        'oo..........oo',
        'oo....o.....oo',
        'oooooooooooooo',
        'oooooooooooooo',
      ].join('\n'),
    );
  });

  it('rejects unknown region ids', () => {
    const r = regionsOf(TWO_ROOMS);
    expect(() => regionMask(r, 0)).toThrow();
    expect(() => regionMask(r, 99)).toThrow();
  });
});
