// The hint ladder (ADR 0037, letters plan phase C): the state machine on a fake clock (plain numbers, in ms), the
// stroke words, and what the tracer and the voice give it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STROKE_WORDS, TIPS, demoClip, strokeClip, tipClip } from '../../shell/soundFiles';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { allChars, glyph, strokeKind, strokeWords } from './glyphs';
import {
  CHECK_SAY_MS,
  DEMO_DOT_MS,
  DEMO_HOLD_MS,
  demoPlan,
  Hints,
  HOWTO_AGAIN_DAYS,
  HOWTO_LETTER,
  isKnown,
  KEEP_GOING_MS,
  KNOWN_WAIT,
  REST_MS,
  TIP_GAP_MS,
  WAITS_MS,
  type HintAction,
  type HintOptions,
} from './hints';
import { finishLetter, keyOf, loadProgress, type LettersSettings } from './progress';
import { START_REACH, TOLERANCE, Tracer } from './trace';
import { LetterVoice } from './voice';

const OPTS: HintOptions = { ordered: false, known: false, speak: true };
const idle = { added: false, early: false };
const good = { added: true, early: false };

/** Ticks the ladder from `from` to `to` every 100 ms and collects what it asks for, each with its time. */
function run(h: Hints, from: number, to: number): [number, HintAction][] {
  const out: [number, HintAction][] = [];
  for (let t = from; t <= to; t += 100) for (const a of h.tick(t)) out.push([t, a]);
  return out;
}

const steps = (log: [number, HintAction][]) =>
  log.filter(([, a]) => a.do === 'step').map(([t, a]) => [t, (a as { step: number }).step]);
const said = (log: [number, HintAction][]) =>
  log.filter(([, a]) => a.do === 'say').map(([t, a]) => [t, (a as { tip: string }).tip]);

describe('the hint ladder (ADR 0037)', () => {
  it('shows step 1 after 5 s with no progress, step 2 after 5 s more, step 3 after 8 s more', () => {
    const h = new Hints(OPTS, 0);
    const log = run(h, 0, 30_000);
    const [w1, w2, w3] = WAITS_MS;
    expect(steps(log)).toEqual([
      [w1, 1],
      [w1 + w2, 2],
      [w1 + w2 + w3, 3],
    ]);
    expect([w1, w2, w3]).toEqual([5000, 5000, 8000]);
    // Step 1 says "Start at the green dot."; steps 2 and 3 their stroke words.
    expect(said(log)).toEqual([[w1, 'start-dot']]);
    expect(log.filter(([, a]) => a.do === 'step').every(([, a]) => (a as { words: boolean }).words)).toBe(true);
    expect(h.reached).toBe(3);
    expect(h.helped).toBe(true);
  });

  it('a touch resets the wait, not the step: the next pause goes one step further', () => {
    const h = new Hints(OPTS, 0);
    expect(steps(run(h, 0, 5000))).toEqual([[5000, 1]]);
    h.touch(7000);
    expect(run(h, 5100, 11_900)).toEqual([]);
    expect(steps(run(h, 12_000, 12_000))).toEqual([[12_000, 2]]);
    // A line on the letter is a touch too.
    h.down(14_000, true);
    h.up(14_500, good);
    expect(run(h, 12_100, 22_400)).toEqual([]);
    expect(steps(run(h, 22_500, 22_500))).toEqual([[22_500, 3]]);
  });

  it('shows and says nothing while a finger is down', () => {
    const h = new Hints(OPTS, 0);
    h.down(100, true);
    expect(run(h, 0, 60_000)).toEqual([]);
    h.up(60_000, good);
    expect(steps(run(h, 60_000, 65_000))).toEqual([[65_000, 1]]);
  });

  it('says "Start at the top." when the kid started somewhere else', () => {
    const h = new Hints(OPTS, 0);
    h.down(1000, false);
    h.up(1200, idle);
    expect(said(run(h, 1200, 6200))).toEqual([[6200, 'top']]);
  });

  it('rests after step 3: it comes back at most twice more, 20 s apart', () => {
    const h = new Hints(OPTS, 0);
    const log = run(h, 0, 200_000);
    const third = WAITS_MS[0] + WAITS_MS[1] + WAITS_MS[2];
    expect(steps(log)).toEqual([
      [5000, 1],
      [10_000, 2],
      [third, 3],
      [third + REST_MS, 3],
      [third + 2 * REST_MS, 3],
    ]);
    // A touch during the rest pushes the next one back 20 s from the touch.
    const h2 = new Hints(OPTS, 0);
    run(h2, 0, third);
    h2.touch(third + 10_000);
    expect(steps(run(h2, third + 100, third + 40_000))).toEqual([[third + 10_000 + REST_MS, 3]]);
  });

  it('a known letter: waits half as long, steps 1 and 2 shown without words, step 3 with them', () => {
    const h = new Hints({ ...OPTS, known: true }, 0);
    const log = run(h, 0, 20_000);
    const [w1, w2, w3] = WAITS_MS.map((w) => w * KNOWN_WAIT);
    expect(steps(log)).toEqual([
      [w1, 1],
      [w1 + w2, 2],
      [w1 + w2 + w3, 3],
    ]);
    expect(said(log)).toEqual([]);
    expect(log.filter(([, a]) => a.do === 'step').map(([, a]) => (a as { words: boolean }).words)).toEqual([false, false, true]);
  });

  it('with spoken tips off, everything is still shown and nothing is said', () => {
    const h = new Hints({ ...OPTS, speak: false }, 0);
    h.up(100, idle);
    h.up(200, idle);
    const log = [...h.up(300, idle).map((a) => [300, a] as [number, HintAction]), ...run(h, 300, 30_000)];
    expect(log.map(([, a]) => a.do)).toEqual(['wiggle', 'step', 'step', 'step']);
    expect(log.filter(([, a]) => a.do === 'step').every(([, a]) => !(a as { words: boolean }).words)).toBe(true);
  });

  it('off the road: three lines in a row that add nothing wiggle the arrow, "Follow the arrow."', () => {
    const h = new Hints(OPTS, 0);
    expect(h.up(100, idle)).toEqual([]);
    expect(h.up(200, idle)).toEqual([]);
    expect(h.up(300, idle)).toEqual([{ do: 'wiggle' }, { do: 'say', tip: 'follow-arrow' }]);
    // A line that adds something starts the count again.
    h.up(400, idle);
    h.up(500, good);
    expect(h.up(600, idle)).toEqual([]);
    expect(h.up(700, idle)).toEqual([]);
    // The third: wiggles, but the tip is dropped (said 6 s ago at most once).
    expect(h.up(800, idle)).toEqual([{ do: 'wiggle' }]);
  });

  it('lifting early: no progress for 3 s, "Keep going!" and the dots on what is left', () => {
    const h = new Hints(OPTS, 0);
    h.down(500, true);
    h.up(1000, { added: true, early: true });
    expect(run(h, 1000, 1000 + KEEP_GOING_MS - 100)).toEqual([]);
    const at = 1000 + KEEP_GOING_MS;
    expect(run(h, at, at)).toEqual([
      [at, { do: 'left' }],
      [at, { do: 'say', tip: 'keep-going' }],
    ]);
    // Progress in the meantime calls it off.
    const h2 = new Hints(OPTS, 0);
    h2.up(1000, { added: true, early: true });
    h2.progress(2000);
    expect(run(h2, 1000, 4500).filter(([, a]) => a.do === 'left')).toEqual([]);
  });

  it('at most one tip every 6 s; the shown part still plays', () => {
    const h = new Hints(OPTS, 0);
    h.down(500, true);
    h.up(1000, { added: true, early: true });
    // "Keep going!" at 4 s, so step 1 at 6 s (5 s after the lift) shows the dot without "Start at the green dot.".
    const log = run(h, 1000, 7000);
    expect(said(log)).toEqual([[4000, 'keep-going']]);
    expect(steps(log)).toEqual([[6000, 1]]);
    expect(TIP_GAP_MS).toBe(6000);
  });

  it('stroke order: "Now the next line." after a stroke, from step 1 up, once the finger lifts', () => {
    const ordered = { ...OPTS, ordered: true };
    // Before any hint: just the chime (the game's), nothing said.
    const h = new Hints(ordered, 0);
    h.down(100, true);
    h.strokeDone();
    expect(h.up(900, good)).toEqual([]);
    // From step 1 up.
    const h2 = new Hints(ordered, 0);
    run(h2, 0, 5000);
    h2.down(13_000, true);
    h2.strokeDone();
    expect(h2.up(13_500, good)).toEqual([{ do: 'say', tip: 'next-line' }]);
    // A finger down on the next line before the first lifts: the kid has moved on, nothing said.
    const h3 = new Hints(ordered, 0);
    run(h3, 0, 5000);
    h3.down(13_000, true);
    h3.strokeDone();
    h3.down(13_100, true);
    expect(h3.up(13_200, good)).toEqual([]);
    expect(h3.up(13_300, good)).toEqual([]);
    // Lenient mode never says it.
    const h4 = new Hints(OPTS, 0);
    run(h4, 0, 5000);
    h4.down(13_000, true);
    h4.strokeDone();
    expect(h4.up(13_500, good)).toEqual([]);
  });

  it('all traced, check not tapped: the check pulses at once, "Tap the check!" at 4 s and once more at 12 s', () => {
    const h = new Hints(OPTS, 0);
    expect(h.ready(1000)).toEqual([{ do: 'check' }]);
    const log = run(h, 1000, 60_000);
    expect(said(log)).toEqual([
      [1000 + CHECK_SAY_MS[0], 'tap-check'],
      [1000 + CHECK_SAY_MS[1], 'tap-check'],
    ]);
    // The ladder stops while the letter is ready.
    expect(steps(log)).toEqual([]);
    // A wipe starts the letter again: the ladder goes on from the step reached.
    h.wipe(60_000);
    expect(steps(run(h, 60_000, 65_000))).toEqual([[65_000, 1]]);
  });

  it('"All by yourself!" and knowing a letter count no hint past step 1', () => {
    const h = new Hints(OPTS, 0);
    run(h, 0, 5000);
    expect(h.reached).toBe(1);
    expect(h.helped).toBe(false);
    run(h, 5100, 10_000);
    expect(h.helped).toBe(true);
  });
});

describe('a letter the kid knows (ADR 0037)', () => {
  it('is known after two finishes with no hint past step 1; old progress files load with no help', async () => {
    const s = appStorage(memoryBackend()).game('letters');
    await s.putJson('kids/k1/progress.json', { stars: ['cap-A'], game: [] });
    expect((await loadProgress(s, 'k1')).help).toEqual({});
    let p = await finishLetter(s, 'k1', 'B', false, 3);
    expect(p.help[keyOf('B')]).toEqual({ done: 1, alone: 0, top: 3 });
    expect(isKnown(p.help[keyOf('B')])).toBe(false);
    p = await finishLetter(s, 'k1', 'B', false, 1);
    expect(isKnown(p.help[keyOf('B')])).toBe(false);
    p = await finishLetter(s, 'k1', 'B', true, 0);
    expect(p.help[keyOf('B')]).toEqual({ done: 3, alone: 2, top: 3 });
    expect(isKnown(p.help[keyOf('B')])).toBe(true);
    // Small b is its own letter.
    expect(isKnown(p.help[keyOf('b')])).toBe(false);
    // Junk in the file is dropped or cleaned.
    await s.putJson('kids/k1/progress.json', { stars: [], game: [], help: { 'cap-C': { done: 2.7, alone: -1, top: 9 }, x: 5 } });
    expect((await loadProgress(s, 'k1')).help).toEqual({ 'cap-C': { done: 2, alone: 0, top: 3 } });
  });
});

/**
 * The word said for each stroke of every letter and number, in stroke order. A table to read and correct: change a
 * word here and the rules in `strokeKind` (glyphs.ts) until it passes.
 */
const STROKE_TABLE: Record<string, string> = {
  A: 'slant, slant, across',
  B: 'down, around',
  C: 'around',
  D: 'down, around',
  E: 'down, across, across, across',
  F: 'down, across, across',
  G: 'around',
  H: 'down, down, across',
  I: 'down, across, across',
  J: 'down',
  K: 'down, slant',
  L: 'down',
  M: 'down, slant',
  N: 'down, slant',
  O: 'around',
  P: 'down, around',
  Q: 'around, slant',
  R: 'down, around',
  S: 'around',
  T: 'down, across',
  U: 'down',
  V: 'slant',
  W: 'slant',
  X: 'slant, slant',
  Y: 'slant, slant',
  Z: 'across',
  a: 'around, down',
  b: 'down-over',
  c: 'around',
  d: 'around, down',
  e: 'around',
  f: 'around, across',
  g: 'around, down',
  h: 'down-over',
  i: 'down, dot',
  j: 'down, dot',
  k: 'down, slant',
  l: 'down',
  m: 'down-over',
  n: 'down-over',
  o: 'around',
  p: 'down-over',
  q: 'around, down',
  r: 'down-over',
  s: 'around',
  t: 'down, across',
  u: 'around',
  v: 'slant',
  w: 'slant',
  x: 'slant, slant',
  y: 'slant, slant',
  z: 'across',
  '0': 'around',
  '1': 'down',
  '2': 'around',
  '3': 'around',
  '4': 'down, down',
  '5': 'down, across',
  '6': 'around',
  '7': 'across',
  '8': 'around',
  '9': 'around',
};

describe('stroke words (ADR 0037)', () => {
  it('gives the expected word for every stroke of all 62 letters and numbers', () => {
    expect(Object.keys(STROKE_TABLE).sort()).toEqual(allChars().sort());
    for (const ch of allChars()) expect(glyph(ch).strokes.map(strokeKind).join(', '), ch).toBe(STROKE_TABLE[ch]);
  });

  it('a stroke of straight lines gets a word where its way changes; a way back up says nothing', () => {
    const words = (ch: string, i = 0) => strokeWords(glyph(ch).strokes[i]).map((w) => w.kind);
    expect(words('L')).toEqual(['down', 'across']);
    expect(words('Z')).toEqual(['across', 'slant', 'across']);
    expect(words('7')).toEqual(['across', 'slant']);
    expect(words('4')).toEqual(['down', 'across']);
    expect(words('N', 1)).toEqual(['slant']);
    // Each word later along the stroke than the one before.
    const z = strokeWords(glyph('Z').strokes[0]);
    expect(z[0].at).toBe(0);
    expect(z[1].at).toBeGreaterThan(0.2);
    expect(z[2].at).toBeGreaterThan(z[1].at);
    // A curved stroke gets one word.
    expect(words('U')).toEqual(['down']);
  });

  it('has a narrator clip for every word and tip the hints say', () => {
    for (const kind of STROKE_WORDS) expect(strokeClip(kind), kind).toBeTruthy();
    for (const tip of TIPS) expect(tipClip(tip), tip).toBeTruthy();
    expect(demoClip('your-turn')).toBeTruthy();
    expect(demoClip('watch')).toBeTruthy();
    // Every word strokeKind can give has a clip.
    const kinds = new Set(allChars().flatMap((ch) => glyph(ch).strokes.flatMap((s) => strokeWords(s).map((w) => w.kind))));
    for (const kind of kinds) expect(STROKE_WORDS as readonly string[]).toContain(kind);
  });
});

describe('the show: strokes one after another (steps 2 and 3, the first-time demo)', () => {
  it('times each stroke in turn, its words as it goes, a dot quickly', () => {
    const plan = demoPlan(glyph('i'), [0, 1]);
    expect(plan.beats.map((b) => b.stroke)).toEqual([0, 1]);
    expect(plan.beats[1].start).toBeGreaterThan(plan.beats[0].start + plan.beats[0].ms);
    expect(plan.beats[1].ms).toBe(DEMO_DOT_MS);
    expect(plan.beats.map((b) => b.words.map((w) => w.kind))).toEqual([['down'], ['dot']]);
    expect(plan.total).toBe(plan.beats[1].start + plan.beats[1].ms + DEMO_HOLD_MS);
    // L: "Down." at the start, "Across." at the corner.
    const l = demoPlan(glyph('L'), [0]).beats[0];
    expect(l.words.map((w) => w.kind)).toEqual(['down', 'across']);
    expect(l.words[1].at).toBeGreaterThan(l.ms / 2);
    expect(l.words[1].at).toBeLessThan(l.ms);
    // A whole letter in about 10 s at most, even a long one.
    for (const ch of allChars()) expect(demoPlan(glyph(ch), glyph(ch).strokes.map((_, i) => i)).total, ch).toBeLessThan(12_000);
  });
});

describe('what the tracer tells the hints', () => {
  it('a line says whether it added anything and whether it left a stroke before its end', () => {
    const g = glyph('T');
    const t = new Tracer(g, { ordered: false });
    // Off the letter: nothing added.
    t.add(1, { x: 95, y: 130 }, TOLERANCE.finger);
    expect(t.lift(1)).toEqual({ added: false, early: false });
    // Half the down stroke: added, and left early.
    const down = g.strokes[0];
    down.slice(0, down.length / 2).forEach((p) => t.add(2, p, TOLERANCE.finger));
    expect(t.lift(2)).toEqual({ added: true, early: true });
    // The rest of it: added, and that stroke is done.
    down.forEach((p) => t.add(3, p, TOLERANCE.finger));
    expect(t.lift(3)).toEqual({ added: true, early: false });
    // Again over the same line: nothing new.
    down.forEach((p) => t.add(4, p, TOLERANCE.finger));
    expect(t.lift(4)).toEqual({ added: false, early: false });
  });

  it('knows a start dot of a stroke still to trace', () => {
    const g = glyph('T');
    const t = new Tracer(g, { ordered: true });
    const [down, bar] = g.strokes;
    expect(t.atStart(down[0])).toBe(true);
    expect(t.atStart({ x: down[0].x + START_REACH - 1, y: down[0].y })).toBe(true);
    expect(t.atStart(down.at(-1)!)).toBe(false);
    // In stroke order only the current stroke's dot counts.
    expect(t.atStart(bar[0])).toBe(false);
    down.forEach((p) => t.add(1, p, TOLERANCE.finger));
    expect(t.atStart(down[0])).toBe(false);
    expect(t.atStart(bar[0])).toBe(true);
    // Lenient: every stroke's dot until it is traced.
    const lenient = new Tracer(g, { ordered: false });
    expect(lenient.atStart(bar[0])).toBe(true);
  });
});

describe('the voice and hints (ADR 0037)', () => {
  class FakeAudio extends EventTarget {
    static started: string[] = [];
    static playing: FakeAudio[] = [];
    constructor(readonly src: string) {
      super();
    }
    play(): Promise<void> {
      FakeAudio.started.push(this.src);
      FakeAudio.playing.push(this);
      return Promise.resolve();
    }
    pause(): void {
      this.dispatchEvent(new Event('pause'));
    }
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const voice = (tips = true, enabled = true) => {
    const settings: LettersSettings = { sounds: true, voice: 'windows', saying: 'name', tips };
    return new LetterVoice(appStorage(memoryBackend()).game('letters'), settings, { play() {}, enabled });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudio.started = [];
    FakeAudio.playing = [];
  });

  it('a tip is dropped while a finger is down, and a waiting one when a finger goes down', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice();
    v.hold(true);
    v.tip(['t1']);
    v.hold(false);
    await tick();
    expect(FakeAudio.started).toEqual([]);
    // One line playing, a tip waiting: a finger down drops the tip.
    void v.line([{ clip: 'name' }]);
    await tick();
    v.tip(['t2']);
    v.hold(true);
    FakeAudio.playing.shift()?.dispatchEvent(new Event('ended'));
    await tick();
    v.hold(false);
    await tick();
    expect(FakeAudio.started).toEqual(['name']);
    // Nothing in the way: said at once.
    v.tip(['t3']);
    await tick();
    expect(FakeAudio.started).toEqual(['name', 't3']);
  });

  it('the spoken-tips switch and the Sounds switches silence tips', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    voice(false).tip(['a']);
    voice(true, false).tip(['b']);
    await tick();
    expect(FakeAudio.started).toEqual([]);
    expect(voice(false).tipsOn).toBe(false);
    expect(voice(true).tipsOn).toBe(true);
  });

  it("the how-to's lines are not tips: only the Sounds switches silence them, and they wait for the end", async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice(false);
    let said = false;
    void v.howTo(['watch']).then(() => (said = true));
    await tick();
    expect(FakeAudio.started).toEqual(['watch']);
    expect(said).toBe(false);
    FakeAudio.playing.shift()?.dispatchEvent(new Event('ended'));
    await tick();
    expect(said).toBe(true);
    // Dropped while a finger is down, like a tip.
    v.hold(true);
    await v.howTo(['down']);
    v.hold(false);
    await tick();
    expect(FakeAudio.started).toEqual(['watch']);
    await voice(true, false).howTo(['muted']);
    expect(FakeAudio.started).toEqual(['watch']);
  });

  it('the how-to has its letter and both lines (D6)', () => {
    expect(HOWTO_LETTER).toBe('L');
    expect(glyph(HOWTO_LETTER).strokes.flatMap(strokeWords).map((w) => w.kind)).toEqual(['down', 'across']);
    expect(demoClip('watch')).toBeTruthy();
    expect(demoClip('your-turn')).toBeTruthy();
    expect(HOWTO_AGAIN_DAYS).toBe(14);
  });
});
