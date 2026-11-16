// The sound files the app ships (ADR 0032), from assets/sounds/. Made by tools/sounds/prepare.mjs; where each one
// came from is in assets/sounds/sounds.json. Bundled with the app, so they play with no network.

const files = import.meta.glob<string>('/assets/sounds/**/*.{wav,mp3}', { eager: true, query: '?url', import: 'default' });

/** The URL of a shipped sound, by its path under assets/sounds/ (e.g. `ui/tap.wav`). */
export function soundUrl(path: string): string | undefined {
  return files[`/assets/sounds/${path}`];
}

/** The narrator's clip for a letter or digit (ADR 0032): small letters share their capital's clip. */
export function letterClip(ch: string): string | undefined {
  if (/^[0-9]$/.test(ch)) return soundUrl(`voice/number-${ch}.mp3`);
  if (/^[a-z]$/i.test(ch)) return soundUrl(`voice/letter-${ch.toUpperCase()}.mp3`);
  return undefined;
}

/**
 * The narrator saying a letter's sound ("buh" for B; the short vowels with their word, "ah… apple"), for the
 * "name then sound" and "sound only" settings (ADR 0037). Small letters share their capital's; digits have none.
 */
export function soundClip(ch: string): string | undefined {
  return /^[a-z]$/i.test(ch) ? soundUrl(`voice/sound-${ch.toUpperCase()}.mp3`) : undefined;
}

/**
 * The narrator's praise, said after a finished letter's cheer (ADR 0032): the first four from the first batch, the
 * last four about what the kid did (ADR 0037, D11). `by-yourself` is only for a letter done without a hint.
 */
export const PRAISE = [
  'yay',
  'you-did-it',
  'great-job',
  'wow',
  'all-the-way',
  'kept-going',
  'whole-letter',
  'by-yourself',
] as const;

export type Praise = (typeof PRAISE)[number];

export function praiseClip(word: Praise): string | undefined {
  return soundUrl(`voice/praise-${word}.mp3`);
}

/** The letters game's spoken tips (ADR 0037): `start-dot` is "Start at the green dot.", and so on. */
export const TIPS = ['start-dot', 'top', 'follow-arrow', 'keep-going', 'next-line', 'tap-check'] as const;
export type TipId = (typeof TIPS)[number];

export function tipClip(id: TipId): string | undefined {
  return soundUrl(`voice/tip-${id}.mp3`);
}

/** The stroke words (ADR 0037): "Down.", "Across.", "Slant.", "Around.", "Down, up and over.", "Dot.". */
export const STROKE_WORDS = ['down', 'across', 'slant', 'around', 'down-over', 'dot'] as const;
export type StrokeWord = (typeof STROKE_WORDS)[number];

export function strokeClip(kind: StrokeWord): string | undefined {
  return soundUrl(`voice/stroke-${kind}.mp3`);
}

/** The how-to's two lines (ADR 0037): "Watch me." and "Your turn!" (the hints' step 3 ends with the second). */
export function demoClip(line: 'watch' | 'your-turn'): string | undefined {
  return soundUrl(`voice/demo-${line}.mp3`);
}
