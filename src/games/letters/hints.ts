// The hint ladder for a kid who is stuck (ADR 0037, letters plan phase C). Plain TypeScript with no DOM and no
// clock of its own: the trace screen tells it what happens (open, a finger down, progress, a finger up, a stroke
// done, the letter ready, a wipe) and asks it every TICK_MS what to show and say. Every number is here, at the top,
// so a playtest can tune them in one place; the research gives no exact numbers (research 3.1).
//
// The ladder, waiting from the last touch: step 1 the start dot pulses bigger and the arrow wiggles, "Start at the
// green dot." ("Start at the top." when the kid started somewhere else); step 2 a fingertip runs along the next
// stroke with its stroke word ("Down."); step 3 the whole letter is drawn stroke by stroke with its words, then the
// start dot and "Your turn!". Then it rests: step 3 comes back at most twice more. A touch resets the wait but not
// the step reached, so the next pause goes one step further. Beside the ladder: going off the road, lifting early,
// the next line in stroke order, and a check not tapped.
import type { TipId } from '../../shell/soundFiles';
import { strokeLength, strokeWords, type Glyph, type StrokeKind } from './glyphs';

// ---- The ladder ----
/** How long with no touch before step 1, then step 2, then step 3 (D5: 5 s before the first). */
export const WAITS_MS = [5000, 5000, 8000] as const;
/** After step 3 it rests; step 3 comes back this long after the last touch or showing, at most REST_REPEATS times. */
export const REST_MS = 20_000;
export const REST_REPEATS = 2;

// ---- The other triggers ----
/** This many lines in a row that add nothing to the trace: the arrow wiggles, "Follow the arrow." */
export const OFF_ROAD_LINES = 3;
/** A stroke left before its end, then no progress for this long: "Keep going!" and dots on what is left. */
export const KEEP_GOING_MS = 3000;
/** All traced but the check not tapped: "Tap the check!" this long after it was ready, and again at the second. */
export const CHECK_SAY_MS = [4000, 12_000] as const;

// ---- Saying less ----
/** At most one tip (a `tip-…` line) this often; one that comes sooner is dropped, the shown part still plays. */
export const TIP_GAP_MS = 6000;
/** A letter finished this many times with no hint past step 1 is known: shorter waits, and steps 1 and 2 unsaid. */
export const KNOWN_AFTER = 2;
/** A known letter's waits, as a share of the usual ones. */
export const KNOWN_WAIT = 0.5;

// ---- The trace screen's clock ----
/** How often the trace screen asks what is due. */
export const TICK_MS = 200;

// ---- The fingertip and the whole-letter show (steps 2 and 3; the first-time demo, phase D, reuses it) ----
/** How fast the fingertip draws, in glyph units a second, and the shortest and longest time for one stroke. */
export const DEMO_SPEED = 75;
export const DEMO_MIN_MS = 1100;
export const DEMO_MAX_MS = 2600;
/** A dot (i, j) is shown as a quick tap. */
export const DEMO_DOT_MS = 600;
/** The pause between strokes, and how long the drawn letter stays before it clears. */
export const DEMO_GAP_MS = 450;
export const DEMO_HOLD_MS = 700;

/** The spoken tips, by clip id (`tip-start-dot` …, assets/sounds/voice/). */
export type Tip = TipId;

/**
 * What the trace screen should do. `step`: show a ladder step (1 dot and arrow, 2 the fingertip, 3 the whole letter),
 * saying its stroke words when `words` (step 1's line comes as its own `say`, which keeps to TIP_GAP_MS). `wiggle`: the arrow wiggles. `left`: dots on what
 * is left. `check`: the check pulses bigger. `say`: a spoken tip.
 */
export type HintAction =
  | { do: 'step'; step: 1 | 2 | 3; words: boolean }
  | { do: 'wiggle' }
  | { do: 'left' }
  | { do: 'check' }
  | { do: 'say'; tip: Tip };

export interface HintOptions {
  /** Stroke order counts (a parent's setting): "Now the next line." only then. */
  ordered: boolean;
  /** The kid knows this letter (`isKnown`): shorter waits, steps 1 and 2 shown only. */
  known: boolean;
  /** Tips may be spoken: the Sounds switches and the parent's spoken-tips switch are on. */
  speak: boolean;
}

/** What a finished line did: covered anything new, and left a stroke before its end. */
export interface LineEnd {
  added: boolean;
  early: boolean;
}

/** How a kid has done on a letter, kept in their progress (`KidProgress.help`). */
export interface LetterHelp {
  /** Times finished. */
  done: number;
  /** Times finished with no hint past step 1. */
  alone: number;
  /** The highest ladder step it ever needed (0 to 3). */
  top: number;
}

/** A letter is known once it was finished KNOWN_AFTER times with no hint past step 1 (research 2.3). */
export function isKnown(help: LetterHelp | undefined): boolean {
  return (help?.alone ?? 0) >= KNOWN_AFTER;
}

/** A hint past step 1 was needed: no "All by yourself!", and it doesn't count towards knowing the letter. */
export function wasHelped(step: number): boolean {
  return step > 1;
}

export class Hints {
  private step: 0 | 1 | 2 | 3 = 0;
  private repeats = 0;
  /** The last touch or ladder step: the ladder waits from here. */
  private since: number;
  private fingers = 0;
  /** The last finger came down away from a start dot. */
  private strayed = false;
  private useless = 0;
  private keepGoingAt: number | null = null;
  private nextLine = false;
  private readyAt: number | null = null;
  private checkSaid = 0;
  private lastTip = -Infinity;

  constructor(
    private readonly opts: HintOptions,
    now: number,
  ) {
    this.since = now;
  }

  /** The highest ladder step shown on this letter. */
  get reached(): number {
    return this.step;
  }

  get helped(): boolean {
    return wasHelped(this.step);
  }

  /** A touch anywhere on the screen: the wait starts again, the step reached stays. */
  touch(now: number): void {
    this.since = now;
  }

  /** A finger or pen went down on the letter; `atStart` when it was on a start dot. */
  down(now: number, atStart: boolean): void {
    this.fingers++;
    this.since = now;
    this.strayed = !atStart;
    this.keepGoingAt = null;
    // A tip about the next line that wasn't said yet: the kid has moved on.
    this.nextLine = false;
  }

  /** The trace covered more of the letter. */
  progress(now: number): void {
    this.since = now;
    this.keepGoingAt = null;
  }

  /** A stroke is traced. In stroke order, "Now the next line." once the finger lifts, from step 1 up. */
  strokeDone(): void {
    if (this.opts.ordered && this.step >= 1) this.nextLine = true;
  }

  /** A finger or pen lifted, with what its line did. */
  up(now: number, line: LineEnd): HintAction[] {
    this.fingers = Math.max(0, this.fingers - 1);
    this.since = now;
    const out: HintAction[] = [];
    if (this.readyAt !== null) return out;
    this.useless = line.added ? 0 : this.useless + 1;
    if (this.useless >= OFF_ROAD_LINES) {
      this.useless = 0;
      out.push({ do: 'wiggle' });
      this.say('follow-arrow', now, out);
    }
    if (line.early) this.keepGoingAt = now + KEEP_GOING_MS;
    if (this.nextLine && this.fingers === 0) {
      this.nextLine = false;
      this.say('next-line', now, out);
    }
    return out;
  }

  /** The whole letter is traced: the check pulses bigger at once; "Tap the check!" comes later. */
  ready(now: number): HintAction[] {
    this.readyAt = now;
    this.checkSaid = 0;
    this.keepGoingAt = null;
    this.nextLine = false;
    return [{ do: 'check' }];
  }

  /** The trace was wiped: the letter starts again, the step reached stays. */
  wipe(now: number): void {
    this.readyAt = null;
    this.fingers = 0;
    this.since = now;
    this.keepGoingAt = null;
    this.useless = 0;
    this.nextLine = false;
  }

  /** What is due now. Nothing while a finger is down: no tip is said over a finger that is drawing. */
  tick(now: number): HintAction[] {
    const out: HintAction[] = [];
    if (this.fingers > 0) return out;
    if (this.readyAt !== null) {
      let due = false;
      while (this.checkSaid < CHECK_SAY_MS.length && now >= this.readyAt + CHECK_SAY_MS[this.checkSaid]) {
        this.checkSaid++;
        due = true;
      }
      if (due) this.say('tap-check', now, out);
      return out;
    }
    if (this.keepGoingAt !== null && now >= this.keepGoingAt) {
      this.keepGoingAt = null;
      out.push({ do: 'left' });
      this.say('keep-going', now, out);
    }
    if (this.step < 3) {
      const wait = WAITS_MS[this.step as 0 | 1 | 2] * (this.opts.known ? KNOWN_WAIT : 1);
      if (now - this.since >= wait) {
        this.step = (this.step + 1) as 1 | 2 | 3;
        this.since = now;
        const words = this.opts.speak && !(this.opts.known && this.step < 3);
        out.push({ do: 'step', step: this.step, words });
        if (this.step === 1 && words) this.say(this.strayed ? 'top' : 'start-dot', now, out);
      }
    } else if (this.repeats < REST_REPEATS && now - this.since >= REST_MS) {
      this.repeats++;
      this.since = now;
      out.push({ do: 'step', step: 3, words: this.opts.speak });
    }
    return out;
  }

  private say(tip: Tip, now: number, out: HintAction[]): void {
    if (!this.opts.speak || now - this.lastTip < TIP_GAP_MS) return;
    this.lastTip = now;
    out.push({ do: 'say', tip });
  }
}

// ---- The show: strokes drawn one after another, each with its words ----

/** One stroke of a show: when it starts and how long it takes (ms), and when each of its words is said (ms in). */
export interface DemoBeat {
  stroke: number;
  start: number;
  ms: number;
  words: { kind: StrokeKind; at: number }[];
}

/**
 * The timing of a show of `strokes` (indices into the glyph, in order): step 2 shows one, step 3 and the first-time
 * demo all of them. `total` includes the hold before the drawing clears.
 */
export function demoPlan(g: Glyph, strokes: readonly number[]): { beats: DemoBeat[]; total: number } {
  const beats: DemoBeat[] = [];
  let at = 0;
  for (const stroke of strokes) {
    const points = g.strokes[stroke];
    const words = strokeWords(points);
    const ms =
      words[0].kind === 'dot'
        ? DEMO_DOT_MS
        : Math.round(Math.min(DEMO_MAX_MS, Math.max(DEMO_MIN_MS, (strokeLength(points) / DEMO_SPEED) * 1000)));
    beats.push({ stroke, start: at, ms, words: words.map((w) => ({ kind: w.kind, at: Math.round(w.at * ms) })) });
    at += ms + DEMO_GAP_MS;
  }
  const end = beats.length > 0 ? beats.at(-1)!.start + beats.at(-1)!.ms : 0;
  return { beats, total: end + DEMO_HOLD_MS };
}
