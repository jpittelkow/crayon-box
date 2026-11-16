import { describe, expect, it } from 'vitest';
import { narratorClip, soundClip } from '../../shell/soundFiles';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import { glyph } from './glyphs';
import {
  findNameRecording,
  finishLetter,
  finishWord,
  forgetKid,
  loadPrefs,
  loadProgress,
  noteNextSaid,
  resetProgress,
  saveNameRecording,
  savePrefs,
} from './progress';
import {
  BOX_MAX,
  BOX_MIN,
  BUILT_IN_WORDS,
  boxSize,
  HELD_SOUNDS,
  lettersIn,
  NAME,
  nameCells,
  nextWord,
  SLOW_TAKES,
  slowClipId,
  wordCells,
  wordKey,
  type Cell,
} from './words';

// Writing words (ADR 0039).

const storage = () => appStorage(memoryBackend()).game('letters');
const letters = (cells: Cell[]) => cells.map((c) => ('ch' in c ? c.ch : ' ')).join('');

describe('the name as letters', () => {
  it('capitals while small letters are off; a capital then small letters once they are on', () => {
    expect(letters(nameCells('star', false))).toBe('STAR');
    expect(letters(nameCells('star', true))).toBe('Star');
    expect(letters(nameCells('STAR', true))).toBe('Star');
  });

  it('skips spaces, hyphens and apostrophes as one gap, none at the ends; each part starts with a capital', () => {
    expect(letters(nameCells('sun-moon', true))).toBe('Sun Moon');
    expect(letters(nameCells('  sun -- moon  ', true))).toBe('Sun Moon');
    expect(letters(nameCells("o'leaf", true))).toBe('O Leaf');
    expect(nameCells('sun moon', false).filter((c) => 'gap' in c)).toHaveLength(1);
  });

  it('traces an accented letter plain and leaves out what is not a letter', () => {
    expect(letters(nameCells('Zoë', true))).toBe('Zoe');
    expect(letters(nameCells('Ångström', false))).toBe('ANGSTROM');
    expect(letters(nameCells('Straße', true))).toBe('Strasse');
    expect(letters(nameCells('Star 2 ★', false))).toBe('STAR');
    expect(nameCells('', true)).toEqual([]);
    expect(nameCells('★ 7', true)).toEqual([]);
  });

  it('every letter of a name has a glyph to trace', () => {
    for (const ch of lettersIn(nameCells('Ångström-Zoë', true))) expect(glyph(ch).strokes.length).toBeGreaterThan(0);
  });
});

describe('the built-in words', () => {
  it('are the 24 words of ADR 0037, each once', () => {
    const ids = BUILT_IN_WORDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(24);
    expect([...ids].sort()).toEqual(
      'bed big box bug bus cat cup dog fox hat hen hop jam map mud pan pig pin red run sat sun tap top'.split(' '),
    );
  });

  it('come in the easy order: every word starting with a held sound before every other', () => {
    const held = BUILT_IN_WORDS.map((w) => HELD_SOUNDS.has(w.id[0]));
    expect(held.indexOf(false)).toBe(held.lastIndexOf(true) + 1);
    expect(BUILT_IN_WORDS.slice(0, 6).map((w) => w.id)).toEqual(['sun', 'sat', 'map', 'mud', 'run', 'red']);
  });

  it('follow the kid’s sets: capitals, or small letters once those are on', () => {
    expect(lettersIn(wordCells('sun', ['capitals']))).toEqual(['S', 'U', 'N']);
    expect(lettersIn(wordCells('sun', ['capitals', 'small']))).toEqual(['s', 'u', 'n']);
    expect(lettersIn(wordCells('sun', ['numbers']))).toEqual(['S', 'U', 'N']);
  });

  it('each has its word clip, both slow takes and a sound clip for every letter', () => {
    for (const { id } of BUILT_IN_WORDS) {
      expect(narratorClip(`word-${id}`), id).toBeDefined();
      expect(narratorClip(`slow-${id}`), id).toBeDefined();
      expect(narratorClip(`slow-${id}-alt`), id).toBeDefined();
      for (const ch of id) expect(soundClip(ch)).toBeDefined();
    }
    expect(narratorClip('word-next-letter')).toBeDefined();
    expect(narratorClip('praise-a-word')).toBeDefined();
    expect(narratorClip('praise-your-name')).toBeDefined();
    expect(narratorClip('word-your-name')).toBeDefined();
  });

  it('the next word follows the order; the name leads into the first; the last has none', () => {
    expect(nextWord(NAME)).toBe('sun');
    expect(nextWord('sun')).toBe('sat');
    expect(nextWord(BUILT_IN_WORDS.at(-1)!.id)).toBeNull();
  });
});

describe('the slow word', () => {
  it('is the stretched take until a word is switched to the other one, and none for a word without takes', () => {
    expect(slowClipId('sun')).toBe('slow-sun');
    expect(slowClipId('mom')).toBe('slow-mom');
    expect(slowClipId('car')).toBeUndefined();
    const was = SLOW_TAKES.sun;
    SLOW_TAKES.sun = 'alt';
    try {
      expect(slowClipId('sun')).toBe('slow-sun-alt');
    } finally {
      SLOW_TAKES.sun = was;
    }
  });

  it('every word with slow takes ships both', () => {
    for (const word of Object.keys(SLOW_TAKES)) {
      expect(narratorClip(`slow-${word}`), word).toBeDefined();
      expect(narratorClip(`slow-${word}-alt`), word).toBeDefined();
    }
  });
});

describe('the row of boxes', () => {
  const name = (n: number) => nameCells('a'.repeat(n), false);

  it('a short word gets full-size boxes', () => {
    expect(boxSize(wordCells('sun', ['capitals']), 900)).toBe(BOX_MAX);
  });

  it('a long name gets smaller boxes so the row fits, never below the smallest', () => {
    const width = 900;
    const ten = boxSize(name(10), width);
    expect(ten).toBeLessThan(BOX_MAX);
    expect(ten * 10 + 9 * 10).toBeLessThanOrEqual(width);
    expect(boxSize(name(20), width)).toBeLessThan(ten);
    expect(boxSize(name(30), 300)).toBe(BOX_MIN);
  });

  it('a gap counts as half a box', () => {
    const withGap = nameCells('aaaa aaaa', false);
    const without = nameCells('aaaaaaaaa', false);
    expect(boxSize(withGap, 700)).toBeGreaterThan(boxSize(without, 700));
  });
});

describe('word stars and what is saved', () => {
  it('a written word gets its star, once, beside the letter stars; a parent reset clears both', async () => {
    const s = storage();
    await finishLetter(s, 'k1', 'S', false);
    await finishWord(s, 'k1', wordKey('sun'));
    await finishWord(s, 'k1', wordKey('sun'));
    await finishWord(s, 'k1', wordKey(NAME));
    const p = await loadProgress(s, 'k1');
    expect(p.words).toEqual(['word-sun', 'name']);
    expect(p.stars).toEqual(['cap-S']);
    // A letter finished later keeps the word stars.
    await finishLetter(s, 'k1', 'U', false);
    expect((await loadProgress(s, 'k1')).words).toEqual(['word-sun', 'name']);
    await resetProgress(s, 'k1');
    expect(await loadProgress(s, 'k1')).toEqual({ stars: [], game: [], help: {}, demoSeen: false });
  });

  it('counts how often "Now the next letter." was said', async () => {
    const s = storage();
    expect((await loadProgress(s, 'k1')).nextSaid).toBeUndefined();
    await noteNextSaid(s, 'k1');
    await noteNextSaid(s, 'k1');
    expect((await loadProgress(s, 'k1')).nextSaid).toBe(2);
  });

  it('Words is off for a kid until a parent turns it on', async () => {
    const s = storage();
    expect((await loadPrefs(s, 'k1')).words).toBeUndefined();
    await savePrefs(s, 'k1', { sets: ['capitals'], ordered: false, words: true });
    expect(await loadPrefs(s, 'k1')).toEqual({ sets: ['capitals'], ordered: false, words: true });
    await savePrefs(s, 'k1', { sets: ['capitals'], ordered: false, words: false });
    expect(await s.getJson('kids/k1/prefs.json')).toEqual({ sets: ['capitals'], ordered: false });
  });

  it("a name's recording is kept by the kid's id, and goes when the kid is deleted", async () => {
    const s = storage();
    await saveNameRecording(s, 'kid-abc', new Blob(['x'], { type: 'audio/webm' }));
    expect(await findNameRecording(s, 'kid-abc')).toBe('voice/name-kid-abc.webm');
    expect(await findNameRecording(s, 'kid-ab')).toBeUndefined();
    await saveNameRecording(s, 'kid-abc', new Blob(['y'], { type: 'audio/ogg' }));
    expect(await s.list('voice/')).toEqual(['voice/name-kid-abc.ogg']);
    await forgetKid(s, 'kid-abc');
    expect(await s.list('voice/')).toEqual([]);
  });
});
