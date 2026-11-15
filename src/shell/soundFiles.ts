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

/** The narrator's praise words, said after a finished letter's cheer (ADR 0032). */
export const PRAISE = ['yay', 'you-did-it', 'great-job', 'wow'] as const;

export function praiseClip(word: (typeof PRAISE)[number]): string | undefined {
  return soundUrl(`voice/praise-${word}.mp3`);
}
