// Small fixture images for the engine's unit tests (ADR 0015), drawn as text: `#` is a line pixel, `.` is paper.

export interface Fixture {
  width: number;
  height: number;
  walls: Uint8Array;
}

export function parseFixture(art: string): Fixture {
  const rows = art
    .trim()
    .split('\n')
    .map((r) => r.trim());
  const width = rows[0].length;
  const height = rows.length;
  const walls = new Uint8Array(width * height);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Fixture row ${y} has length ${row.length}, expected ${width}`);
    for (let x = 0; x < width; x++) if (row[x] === '#') walls[y * width + x] = 1;
  });
  return { width, height, walls };
}

/** Renders a fixture as RGBA, black lines on white paper, like a PNG page. */
export function fixtureToRgba(f: Fixture): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(f.width * f.height * 4);
  for (let i = 0; i < f.walls.length; i++) {
    const v = f.walls[i] ? 0 : 255;
    rgba.set([v, v, v, 255], i * 4);
  }
  return rgba;
}

/** Two rooms inside a frame, with paper all around the outside. */
export const TWO_ROOMS = `
..............
.############.
.#....#.....#.
.#....#.....#.
.#....#.....#.
.############.
..............
`;

/** A shape whose outline has a one-pixel gap: the inside and outside are one region. */
export const LEAKY = `
.......
.#####.
.#...#.
.#.....
.#####.
.......
`;

/** Lines that touch only at corners. With 4-connected regions, paint can't squeeze through a diagonal. */
export const DIAGONAL = `
..#....
.#.#...
#...#..
.#...#.
..#...#
...#.#.
....#..
`;

/** A thick line, wider than the 8 px nearest-region search, between two areas. */
export const THICK_WALL = `
....####################....
....####################....
....####################....
`;
