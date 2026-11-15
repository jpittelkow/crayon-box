import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { allChars, arrowFor, glyph, SET_CHARS, type Glyph, type Pt } from './glyphs';
import {
  finishLetter,
  forgetKid,
  gameIndex,
  isOpenInGame,
  keyOf,
  lettersOf,
  loadPrefs,
  loadProgress,
  nextInSet,
  resetProgress,
  savePrefs,
  spoken,
} from './progress';
import { TOLERANCE, Tracer } from './trace';

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
    for (const ch of allChars()) {
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
    for (const ch of allChars()) {
      const g = glyph(ch);
      g.strokes.forEach((stroke, i) => {
        const a = arrowFor(g, i);
        if (stroke.length < 14) return;
        expect(a, `${ch} stroke ${i}`).not.toBeNull();
      });
    }
    expect(arrowFor(glyph('i'), 1)).toBeNull(); // the dot
  });
});

describe('tracing (ADR 0026)', () => {
  it('a good trace finishes every letter, lenient and in stroke order', () => {
    for (const ch of allChars()) {
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
      glyph('l').strokes[0].forEach((p, i) => t.add(1, { x: p.x + 14, y: p.y }, tol + 0 * i));
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
    expect(isOpenInGame(path, p, 'A')).toBe(true);
    expect(isOpenInGame(path, p, 'B')).toBe(false);

    p = await finishLetter(s, 'k1', 'B', false); // practice
    expect(p.stars).toEqual(['cap-B']);
    expect(isOpenInGame(path, p, 'B')).toBe(false);

    p = await finishLetter(s, 'k1', 'A', true);
    expect(gameIndex(path, p)).toBe(1);
    expect(isOpenInGame(path, p, 'B')).toBe(true);
    expect(isOpenInGame(path, p, 'C')).toBe(false);

    await resetProgress(s, 'k1');
    expect(await loadProgress(s, 'k1')).toEqual({ stars: [], game: [] });
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

  it('every letter has a name to say', () => {
    for (const ch of allChars()) expect(spoken(ch), ch).toMatch(/^[a-z ]+$/);
  });
});
