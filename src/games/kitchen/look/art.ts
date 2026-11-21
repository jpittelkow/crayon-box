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

/** A rail button's art for an option: a piece as it is, a sauce as a puddle of it. Undefined when there is none. */
export function optionArt(id: string): readonly Op[] | undefined {
  if (PIECES[id]) return PIECES[id];
  const layer = LAYERS[id];
  if (!layer) return undefined;
  return [
    { d: puddle(), fill: layer.fill, stroke: INK },
    { d: 'M-12-4q8-10 20-6', stroke: layer.edge, width: 4 },
  ];
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
