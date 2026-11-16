// The pictures for the built-in words (ADR 0039, decision W9): one small colour picture per word, all in one
// style, made with an OpenRouter image model and picked by eye, kept in `assets/pictures/words/<word>.webp`.
// Where each one came from and what it shows is in `assets/pictures/words/pictures.json`. Bundled with the app,
// so they show with no network.

const files = import.meta.glob<string>('/assets/pictures/words/*.webp', { eager: true, query: '?url', import: 'default' });

/** The 24 built-in words of ADR 0037 / the letters plan, in that list's order; each has a narrator clip `word-<word>`. */
export const PICTURE_WORDS = [
  'cat', 'dog', 'sun', 'bus', 'pig', 'hat', 'cup', 'bed', 'box', 'fox', 'hen', 'bug',
  'map', 'pan', 'pin', 'sat', 'tap', 'top', 'red', 'run', 'hop', 'big', 'mud', 'jam',
] as const;
export type PictureWord = (typeof PICTURE_WORDS)[number];

/** The URL of a built-in word's picture, or undefined when the word has none. */
export function wordPicture(word: string): string | undefined {
  return files[`/assets/pictures/words/${word.toLowerCase()}.webp`];
}
