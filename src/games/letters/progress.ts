// What the letters game keeps (ADR 0026), and the game path's rules.
//   kids/<id>/prefs.json     set by a parent: which letter sets, and whether stroke order counts
//   kids/<id>/progress.json  the kid's stars (shared by practice and the game) and the letters done in the game
//   settings.json            the game's sounds switch and which voice says the letters
//   voice/<key>.<ext>        a parent's own recording of a letter
// Letters are stored by a key that keeps capitals and small letters apart on a file system that ignores case
// (Windows, the installer's file storage): `cap-A`, `small-a`, `num-3`.
import type { GameStorage } from '../../storage/types';
import { SET_CHARS, SET_ORDER, setOf, type SetId } from './glyphs';

export interface KidPrefs {
  /** Turned-on sets, in the fixed order capitals, small letters, numbers. Never empty. */
  sets: SetId[];
  /** Stroke order counts (ADR 0026). Off by default. */
  ordered: boolean;
}

export interface KidProgress {
  /** Keys of letters with a star. */
  stars: string[];
  /** Keys of letters finished in the game (what unlocks the next one). */
  game: string[];
}

/** Who says the letters: the app's narrator (stored as 'windows', its name before ADR 0032), or a parent. */
export type Voice = 'windows' | 'own';

export interface LettersSettings {
  sounds: boolean;
  voice: Voice;
}

const kidDir = (kidId: string) => `kids/${kidId}/`;
const prefsPath = (kidId: string) => `${kidDir(kidId)}prefs.json`;
const progressPath = (kidId: string) => `${kidDir(kidId)}progress.json`;
const SETTINGS = 'settings.json';
export const VOICE_DIR = 'voice/';

export function keyOf(ch: string): string {
  const set = setOf(ch);
  return `${set === 'capitals' ? 'cap' : set === 'small' ? 'small' : 'num'}-${ch}`;
}

export const DEFAULT_PREFS: KidPrefs = { sets: ['capitals'], ordered: false };

export function cleanSets(sets: unknown): SetId[] {
  const list = Array.isArray(sets) ? sets : [];
  const kept = SET_ORDER.filter((s) => list.includes(s));
  return kept.length > 0 ? kept : ['capitals'];
}

export async function loadPrefs(storage: GameStorage, kidId: string): Promise<KidPrefs> {
  const raw = await storage.getJson<Partial<KidPrefs>>(prefsPath(kidId));
  return { sets: cleanSets(raw?.sets ?? DEFAULT_PREFS.sets), ordered: raw?.ordered === true };
}

export async function savePrefs(storage: GameStorage, kidId: string, prefs: KidPrefs): Promise<void> {
  await storage.putJson(prefsPath(kidId), { sets: cleanSets(prefs.sets), ordered: prefs.ordered });
}

export async function loadProgress(storage: GameStorage, kidId: string): Promise<KidProgress> {
  const raw = await storage.getJson<Partial<KidProgress>>(progressPath(kidId));
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { stars: list(raw?.stars), game: list(raw?.game) };
}

/** Records a finished letter: a star, and in the game, one more step along the path. */
export async function finishLetter(storage: GameStorage, kidId: string, ch: string, inGame: boolean): Promise<KidProgress> {
  const progress = await loadProgress(storage, kidId);
  const key = keyOf(ch);
  if (!progress.stars.includes(key)) progress.stars.push(key);
  if (inGame && !progress.game.includes(key)) progress.game.push(key);
  await storage.putJson(progressPath(kidId), progress);
  return progress;
}

/** A parent's reset: the kid's stars and game start again. */
export async function resetProgress(storage: GameStorage, kidId: string): Promise<void> {
  await storage.delete(progressPath(kidId));
}

export async function loadLettersSettings(storage: GameStorage): Promise<LettersSettings> {
  const raw = await storage.getJson<Partial<LettersSettings>>(SETTINGS);
  return { sounds: raw?.sounds !== false, voice: raw?.voice === 'own' ? 'own' : 'windows' };
}

export async function saveLettersSettings(storage: GameStorage, value: LettersSettings): Promise<void> {
  await storage.putJson(SETTINGS, value);
}

/** Deletes what the game keeps for a kid, when a parent deletes the kid (ADR 0012). */
export async function forgetKid(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}

// ---- Recordings ----

export async function findRecording(storage: GameStorage, ch: string): Promise<string | undefined> {
  const prefix = `${VOICE_DIR}${keyOf(ch)}.`;
  return (await storage.list(prefix))[0];
}

export async function saveRecording(storage: GameStorage, ch: string, blob: Blob): Promise<void> {
  const old = await findRecording(storage, ch);
  const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4|aac/.test(blob.type) ? 'm4a' : 'webm';
  const path = `${VOICE_DIR}${keyOf(ch)}.${ext}`;
  if (old && old !== path) await storage.delete(old);
  await storage.putBlob(path, blob);
}

export async function deleteRecording(storage: GameStorage, ch: string): Promise<void> {
  const old = await findRecording(storage, ch);
  if (old) await storage.delete(old);
}

// ---- The game path ----

/** Every letter of the turned-on sets, in order: the practice grid and the game path both use it. */
export function lettersOf(sets: readonly SetId[]): string[] {
  return cleanSets(sets).flatMap((s) => [...SET_CHARS[s]]);
}

/** Where the kid is on the game path: the index of the first letter not yet done, or the length when all are. */
export function gameIndex(path: readonly string[], progress: KidProgress): number {
  const done = new Set(progress.game);
  const i = path.findIndex((ch) => !done.has(keyOf(ch)));
  return i < 0 ? path.length : i;
}

/** In the game, a letter can be traced when it is done or the next one. Later ones are locked. */
export function isOpenInGame(path: readonly string[], progress: KidProgress, ch: string): boolean {
  const i = path.indexOf(ch);
  return i >= 0 && (i <= gameIndex(path, progress) || progress.game.includes(keyOf(ch)));
}

/** The letter after `ch` in practice: the next in its set, wrapping round. */
export function nextInSet(ch: string): string {
  const chars = SET_CHARS[setOf(ch)];
  return chars[(chars.indexOf(ch) + 1) % chars.length];
}

/** Names the browser's voice says. Saying "A" alone reads as the word "a", so each letter has its name spelled. */
export const SAY: Record<string, string> = {
  a: 'ay', b: 'bee', c: 'see', d: 'dee', e: 'ee', f: 'ef', g: 'jee', h: 'aitch', i: 'eye', j: 'jay', k: 'kay',
  l: 'el', m: 'em', n: 'en', o: 'oh', p: 'pee', q: 'cue', r: 'ar', s: 'ess', t: 'tee', u: 'you', v: 'vee',
  w: 'double you', x: 'ex', y: 'why', z: 'zee',
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven',
  '8': 'eight', '9': 'nine',
};

export function spoken(ch: string): string {
  return SAY[ch.toLowerCase()] ?? ch;
}
