// How the pizza is drawn (ADR 0044), on a 2D canvas whose units are the recipe's (0,0 is the middle of the thing,
// the pizza is 250 to its edge). Everything comes from the plain data in `Made`, so the same code draws a lump of
// dough, a raw pizza, one in the oven and one half eaten. The baked look is the raw art with its second colours.
import type { Recipe } from '../recipe';
import { cellAt, cells, GRID, type Bit, type Made } from '../make/made';
import { covered, pressedRadius } from '../make/verbs';
import { INK, LAYERS } from './art';
import { arcs, Bitten, disc, drawPiece, lerp, mix, ovenScene, path, seeded, smooth, TAU, toneAt, type Ctx, type Look, type View } from './kit';

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

/** Draws the pizza's scene for the open step. */
export class PizzaLook implements Look {
  private readonly bitten = new Bitten();

  draw(ctx: Ctx, recipe: Recipe, made: Made, view: View): void {
    const step = recipe.steps[made.step];
    if (step.verb === 'cook') {
      const cooked = made.cooked[step.id] ?? 0;
      ovenScene(ctx, view, cooked, () => {
        ctx.translate(0, 65);
        ctx.scale(0.82, 0.3);
        pizza(ctx, recipe, made, view, 1, cooked);
      }, OVEN_BUBBLES);
      return;
    }
    if (step.verb === 'eat') {
      disc(ctx, 0, 0, 318, '#ffffff', INK);
      this.bitten.draw(ctx, made, made.bites[step.id] ?? [], (c) => pizza(c, recipe, made, { ...view, pop: () => 1 }, 1, 1));
      disc(ctx, 0, 0, 268, undefined, '#d3d9e0', 4);
      return;
    }
    board(ctx);
    pizza(ctx, recipe, made, view, view.flat, 0);
  }
}
