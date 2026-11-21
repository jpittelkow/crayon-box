// Checks a kid's trace against a letter (ADR 0026). Plain TypeScript with no DOM, so it has unit tests.
//
// Each stroke is sampled into checkpoints a few units apart. A checkpoint counts once a trace passes within the
// tolerance of it. The whole letter has to be traced (ADR 0028, which tightened ADR 0026's 85 %): every stroke from
// end to end and nearly all of its checkpoints. Each end must be reached, not just passed near: the trace has to come
// within END_REACH of it, closer than the tolerance (tightened 2026-11-15). Lenient (the default): any order and direction.
// Stroke order: only the current stroke counts, from its start and in its direction, and the next stroke starts
// once the current one is traced to its end. A finished trace is only "ready": the kid confirms it (game.ts).
// Ink far from the letter is counted too: a trace with more than three times the letter's length of it (a scribble
// over the whole screen) does not finish until it is wiped.
// Two things for the sounds (ADR 0037): `near` says whether a point is on the letter's road (the drawing sound plays
// only there), and `add` reports each stroke the moment it is traced, once (the chime).
// For the hint ladder (hints.ts): `lift` says what a finger's line did, and `atStart` whether a point is on a start dot.
import { strokeLength, type Glyph, type Pt } from './glyphs';
import type { LineEnd } from './hints';

/** Checkpoint spacing, in glyph units. */
const SPACING = 3;
/** Share of a letter's checkpoints a trace must cover (ADR 0028). */
export const DONE_SHARE = 0.98;
/** Share of each stroke's own checkpoints a trace must cover. */
const STROKE_SHARE = 0.92;
/** In stroke order, how far ahead of the covered run a checkpoint may still count. */
const WINDOW = 4;
/** How far from a checkpoint a trace still covers it, in glyph units (the guide is 20 wide). */
export const TOLERANCE = { finger: 10, pen: 9 } as const;
/** How close a trace must come to each end of a stroke, in glyph units: a quarter of the guide's width or so. */
export const END_REACH = 6;
/** Ink this many tolerances from every checkpoint is off the letter. */
const OFF_FACTOR = 1.5;
/** How much off-letter ink, in letter lengths, still lets a trace finish. */
const OFF_LIMIT = 3;
/** Fast moves are filled in at this step, so a quick swipe still passes its checkpoints. */
const FILL_STEP = 2;
/** How far from a stroke's line a point is still on the road, in glyph units: half the road's dark edge (25 wide). */
export const ROAD_HALF = 12.5;
/** How near a stroke's first point a finger counts as on its start dot, in glyph units (the dot's ring is 14). */
export const START_REACH = 14;

export interface TraceOptions {
  ordered: boolean;
}

export class Tracer {
  private readonly checkpoints: Pt[][];
  private readonly covered: boolean[][];
  /** Whether each stroke's start and end were reached (within END_REACH). */
  private readonly ends: [boolean, boolean][];
  private readonly own: boolean[][];
  /** In stroke order: how many checkpoints of each stroke are covered in a row from its start. */
  private readonly run: number[];
  private readonly letterLength: number;
  private readonly last = new Map<number, Pt>();
  private offInk = 0;
  private current = 0;
  /** Strokes already reported as traced, so each is reported once. */
  private readonly told: boolean[];
  /** Per pointer: whether its line covered anything new, and the strokes whose own checkpoints it covered. */
  private readonly lines = new Map<number, { added: boolean; strokes: Set<number> }>();

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
    this.ends = this.checkpoints.map(() => [false, false]);
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
    this.told = this.checkpoints.map(() => false);
  }

  /** The stroke a kid is on, in stroke order (the start dot and arrow to show). In lenient mode, always 0. */
  get currentStroke(): number {
    return this.opts.ordered ? this.current : 0;
  }

  /**
   * A pointer went down or moved to `p` (glyph units). `pointer` tells fingers apart. Returns the strokes this move
   * finished tracing, each reported once until a wipe (usually none).
   */
  add(pointer: number, p: Pt, tolerance: number): number[] {
    const prev = this.last.get(pointer);
    this.last.set(pointer, p);
    let line = this.lines.get(pointer);
    if (!line) this.lines.set(pointer, (line = { added: false, strokes: new Set() }));
    if (!prev) {
      this.visit(p, tolerance, 0, line);
    } else {
      const dist = Math.hypot(p.x - prev.x, p.y - prev.y);
      const steps = Math.max(1, Math.ceil(dist / FILL_STEP));
      for (let i = 1; i <= steps; i++) {
        const q = { x: prev.x + ((p.x - prev.x) * i) / steps, y: prev.y + ((p.y - prev.y) * i) / steps };
        this.visit(q, tolerance, dist / steps, line);
      }
    }
    const finished: number[] = [];
    this.told.forEach((told, s) => {
      if (told || !this.strokeTraced(s)) return;
      this.told[s] = true;
      finished.push(s);
    });
    return finished;
  }

  /** Whether `p` is on the letter's road: within ROAD_HALF of a stroke's line. */
  near(p: Pt): boolean {
    // The strokes' points are about a unit apart, so the nearest point is as good as the nearest spot on the line.
    return this.glyph.strokes.some((stroke) => stroke.some((q) => Math.hypot(q.x - p.x, q.y - p.y) <= ROAD_HALF));
  }

  /**
   * Whether `p` is on the start dot of a stroke still to trace (in stroke order, the current one's): where step 1
   * of the hints says "Start at the green dot." rather than "Start at the top.".
   */
  atStart(p: Pt): boolean {
    return this.glyph.strokes.some((stroke, s) => {
      if (this.opts.ordered ? s !== this.current : this.strokeTraced(s)) return false;
      return Math.hypot(stroke[0].x - p.x, stroke[0].y - p.y) <= START_REACH;
    });
  }

  /**
   * A pointer lifted. Says what its line did: `added` when it covered anything new, `early` when it worked on a
   * stroke and left it before its end (that stroke isn't traced yet).
   */
  lift(pointer: number): LineEnd {
    this.last.delete(pointer);
    const line = this.lines.get(pointer);
    this.lines.delete(pointer);
    if (!line) return { added: false, early: false };
    const early = !this.done && [...line.strokes].some((s) => !this.strokeTraced(s));
    return { added: line.added, early };
  }

  /** Wipes the trace: the letter starts again. */
  reset(): void {
    for (const c of this.covered) c.fill(false);
    for (const e of this.ends) e.fill(false);
    this.run.fill(0);
    this.last.clear();
    this.lines.clear();
    this.offInk = 0;
    this.current = 0;
    this.told.fill(false);
  }

  get done(): boolean {
    if (this.offInk > this.letterLength * OFF_LIMIT) return false;
    if (this.opts.ordered) return this.current >= this.checkpoints.length;
    const total = this.covered.reduce((a, c) => a + c.length, 0);
    const hit = this.covered.reduce((a, c) => a + c.filter(Boolean).length, 0);
    if (hit < total * DONE_SHARE) return false;
    // Both ends of every stroke: a stroke traced most of the way isn't traced.
    if (!this.ends.every(([a, b]) => a && b)) return false;
    return this.covered.every((_, s) => this.ownCovered(s));
  }

  /**
   * Whether stroke `s` is traced: in stroke order, once the kid has moved past it; in lenient mode, once both its
   * ends are reached and its own checkpoints are covered, as `done` judges each stroke.
   */
  strokeTraced(s: number): boolean {
    if (this.opts.ordered) return s < this.current;
    return this.ends[s][0] && this.ends[s][1] && this.ownCovered(s);
  }

  /** Judges a stroke by its own checkpoints; a stroke with none (wholly near others) by all of them. */
  private ownCovered(s: number): boolean {
    const c = this.covered[s];
    const mine = c.filter((_, i) => this.own[s][i]);
    const judged = mine.length > 0 ? mine : c;
    const ownHit = mine.length > 0 ? c.filter((v, i) => v && this.own[s][i]).length : c.filter(Boolean).length;
    return ownHit >= Math.max(1, Math.floor(judged.length * STROKE_SHARE));
  }

  /** The first stroke not yet traced well enough: the one the hint shows. */
  get firstUnfinished(): number {
    if (this.opts.ordered) return Math.min(this.current, this.checkpoints.length - 1);
    const i = this.covered.findIndex((c) => c.filter(Boolean).length < c.length * STROKE_SHARE);
    return i < 0 ? 0 : i;
  }

  /**
   * The checkpoints still to trace, for the "here's what's left" dots after a finger lifts. In stroke order, only
   * the current stroke's.
   */
  get missing(): Pt[] {
    const out: Pt[] = [];
    this.checkpoints.forEach((cps, s) => {
      if (this.opts.ordered && s !== this.current) return;
      cps.forEach((cp, i) => {
        const end = (i === 0 && !this.ends[s][0]) || (i === cps.length - 1 && !this.ends[s][1]);
        if (!this.covered[s][i] || end) out.push(cp);
      });
    });
    return out;
  }

  /** Share of the letter covered, 0..1. */
  get progress(): number {
    const total = this.covered.reduce((a, c) => a + c.length, 0);
    return this.covered.reduce((a, c) => a + c.filter(Boolean).length, 0) / total;
  }

  private visit(p: Pt, tolerance: number, length: number, line: { added: boolean; strokes: Set<number> }): void {
    let near = false;
    const reach = tolerance * OFF_FACTOR;
    for (let s = 0; s < this.checkpoints.length; s++) {
      const cps = this.checkpoints[s];
      for (let i = 0; i < cps.length; i++) {
        const d = Math.hypot(cps[i].x - p.x, cps[i].y - p.y);
        if (d <= reach) near = true;
        if (d > tolerance) continue;
        if (this.opts.ordered) {
          if (s !== this.current || i > this.run[s] + WINDOW) continue;
        }
        if (d <= Math.min(END_REACH, tolerance)) {
          if (i === 0) this.ends[s][0] = true;
          if (i === cps.length - 1) this.ends[s][1] = true;
        }
        if (!this.covered[s][i]) {
          line.added = true;
          if (this.own[s][i] || !this.own[s].some(Boolean)) line.strokes.add(s);
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
      const [start, end] = this.ends[this.current];
      if (this.run[this.current] >= Math.ceil(c.length * DONE_SHARE) && start && end) {
        this.current++;
        continue;
      }
      break;
    }
  }
}
