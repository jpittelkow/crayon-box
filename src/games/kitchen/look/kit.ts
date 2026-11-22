// What every recipe's look shares (ADR 0044): colours that go from raw to baked, drawing a piece from its art, the
// oven, and the bites out of a finished thing. A look draws on a 2D canvas whose units are the recipe's (0,0 is the
// middle of the thing).
import type { Recipe } from '../recipe';
import type { Bite, Made, Placed } from '../make/made';
import { INK, PIECES, type Op, type Tone } from './art';

export type Ctx = CanvasRenderingContext2D;

/** What the screen knows that the saved data doesn't. */
export interface View {
  /** Seconds since the screen opened, for the things that move. */
  time: number;
  /** The dough's flatness as shown: it follows the saved number with a short ease. */
  flat: number;
  /** The canvas, in units, for things that run to its edges (the oven's floor). */
  width: number;
  height: number;
  /** A finger is down (a jug pours only while one is). */
  held: boolean;
  /** How big to draw a bit or piece that has just landed (1 once it has settled). */
  pop(thing: object): number;
  /** Bubbles a kid's touch made on the oven window: where, and when (`time`). */
  bubbles: readonly { x: number; y: number; at: number }[];
}

/** How one recipe is drawn. */
export interface Look {
  /** The scene for the open step. */
  draw(ctx: Ctx, recipe: Recipe, made: Made, view: View): void;
}

export const TAU = Math.PI * 2;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
export const smooth = (t: number) => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};

export function mix(a: string, b: string, t: number): string {
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
export function path(d: string): Path2D {
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

export function disc(ctx: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, width = 6): void {
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

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill?: string, stroke?: string, width = 6): void {
  if (rx <= 0 || ry <= 0) return;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
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

export function arcs(ctx: Ctx, r: number, spans: readonly [number, number][], stroke: string, width: number): void {
  ctx.beginPath();
  for (const [a, b] of spans) {
    ctx.moveTo(r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180));
    ctx.arc(0, 0, r, (a * Math.PI) / 180, (b * Math.PI) / 180);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** The same scatter every time, so things don't jump between frames. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/**
 * The oven: a bright one with a big window. `inside` draws the thing on the rack (0,65 is the middle of the rack's
 * top); `spots` are where bubbles come up on it as it cooks, round that point.
 */
export function ovenScene(ctx: Ctx, view: View, cooked: number, inside: () => void, spots: readonly (readonly [number, number])[] = []): void {
  const t = view.time;
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
  // The window, the glow under the rack, and the thing on it.
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
  inside();
  ctx.restore();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Bubbles as it cooks, and one wherever the window is touched.
  ctx.fillStyle = '#ffe98f';
  ctx.strokeStyle = '#e3a21a';
  ctx.lineWidth = 2.5;
  const bubble = (x: number, y: number, r: number) => {
    if (r <= 0.5) return;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  };
  spots.forEach(([x, y], i) => {
    if (cooked * spots.length > i) bubble(x, 65 + y, 8 * (0.6 + 0.4 * Math.sin(t * 6 + i * 1.7)));
  });
  for (const b of view.bubbles) {
    const age = t - b.at;
    if (age < 0.6) bubble(b.x, b.y, 16 * Math.sin((age / 0.6) * Math.PI));
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
 * A finished thing with bites out of it. It keeps two spare canvases: bites are cut out of a picture of the whole
 * thing, and out of the same picture turned to ink with slightly smaller holes, which leaves an ink line along each
 * bite. The pictures are made again only when a bite is taken or the canvas changes size.
 */
export class Bitten {
  private whole: HTMLCanvasElement | undefined;
  private rim: HTMLCanvasElement | undefined;
  private key = '';
  private of: object | undefined;

  /**
   * `paint` draws the whole thing, with no bites, in the canvas's own units. `of` is the thing itself (its saved
   * data): a new thing is a new picture even with the same number of bites.
   */
  draw(ctx: Ctx, of: object, bites: readonly Bite[], paint: (c: Ctx) => void): void {
    const canvas = ctx.canvas, at = ctx.getTransform();
    const key = `${canvas.width}x${canvas.height}:${at.a}:${bites.length}`;
    if (key !== this.key || of !== this.of || !this.whole || !this.rim) {
      this.key = key;
      this.of = of;
      const layer = (old: HTMLCanvasElement | undefined, ink: boolean, shrink: number) => {
        const el = old ?? document.createElement('canvas');
        el.width = canvas.width;
        el.height = canvas.height;
        const c = el.getContext('2d')!;
        c.setTransform(at);
        paint(c);
        if (ink) {
          // Only where something was painted: its shape, in ink.
          c.globalCompositeOperation = 'source-in';
          c.setTransform(1, 0, 0, 1, 0, 0);
          c.fillStyle = INK;
          c.fillRect(0, 0, el.width, el.height);
          c.setTransform(at);
        }
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
      this.rim = layer(this.rim, true, 5);
      this.whole = layer(this.whole, false, 0);
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.rim, 0, 0);
    ctx.drawImage(this.whole, 0, 0);
    ctx.restore();
  }
}
