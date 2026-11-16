import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRAISE, letterClip, soundClip, type Praise } from '../../shell/soundFiles';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { allChars, arrowFor, arrowsFor, glyph, SET_CHARS, SET_ORDER, setOf, SHAPES, type Glyph, type Pt } from './glyphs';
import {
  dayOf,
  daysBetween,
  demoDue,
  finishLetter,
  GAME_GROUPS,
  forgetKid,
  gameIndex,
  isOpenInGame,
  keyOf,
  lettersOf,
  loadLettersSettings,
  loadPrefs,
  loadProgress,
  nextInSet,
  notePlayed,
  resetProgress,
  saveLettersSettings,
  savePrefs,
  saveRecording,
  showDemoAgain,
  spoken,
  type LettersSettings,
} from './progress';
import { ROAD_HALF, TOLERANCE, Tracer } from './trace';
import { LetterVoice, letterParts, partsFor, pickPraise, type Part } from './voice';

/** Every glyph: the 62 letters and numbers and the 8 lines and shapes (ADR 0037, D9). */
const everyGlyph = [...allChars(), ...SET_CHARS.shapes];

/** Traces every stroke of a glyph as drawn, each as its own touch, with a small wobble. */
function traceGlyph(t: Tracer, g: Glyph, opts: { reverse?: boolean; skip?: number; wobble?: number } = {}): void {
  g.strokes.forEach((stroke, s) => {
    if (s === opts.skip) return;
    const pts = opts.reverse ? [...stroke].reverse() : stroke;
    pts.forEach((p, i) => t.add(s, { x: p.x + Math.sin(i) * (opts.wobble ?? 3), y: p.y }, TOLERANCE.finger));
    t.lift(s);
  });
}

describe('the letters (ADR 0026)', () => {
  it('has all 62 letters and numbers, each inside its box with real strokes', () => {
    expect(allChars()).toHaveLength(62);
    for (const ch of everyGlyph) {
      const g = glyph(ch);
      expect(g.strokes.length, ch).toBeGreaterThan(0);
      for (const p of g.strokes.flat()) {
        expect(p.x, ch).toBeGreaterThanOrEqual(0);
        expect(p.x, ch).toBeLessThanOrEqual(100);
        expect(p.y, ch).toBeGreaterThanOrEqual(0);
        expect(p.y, ch).toBeLessThanOrEqual(140);
      }
      // Points are about one unit apart: no jumps that would leave a hole in the guide.
      for (const stroke of g.strokes) {
        for (let i = 1; i < stroke.length; i++) {
          expect(Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y), ch).toBeLessThan(2.5);
        }
      }
    }
  });

  it('gives every long stroke an arrow that ends near where the stroke is heading', () => {
    for (const ch of everyGlyph) {
      const g = glyph(ch);
      g.strokes.forEach((stroke, i) => {
        const a = arrowFor(g, i);
        if (stroke.length < 14) return;
        expect(a, `${ch} stroke ${i}`).not.toBeNull();
      });
    }
    expect(arrowFor(glyph('i'), 1)).toBeNull(); // the dot
  });

  it('follows how print letters are taught (ADR 0028)', () => {
    const start = (ch: string, i = 0) => glyph(ch).strokes[i][0];
    const end = (ch: string, i = 0) => glyph(ch).strokes[i].at(-1)!;
    // Start at the top: capitals and numbers in their top part, small letters at the middle line or just below it
    // (the top right of "magic c"). Only e starts in its middle, as taught.
    for (const ch of allChars()) {
      if (ch === 'e') continue;
      expect(start(ch).y, ch).toBeLessThanOrEqual(/[a-z]/.test(ch) ? 75 : 40);
    }
    // Down, then back up the same line without lifting, then over: one stroke each.
    for (const ch of 'bhmnpr') {
      expect(glyph(ch).strokes.length, ch).toBe(1);
      expect(arrowsFor(glyph(ch), 0).length, ch).toBeGreaterThanOrEqual(2);
    }
    // Round letters go counterclockwise ("magic c"): from the start the pen heads left (and up or down).
    for (const ch of 'COacdgoq09') {
      const s0 = glyph(ch).strokes[0];
      expect(s0[5].x, ch).toBeLessThan(s0[0].x);
    }
    // G's bar runs right to left; the 4 is open (a short line straight down first).
    expect(end('G').x).toBeLessThan(glyph('G').strokes[0].at(-15)!.x);
    expect(glyph('4').strokes[0][10].x).toBe(start('4').x);
  });
});

describe('tracing (ADR 0026, 0028)', () => {
  it('a good trace finishes every letter, lenient and in stroke order', () => {
    for (const ch of everyGlyph) {
      const lenient = new Tracer(glyph(ch), { ordered: false });
      traceGlyph(lenient, glyph(ch));
      expect(lenient.done, `${ch} lenient`).toBe(true);
      const ordered = new Tracer(glyph(ch), { ordered: true });
      traceGlyph(ordered, glyph(ch));
      expect(ordered.done, `${ch} in order`).toBe(true);
    }
  });

  it('lenient takes any direction; stroke order does not', () => {
    const lenient = new Tracer(glyph('L'), { ordered: false });
    traceGlyph(lenient, glyph('L'), { reverse: true });
    expect(lenient.done).toBe(true);
    const ordered = new Tracer(glyph('L'), { ordered: true });
    traceGlyph(ordered, glyph('L'), { reverse: true });
    expect(ordered.done).toBe(false);
  });

  it('a trace that stops short of the ends does not finish, and what is left is known (ADR 0028)', () => {
    for (const ch of ['L', 'U', 'S', 'C', 'J', '2']) {
      for (const ordered of [false, true]) {
        const g = glyph(ch);
        const t = new Tracer(g, { ordered });
        // Each stroke traced only three quarters of the way: enough for ADR 0026's 85 %, not for the whole letter.
        g.strokes.forEach((stroke, s) => {
          stroke.slice(0, Math.floor(stroke.length * 0.75)).forEach((p) => t.add(s, p, TOLERANCE.finger));
          t.lift(s);
        });
        expect(t.done, `${ch} ${ordered ? 'in order' : 'lenient'}`).toBe(false);
        const left = t.missing;
        expect(left.length, ch).toBeGreaterThan(0);
        // What is left includes the end of the stroke being worked on.
        const stroke = g.strokes[ordered ? t.currentStroke : 0];
        const end = stroke[stroke.length - 1];
        expect(left.some((p) => Math.hypot(p.x - end.x, p.y - end.y) < 4), ch).toBe(true);
        // Finishing the strokes finishes the letter.
        g.strokes.forEach((s, i) => s.forEach((p) => t.add(10 + i, p, TOLERANCE.finger)));
        expect(t.done, ch).toBe(true);
        expect(t.missing).toEqual([]);
      }
    }
  });

  it('stopping a little short of each end does not finish: the ends must be reached (2026-11-15)', () => {
    for (const ch of ['L', 'S', 'C', 'J', '2', 'z']) {
      for (const ordered of [false, true]) {
        const g = glyph(ch);
        const t = new Tracer(g, { ordered });
        // Every stroke traced from start to 8 units (points are about 1 unit apart) before its end: within the
        // finger's reach of the last checkpoint, but not at the end itself.
        g.strokes.forEach((stroke, s) => {
          stroke.slice(0, Math.max(1, stroke.length - 8)).forEach((p) => t.add(s, p, TOLERANCE.finger));
          t.lift(s);
        });
        expect(t.done, `${ch} ${ordered ? 'in order' : 'lenient'}`).toBe(false);
        // The unreached end shows in what is left.
        expect(t.missing.length, ch).toBeGreaterThan(0);
        // Reaching the ends finishes it.
        g.strokes.forEach((s, i) => s.forEach((p) => t.add(20 + i, p, TOLERANCE.finger)));
        expect(t.done, ch).toBe(true);
      }
    }
  });

  it("a whole stroke can't be skipped, even a short one like A's bar", () => {
    const t = new Tracer(glyph('A'), { ordered: false });
    traceGlyph(t, glyph('A'), { skip: 2 });
    expect(t.done).toBe(false);
    glyph('A').strokes[2].forEach((p) => t.add(9, p, TOLERANCE.finger));
    expect(t.done).toBe(true);
  });

  it('a scribble over the whole screen does not finish, until it is wiped and traced', () => {
    const t = new Tracer(glyph('O'), { ordered: false });
    for (let y = -10; y <= 150; y += 6) {
      t.add(1, { x: -10, y }, TOLERANCE.finger);
      t.add(1, { x: 110, y: y + 3 }, TOLERANCE.finger);
    }
    expect(t.progress).toBeGreaterThan(0.85);
    expect(t.done).toBe(false);
    t.reset();
    traceGlyph(t, glyph('O'));
    expect(t.done).toBe(true);
  });

  it('a pen must be closer to the line than a finger', () => {
    const near = (tol: number) => {
      const t = new Tracer(glyph('l'), { ordered: false });
      const stroke = glyph('l').strokes[0];
      // Beside the line all the way, touching the line itself only at its two ends.
      stroke.forEach((p, i) => t.add(1, { x: p.x + (i < 3 || i > stroke.length - 4 ? 0 : 9.5), y: p.y }, tol));
      return t.done;
    };
    expect(near(TOLERANCE.finger)).toBe(true);
    expect(near(TOLERANCE.pen)).toBe(false);
  });

  it('in stroke order, the current stroke moves on as each one is done', () => {
    const g = glyph('T');
    const t = new Tracer(g, { ordered: true });
    expect(t.currentStroke).toBe(0);
    // The bar first does nothing: it is the second stroke.
    g.strokes[1].forEach((p) => t.add(1, p, TOLERANCE.finger));
    t.lift(1);
    expect(t.currentStroke).toBe(0);
    g.strokes[0].forEach((p) => t.add(2, p, TOLERANCE.finger));
    expect(t.currentStroke).toBe(1);
    g.strokes[1].forEach((p) => t.add(3, p, TOLERANCE.finger));
    expect(t.done).toBe(true);
  });

  it('a fast swipe still counts the checkpoints it passes', () => {
    const t = new Tracer(glyph('l'), { ordered: true });
    t.add(1, { x: 50, y: 10 } as Pt, TOLERANCE.finger);
    t.add(1, { x: 50, y: 110 } as Pt, TOLERANCE.finger);
    expect(t.done).toBe(true);
  });
});

describe('progress and the game path (ADR 0026)', () => {
  const storage = () => appStorage(memoryBackend()).game('letters');

  it('keys keep capitals and small letters apart', () => {
    expect(keyOf('A')).toBe('cap-A');
    expect(keyOf('a')).toBe('small-a');
    expect(keyOf('7')).toBe('num-7');
    expect(keyOf('○')).toBe('shape-circle');
    expect(keyOf('×')).toBe('shape-x');
    expect(new Set(everyGlyph.map(keyOf)).size).toBe(70);
  });

  it('the game path goes easy first: straight lines, then curves, then slants (D8); practice stays A to Z', () => {
    expect(lettersOf(['capitals']).join('')).toBe('LFEHTIDPBRCOQGSUJNMKAVWXYZ');
    expect(Object.values(GAME_GROUPS.capitals)).toEqual(['LFEHTI', 'DPBR', 'COQGS', 'UJ', 'NMK', 'AVWXYZ']);
    // Every capital once, nothing else.
    expect([...lettersOf(['capitals'])].sort().join('')).toBe(SET_CHARS.capitals);
    for (const set of SET_ORDER) expect([...GAME_GROUPS[set].join('')].sort(), set).toEqual([...SET_CHARS[set]].sort());
    // The other sets as in practice, and sets in their fixed order with shapes first.
    expect(lettersOf(['numbers', 'small', 'capitals', 'shapes'])).toEqual([
      ...SET_CHARS.shapes,
      ...'LFEHTIDPBRCOQGSUJNMKAVWXYZ',
      ...SET_CHARS.small,
      ...SET_CHARS.numbers,
    ]);
    expect(nextInSet('L')).toBe('M');
  });

  it("old game progress keeps its stars; the path shows them in the new order (D8)", async () => {
    const s = storage();
    // Done before D8, in the old A B C order.
    await s.putJson('kids/k1/progress.json', { stars: ['cap-A', 'cap-B', 'cap-C'], game: ['cap-A', 'cap-B', 'cap-C'] });
    const p = await loadProgress(s, 'k1');
    const path = lettersOf(['capitals']);
    expect(p.stars).toEqual(['cap-A', 'cap-B', 'cap-C']);
    expect(gameIndex(path, p)).toBe(0); // L is next
    for (const ch of 'ABCL') expect(isOpenInGame(path, p, ch), ch).toBe(true);
    expect(isOpenInGame(path, p, 'F')).toBe(false);
  });

  it('lines and shapes are a set of their own, off by default, before capitals (D9)', async () => {
    expect([...SET_CHARS.shapes].map((ch) => SHAPES[ch].key)).toEqual([
      'line-down',
      'line-across',
      'circle',
      'cross',
      'slant',
      'square',
      'x',
      'triangle',
    ]);
    // Not letters: the 62 stay the 62 (a parent's recordings, the stroke table).
    for (const ch of SET_CHARS.shapes) {
      expect(allChars()).not.toContain(ch);
      expect(setOf(ch)).toBe('shapes');
    }
    const s = storage();
    expect((await loadPrefs(s, 'k1')).sets).toEqual(['capitals']);
    await savePrefs(s, 'k1', { sets: ['capitals', 'shapes'], ordered: false });
    expect((await loadPrefs(s, 'k1')).sets).toEqual(['shapes', 'capitals']);
    await savePrefs(s, 'k1', { sets: ['shapes'], ordered: false });
    expect((await loadPrefs(s, 'k1')).sets).toEqual(['shapes']);
    // A shape traced gets a star and its game step like a letter.
    const p = await finishLetter(s, 'k1', '○', true);
    expect(p.stars).toEqual(['shape-circle']);
    expect(p.help['shape-circle']).toEqual({ done: 1, alone: 1, top: 0 });
  });

  it('a new kid traces capitals, any way', async () => {
    expect(await loadPrefs(storage(), 'k1')).toEqual({ sets: ['capitals'], ordered: false });
  });

  it('sets keep their fixed order and are never empty', async () => {
    const s = storage();
    await savePrefs(s, 'k1', { sets: ['numbers', 'capitals'], ordered: true });
    expect(await loadPrefs(s, 'k1')).toEqual({ sets: ['capitals', 'numbers'], ordered: true });
    await savePrefs(s, 'k1', { sets: [], ordered: false });
    expect((await loadPrefs(s, 'k1')).sets).toEqual(['capitals']);
  });

  it('the game opens one letter at a time; practice stars do not unlock it', async () => {
    const s = storage();
    const path = lettersOf(['capitals', 'numbers']);
    expect(path).toHaveLength(36);
    let p = await loadProgress(s, 'k1');
    expect(gameIndex(path, p)).toBe(0);
    expect(isOpenInGame(path, p, 'L')).toBe(true);
    expect(isOpenInGame(path, p, 'F')).toBe(false);

    p = await finishLetter(s, 'k1', 'F', false); // practice
    expect(p.stars).toEqual(['cap-F']);
    expect(isOpenInGame(path, p, 'F')).toBe(false);

    p = await finishLetter(s, 'k1', 'L', true);
    expect(gameIndex(path, p)).toBe(1);
    expect(isOpenInGame(path, p, 'F')).toBe(true);
    expect(isOpenInGame(path, p, 'E')).toBe(false);

    await resetProgress(s, 'k1');
    expect(await loadProgress(s, 'k1')).toEqual({ stars: [], game: [], help: {}, demoSeen: false });
  });

  it('forgetting a kid removes only their letters', async () => {
    const s = storage();
    await finishLetter(s, 'k1', 'A', true);
    await finishLetter(s, 'k2', 'A', true);
    await forgetKid(s, 'k1');
    expect((await loadProgress(s, 'k1')).stars).toEqual([]);
    expect((await loadProgress(s, 'k2')).stars).toEqual(['cap-A']);
  });

  it('practice moves through a set and wraps round', () => {
    expect(nextInSet('A')).toBe('B');
    expect(nextInSet('Z')).toBe('A');
    expect(nextInSet('9')).toBe('0');
    expect(SET_CHARS.small.includes(nextInSet('z'))).toBe(true);
  });

  it('the first-time how-to is due on first play, after 14 days away and after a parent asks, and not otherwise', async () => {
    const s = storage();
    // A new kid.
    let p = await loadProgress(s, 'k1');
    expect(demoDue(p, '2026-11-15')).toBe(true);
    // Seen: not again the same day, nor a few days later, nor 13 days later.
    p = await notePlayed(s, 'k1', '2026-11-15', true);
    expect(p).toMatchObject({ demoSeen: true, lastPlayed: '2026-11-15' });
    expect(demoDue(await loadProgress(s, 'k1'), '2026-11-15')).toBe(false);
    expect(demoDue(p, '2026-11-20')).toBe(false);
    expect(demoDue(p, '2026-11-28')).toBe(false);
    // 14 days away, across a month's end.
    expect(demoDue(p, '2026-11-29')).toBe(true);
    expect(demoDue({ ...p, lastPlayed: '2026-12-25' }, '2027-01-08')).toBe(true);
    // Playing on a later day moves the 14 days on; the how-to stays seen.
    p = await notePlayed(s, 'k1', '2026-11-27', false);
    expect(p).toMatchObject({ demoSeen: true, lastPlayed: '2026-11-27' });
    expect(demoDue(p, '2026-12-10')).toBe(false);
    // A clock set back is not "away".
    expect(demoDue(p, '2026-11-01')).toBe(false);
    // A finished letter keeps both.
    p = await finishLetter(s, 'k1', 'L', false);
    expect(p).toMatchObject({ demoSeen: true, lastPlayed: '2026-11-27' });
    // A parent's "Show how to trace again".
    await showDemoAgain(s, 'k1');
    p = await loadProgress(s, 'k1');
    expect(demoDue(p, '2026-11-27')).toBe(true);
    expect(p.stars).toEqual(['cap-L']);
    // A reset starts the kid over, how-to and all.
    await notePlayed(s, 'k1', '2026-11-27', true);
    await resetProgress(s, 'k1');
    expect(demoDue(await loadProgress(s, 'k1'), '2026-11-27')).toBe(true);
  });

  it('days are counted on the calendar, and old or broken progress files load', async () => {
    expect(daysBetween('2026-11-15', '2026-11-29')).toBe(14);
    expect(daysBetween('2027-03-27', '2027-03-29')).toBe(2); // across a clock change
    expect(dayOf(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    const s = storage();
    // A file from before the how-to: the stars stay, the how-to is due once.
    await s.putJson('kids/k1/progress.json', { stars: ['cap-A'], game: ['cap-A'] });
    const old = await loadProgress(s, 'k1');
    expect(old).toEqual({ stars: ['cap-A'], game: ['cap-A'], help: {}, demoSeen: false });
    expect(demoDue(old, '2026-11-15')).toBe(true);
    await s.putJson('kids/k2/progress.json', { stars: [], demoSeen: 'yes', lastPlayed: 'last tuesday' });
    expect(await loadProgress(s, 'k2')).toEqual({ stars: [], game: [], help: {}, demoSeen: false });
  });

  it('every letter has a name to say', () => {
    for (const ch of everyGlyph) expect(spoken(ch), ch).toMatch(/^[a-z ]+$/);
  });
});

describe('sound while tracing (ADR 0037)', () => {
  it('knows when a point is on the road: the drawing sound plays only there', () => {
    const t = new Tracer(glyph('L'), { ordered: false });
    const [down] = glyph('L').strokes;
    const mid = down[Math.floor(down.length / 2)];
    expect(t.near(mid)).toBe(true);
    expect(t.near({ x: mid.x + ROAD_HALF - 1, y: mid.y })).toBe(true);
    expect(t.near({ x: mid.x + ROAD_HALF + 2, y: mid.y })).toBe(false);
    // Inside the L's corner but well away from both lines, and far off the card.
    expect(t.near({ x: 70, y: 40 })).toBe(false);
    expect(t.near({ x: -50, y: 200 })).toBe(false);
  });

  it('reports each stroke once, as it is traced, in both modes; a wipe starts again', () => {
    for (const ordered of [false, true]) {
      const g = glyph('E');
      const t = new Tracer(g, { ordered });
      const told: number[] = [];
      const traceAll = () =>
        g.strokes.forEach((stroke, s) => {
          stroke.forEach((p) => told.push(...t.add(s, p, TOLERANCE.finger)));
          t.lift(s);
        });
      traceAll();
      expect(told, ordered ? 'in order' : 'lenient').toEqual(g.strokes.map((_, i) => i));
      // Tracing it all again reports nothing new.
      traceAll();
      expect(told).toHaveLength(g.strokes.length);
      t.reset();
      told.length = 0;
      traceAll();
      expect(told).toHaveLength(g.strokes.length);
    }
  });

  it('does not report a stroke traced only most of the way', () => {
    const g = glyph('T');
    const t = new Tracer(g, { ordered: false });
    const told: number[] = [];
    const down = g.strokes[0];
    down.slice(0, Math.floor(down.length * 0.7)).forEach((p) => told.push(...t.add(1, p, TOLERANCE.finger)));
    expect(told).toEqual([]);
    down.forEach((p) => told.push(...t.add(2, p, TOLERANCE.finger)));
    expect(told).toEqual([0]);
  });

  it('never says the same praise twice in a row, and "All by yourself!" only without a hint', () => {
    let last: Praise | null = null;
    const seen = new Set<string>();
    let r = 0.123;
    const random = () => (r = (r * 9301 + 0.49297) % 1);
    for (let i = 0; i < 400; i++) {
      const helped = i % 3 === 0;
      const word = pickPraise(last, helped, random);
      expect(word).not.toBe(last);
      if (helped) expect(word).not.toBe('by-yourself');
      seen.add(word);
      last = word;
    }
    // Every word comes up: the four from before and the four about the effort.
    expect([...seen].sort()).toEqual([...PRAISE].sort());
    // The edges of the random range stay in the list.
    expect(PRAISE).toContain(pickPraise(null, false, () => 0));
    expect(PRAISE).toContain(pickPraise(null, false, () => 0.9999999));
  });

  it('says the name, the name then the sound, or the sound; a digit always its name', () => {
    expect(partsFor('name', 'B')).toEqual(['name']);
    expect(partsFor('name-sound', 'B')).toEqual(['name', 'sound']);
    expect(partsFor('sound', 'b')).toEqual(['sound']);
    expect(partsFor('sound', '7')).toEqual(['name']);
    expect(partsFor('name-sound', '7')).toEqual(['name']);
  });

  it("keeps the setting, name by default, and cleans what it doesn't know", async () => {
    const s = appStorage(memoryBackend()).game('letters');
    expect(await loadLettersSettings(s)).toEqual({ sounds: true, voice: 'windows', saying: 'name', tips: true });
    await saveLettersSettings(s, { sounds: true, voice: 'own', saying: 'name-sound', tips: true });
    expect((await loadLettersSettings(s)).saying).toBe('name-sound');
    await s.putJson('settings.json', { sounds: false, voice: 'windows', saying: 'shout' });
    expect(await loadLettersSettings(s)).toEqual({ sounds: false, voice: 'windows', saying: 'name', tips: true });
    await saveLettersSettings(s, { sounds: true, voice: 'windows', saying: 'nope' } as unknown as LettersSettings);
    expect(await s.getJson('settings.json')).toEqual({ sounds: true, voice: 'windows', saying: 'name', tips: true });
  });

  it("uses a parent's recordings of names and of sounds where there are some, else the narrator", async () => {
    const s = appStorage(memoryBackend()).game('letters');
    const blob = new Blob(['x'], { type: 'audio/webm' });
    await saveRecording(s, 'B', blob, 'name');
    await saveRecording(s, 'm', blob, 'sound');
    const settings = (saying: LettersSettings['saying'], voice: LettersSettings['voice'] = 'own'): LettersSettings => ({
      sounds: true,
      voice,
      saying,
    tips: true,
    });
    expect(await letterParts(s, settings('name-sound'), 'B')).toEqual([{ own: 'voice/cap-B.webm' }, { clip: soundClip('B') }]);
    // One sound recording serves the capital and the small letter.
    expect(await letterParts(s, settings('sound'), 'M')).toEqual([{ own: 'voice/sound-m.webm' }]);
    expect(await letterParts(s, settings('sound'), 'm')).toEqual([{ own: 'voice/sound-m.webm' }]);
    expect(await letterParts(s, settings('name-sound'), 'm')).toEqual([{ clip: letterClip('m') }, { own: 'voice/sound-m.webm' }]);
    // The app's voice chosen: recordings are kept but not used.
    expect(await letterParts(s, settings('name-sound', 'windows'), 'B')).toEqual([
      { clip: letterClip('B') },
      { clip: soundClip('B') },
    ]);
  });
});

describe('the line queue (ADR 0037)', () => {
  /** A stand-in for the browser's audio element: records what starts, and ends a clip when told. */
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
  const endCurrent = async () => {
    FakeAudio.playing.shift()?.dispatchEvent(new Event('ended'));
    await tick();
  };
  const settings: LettersSettings = { sounds: true, voice: 'windows', saying: 'name', tips: true };
  const voice = (enabled = true) => new LetterVoice(appStorage(memoryBackend()).game('letters'), settings, { play() {}, enabled });
  const clip = (c: string): Part => ({ clip: c });

  afterEach(() => {
    vi.unstubAllGlobals();
    FakeAudio.started = [];
    FakeAudio.playing = [];
  });

  it('says one line at a time; a line asked for meanwhile waits, and a newer one replaces it', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice();
    void v.line([clip('a1'), clip('a2')]);
    await tick();
    void v.line([clip('b')]);
    void v.line([clip('c')]);
    expect(FakeAudio.started).toEqual(['a1']);
    await endCurrent();
    expect(FakeAudio.started).toEqual(['a1', 'a2']);
    await endCurrent();
    expect(FakeAudio.started).toEqual(['a1', 'a2', 'c']);
  });

  it('starts nothing while a finger is on the letter, then says the newest line', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice();
    v.hold(true);
    void v.line([clip('a')]);
    void v.line([clip('b')]);
    await tick();
    expect(FakeAudio.started).toEqual([]);
    v.hold(false);
    await tick();
    expect(FakeAudio.started).toEqual(['b']);
  });

  it('a stop drops the line waiting', async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice();
    void v.line([clip('a')]);
    await tick();
    void v.line([clip('b')]);
    v.stop();
    await endCurrent();
    expect(FakeAudio.started).toEqual(['a']);
  });

  it("is silent when the app's sounds are off", async () => {
    vi.stubGlobal('Audio', FakeAudio);
    const v = voice(false);
    await v.line([clip('a')]);
    await v.say('A');
    await v.sayFinished('A', false);
    expect(FakeAudio.started).toEqual([]);
  });
});
