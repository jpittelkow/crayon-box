// The letters and numbers as stroke data (ADR 0026): a simple print style of straight sticks and round balls.
// Original work, CC0 (ADR 0011). Not a font: the strokes carry their order and direction, which give the guide,
// the start dots, the arrows and the hint.
//
// Strokes follow how print letters are taught in US schools (Zaner-Bloser and Handwriting Without Tears agree on
// these, ADR 0028): start at the top; lines go down, then across left to right; round letters go counterclockwise
// from the top right ("magic c"); b, h, m, n, p and r go down and push back up the same line without lifting; the
// bumps of B and R, the slants of K and k and the bar of G go on without a lift; the 4 is the open 4.
//
// Every glyph sits in a 100 x 140 box. Capitals and numbers run from y 10 (top) to y 110 (the baseline). Small
// letters have their middle line at y 60 and descenders down to y 135. Angles are in degrees, 0 pointing right and
// 90 pointing down (screen coordinates), so a rising angle turns clockwise on screen.

export type Pt = { x: number; y: number };
/** One stroke: the points along it, about one unit apart, in the order it is drawn. */
export type Stroke = Pt[];
export interface Glyph {
  ch: string;
  strokes: Stroke[];
}

export type SetId = 'capitals' | 'small' | 'numbers';
export const SET_ORDER: readonly SetId[] = ['capitals', 'small', 'numbers'];
export const SET_CHARS: Record<SetId, string> = {
  capitals: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  small: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
};

export const BOX = { w: 100, h: 140 };

type Seg = Pt[];

function line(x1: number, y1: number, x2: number, y2: number): Seg {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n }));
}

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number): Seg {
  const span = ((to - from) * Math.PI) / 180;
  const n = Math.max(2, Math.ceil(Math.abs(span) * Math.max(rx, ry)));
  const a0 = (from * Math.PI) / 180;
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (span * i) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

/** Joins segments into one stroke, dropping the repeated point where two segments meet. */
function s(...segs: Seg[]): Stroke {
  const out: Pt[] = [];
  for (const seg of segs) {
    for (const p of seg) {
      const last = out.at(-1);
      if (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.01) continue;
      out.push({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
    }
  }
  return out;
}

/** A dot (on i and j): a very short stroke. */
const dot = (x: number, y: number) => s(line(x, y, x, y + 2));

const DATA: Record<string, Stroke[]> = {
  // ---- Capitals ----
  A: [s(line(50, 10, 15, 110)), s(line(50, 10, 85, 110)), s(line(27, 75, 73, 75))],
  B: [
    s(line(25, 10, 25, 110)),
    s(
      line(25, 10, 55, 10),
      arc(55, 35, 22, 25, -90, 90),
      line(55, 60, 25, 60),
      line(25, 60, 58, 60),
      arc(58, 85, 24, 25, -90, 90),
      line(58, 110, 25, 110),
    ),
  ],
  C: [s(arc(55, 60, 38, 50, -40, -320))],
  D: [s(line(25, 10, 25, 110)), s(line(25, 10, 42, 10), arc(42, 60, 38, 50, -90, 90), line(42, 110, 25, 110))],
  E: [s(line(25, 10, 25, 110)), s(line(25, 10, 80, 10)), s(line(25, 60, 70, 60)), s(line(25, 110, 80, 110))],
  F: [s(line(25, 10, 25, 110)), s(line(25, 10, 80, 10)), s(line(25, 60, 70, 60))],
  G: [s(arc(55, 60, 38, 50, -40, -360), line(93, 60, 65, 60))],
  H: [s(line(20, 10, 20, 110)), s(line(80, 10, 80, 110)), s(line(20, 60, 80, 60))],
  I: [s(line(50, 10, 50, 110)), s(line(30, 10, 70, 10)), s(line(30, 110, 70, 110))],
  J: [s(line(70, 10, 70, 85), arc(47, 85, 23, 25, 0, 180))],
  K: [s(line(25, 10, 25, 110)), s(line(80, 10, 27, 62), line(27, 62, 80, 110))],
  L: [s(line(25, 10, 25, 110), line(25, 110, 80, 110))],
  M: [s(line(15, 10, 15, 110)), s(line(15, 10, 50, 80), line(50, 80, 85, 10), line(85, 10, 85, 110))],
  N: [s(line(20, 10, 20, 110)), s(line(20, 10, 80, 110), line(80, 110, 80, 10))],
  O: [s(arc(50, 60, 38, 50, -90, -450))],
  P: [s(line(25, 10, 25, 110)), s(line(25, 10, 55, 10), arc(55, 35, 25, 25, -90, 90), line(55, 60, 25, 60))],
  Q: [s(arc(50, 60, 38, 50, -90, -450)), s(line(60, 85, 85, 115))],
  R: [
    s(line(25, 10, 25, 110)),
    s(line(25, 10, 55, 10), arc(55, 35, 25, 25, -90, 90), line(55, 60, 30, 60), line(30, 60, 82, 110)),
  ],
  S: [s(arc(50, 35, 30, 25, -30, -270), arc(50, 85, 30, 25, -90, 150))],
  T: [s(line(50, 10, 50, 110)), s(line(15, 10, 85, 10))],
  U: [s(line(20, 10, 20, 80), arc(50, 80, 30, 30, 180, 0), line(80, 80, 80, 10))],
  V: [s(line(15, 10, 50, 110), line(50, 110, 85, 10))],
  W: [s(line(10, 10, 30, 110), line(30, 110, 50, 10), line(50, 10, 70, 110), line(70, 110, 90, 10))],
  X: [s(line(20, 10, 80, 110)), s(line(80, 10, 20, 110))],
  Y: [s(line(15, 10, 50, 60)), s(line(85, 10, 50, 60), line(50, 60, 50, 110))],
  Z: [s(line(20, 10, 80, 10), line(80, 10, 20, 110), line(20, 110, 80, 110))],

  // ---- Small letters ----
  a: [s(arc(50, 85, 25, 25, -30, -390)), s(line(75, 60, 75, 110))],
  b: [s(line(25, 10, 25, 110), line(25, 110, 25, 85), arc(50, 85, 25, 25, 180, 540))],
  c: [s(arc(55, 85, 27, 25, -40, -320))],
  d: [s(arc(50, 85, 25, 25, -30, -390)), s(line(75, 10, 75, 110))],
  e: [s(line(25, 85, 77, 85), arc(51, 85, 26, 25, 0, -310))],
  f: [s(arc(65, 30, 17, 20, -30, -180), line(48, 30, 48, 110)), s(line(32, 60, 68, 60))],
  g: [s(arc(50, 85, 25, 25, -30, -390)), s(line(75, 60, 75, 120), arc(52, 120, 23, 15, 0, 160))],
  h: [s(line(25, 10, 25, 110), line(25, 110, 25, 82), arc(50, 82, 25, 22, 180, 360), line(75, 82, 75, 110))],
  i: [s(line(50, 60, 50, 110)), dot(50, 40)],
  j: [s(line(55, 60, 55, 120), arc(35, 120, 20, 15, 0, 160)), dot(55, 40)],
  k: [s(line(25, 10, 25, 110)), s(line(72, 60, 27, 87), line(27, 87, 75, 110))],
  l: [s(line(50, 10, 50, 110))],
  m: [
    s(
      line(15, 60, 15, 110),
      line(15, 110, 15, 78),
      arc(31, 78, 16, 18, 180, 360),
      line(47, 78, 47, 110),
      line(47, 110, 47, 78),
      arc(63, 78, 16, 18, 180, 360),
      line(79, 78, 79, 110),
    ),
  ],
  n: [s(line(25, 60, 25, 110), line(25, 110, 25, 82), arc(50, 82, 25, 22, 180, 360), line(75, 82, 75, 110))],
  o: [s(arc(50, 85, 25, 25, -90, -450))],
  p: [s(line(25, 60, 25, 135), line(25, 135, 25, 85), arc(50, 85, 25, 25, 180, 540))],
  q: [s(arc(50, 85, 25, 25, -30, -390)), s(line(75, 60, 75, 135))],
  r: [s(line(30, 60, 30, 110), line(30, 110, 30, 82), arc(52, 82, 22, 22, 180, 300))],
  s: [s(arc(50, 72, 20, 12, -30, -270), arc(50, 97, 20, 13, -90, 150))],
  t: [s(line(50, 20, 50, 110)), s(line(32, 60, 68, 60))],
  u: [s(line(25, 60, 25, 88), arc(50, 88, 25, 22, 180, 0), line(75, 88, 75, 60), line(75, 60, 75, 110))],
  v: [s(line(20, 60, 50, 110), line(50, 110, 80, 60))],
  w: [s(line(10, 60, 30, 110), line(30, 110, 50, 60), line(50, 60, 70, 110), line(70, 110, 90, 60))],
  x: [s(line(25, 60, 75, 110)), s(line(75, 60, 25, 110))],
  y: [s(line(25, 60, 50, 105)), s(line(75, 60, 36, 135))],
  z: [s(line(25, 60, 75, 60), line(75, 60, 25, 110), line(25, 110, 75, 110))],

  // ---- Numbers ----
  '0': [s(arc(50, 60, 32, 50, -90, -450))],
  '1': [s(line(50, 10, 50, 110))],
  '2': [s(arc(50, 37, 28, 27, -160, 20), line(76.31, 46.23, 20, 110), line(20, 110, 82, 110))],
  '3': [s(arc(48, 34, 27, 24, -150, 90), arc(48, 84, 30, 26, -90, 150))],
  '4': [s(line(22, 10, 22, 70), line(22, 70, 85, 70)), s(line(65, 10, 65, 110))],
  '5': [s(line(28, 10, 28, 57), arc(48, 78, 28, 30, -136, 150)), s(line(28, 10, 78, 10))],
  '6': [s(arc(55, 60, 33, 50, -70, -180), line(22, 60, 22, 83), arc(50, 83, 28, 27, 180, -180))],
  '7': [s(line(20, 10, 80, 10), line(80, 10, 40, 110))],
  '8': [s(arc(50, 35, 22, 25, -90, -270), arc(50, 85, 27, 25, -90, 270), arc(50, 35, 22, 25, 90, -90))],
  '9': [s(arc(50, 37, 25, 27, 0, -360), line(75, 37, 75, 110))],
};

const GLYPHS = new Map<string, Glyph>(Object.entries(DATA).map(([ch, strokes]) => [ch, { ch, strokes }]));

export function glyph(ch: string): Glyph {
  const g = GLYPHS.get(ch);
  if (!g) throw new Error(`No glyph for ${ch}`);
  return g;
}

export function allChars(): string[] {
  return SET_ORDER.flatMap((set) => [...SET_CHARS[set]]);
}

export function setOf(ch: string): SetId {
  return SET_ORDER.find((set) => SET_CHARS[set].includes(ch)) ?? 'capitals';
}

export function strokeLength(stroke: Stroke): number {
  let len = 0;
  for (let i = 1; i < stroke.length; i++) len += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
  return len;
}

/** SVG path data for a stroke. */
export function pathData(stroke: Stroke): string {
  return stroke.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('');
}

/** The middle of all the glyph's points: arrows go on the side of a stroke away from it. */
function centre(g: Glyph): Pt {
  const pts = g.strokes.flat();
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  };
}

/** How far an arrow sits from its stroke's centre line, in glyph units. The guide is 20 wide. */
const ARROW_GAP = 16;

export interface Arrow {
  shaft: string;
  head: string;
}

/**
 * The parts of a stroke between sharp turns (more than 90 degrees): n's "down, then back up and over" is two runs,
 * and so is K's "slant in, slant out". Each run gets its own
 * arrow, so an arrow never folds back on itself.
 */
function runs(stroke: Stroke): Stroke[] {
  const out: Stroke[] = [[stroke[0]]];
  for (let i = 1; i < stroke.length; i++) {
    const cur = out.at(-1)!;
    if (cur.length >= 2) {
      const a = cur[cur.length - 2];
      const b = cur[cur.length - 1];
      const c = stroke[i];
      const u = { x: b.x - a.x, y: b.y - a.y };
      const v = { x: c.x - b.x, y: c.y - b.y };
      const dot = (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1) * (Math.hypot(v.x, v.y) || 1));
      if (dot < 0) out.push([b]);
    }
    out.at(-1)!.push(stroke[i]);
  }
  return out;
}

// ---- Stroke words (ADR 0037): the same word for the same kind of stroke, said as a hint or the demo draws it ----

/** What a stroke is called: "Down.", "Across.", "Slant.", "Around.", "Down, up and over." (b h m n p r), "Dot.". */
export type StrokeKind = 'down' | 'across' | 'slant' | 'around' | 'down-over' | 'dot';

/** A stroke shorter than this is a dot (i, j). */
const DOT_LENGTH = 6;
/** A line within this many degrees of straight down (or up) is "down"; of level, "across"; anything else is a slant. */
const STRAIGHT_DEG = 8;
/** Steps of this length measure how a stroke bends, so the rounding in the data reads as straight. */
const BEND_STEP = 3;
/** A bend between steps of more than this (degrees) is curve; one over CORNER_DEG is a corner, not curve. */
const CURVE_DEG = 1.5;
const CORNER_DEG = 60;
/** A stroke that turns more than this (degrees) in its first quarter starts round: "Around." */
const ROUND_START_DEG = 20;
/** A stroke that starts across but is at least this share curve (the bumps of B, D, P, R; e) is "Around." */
const ROUND_SHARE = 0.3;
/** Inside a stroke of straight lines, a turn of more than this (degrees) at a point starts a new line (L, Z, 7). */
const LINE_TURN_DEG = 30;

/** Which way a straight move goes, by the words: down, across or slant; up only inside a stroke (n's way back). */
function directionOf(a: Pt, b: Pt): StrokeKind | 'up' {
  const deg = (Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * 180) / Math.PI;
  if (deg >= 90 - STRAIGHT_DEG) return b.y > a.y ? 'down' : 'up';
  if (deg <= STRAIGHT_DEG) return 'across';
  return 'slant';
}

/** The point `dist` units along a stroke (or its end). */
function pointAlong(stroke: Stroke, dist: number): Pt {
  let run = 0;
  for (let i = 1; i < stroke.length; i++) {
    run += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    if (run >= dist) return stroke[i];
  }
  return stroke.at(-1)!;
}

/** How a stroke bends: the share of its length that is curve, and how far it turns (degrees) in its first quarter. */
function bends(stroke: Stroke): { curveShare: number; startTurn: number } {
  const total = strokeLength(stroke);
  const steps: { len: number; angle: number; at: number }[] = [];
  let from = stroke[0];
  let run = 0;
  let at = 0;
  for (let i = 1; i < stroke.length; i++) {
    const d = Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    run += d;
    at += d;
    if (run >= BEND_STEP || i === stroke.length - 1) {
      steps.push({ len: run, angle: Math.atan2(stroke[i].y - from.y, stroke[i].x - from.x), at });
      from = stroke[i];
      run = 0;
    }
  }
  let curve = 0;
  let startTurn = 0;
  for (let i = 1; i < steps.length; i++) {
    let turn = Math.abs(steps[i].angle - steps[i - 1].angle) * (180 / Math.PI);
    if (turn > 180) turn = 360 - turn;
    if (turn <= CURVE_DEG || turn >= CORNER_DEG) continue;
    curve += steps[i].len;
    if (steps[i].at <= total / 4) startTurn += turn;
  }
  return { curveShare: total > 0 ? curve / total : 0, startTurn };
}

/**
 * What to call a stroke, from its shape: a dot; down then straight back up and over (b h m n p r); round from its
 * start, or across into a bump (B D P R, e): around; else by which way it starts: down, across or a slant.
 */
export function strokeKind(stroke: Stroke): StrokeKind {
  return strokeWords(stroke)[0].kind;
}

/**
 * The words for a stroke, each with where along it (0..1) to say it. A stroke of straight lines gets a word per
 * line where the way changes (L: "Down." then "Across."); a way back up says nothing. Any other stroke gets one word.
 */
export function strokeWords(stroke: Stroke): { kind: StrokeKind; at: number }[] {
  const total = strokeLength(stroke);
  if (total < DOT_LENGTH) return [{ kind: 'dot', at: 0 }];
  const parts = runs(stroke);
  if (parts.length >= 2) {
    const first = directionOf(parts[0][0], pointAlong(parts[0], 8));
    const back = directionOf(parts[1][0], pointAlong(parts[1], 8));
    if (first === 'down' && back === 'up') return [{ kind: 'down-over', at: 0 }];
  }
  const { curveShare, startTurn } = bends(stroke);
  if (startTurn > ROUND_START_DEG) return [{ kind: 'around', at: 0 }];
  const start = directionOf(stroke[0], pointAlong(stroke, 8));
  if (start === 'across' && curveShare >= ROUND_SHARE) return [{ kind: 'around', at: 0 }];
  if (curveShare > 0.05) return [{ kind: start === 'up' ? 'down' : start, at: 0 }];
  // Straight lines only: a word where each new line starts, the same word twice in a row said once.
  const out: { kind: StrokeKind; at: number }[] = [];
  let begin = 0;
  let run = 0;
  const push = (from: number, to: number, at: number) => {
    const way = directionOf(stroke[from], stroke[to]);
    if (way === 'up' || out.at(-1)?.kind === way) return;
    out.push({ kind: way, at: total > 0 ? at / total : 0 });
  };
  let lineStart = 0;
  for (let i = 1; i < stroke.length - 1; i++) {
    run += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    const u = { x: stroke[i].x - stroke[i - 1].x, y: stroke[i].y - stroke[i - 1].y };
    const v = { x: stroke[i + 1].x - stroke[i].x, y: stroke[i + 1].y - stroke[i].y };
    const cos = (u.x * v.x + u.y * v.y) / ((Math.hypot(u.x, u.y) || 1) * (Math.hypot(v.x, v.y) || 1));
    if (cos < Math.cos((LINE_TURN_DEG * Math.PI) / 180)) {
      push(begin, i, lineStart);
      begin = i;
      lineStart = run;
    }
  }
  push(begin, stroke.length - 1, lineStart);
  return out.length > 0 ? out : [{ kind: 'down', at: 0 }];
}

/** Arrows beside a stroke, one per run of at least 30 units (or the stroke's one run): see `arrowFor`. */
export function arrowsFor(g: Glyph, index: number): Arrow[] {
  const all = runs(g.strokes[index]);
  const long = all.filter((r) => strokeLength(r) >= 30);
  const picked = long.length > 0 ? long : all.length === 1 ? all : [];
  return picked.map((r) => arrowAlong(g, r)).filter((a): a is Arrow => a !== null);
}

/** The first arrow of a stroke (`arrowsFor`), or null for strokes too short for one (the dots). */
export function arrowFor(g: Glyph, index: number): Arrow | null {
  return arrowsFor(g, index)[0] ?? null;
}

/**
 * An arrow beside a run of a stroke, pointing the way it is drawn: the shaft follows the run from 20 % to 60 % of
 * its length, shifted to the outside of the letter. Runs too short for one get none.
 */
function arrowAlong(g: Glyph, stroke: Stroke): Arrow | null {
  const total = strokeLength(stroke);
  if (total < 12) return null;
  const c = centre(g);
  // Walk to the part of the stroke the arrow covers.
  const part: Pt[] = [];
  let run = 0;
  for (let i = 1; i < stroke.length; i++) {
    run += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    if (run >= total * 0.2 && run <= total * 0.6) part.push(stroke[i]);
  }
  if (part.length < 3) return null;
  const normalAt = (i: number) => {
    const a = part[Math.max(0, i - 1)];
    const b = part[Math.min(part.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  };
  // Pick the side away from the letter's middle, judged at the arrow's midpoint.
  const mid = part[Math.floor(part.length / 2)];
  const n = normalAt(Math.floor(part.length / 2));
  const plus = Math.hypot(mid.x + n.x * ARROW_GAP - c.x, mid.y + n.y * ARROW_GAP - c.y);
  const minus = Math.hypot(mid.x - n.x * ARROW_GAP - c.x, mid.y - n.y * ARROW_GAP - c.y);
  const side = plus >= minus ? 1 : -1;
  const shifted = part.map((p, i) => {
    const m = normalAt(i);
    return { x: p.x + m.x * ARROW_GAP * side, y: p.y + m.y * ARROW_GAP * side };
  });
  const tip = shifted.at(-1)!;
  const before = shifted[Math.max(0, shifted.length - 4)];
  const len = Math.hypot(tip.x - before.x, tip.y - before.y) || 1;
  const d = { x: (tip.x - before.x) / len, y: (tip.y - before.y) / len };
  const back = { x: tip.x - d.x * 6, y: tip.y - d.y * 6 };
  const r = (v: number) => Math.round(v * 10) / 10;
  const head =
    `M${r(back.x - d.y * 4)} ${r(back.y + d.x * 4)}L${r(tip.x)} ${r(tip.y)}` + `L${r(back.x + d.y * 4)} ${r(back.y - d.x * 4)}`;
  return { shaft: pathData(shifted.map((p) => ({ x: r(p.x), y: r(p.y) }))), head };
}
