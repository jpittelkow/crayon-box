// Writing words (ADR 0039): the word list, the kid's own name as letters, which letters a word is written in, the
// row of boxes' size and the slow word. Plain TypeScript with no DOM; the screens are in game.ts and wordView.ts.
import type { SetId } from './glyphs';

/**
 * A built-in word (ADR 0037's 24, ADR 0039). Its picture is found by its id (`wordPicture` in `wordPictures.ts`).
 * Family words are kept apart, one file each (`familyWords.ts`), and sit between the name and these in the tiles.
 */
export interface WordEntry {
  /** The word itself, in small letters; also its clip names (`word-<id>`, `slow-<id>`), picture and star's key. */
  id: string;
}

/**
 * The built-in words in the easy order (ADR 0039, W6): words starting with a sound that can be held ("sss") first,
 * then the rest. Every word is open; this order is only where each tile sits.
 */
export const BUILT_IN_WORDS: readonly WordEntry[] = [
  // Starting with a held sound.
  { id: 'sun' },
  { id: 'sat' },
  { id: 'map' },
  { id: 'mud' },
  { id: 'run' },
  { id: 'red' },
  { id: 'fox' },
  // Starting with a quick sound.
  { id: 'cat' },
  { id: 'dog' },
  { id: 'bus' },
  { id: 'pig' },
  { id: 'hat' },
  { id: 'cup' },
  { id: 'bed' },
  { id: 'box' },
  { id: 'hen' },
  { id: 'bug' },
  { id: 'pan' },
  { id: 'pin' },
  { id: 'tap' },
  { id: 'top' },
  { id: 'hop' },
  { id: 'big' },
  { id: 'jam' },
];

/** Letters whose sound can be held as long as you like (continuous sounds): a word starting with one is easier. */
export const HELD_SOUNDS = new Set([...'aefilmnorsuvwyz']);

/**
 * Which of a word's two slow takes is used (ADR 0039): `stretched` is `slow-<word>` (read from "sssuuunnn"), `alt`
 * is `slow-<word>-alt` (the plain word, drawn out). Both ship; nobody has listened yet, so every word starts on the
 * stretched take. To swap a word after listening, change its entry here.
 */
export const SLOW_TAKES: Record<string, 'stretched' | 'alt'> = {
  cat: 'stretched', dog: 'stretched', sun: 'stretched', bus: 'stretched', pig: 'stretched', hat: 'stretched',
  cup: 'stretched', bed: 'stretched', box: 'stretched', fox: 'stretched', hen: 'stretched', bug: 'stretched',
  map: 'stretched', pan: 'stretched', pin: 'stretched', sat: 'stretched', tap: 'stretched', top: 'stretched',
  red: 'stretched', run: 'stretched', hop: 'stretched', big: 'stretched', mud: 'stretched', jam: 'stretched',
  // Spares for family words (part 2).
  mom: 'stretched', dad: 'stretched', van: 'stretched', jet: 'stretched', yes: 'stretched',
};

/** The narrator clip saying a word slowly, or undefined when it has none (then its letters' sounds are said). */
export function slowClipId(word: string): string | undefined {
  const take = SLOW_TAKES[word.toLowerCase()];
  return take ? `slow-${word.toLowerCase()}${take === 'alt' ? '-alt' : ''}` : undefined;
}

/** A word's star key in the kid's progress: `word-sun`; the kid's own name is `name`. */
export function wordKey(id: string): string {
  return id === NAME ? 'name' : `word-${id}`;
}

/** The id the kid's own name goes by (never the name itself). */
export const NAME = '@name';

/** One box of a word: a letter to trace, or a gap (a space, hyphen or apostrophe in a name), which is skipped. */
export type Cell = { ch: string } | { gap: true };

/** Letters that don't come apart into a plain letter and an accent. */
const PLAIN: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/**
 * The boxes for the kid's name (ADR 0039): letters A to Z are traced; a space, hyphen or apostrophe is a gap (one,
 * however many in a row, none at either end); an accented letter is its plain letter; anything else is left out.
 * With small letters on each part is a capital then small letters, else all capitals.
 */
export function nameCells(name: string, small: boolean): Cell[] {
  return textCells(name, (c, startOfPart) => (!small || startOfPart ? c.toUpperCase() : c));
}

/**
 * A family word's boxes (ADR 0039): handled like the name (gaps, accents, symbols left out), but with small letters
 * on each letter keeps the case the parent typed ("pup" stays small, "Pup" starts with a capital); without small
 * letters, all capitals.
 */
export function familyCells(text: string, small: boolean): Cell[] {
  return textCells(text, (c, _start, typedCapital) => (!small || typedCapital ? c.toUpperCase() : c));
}

/**
 * Typed text as boxes: letters A to Z (accents taken off), one gap for any run of spaces, hyphens or apostrophes
 * (none at either end), anything else left out. `letter` picks each letter's case from its small letter.
 */
function textCells(text: string, letter: (c: string, startOfPart: boolean, typedCapital: boolean) => string): Cell[] {
  const cells: Cell[] = [];
  let startOfPart = true;
  for (const typed of text.normalize('NFD').replace(/\p{M}/gu, '')) {
    const lower = typed.toLowerCase();
    const capital = typed !== lower;
    for (const c of PLAIN[lower] ?? lower) {
      if (/[a-z]/.test(c)) {
        cells.push({ ch: letter(c, startOfPart, capital) });
        startOfPart = false;
      } else if (/[\s\-'’‐‑–]/.test(c)) {
        if (cells.length > 0 && !('gap' in cells[cells.length - 1])) cells.push({ gap: true });
        startOfPart = true;
      }
    }
  }
  if (cells.length > 0 && 'gap' in cells[cells.length - 1]) cells.pop();
  return cells;
}

/** A built-in word's boxes: small letters when the kid has small letters on, else capitals (ADR 0039, W7). */
export function wordCells(word: string, sets: readonly SetId[]): Cell[] {
  const small = sets.includes('small');
  return [...word].map((c) => ({ ch: small ? c.toLowerCase() : c.toUpperCase() }));
}

/** The letters of a word's boxes, in order, gaps left out. */
export function lettersIn(cells: readonly Cell[]): string[] {
  return cells.flatMap((c) => ('ch' in c ? [c.ch] : []));
}

/** The row of boxes: a box's width in CSS px is at most this, and the gap between two. A gap cell is half a box. */
export const BOX_MAX = 96;
export const BOX_MIN = 22;
export const BOX_GAP = 10;
/** The boxes at the end, grown to the middle of the screen: at most this wide each. */
export const BOX_MAX_DONE = 200;

/**
 * How wide each box is so the whole row fits `width` CSS px: a long name gets smaller boxes (the letter being
 * traced never changes size). A gap counts as half a box.
 */
export function boxSize(cells: readonly Cell[], width: number, max = BOX_MAX): number {
  const letters = cells.filter((c) => 'ch' in c).length;
  const gaps = cells.length - letters;
  const units = letters + gaps / 2;
  if (units === 0) return max;
  const fit = (width - (cells.length - 1) * BOX_GAP) / units;
  return Math.max(BOX_MIN, Math.min(max, Math.floor(fit)));
}

/** "Now the next letter." is said as a word's next letter opens, the first this many times for a kid (ADR 0039). */
export const NEXT_LETTER_TIMES = 4;

/**
 * The word tiles' order (ADR 0039): My name, then the family words (`familyIds`, oldest first), then the built-in
 * words. `name` is false for a kid with no name (no name tile).
 */
export function wordOrder(familyIds: readonly string[] = [], name = true): string[] {
  return [...(name ? [NAME] : []), ...familyIds, ...BUILT_IN_WORDS.map((w) => w.id)];
}

/** The word after `id` in the tiles' order, or null after the last. The name leads into the next tile. */
export function nextWord(id: string, order: readonly string[] = wordOrder()): string | null {
  const i = order.indexOf(id);
  return i >= 0 && i + 1 < order.length ? order[i + 1] : null;
}
