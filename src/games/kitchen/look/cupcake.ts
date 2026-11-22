// How the cupcake is drawn (ADR 0044), seen from the side: a pleated wrapper below the middle, the cake rising out
// of it, a swirl of frosting on top with sprinkles and toppers. Everything comes from the plain data in `Made`.
import type { Recipe } from '../recipe';
import type { Bit, Made } from '../make/made';
import { BATTERS, FROSTINGS, INK, WRAPPERS } from './art';
import { Bitten, clamp01, drawPiece, lerp, oval, ovenScene, smooth, toneAt, type Ctx, type Look, type View } from './kit';

/** The wrapper's top edge and its bottom, and how wide it is at each. */
const TOP = 30, BOTTOM = 225, TOP_HALF = 135, BOTTOM_HALF = 100;
/** How far the cake rises above the wrapper when it is baked. */
const RISE = 62;
/** The frosting's swirls, bottom to top: the middle of each, and its size. */
const SWIRLS = [
  { y: -22, rx: 152, ry: 46 },
  { y: -78, rx: 120, ry: 42 },
  { y: -128, rx: 86, ry: 36 },
  { y: -170, rx: 50, ry: 30 },
] as const;
const SPRINKLE_COLOURS = ['#ffd23f', '#4cc9f0', '#9bd93c', '#ffffff', '#ff8a1f', '#9b5de5'];

/** What it stands on: a grey baking tray before the oven, a plate after. */
function stand(ctx: Ctx, baked: boolean): void {
  oval(ctx, 0, BOTTOM + 8, 238, 50, baked ? '#ffffff' : '#c7ced6', INK);
  oval(ctx, 0, BOTTOM + 4, 180, 32, undefined, baked ? '#d3d9e0' : '#aab3bd', 4);
}

function wrapper(ctx: Ctx, made: Made): void {
  const look = WRAPPERS[made.picked.wrapper] ?? WRAPPERS['blue-wrapper'];
  ctx.beginPath();
  ctx.moveTo(-TOP_HALF, TOP);
  ctx.lineTo(TOP_HALF, TOP);
  ctx.lineTo(BOTTOM_HALF, BOTTOM);
  ctx.quadraticCurveTo(0, BOTTOM + 18, -BOTTOM_HALF, BOTTOM);
  ctx.closePath();
  ctx.fillStyle = look.fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    ctx.moveTo((i * TOP_HALF) / 4, TOP + 8);
    ctx.lineTo((i * BOTTOM_HALF) / 4, BOTTOM - 4);
  }
  ctx.strokeStyle = look.pleat;
  ctx.lineWidth = 5;
  ctx.stroke();
}

/** The batter in the wrapper's mouth as it is poured, then the cake's dome as it bakes. */
function cake(ctx: Ctx, made: Made, bake: number): void {
  const poured = made.poured.batter ?? 0;
  const tone = BATTERS[made.picked.batter] ?? BATTERS['vanilla-batter'];
  // The mouth of the wrapper: dark while it is empty.
  oval(ctx, 0, TOP, TOP_HALF, 26, '#3b2f2a', INK);
  if (poured <= 0) return;
  const colour = toneAt(tone, bake);
  if (bake <= 0) {
    // A pool that grows to fill the mouth.
    const k = 0.25 + 0.75 * smooth(poured);
    oval(ctx, 0, TOP + 4 * (1 - k), (TOP_HALF - 8) * k, 21 * k, colour, INK, 5);
    return;
  }
  const up = RISE * smooth(bake);
  ctx.beginPath();
  ctx.moveTo(-TOP_HALF - 6 * bake, TOP);
  ctx.bezierCurveTo(-TOP_HALF - 10, TOP - up * 1.25, TOP_HALF + 10, TOP - up * 1.25, TOP_HALF + 6 * bake, TOP);
  ctx.bezierCurveTo(TOP_HALF, TOP + 30, -TOP_HALF, TOP + 30, -TOP_HALF - 6 * bake, TOP);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
}

function frosting(ctx: Ctx, made: Made): void {
  const amount = made.poured.frosting ?? 0;
  if (amount <= 0) return;
  const look = FROSTINGS[made.picked.frosting] ?? FROSTINGS['strawberry-frosting'];
  SWIRLS.forEach((s, i) => {
    // Each swirl grows in turn as more is squeezed on.
    const k = smooth(clamp01(amount * SWIRLS.length - i));
    if (k <= 0) return;
    oval(ctx, 0, s.y + s.ry * (1 - k) * 0.6, s.rx * k, s.ry * k, look.fill, INK);
    if (k >= 1) {
      ctx.beginPath();
      ctx.ellipse(0, s.y - 4, s.rx * 0.72, s.ry * 0.5, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.strokeStyle = look.edge;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  });
  if (amount >= 1) {
    // The little peak on top.
    const top = SWIRLS[SWIRLS.length - 1];
    ctx.beginPath();
    ctx.moveTo(-22, top.y - 16);
    ctx.quadraticCurveTo(-6, top.y - 60, 12, top.y - 62);
    ctx.quadraticCurveTo(6, top.y - 36, 24, top.y - 16);
    ctx.fillStyle = look.fill;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
}

function sprinkles(ctx: Ctx, bits: readonly Bit[], view: View): void {
  if (!bits.length) return;
  ctx.lineCap = 'round';
  const line = (i: number) => {
    const b = bits[i], k = view.pop(b), len = b.l * 0.75;
    const dx = (Math.cos(b.a) * len * k) / 2, dy = (Math.sin(b.a) * len * k) / 2;
    ctx.moveTo(b.x - dx, b.y - dy);
    ctx.lineTo(b.x + dx, b.y + dy);
  };
  ctx.beginPath();
  for (let i = 0; i < bits.length; i++) line(i);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 11;
  ctx.stroke();
  SPRINKLE_COLOURS.forEach((colour, c) => {
    ctx.beginPath();
    for (let i = c; i < bits.length; i += SPRINKLE_COLOURS.length) line(i);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 6.5;
    ctx.stroke();
  });
}

/** The cupcake itself, with no bites. */
function cupcake(ctx: Ctx, made: Made, view: View, bake: number): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  cake(ctx, made, bake);
  wrapper(ctx, made);
  if (bake < 1) return;
  frosting(ctx, made);
  sprinkles(ctx, made.bits.sprinkles ?? [], view);
  for (const piece of made.placed.toppers ?? []) drawPiece(ctx, piece, 0, view.pop(piece) * 1.25);
}

/** A jug pouring batter into the wrapper, while a finger is down. */
function jug(ctx: Ctx, made: Made, view: View): void {
  if (!view.held || (made.poured.batter ?? 0) >= 1) return;
  const colour = toneAt(BATTERS[made.picked.batter] ?? BATTERS['vanilla-batter'], 0);
  const wobble = 3 * Math.sin(view.time * 14);
  // The stream first, so the jug's lip sits over it.
  ctx.beginPath();
  ctx.moveTo(84, -168);
  ctx.quadraticCurveTo(24 + wobble, -120, 8 + wobble, TOP - 6);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 26;
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.save();
  ctx.translate(170, -196);
  ctx.rotate(-0.75);
  ctx.beginPath();
  ctx.roundRect(-70, -60, 140, 120, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  oval(ctx, 0, -60, 70, 16, colour, INK);
  ctx.beginPath();
  ctx.arc(84, 0, 34, -1.2, 1.2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** A piping bag over the swirl, while a finger is down. */
function bag(ctx: Ctx, made: Made, view: View): void {
  const amount = made.poured.frosting ?? 0;
  if (!view.held || amount >= 1) return;
  const look = FROSTINGS[made.picked.frosting] ?? FROSTINGS['strawberry-frosting'];
  const tip = lerp(SWIRLS[0].y - 30, SWIRLS[SWIRLS.length - 1].y - 50, amount);
  const sway = 26 * Math.sin(view.time * 7);
  ctx.save();
  ctx.translate(sway, tip);
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(10, 0);
  ctx.lineTo(74, -150);
  ctx.quadraticCurveTo(0, -176, -74, -150);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34, -56);
  ctx.lineTo(34, -56);
  ctx.strokeStyle = look.fill;
  ctx.lineWidth = 12;
  ctx.stroke();
  ctx.restore();
}

/** Draws the cupcake's scene for the open step. */
export class CupcakeLook implements Look {
  private readonly bitten = new Bitten();

  draw(ctx: Ctx, recipe: Recipe, made: Made, view: View): void {
    const step = recipe.steps[made.step];
    const bake = made.cooked.oven ?? 0;
    if (step.verb === 'cook') {
      ovenScene(ctx, view, bake, () => {
        // On the rack, small, with the cake rising.
        ctx.translate(0, 34);
        ctx.scale(0.5, 0.5);
        cupcake(ctx, made, view, bake);
      });
      return;
    }
    if (step.verb === 'eat') {
      stand(ctx, true);
      this.bitten.draw(ctx, made, made.bites[step.id] ?? [], (c) => cupcake(c, made, { ...view, pop: () => 1 }, 1));
      return;
    }
    stand(ctx, bake >= 1);
    cupcake(ctx, made, view, bake);
    if (step.id === 'batter') jug(ctx, made, view);
    if (step.id === 'frosting') bag(ctx, made, view);
  }
}
