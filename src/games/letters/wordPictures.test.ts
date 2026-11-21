import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PICTURE_WORDS, wordPicture } from './wordPictures';
import { BUILT_IN_WORDS } from './words';

/** A WebP file's size in pixels, from its header (lossy, lossless or extended). */
function webpSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = bytes.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const bits = bytes.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { width: bytes.readUIntLE(24, 3) + 1, height: bytes.readUIntLE(27, 3) + 1 };
  throw new Error(`unknown WebP chunk ${chunk}`);
}

describe('the built-in words’ pictures (ADR 0039, W9)', () => {
  it('are the same 24 words the narrator says (tools/sounds/generate.mjs)', () => {
    const script = readFileSync('tools/sounds/generate.mjs', 'utf8');
    const list = /const WORDS = \[([^\]]*)\]/.exec(script)?.[1] ?? '';
    const said = [...list.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect([...PICTURE_WORDS]).toEqual(said);
  });

  it('every word has a picture, including every built-in word of the Words screen', () => {
    expect(PICTURE_WORDS.filter((w) => !wordPicture(w))).toEqual([]);
    expect(BUILT_IN_WORDS.map((w) => w.id).filter((id) => !wordPicture(id))).toEqual([]);
    expect(BUILT_IN_WORDS.map((w) => w.id).sort()).toEqual([...PICTURE_WORDS].sort());
    expect(wordPicture('CAT')).toBe(wordPicture('cat'));
    expect(wordPicture('zebra')).toBeUndefined();
  });

  it('each is a small square WebP, listed with its source', () => {
    const record = JSON.parse(readFileSync('assets/pictures/words/pictures.json', 'utf8')) as {
      pictures: { file: string; word: string; shows: string; source: string; license: string }[];
    };
    expect(record.pictures.map((p) => p.word)).toEqual([...PICTURE_WORDS]);
    for (const word of PICTURE_WORDS) {
      const entry = record.pictures.find((p) => p.word === word)!;
      expect(entry.file).toBe(`${word}.webp`);
      expect(entry.shows && entry.source && entry.license, word).toBeTruthy();
      const bytes = readFileSync(`assets/pictures/words/${word}.webp`);
      expect(bytes.length, word).toBeLessThan(80_000);
      const { width, height } = webpSize(bytes);
      expect(width, word).toBe(height);
      expect(width, word).toBeGreaterThanOrEqual(256);
      expect(width, word).toBeLessThanOrEqual(640);
    }
  });
});
