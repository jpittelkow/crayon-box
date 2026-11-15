// Checks a kid's trace against a letter (ADR 0026). Plain TypeScript with no DOM, so it has unit tests.
//
// Each stroke is sampled into checkpoints a few units apart. A checkpoint counts once a trace passes within the
// tolerance of it. Lenient (the default): any order and direction, done when 85 % of all checkpoints and 80 % of
// every stroke are covered, so a whole stroke (A's bar) can't be skipped. Stroke order: only the current stroke
// counts, from its start and in its direction, and the next stroke starts when 85 % of it is done.
// Ink far from the letter is counted too: a trace with more than three times the letter's length of it (a scribble
// over the whole screen) does not finish until it is wiped.
import { strokeLength, type Glyph, type Pt } from './glyphs';

/** Checkpoint spacing, in glyph units. */
const SPACING = 3;
/** Share of a letter's checkpoints a lenient trace must cover. */
export const DONE_SHARE = 0.85;
/** Share of each stroke a lenient trace must cover. */
const STROKE_SHARE = 0.8;
/** In stroke order, how far ahead of the covered run a checkpoint may still count. */
const WINDOW = 4;
/** How far from a checkpoint a trace still covers it, in glyph units (the guide is 20 wide). */
export const TOLERANCE = { finger: 15, pen: 9 } as const;
/** Ink this many tolerances from every checkpoint is off the letter. */
const OFF_FACTOR = 1.5;
/** How much off-letter ink, in letter lengths, still lets a trace finish. */
const OFF_LIMIT = 3;
/** Fast moves are filled in at this step, so a quick swipe still passes its checkpoints. */
const FILL_STEP = 2;

export interface TraceOptions {
  ordered: boolean;
}

export class Tracer {
  private readonly checkpoints: Pt[][];
  private readonly covered: boolean[][];
  private readonly own: boolean[][];
  /** In stroke order: how many checkpoints of each stroke are covered in a row from its start. */
  private readonly run: number[];
  private readonly letterLength: number;
  private readonly last = new Map<number, Pt>();
  private offInk = 0;
  private current = 0;

  constructor(
    readonly glyph: Glyph,
    readonly opts: TraceOptions,
  ) {
    this.checkpoints = glyph.strokes.map((stroke) => {
      const out: Pt[] = [stroke[0]];
      let since = 0;
      for (let i = 1; i < stroke.length; i++) {
        since += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
        if (since >= SPACING) {
          out.push(stroke[i]);
          since = 0;
        }
      }
      const end = stroke.at(-1)!;
      if (out.at(-1) !== end && Math.hypot(out.at(-1)!.x - end.x, out.at(-1)!.y - end.y) > SPACING / 2) out.push(end);
      return out;
    });
    this.covered = this.checkpoints.map((c) => c.map(() => false));
    // A checkpoint is a stroke's own when no other stroke passes near it. Tracing A's legs covers the ends of its
    // bar, so only the bar's own middle shows whether the bar was traced.
    this.own = this.checkpoints.map((cps, s) =>
      cps.map(
        (cp) =>
          !glyph.strokes.some(
            (other, o) => o !== s && other.some((p) => Math.hypot(p.x - cp.x, p.y - cp.y) <= TOLERANCE.finger + 2),
          ),
      ),
    );
    this.run = this.checkpoints.map(() => 0);
    this.letterLength = glyph.strokes.reduce((a, s) => a + strokeLength(s), 0);
  }

  /** The stroke a kid is on, in stroke order (the start dot and arrow to show). In lenient mode, always 0. */
  get currentStroke(): number {
    return this.opts.ordered ? this.current : 0;
  }

  /** A pointer went down or moved to `p` (glyph units). `pointer` tells fingers apart. */
  add(pointer: number, p: Pt, tolerance: number): void {
    const prev = this.last.get(pointer);
    this.last.set(pointer, p);
    if (!prev) {
      this.visit(p, tolerance, 0);
      return;
    }
    const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
    const steps = Math.max(1, Math.ceil(dist / FILL_STEP));
    for (let i = 1; i <= steps; i++) {
      const q = { x: prev.x + ((p.x - prev.x) * i) / steps, y: prev.y + ((p.y - prev.y) * i) / steps };
      this.visit(q, tolerance, dist / steps);
    }
  }

  lift(pointer: number): void {
    this.last.delete(pointer);
  }

  /** Wipes the trace: the letter starts again. */
  reset(): void {
    for (const c of this.covered) c.fill(false);
    this.run.fill(0);
    this.last.clear();
    this.offInk = 0;
    this.current = 0;
  }

  get done(): boolean {
    if (this.offInk > this.letterLength * OFF_LIMIT) return false;
    if (this.opts.ordered) return this.current >= this.checkpoints.length;
    const total = this.covered.reduce((a, c) => a + c.length, 0);
    const hit = this.covered.reduce((a, c) => a + c.filter(Boolean).length, 0);
    if (hit < total * DONE_SHARE) return false;
    return this.covered.every((c, s) => {
      // Judge each stroke by its own checkpoints; a stroke with none (wholly near others) by all of them.
      const mine = c.filter((_, i) => this.own[s][i]);
      const judged = mine.length > 0 ? mine : c;
      const ownHit = mine.length > 0 ? c.filter((v, i) => v && this.own[s][i]).length : c.filter(Boolean).length;
      return ownHit >= Math.max(1, Math.floor(judged.length * STROKE_SHARE));
    });
  }

  /** The first stroke not yet traced well enough: the one the hint shows. */
  get firstUnfinished(): number {
    if (this.opts.ordered) return Math.min(this.current, this.checkpoints.length - 1);
    const i = this.covered.findIndex((c) => c.filter(Boolean).length < c.length * STROKE_SHARE);
    return i < 0 ? 0 : i;
  }

  /** Share of the letter covered, 0..1. */
  get progress(): number {
    const total = this.covered.reduce((a, c) => a + c.length, 0);
    return this.covered.reduce((a, c) => a + c.filter(Boolean).length, 0) / total;
  }

  private visit(p: Pt, tolerance: number, length: number): void {
    let near = false;
    const reach = tolerance * OFF_FACTOR;
    for (let s = 0; s < this.checkpoints.length; s++) {
      const cps = this.checkpoints[s];
      for (let i = 0; i < cps.length; i++) {
        const d = Math.hypot(cps[i].x - p.x, cps[i].y - p.y);
        if (d <= reach) near = true;
        if (d > tolerance || this.covered[s][i]) continue;
        if (this.opts.ordered) {
          if (s !== this.current || i > this.run[s] + WINDOW) continue;
        }
        this.covered[s][i] = true;
      }
    }
    if (!near) this.offInk += length;
    if (this.opts.ordered) this.advance();
  }

  private advance(): void {
    while (this.current < this.checkpoints.length) {
      const c = this.covered[this.current];
      while (this.run[this.current] < c.length && c[this.run[this.current]]) this.run[this.current]++;
      // A skipped checkpoint inside the window must not block the run: step over gaps once the next ones are in.
      let i = this.run[this.current];
      while (i < c.length && !c[i] && c.slice(i + 1, i + 1 + WINDOW).some(Boolean)) {
        c[i] = true;
        i++;
        while (i < c.length && c[i]) i++;
      }
      this.run[this.current] = i;
      if (this.run[this.current] >= Math.ceil(c.length * DONE_SHARE)) {
        this.current++;
        continue;
      }
      break;
    }
  }
}
