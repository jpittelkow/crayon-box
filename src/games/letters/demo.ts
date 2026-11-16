// The show on the trace screen (ADR 0037): a fingertip draws strokes of the letter one after another, each with its
// stroke word, then the drawing clears. The hints use it for one stroke (step 2) and for the whole letter (step 3);
// the first-time how-to (letters plan phase D) can call it on its own. Timing comes from `demoPlan` in hints.ts.
import type { Glyph, StrokeKind } from './glyphs';
import { demoPlan } from './hints';

const SVG_NS = 'http://www.w3.org/2000/svg';
const INK = '#23201c';

export interface DemoOptions {
  glyph: Glyph;
  /** The strokes to draw, in order (indices into the glyph). */
  strokes: readonly number[];
  /** Where to draw: a group inside the trace screen's picture, in glyph units. */
  layer: SVGGElement;
  /** The drawn line's colour (the kid's). */
  color: string;
  /** Less motion: each stroke appears whole at its turn, the fingertip at its start, on the same timing. */
  still: boolean;
  /** Says a stroke word as its part of the stroke starts. Left out, the show is silent. */
  say?: (kind: StrokeKind) => void;
}

export interface Demo {
  /** Ends the show at once and clears it (a touch, leaving the letter). */
  stop(): void;
  /** True once the show ran to its end, false when it was stopped. */
  readonly done: Promise<boolean>;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Plays a show of `strokes`. Each word is said once, as the fingertip reaches it. */
export function playDemo(opts: DemoOptions): Demo {
  const { glyph: g, layer } = opts;
  const plan = demoPlan(g, opts.strokes);
  const group = svgEl('g', { class: 'letters-demo', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const lines = plan.beats.map(() => {
    const node = svgEl('polyline', { 'stroke-width': 9, opacity: 0.85 });
    node.style.stroke = opts.color;
    group.append(node);
    return node;
  });
  const tip = svgEl('g', { class: 'letters-hint', visibility: 'hidden' });
  tip.append(
    svgEl('circle', { r: 15, stroke: INK, 'stroke-width': 1.5, opacity: 0.35 }),
    svgEl('circle', { r: 10, fill: '#ffffff', stroke: INK, 'stroke-width': 2.5 }),
  );
  group.append(tip);
  layer.append(group);

  const said = plan.beats.map((b) => b.words.map(() => false));
  let frame = 0;
  let finish: (ran: boolean) => void = () => {};
  const done = new Promise<boolean>((resolve) => (finish = resolve));
  let over = false;
  const end = (ran: boolean) => {
    if (over) return;
    over = true;
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    group.remove();
    finish(ran);
  };
  const t0 = performance.now();
  const step = () => {
    if (over) return;
    const t = performance.now() - t0;
    if (t >= plan.total) {
      end(true);
      return;
    }
    let shownAt: { x: number; y: number } | null = null;
    plan.beats.forEach((beat, b) => {
      if (t < beat.start) return;
      const stroke = g.strokes[beat.stroke];
      const f = opts.still ? 1 : Math.min(1, (t - beat.start) / beat.ms);
      const upto = Math.max(1, Math.round(f * (stroke.length - 1)) + 1);
      lines[b].setAttribute('points', stroke.slice(0, upto).map((p) => `${p.x},${p.y}`).join(' '));
      if (t <= beat.start + beat.ms) shownAt = opts.still ? stroke[0] : stroke[upto - 1];
      beat.words.forEach((w, i) => {
        if (said[b][i] || t < beat.start + w.at) return;
        said[b][i] = true;
        opts.say?.(w.kind);
      });
    });
    if (shownAt) {
      const p: { x: number; y: number } = shownAt;
      tip.setAttribute('transform', `translate(${p.x} ${p.y})`);
      tip.setAttribute('visibility', 'visible');
    } else {
      tip.setAttribute('visibility', 'hidden');
    }
    frame = requestAnimationFrame(step);
  };
  // A timer as well as frames: a page in the background gets no frames, and the show must still end.
  const timer = setTimeout(() => end(true), plan.total + 500);
  step();
  return { stop: () => end(false), done };
}
