// How the pizza is drawn (ADR 0044), on a 2D canvas whose units are the recipe's (0,0 is the middle of the thing,
// the pizza is 250 to its edge). Everything comes from the plain data in `Made`, so the same code draws a lump of
// dough, a raw pizza, one in the oven and one half eaten. The baked look is the raw art with its second colours.
import type { Recipe } from '../recipe';
import { cellAt, cells, GRID, type Bit, type Bite, type Made, type Placed } from '../make/made';
import { covered, pressedRadius } from '../make/verbs';
import { INK, LAYERS, PIECES, type Op, type Tone } from './art';

type Ctx = CanvasRenderingContext2D;

/** What the screen knows that the saved data doesn't. */
export interface View {
  /** Seconds since the screen opened, for the things that move. */
  time: number;
  /** The dough's flatness as shown: it follows the saved number with a short ease. */
  flat: number;
  /** The canvas, in units, for things that run to its edges (the oven's floor). */
  width: number;
  height: number;
  /** How big to draw a bit or piece that has just landed (1 once it has settled). */
  pop(thing: object): number;
  /** Bubbles a kid's touch made on the oven window: where, and when (`time`). */
  bubbles: readonly { x: number; y: number; at: number }[];
}

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
/** A tone at a bake from 0 (raw) to 1 (baked). */
export function toneAt(tone: Tone, bake: number): string {
  if (typeof tone === 'string') return tone;
  return bake <= 0 ? tone[0] : bake >= 1 ? tone[1] : mix(tone[0], tone[1], bake);
}

const paths = new Map<string, Path2D>();
function path(d: string): Path2D {
  let p = paths.get(d);
  if (!p) paths.set(d, (p = new Path2D(d)));
  return p;
}

/** Draws a piece's art round 0,0. */
export function drawOps(ctx: Ctx, ops: readonly Op[], bake = 0): void {
  for (const op of ops) {
    const p = path(op.d);
    if (op.fill) {
      ctx.fillStyle = toneAt(op.fill, bake);
      ctx.fill(p);
    }
    if (op.stroke) {
      ctx.strokeStyle = toneAt(op.stroke, bake);
      ctx.lineWidth = op.width ?? 4;
      ctx.stroke(p);
    }
  }
}

/** One piece where it lies. */
export function drawPiece(ctx: Ctx, piece: Placed, bake: number, scale = 1): void {
  const ops = PIECES[piece.kind];
  if (!ops) return;
  ctx.save();
  ctx.translate(piece.x, piece.y);
  ctx.rotate((piece.rot * Math.PI) / 180);
  ctx.scale(scale, scale);
  drawOps(ctx, ops, bake);
  ctx.restore();
}

function disc(ctx: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, width = 6): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function arcs(ctx: Ctx, r: number, spans: readonly [number, number][], stroke: string, width: number): void {
  ctx.beginPath();
  for (const [a, b] of spans) {
    ctx.moveTo(r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180));
    ctx.arc(0, 0, r, (a * Math.PI) / 180, (b * Math.PI) / 180);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The same scatter every time, so the flour doesn't jump between frames. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const FLOUR = (() => {
  const r = seeded(11), out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 60; i++) {
    const far = 185 + 118 * r(), turn = r() * TAU;
    out.push({ x: far * Math.cos(turn), y: far * Math.sin(turn), r: 2.5 + r() * 5 });
  }
  return out;
})();
const OVEN_BUBBLES = [[-84, 16], [8, 30], [72, -10], [-20, -36], [128, 22], [-140, -20], [150, -60]] as const;

function board(ctx: Ctx): void {
  disc(ctx, 0, 0, 318, '#c98f5a', INK);
  disc(ctx, 0, 0, 290, undefined, '#b57a45', 4);
  ctx.globalAlpha = 0.7;
  arcs(ctx, 240, [[200, 250]], '#b57a45', 4);
  arcs(ctx, 268, [[300, 340]], '#b57a45', 4);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const f of FLOUR) {
    ctx.moveTo(f.x + f.r, f.y);
    ctx.arc(f.x, f.y, f.r, 0, TAU);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** The dough: a wobbly lump that rounds off as it is patted, then a base with a raised edge. */
function base(ctx: Ctx, recipe: Recipe, flat: number, bake: number): void {
  const r = pressedRadius(recipe, flat), wobble = 1 - smooth(flat);
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const t = (i / 90) * TAU;
    const q = r * (1 + wobble * (0.07 * Math.sin(3 * t + 0.6) + 0.045 * Math.sin(5 * t + 1.3)));
    ctx.lineTo(q * Math.cos(t), q * Math.sin(t));
  }
  ctx.closePath();
  ctx.fillStyle = mix('#f6dfae', '#e2a85c', bake);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  if (flat < 1) {
    // A soft crease, so the lump reads as dough and not as a plate.
    ctx.globalAlpha = wobble;
    ctx.beginPath();
    ctx.moveTo(-0.62 * r, 0.4 * r);
    ctx.quadraticCurveTo(-0.05 * r, 0.78 * r, 0.6 * r, 0.32 * r);
    ctx.strokeStyle = '#e3c385';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // The raised edge shows as the dough gets flat.
  const edge = smooth((flat - 0.7) / 0.3);
  if (edge > 0) {
    ctx.globalAlpha = edge;
    disc(ctx, 0, 0, recipe.inner + 6, mix('#faecc8', '#edc27a', bake), mix('#e3c385', '#c98843', bake), 4);
    ctx.globalAlpha = 1;
  }
  if (bake > 0) {
    ctx.globalAlpha = bake;
    arcs(ctx, recipe.r - 18, [[190, 222], [20, 48], [95, 130], [285, 310]], '#c98843', 10);
    ctx.globalAlpha = 1;
  }
}

function sauce(ctx: Ctx, recipe: Recipe, made: Made, stepId: string, bake: number): void {
  const grid = made.spread[stepId], layer = LAYERS[made.picked[stepId]];
  if (!grid || !layer) return;
  const fill = toneAt(layer.fill, bake), edge = toneAt(layer.edge, bake);
  if (covered(recipe, made, stepId) >= 1) {
    disc(ctx, 0, 0, recipe.inner, fill, edge, 5);
    ctx.globalAlpha = 0.6 * (1 - bake);
    ctx.strokeStyle = layer.shine;
    ctx.lineWidth = 10;
    ctx.stroke(path('M-130-50q60-50 130 0t120 30M-140 60q70 50 150 10t110 20'));
    ctx.globalAlpha = 1;
    return;
  }
  // Each covered cell is a blob a little wider than the cell, so the sauce's edge is soft bumps, not steps.
  const size = ((2 * recipe.r) / GRID) * 1.35;
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, recipe.inner, 0, TAU);
  ctx.clip();
  for (const [grow, colour] of [[4, edge], [0, fill]] as const) {
    ctx.beginPath();
    for (const i of cells(recipe).inner) {
      if (grid[i] !== '1') continue;
      const c = cellAt(recipe, i);
      ctx.moveTo(c.x + size + grow, c.y);
      ctx.arc(c.x, c.y, size + grow, 0, TAU);
    }
    ctx.fillStyle = colour;
    ctx.fill();
  }
  ctx.restore();
}

/** Cheese: thin shreds when raw, which swell into melted pools as it bakes. */
function cheese(ctx: Ctx, bits: readonly Bit[], bake: number, view: View): void {
  if (!bits.length) return;
  const melt = smooth(bake);
  const wide = lerp(6.5, 38, melt), rim = lerp(3.5, 6, melt);
  const light = mix('#ffd94d', '#ffcf5a', melt), dark = mix('#d39c12', '#e3a21a', melt);
  ctx.lineCap = 'round';
  // Raw shreds lie over one another, so they are drawn in batches; melted, they are one pool.
  const batches = melt < 0.5 ? 8 : 1;
  for (let g = 0; g < batches; g++) {
    ctx.beginPath();
    for (let i = g; i < bits.length; i += batches) {
      const b = bits[i], k = view.pop(b);
      const dx = (Math.cos(b.a) * b.l * k) / 2, dy = (Math.sin(b.a) * b.l * k) / 2;
      ctx.moveTo(b.x - dx, b.y - dy);
      ctx.lineTo(b.x + dx, b.y + dy);
    }
    ctx.strokeStyle = dark;
    ctx.lineWidth = wide + rim;
    ctx.stroke();
    ctx.strokeStyle = light;
    ctx.lineWidth = wide;
    ctx.stroke();
  }
  if (bake > 0) {
    ctx.globalAlpha = bake;
    ctx.fillStyle = '#f2b04a';
    ctx.beginPath();
    for (let i = 0; i < bits.length; i += 11) {
      const b = bits[i], r = 8 + (i % 7);
      ctx.moveTo(b.x + r, b.y);
      ctx.arc(b.x, b.y, r, 0, TAU);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** The pizza itself, raw (bake 0) to baked (1), with no bites. */
function pizza(ctx: Ctx, recipe: Recipe, made: Made, view: View, flat: number, bake: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  base(ctx, recipe, flat, bake);
  if (flat < 1) return;
  sauce(ctx, recipe, made, 'sauce', bake);
  cheese(ctx, made.bits.cheese ?? [], bake, view);
  for (const piece of made.placed.toppings ?? []) drawPiece(ctx, piece, bake, view.pop(piece));
}

function oven(ctx: Ctx, recipe: Recipe, made: Made, view: View): void {
  const cooked = made.cooked.oven ?? 0, t = view.time;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // The floor, to the canvas's edges.
  ctx.fillStyle = '#f6c9a0';
  ctx.fillRect(-view.width / 2, 301, view.width, view.height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-view.width / 2, 301);
  ctx.lineTo(view.width / 2, 301);
  ctx.stroke();
  // The oven.
  ctx.beginPath();
  ctx.roundRect(-330, -331, 660, 640, 44);
  ctx.fillStyle = '#12a8a3';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-330, -217);
  ctx.lineTo(330, -217);
  ctx.stroke();
  disc(ctx, -223, -273, 30, '#ffffff', INK, 5);
  disc(ctx, -123, -273, 30, '#ffffff', INK, 5);
  ctx.lineWidth = 6;
  ctx.stroke(path('M-223-273l14-16M-123-273l-18-10'));
  // The light is on while it bakes.
  if (cooked < 1) {
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 5);
    disc(ctx, 223, -273, 36, undefined, '#ffd23f', 6);
    ctx.globalAlpha = 1;
  }
  disc(ctx, 223, -273, 24, cooked < 1 ? '#f23b2f' : '#9bd93c', INK, 5);
  // The window, the glow under the rack, and the pizza on it.
  ctx.beginPath();
  ctx.roundRect(-270, -177, 540, 380, 30);
  ctx.fillStyle = '#4a2f22';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  const flicker = 1 + 0.04 * Math.sin(t * 9);
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.ellipse(0, 179, 244 * flicker, 20, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.ellipse(0, 183, 170 / flicker, 11, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8a6f5c';
  ctx.lineWidth = 4;
  ctx.stroke(path('M-250 133H250M-250 149H250'));
  ctx.save();
  ctx.translate(0, 65);
  ctx.scale(0.82, 0.3);
  pizza(ctx, recipe, made, view, 1, cooked);
  ctx.restore();
  // Bubbles on the cheese, more as it cooks, and one wherever the window is touched.
  ctx.fillStyle = '#ffe98f';
  ctx.strokeStyle = '#e3a21a';
  ctx.lineWidth = 2.5;
  const bubble = (x: number, y: number, r: number) => {
    if (r <= 0.5) return;
    ctx.beginPath();
    ctx.arc(x, 65 + y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  };
  OVEN_BUBBLES.forEach(([x, y], i) => {
    if (cooked * OVEN_BUBBLES.length > i) bubble(x, y, 8 * (0.6 + 0.4 * Math.sin(t * 6 + i * 1.7)));
  });
  for (const b of view.bubbles) {
    const age = t - b.at;
    if (age < 0.6) bubble(b.x, b.y - 65, 16 * Math.sin((age / 0.6) * Math.PI));
  }
  // Heat rising, and the shine on the glass.
  ctx.strokeStyle = '#ffbf75';
  ctx.lineWidth = 7;
  [-110, 0, 110].forEach((x, i) => {
    const phase = (t / 2 + i / 3) % 1;
    ctx.globalAlpha = 0.85 * Math.sin(phase * Math.PI);
    ctx.save();
    ctx.translate(x, 8 - 22 * phase);
    ctx.stroke(path('M0-35q-16-22 0-44t0-44'));
    ctx.restore();
  });
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.stroke(path('M-227-121l58-30M-227-77l112-58'));
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.roundRect(-180, 233, 360, 32, 16);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.stroke();
}

/**
 * Draws the pizza's scene for the open step. It keeps two spare canvases for the eaten pizza: bites are cut out of
 * a picture of the whole pizza, and out of an ink shape a little bigger, which leaves an ink line along each bite.
 */
export class PizzaLook {
  private whole: HTMLCanvasElement | undefined;
  private rim: HTMLCanvasElement | undefined;
  private key = '';

  draw(ctx: Ctx, recipe: Recipe, made: Made, view: View): void {
    const step = recipe.steps[made.step];
    if (step.verb === 'cook') return oven(ctx, recipe, made, view);
    if (step.verb === 'eat') return this.plate(ctx, recipe, made, view, made.bites[step.id] ?? []);
    board(ctx);
    pizza(ctx, recipe, made, view, view.flat, 0);
  }

  private plate(ctx: Ctx, recipe: Recipe, made: Made, view: View, bites: readonly Bite[]): void {
    disc(ctx, 0, 0, 318, '#ffffff', INK);
    const canvas = ctx.canvas, at = ctx.getTransform();
    const key = `${canvas.width}x${canvas.height}:${at.a}:${bites.length}`;
    if (key !== this.key || !this.whole || !this.rim) {
      this.key = key;
      const layer = (old: HTMLCanvasElement | undefined, paint: (c: Ctx) => void, shrink: number) => {
        const el = old ?? document.createElement('canvas');
        el.width = canvas.width;
        el.height = canvas.height;
        const c = el.getContext('2d')!;
        c.setTransform(at);
        paint(c);
        c.globalCompositeOperation = 'destination-out';
        c.beginPath();
        for (const b of bites) {
          c.moveTo(b.x + b.r - shrink, b.y);
          c.arc(b.x, b.y, b.r - shrink, 0, TAU);
        }
        c.fill();
        c.globalCompositeOperation = 'source-over';
        return el;
      };
      this.rim = layer(this.rim, (c) => disc(c, 0, 0, recipe.r + 3, INK), 5);
      this.whole = layer(this.whole, (c) => pizza(c, recipe, made, { ...view, pop: () => 1 }, 1, 1), 0);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.rim, 0, 0);
    ctx.drawImage(this.whole, 0, 0);
    ctx.restore();
    disc(ctx, 0, 0, 268, undefined, '#d3d9e0', 4);
  }
}
