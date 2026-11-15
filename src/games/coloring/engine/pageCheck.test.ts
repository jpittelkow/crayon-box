import { describe, expect, it } from 'vitest';
import { TWO_ROOMS, parseFixture } from './fixtures';
import { checkPage, closeGaps } from './pageCheck';

const opts = { gap: 2, speck: 1, smallShare: 0 };

function check(art: string, o = opts) {
  const f = parseFixture(art);
  return checkPage(f.walls, f.width, f.height, o);
}

/**
 * Draws a square box with a gap of `gap` px in its right side, with `margin` px of paper all around. The margin
 * must be wider than the gap limit, or closing fills the paper between the box and the page edge too.
 */
function boxWithGap(gap: number, margin = 4, side = 12): string {
  const size = side + margin * 2;
  const last = margin + side - 1;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      const inBox = y >= margin && y <= last && x >= margin && x <= last;
      const onFrame = inBox && (y === margin || y === last || x === margin || x === last);
      const inGap = x === last && y >= margin + 2 && y < margin + 2 + gap;
      row += onFrame && !inGap ? '#' : '.';
    }
    rows.push(row);
  }
  return rows.join('\n');
}

/** Two boxes side by side whose shared wall leaves a 1 px wide channel: a narrow but closed area. */
const SLIVER = `
...............
...............
...............
...#########...
...#...#.#..#..
...#...#.#..#..
...#...#.#..#..
...#########...
...............
...............
...............
`;

describe('closeGaps', () => {
  it('shuts a gap and keeps other lines and open paper as they were', () => {
    const f = parseFixture(boxWithGap(2));
    const at = (x: number, y: number) => f.width * y + x;
    const closed = closeGaps(f.walls, f.width, f.height, 2);
    expect(closed[at(15, 6)]).toBe(1);
    expect(closed[at(15, 7)]).toBe(1);
    expect(closed[at(4, 4)]).toBe(1);
    expect(closed[at(9, 9)]).toBe(0);
    expect(closed[at(18, 9)]).toBe(0);
    expect(closed[0]).toBe(0);
  });

  it('keeps lines that run off the edge of the page closed against it', () => {
    const f = parseFixture(`
#....
#....
#....
`);
    const closed = closeGaps(f.walls, f.width, f.height, 2);
    expect([closed[0], closed[5], closed[10]]).toEqual([1, 1, 1]);
  });
});

describe('checkPage', () => {
  it('passes closed shapes', () => {
    const r = check(boxWithGap(0));
    expect(r.regions).toBe(2);
    expect(r.openShapes).toEqual([]);
  });

  it('fails a shape with a small gap, and says where', () => {
    const r = check(boxWithGap(2));
    expect(r.openShapes).toHaveLength(1);
    expect(r.openShapes[0]).toMatchObject({ x: 0, y: 0, width: 20, height: 20 });
  });

  it('fails a one-pixel gap', () => {
    expect(check(boxWithGap(1)).openShapes).toHaveLength(1);
  });

  it('fails a 6 px gap at the default limit (ADR 0005)', () => {
    expect(check(boxWithGap(6, 10, 16), { gap: 6, speck: 1, smallShare: 0 }).openShapes).toHaveLength(1);
  });

  it('does not fail a narrow area that closing fills in', () => {
    expect(check(SLIVER).openShapes).toEqual([]);
  });

  it('ignores gaps wider than the limit: those are openings on purpose', () => {
    expect(check(boxWithGap(5)).openShapes).toEqual([]);
  });

  it('reports small areas as warnings', () => {
    const f = parseFixture(TWO_ROOMS);
    const r = checkPage(f.walls, f.width, f.height, { gap: 1, speck: 1, smallShare: 13 / (f.width * f.height) });
    // The left room is 12 px, under the limit; the right room (15 px) and the outside are not.
    expect(r.smallRegions).toEqual([{ x: 2, y: 2, width: 4, height: 3 }]);
  });

  it('leaves specks out of the count', () => {
    expect(check(TWO_ROOMS, { gap: 1, speck: 13, smallShare: 0 }).regions).toBe(2);
  });
});
