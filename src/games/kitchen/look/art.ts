// The pizza's art as data (ADR 0044): original, CC0 (ADR 0011), in the Crayon Box look (ADR 0016: ink outline,
// flat bright colours). Each piece is a few SVG paths round 0,0, about 26 units to its edge. One list draws the
// piece on the canvas and makes its rail button, and a colour may be a pair: raw, then baked, so the baked look
// comes from the same art. No DOM here, so the recipe check in the unit tests can read it.

export const INK = '#23201c';

/** One colour, or a pair: raw, then baked. */
export type Tone = string | readonly [raw: string, baked: string];

export interface Op {
  /** An SVG path. */
  d: string;
  fill?: Tone;
  stroke?: Tone;
  /** The stroke's width; 4 when not given. */
  width?: number;
}

const circle = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
const oval = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const pill = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}` +
  `a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;

/** The toppings, by the ids the recipe's rail uses. */
export const PIECES: Record<string, readonly Op[]> = {
  pepperoni: [
    { d: circle(0, 0, 26), fill: ['#d6402b', '#b8331f'], stroke: INK },
    { d: circle(-9, -7, 4.5) + circle(9, -3, 4) + circle(-2, 11, 4.5), fill: ['#a8201a', '#8a1a14'] },
  ],
  mushroom: [
    {
      d: 'M-26 0C-26-27 26-27 26 0C26 7 18 8 12 6L8 6L8 20C8 27-8 27-8 20L-8 6L-12 6C-18 8-26 7-26 0Z',
      fill: ['#efe3cf', '#d9c3a0'],
      stroke: INK,
    },
    { d: 'M-15-3q15 8 30 0', stroke: ['#b9a58a', '#a08766'], width: 3 },
  ],
  pepper: [
    { d: circle(0, 0, 20), stroke: INK, width: 15 },
    { d: circle(0, 0, 20), stroke: ['#3fb86b', '#2f9a56'], width: 7 },
  ],
  olive: [
    { d: circle(0, 0, 12), stroke: INK, width: 12 },
    { d: 'M-10-11a15 15 0 0 1 10-4', stroke: '#9a94a3', width: 3 },
  ],
  tomato: [
    { d: circle(0, 0, 26), fill: ['#ff6b57', '#e2533f'], stroke: INK },
    { d: circle(0, 0, 18), fill: ['#ff9483', '#f07a66'] },
    { d: oval(-8, -7, 3, 5) + oval(9, -6, 3, 5) + oval(0, 10, 5, 3), fill: ['#ffe08a', '#f2cf70'] },
  ],
  pineapple: [
    { d: 'M-24 14L0-24L24 14Q0 24-24 14Z', fill: ['#ffd23f', '#f2bd2e'], stroke: INK },
    { d: 'M-10 6L4-8M0 14L12-2', stroke: ['#e3a21a', '#c98a14'], width: 3 },
  ],
  corn: [
    { d: pill(-20, -14, 17, 19, 7) + pill(2, -18, 17, 19, 7) + pill(-9, 3, 17, 19, 7), fill: ['#ffbf3f', '#f0a92e'], stroke: INK, width: 3.5 },
  ],
  basil: [
    { d: 'M-27 0Q0-26 27 0Q0 26-27 0Z', fill: ['#2fa35f', '#27864f'], stroke: INK },
    { d: 'M-19 0H19', stroke: ['#1b6b3c', '#17573a'], width: 3 },
  ],
  // The cupcake's toppers. They go on after the oven, so they have one colour.
  cherry: [
    { d: 'M2-12q4-16 17-18', stroke: INK, width: 4 },
    { d: circle(0, 6, 20), fill: '#f23b2f', stroke: INK },
    { d: 'M-9-2q3-7 9-8', stroke: '#ff8f85', width: 3 },
  ],
  strawberry: [
    { d: 'M0 27C-22 13-27-5-19-13Q0-21 19-13C27-5 22 13 0 27Z', fill: '#f23b2f', stroke: INK },
    { d: 'M-15-13L0-7L15-13L7-22L0-15L-7-22Z', fill: '#2fa35f', stroke: INK, width: 3 },
    { d: circle(-8, 2, 2) + circle(6, 0, 2) + circle(-1, 12, 2) + circle(9, 11, 2), fill: '#ffe08a' },
  ],
  blueberry: [
    { d: circle(0, 0, 19), fill: '#4d5fd1', stroke: INK },
    { d: 'M-6-5l6 5 6-5', stroke: '#2b3a9e', width: 3 },
  ],
  banana: [
    { d: circle(0, 0, 22), fill: '#ffe9a0', stroke: INK },
    { d: circle(0, 0, 13), stroke: '#e3c96a', width: 3 },
    { d: circle(-4, -3, 2.2) + circle(4, -2, 2.2) + circle(0, 5, 2.2), fill: '#8d5a3b' },
  ],
  candy: [
    { d: 'M-14 0L-28-11V11Z', fill: '#ffd23f', stroke: INK, width: 3.5 },
    { d: 'M14 0L28-11V11Z', fill: '#ffd23f', stroke: INK, width: 3.5 },
    { d: circle(0, 0, 15), fill: '#4cc9f0', stroke: INK },
    { d: 'M-7 2q7-10 14 0', stroke: '#ffffff', width: 3 },
  ],
  candle: [
    { d: pill(-7, -12, 14, 38, 4), fill: '#9b5de5', stroke: INK },
    { d: 'M-7 0l14-6M-7 12l14-6', stroke: '#ffffff', width: 3 },
    { d: 'M0-14c-9-8-2-16 0-23 2 7 9 15 0 23z', fill: '#ffd23f', stroke: INK, width: 3 },
  ],
  star: [{ d: 'M0-25L7-8L25-7L11 5L15 23L0 13L-15 23L-11 5L-25-7L-7-8Z', fill: '#ffd23f', stroke: INK }],
  heart: [{ d: 'M0 23S-25 8-25-8A12.500 12.500 0 0 1 0-12A12.500 12.500 0 0 1 25-8C25 8 0 23 0 23Z', fill: '#ff70a6', stroke: INK }],
};

/** The cupcake's wrappers, by the ids the recipe's rail uses. */
export const WRAPPERS: Record<string, { fill: string; pleat: string }> = {
  'blue-wrapper': { fill: '#4c8cf5', pleat: '#1d3a9e' },
  'pink-wrapper': { fill: '#ff70a6', pleat: '#d81b84' },
  'yellow-wrapper': { fill: '#ffd23f', pleat: '#e3a21a' },
  'green-wrapper': { fill: '#44b87b', pleat: '#1b6b3c' },
};
/** Its batters: raw, then baked. */
export const BATTERS: Record<string, Tone> = {
  'vanilla-batter': ['#f6e3a8', '#e6b866'],
  'chocolate-batter': ['#8d5a3b', '#5b3a26'],
  'strawberry-batter': ['#ffb3c7', '#ea8ea6'],
};
/** Its frostings: the colour, and the darker line between the swirls. */
export const FROSTINGS: Record<string, { fill: string; edge: string }> = {
  'strawberry-frosting': { fill: '#ff70a6', edge: '#d81b84' },
  'vanilla-frosting': { fill: '#fff4dc', edge: '#e3cfa0' },
  'chocolate-frosting': { fill: '#8d5a3b', edge: '#5b3a26' },
  'blue-frosting': { fill: '#4cc9f0', edge: '#12a8a3' },
};

/** The sauces, by the ids the recipe's rail uses: the layer's colour, its darker edge, and both again when baked. */
export const LAYERS: Record<string, { fill: Tone; edge: Tone; shine: string }> = {
  'tomato-sauce': { fill: ['#f23b2f', '#c92a20'], edge: ['#c92a20', '#a8201a'], shine: '#ff6a57' },
  'green-sauce': { fill: ['#6fbf3f', '#579a2f'], edge: ['#3f8f2a', '#347522'], shine: '#9bd93c' },
  'white-sauce': { fill: ['#fff4dc', '#f4e2b8'], edge: ['#e3cfa0', '#d1b987'], shine: '#ffffff' },
};

/** A blob of sauce for a rail button, as one path. */
function puddle(): string {
  let d = '';
  for (let i = 0; i < 60; i++) {
    const t = (i / 60) * Math.PI * 2;
    const r = 24 * (1 + 0.1 * Math.sin(4 * t) + 0.06 * Math.sin(7 * t + 1.3));
    d += `${i ? 'L' : 'M'}${(r * Math.cos(t)).toFixed(1)} ${(r * Math.sin(t)).toFixed(1)}`;
  }
  return d + 'Z';
}

/**
 * A rail button's art for an option: a piece as it is, a sauce or a batter as a puddle of it, a wrapper as a little
 * wrapper, a frosting as a swirl. Undefined when there is none.
 */
export function optionArt(id: string): readonly Op[] | undefined {
  if (PIECES[id]) return PIECES[id];
  const layer = LAYERS[id];
  if (layer) {
    return [
      { d: puddle(), fill: layer.fill, stroke: INK },
      { d: 'M-12-4q8-10 20-6', stroke: layer.edge, width: 4 },
    ];
  }
  const batter = BATTERS[id];
  if (batter) return [{ d: puddle(), fill: batter, stroke: INK }, { d: 'M-12-4q8-10 20-6', stroke: '#ffffff', width: 4 }];
  const wrapper = WRAPPERS[id];
  if (wrapper) {
    return [
      { d: 'M-25-18H25L18 22H-18Z', fill: wrapper.fill, stroke: INK },
      { d: 'M-11-16l3 36M0-16v36M11-16l-3 36', stroke: wrapper.pleat, width: 3 },
    ];
  }
  const frosting = FROSTINGS[id];
  if (frosting) {
    return [
      { d: oval(0, 14, 25, 11), fill: frosting.fill, stroke: INK },
      { d: oval(0, 1, 18, 10), fill: frosting.fill, stroke: INK },
      { d: oval(0, -12, 10, 8), fill: frosting.fill, stroke: INK },
    ];
  }
  return undefined;
}

/** A tone's raw colour. */
export const rawOf = (tone: Tone): string => (typeof tone === 'string' ? tone : tone[0]);

/** A rail button's picture, as SVG markup. */
export function optionSvg(id: string, size = 64): string {
  const ops = optionArt(id) ?? [];
  const body = ops
    .map(
      (op) =>
        `<path d="${op.d}" fill="${op.fill ? rawOf(op.fill) : 'none'}"` +
        (op.stroke ? ` stroke="${rawOf(op.stroke)}" stroke-width="${op.width ?? 4}"` : '') +
        '/>',
    )
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="-34 -34 68 68" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
