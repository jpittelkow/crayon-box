// The home screen's game tiles (ADR 0047): a little picture of each game, filling its tile. Original, CC0
// (ADR 0011), in the Crayon Box look (ADR 0016). Each is an SVG on a 448 x 248 grid that covers the tile whatever
// its shape (the sides are cropped on a narrower tile), so nothing that matters sits at the far left or right.

const INK = '#23201c';
const W = 448, H = 248;

const f = (n: number) => String(Math.round(n * 10) / 10);
const rad = (d: number) => (d * Math.PI) / 180;
/** The same scatter every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function scene(body: string): string {
  return (
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${body}</svg>`
  );
}

/** A crayon standing on 0,0, pointing up, 150 long. */
const crayon = (colour: string, light: string) =>
  `<g stroke="${INK}" stroke-width="6"><path d="M-17-110L-9-140Q0-152 9-140L17-110Z" fill="${colour}"/>` +
  `<rect x="-17" y="-110" width="34" height="110" rx="6" fill="${colour}"/>` +
  `<rect x="-17" y="-84" width="34" height="52" fill="${light}" stroke-width="4"/><path d="M-8-58h16" fill="none" stroke-width="4"/></g>`;

/** The crayons standing along the bottom of the Coloring tile: colour, label colour, how much of each shows. */
const CRAYONS: readonly (readonly [string, string, number])[] = [
  ['#f23b2f', '#fbb5ae', 96],
  ['#ff8a1f', '#ffd2a6', 80],
  ['#ffd23f', '#fff0b8', 104],
  ['#2fa35f', '#b4e3c6', 86],
  ['#4cc9f0', '#d3f1fb', 100],
  ['#9b5de5', '#dcc7f7', 82],
  ['#ff70a6', '#ffcfe0', 94],
];
/** A rainbow's bands, from the outside in. */
const RAINBOW = ['#f23b2f', '#ff8a1f', '#ffd23f', '#2fa35f', '#4cc9f0', '#9b5de5'];

/** The top half of a ring round cx,cy. */
const bow = (cx: number, cy: number, R: number) => `M${cx - R} ${cy}A${R} ${R} 0 0 1 ${cx + R} ${cy}`;

// The Driving tile is drawn the way the game is seen (ADR 0021): from behind the car, the road running away to
// the horizon. A spot on the road is `d` below the horizon line; things shrink in step with d.
const HORIZON = 90;
const NEAR = H - HORIZON;
/** The middle of the road, which bends right as it goes away. */
const roadMid = (d: number) => W / 2 + 900 / d - 900 / NEAR;
const roadHalf = (d: number) => 1.04 * d;
/** A strip of the road between two distances, `share` of the road's width wide. */
function roadStrip(far: number, near: number, share: number): string {
  const left: string[] = [], right: string[] = [];
  for (let i = 0; i <= 20; i++) {
    const d = far * (near / far) ** (i / 20), y = f(HORIZON + d);
    left.push(`${f(roadMid(d) - roadHalf(d) * share)} ${y}`);
    right.unshift(`${f(roadMid(d) + roadHalf(d) * share)} ${y}`);
  }
  return `M${left.join('L')}L${right.join('L')}Z`;
}
function roadAhead(): string {
  let dashes = '';
  for (let z = 1.9; NEAR / (z + 0.45) > 9; z += 0.9) dashes += roadStrip(NEAR / (z + 0.45), NEAR / z, 0.035);
  return (
    `<path d="${roadStrip(7, NEAR + 12, 1)}" fill="#ffffff" stroke="${INK}" stroke-width="6"/>` +
    `<path d="${roadStrip(7, NEAR + 12, 0.92)}" fill="#6b7078"/><path d="${dashes}" fill="#ffffff"/>`
  );
}

/** Things beside the road, each standing on x,y at a size. */
const beside = (x: number, y: number, s: number, body: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})" stroke="${INK}" stroke-width="${f(Math.min(6, 4.5 / s))}">${body}</g>`;
const pine = (x: number, y: number, s: number) =>
  beside(x, y, s, '<rect x="-7" y="-18" width="14" height="20" fill="#8a5a2b"/><path d="M0-112L-30-60h13L-44-16h88L17-60h13Z" fill="#2fa35f"/>');
const roundTree = (x: number, y: number, s: number) =>
  beside(x, y, s, '<rect x="-7" y="-30" width="14" height="32" fill="#8a5a2b"/><circle cy="-62" r="36" fill="#2fa35f"/>');
const cone = (x: number, y: number, s: number) =>
  beside(x, y, s, '<path d="M-17 0h34l-5-8h-24zM-11-8L-4-44h8l7 36z" fill="#ff8a1f"/><path d="M-8-22h16" fill="none" stroke="#ffffff"/>');
function star(x: number, y: number, R: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.45 : R, t = rad(i * 36 - 90);
    d += `${i ? 'L' : 'M'}${f(x + r * Math.cos(t))} ${f(y + r * Math.sin(t))}`;
  }
  return `<path d="${d}Z" fill="#ffd23f" stroke="${INK}" stroke-width="4"/>`;
}

/** A cartoon car seen from behind, standing on 0,0, 100 wide. */
const carFromBehind =
  `<ellipse cy="2" rx="60" ry="9" fill="${INK}" opacity="0.25"/><g stroke="${INK}" stroke-width="5">` +
  `<rect x="-52" y="-36" width="22" height="36" rx="7" fill="${INK}"/><rect x="30" y="-36" width="22" height="36" rx="7" fill="${INK}"/>` +
  '<path d="M-38-54L-31-96q1-6 8-6h46q7 0 8 6L38-54z" fill="#f23b2f"/>' +
  '<rect x="-25" y="-92" width="50" height="30" rx="5" fill="#d3f1fb" stroke-width="4"/>' +
  '<rect x="-46" y="-58" width="92" height="44" rx="10" fill="#f23b2f"/>' +
  '<g fill="#ffd23f" stroke-width="3.5"><rect x="-40" y="-48" width="20" height="12" rx="3"/><rect x="20" y="-48" width="20" height="12" rx="3"/></g>' +
  '<rect x="-11" y="-42" width="22" height="12" rx="2" fill="#ffffff" stroke-width="3.5"/>' +
  '<rect x="-49" y="-20" width="98" height="12" rx="5" fill="#6b7078"/></g>';

/** A letter as the letters game draws it, on a 100 x 140 grid: a pale road with an ink edge. */
const road = (d: string) =>
  `<g fill="none"><path d="${d}" stroke="${INK}" stroke-width="25"/><path d="${d}" stroke="#fffaf0" stroke-width="19"/></g>`;
const startDot = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="10" fill="#2fa35f" stroke="${INK}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3.5" fill="#ffffff"/>`;

function blob(R: number, a: number, k1: number, b: number, k2: number): string {
  let d = '';
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2, r = R * (1 + a * Math.sin(k1 * t) + b * Math.sin(k2 * t + 1.3));
    d += `${i ? 'L' : 'M'}${f(r * Math.cos(t))} ${f(r * Math.sin(t))}`;
  }
  return d + 'Z';
}
const arc = (R: number, a1: number, a2: number) =>
  `M${f(R * Math.cos(rad(a1)))} ${f(R * Math.sin(rad(a1)))}A${R} ${R} 0 0 1 ${f(R * Math.cos(rad(a2)))} ${f(R * Math.sin(rad(a2)))}`;

/** A baked pepperoni pizza, 250 to its edge, round 0,0. */
function pizza(): string {
  const r = seeded(3);
  let spots = '';
  for (let i = 0; i < 8; i++) {
    const far = 60 + 120 * r(), turn = r() * 6.28;
    spots += `<circle cx="${f(far * Math.cos(turn))}" cy="${f(far * Math.sin(turn))}" r="${f(9 + r() * 8)}"/>`;
  }
  const pepperoni = [[-95, -70], [40, -110], [120, -10], [-20, 20], [-120, 70], [50, 110]]
    .map(
      ([x, y]) =>
        `<g transform="translate(${x} ${y}) scale(1.9)" stroke="${INK}" stroke-width="4"><circle r="26" fill="#b8331f"/>` +
        '<g fill="#8a1a14" stroke="none"><circle cx="-9" cy="-7" r="4.5"/><circle cx="9" cy="-3" r="4"/><circle cx="-2" cy="11" r="4.5"/></g></g>',
    )
    .join('');
  return (
    `<circle r="250" fill="#e2a85c" stroke="${INK}" stroke-width="15"/>` +
    `<path d="${arc(232, 190, 222)}${arc(232, 20, 48)}${arc(232, 95, 130)}" fill="none" stroke="#c98843" stroke-width="10"/>` +
    `<circle r="215" fill="#c92a20"/><path d="${blob(204, 0.022, 7, 0.012, 3)}" fill="#ffcf5a" stroke="#e3a21a" stroke-width="4"/>` +
    `<g fill="#f2b04a">${spots}</g>${pepperoni}`
  );
}

/** A cupcake on a 200 grid. */
const cupcake =
  `<g stroke="${INK}" stroke-width="6"><path d="M52 108h96l-14 72H66z" fill="#4cc9f0"/>` +
  '<path d="M77 112l5 66M100 112v68M123 112l-5 66" fill="none" stroke-width="4"/>' +
  '<path d="M46 110c-12-22 6-40 22-36-2-26 28-38 46-22 14-12 40-2 36 22 18 2 22 26 4 36z" fill="#ff70a6"/>' +
  '<path d="M104 30q4-14 16-16" fill="none" stroke-width="5"/><circle cx="100" cy="44" r="15" fill="#f23b2f"/>' +
  '<g fill="none" stroke-width="6"><path d="M70 90l9-6" stroke="#ffd23f"/><path d="M97 80l11 2" stroke="#4cc9f0"/>' +
  '<path d="M124 94l9-6" stroke="#9bd93c"/><path d="M86 100l9 4" stroke="#ffffff"/></g></g>';

function counterTiles(): string {
  let d = '';
  for (let x = 75; x < W; x += 75) d += `M${x} 0V${H}`;
  for (let y = 62; y < H; y += 62) d += `M0 ${y}H${W}`;
  return `<rect width="${W}" height="${H}" fill="#b5e8f8"/><path d="${d}" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.8"/>`;
}

export const tiles = {
  /** Coloring: a sheet with a coloured-in sun, flower and rainbow, and a row of crayons standing in front. */
  coloring: () =>
    scene(
      `<rect width="${W}" height="${H}" fill="#ffffff"/><g stroke="${INK}" stroke-width="6" fill="none">` +
        '<circle cx="100" cy="68" r="32" fill="#ffd23f"/>' +
        '<path d="M100 20V8M100 128v-12M52 68H40M160 68h-12M66 34L57 25M134 34l9-9M66 102l-9 9M134 102l9 9"/>' +
        `<path d="M-10 204H${W + 10}V${H + 10}H-10z" fill="#9bd93c"/>` +
        '<path d="M226 204V128"/><path d="M226 172q-32-4-40-32 34-2 40 32z" fill="#9bd93c"/>' +
        '<g fill="#ff70a6"><circle cx="226" cy="54" r="21"/><circle cx="256" cy="76" r="21"/><circle cx="245" cy="111" r="21"/>' +
        '<circle cx="207" cy="111" r="21"/><circle cx="196" cy="76" r="21"/></g><circle cx="226" cy="84" r="18" fill="#ffd23f"/></g>' +
        `<g fill="none" stroke-linecap="butt">${RAINBOW.map((colour, i) => `<path d="${bow(352, 201, 87 - i * 11)}" stroke="${colour}" stroke-width="11.5"/>`).join('')}` +
        `<path d="${bow(352, 201, 92.5)}${bow(352, 201, 26.5)}" stroke="${INK}" stroke-width="6"/></g>` +
        CRAYONS.map(
          ([colour, light, shown], i) =>
            `<g transform="translate(${76 + i * 41} ${H + 150 - shown}) rotate(${[-3, 2, -1, 3, -2, 1, -3][i]})">${crayon(colour, light)}</g>`,
        ).join(''),
    ),
  /** Driving: the game as it is seen, from behind a red car on a road that runs away between trees. */
  driving: () =>
    scene(
      `<rect width="${W}" height="${H}" fill="#b5e8f8"/><circle cx="322" cy="38" r="23" fill="#ffd23f" stroke="${INK}" stroke-width="6"/>` +
        `<path d="M196 40q7-19 26-14 16-12 30 4 19 0 17 17-2 12-19 12h-44q-17-3-10-19z" fill="#ffffff" stroke="${INK}" stroke-width="5"/>` +
        `<rect y="${HORIZON - 12}" width="${W}" height="14" fill="#4cc9f0"/>` +
        `<rect x="-10" y="${HORIZON}" width="${W + 20}" height="${NEAR + 10}" fill="#9bd93c" stroke="${INK}" stroke-width="5"/>` +
        roundTree(300, 99, 0.3) + pine(388, 104, 0.42) + pine(46, 112, 0.5) + roundTree(170, 110, 0.42) +
        roadAhead() +
        pine(104, 150, 0.8) + roundTree(376, 142, 0.72) + pine(424, 190, 1.05) + cone(96, 204, 0.62) + cone(352, 176, 0.42) +
        star(roadMid(34) - 4, HORIZON + 20, 15) +
        `<g transform="translate(${W / 2} ${H - 8})">${carFromBehind}</g>`,
    ),
  /** Letters: a big A being traced and a B waiting, on lined paper. */
  letters: () =>
    scene(
      `<rect width="${W}" height="${H}" fill="#fffaf0"/><path d="M0 204H${W}M0 44H${W}" fill="none" stroke="#b5e8f8" stroke-width="5"/>` +
        `<g transform="translate(70 40) scale(1.2)">${road('M50 5L10 135M50 5L90 135M26 88h48')}` +
        `<path d="M50 7L24 92" fill="none" stroke="#ff8a1f" stroke-width="10"/>${startDot(50, 5)}</g>` +
        `<g transform="translate(250 40) scale(1.2)">${road('M20 5V135M20 5h28a32 32 0 0 1 0 64H20h34a33 33 0 0 1 0 66H20')}${startDot(20, 5)}</g>`,
    ),
  /** Kitchen: a pizza on its board and a cupcake, on the tiled counter. */
  kitchen: () =>
    scene(
      counterTiles() +
        `<g transform="translate(170 128)"><circle r="112" fill="#c98f5a" stroke="${INK}" stroke-width="6"/><g transform="scale(0.37)">${pizza()}</g></g>` +
        `<g transform="translate(288 62) scale(0.9)">${cupcake}</g>`,
    ),
} as const;
