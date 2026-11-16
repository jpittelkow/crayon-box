// What the letters game keeps (ADR 0026), and the game path's rules.
//   kids/<id>/prefs.json     set by a parent: which letter sets, and whether stroke order counts
//   kids/<id>/progress.json  the kid's stars (shared by practice and the game), the letters done in the game, and
//                            per letter how often it was finished and how much help it needed (ADR 0037)
//   settings.json            the game's sounds switch, which voice says the letters, what it says, and whether
//                            tips are spoken (ADR 0037)
//   voice/<key>.<ext>        a parent's own recording of a letter's name
//   voice/sound-<a-z>.<ext>  a parent's own recording of a letter's sound (one per letter: A and a share it)
// Letters are stored by a key that keeps capitals and small letters apart on a file system that ignores case
// (Windows, the installer's file storage): `cap-A`, `small-a`, `num-3`.
import type { GameStorage } from '../../storage/types';
import { SET_CHARS, SET_ORDER, setOf, type SetId } from './glyphs';
import { wasHelped, type LetterHelp } from './hints';

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
  /** Per letter key: times finished, times with no hint past step 1, the highest hint step (ADR 0037). */
  help: Record<string, LetterHelp>;
}

/** Who says the letters: the app's narrator (stored as 'windows', its name before ADR 0032), or a parent. */
export type Voice = 'windows' | 'own';

/** What is said with a letter (ADR 0037, D3): its name (the default), its name then its sound, or only its sound. */
export type Saying = 'name' | 'name-sound' | 'sound';
export const SAYINGS: readonly Saying[] = ['name', 'name-sound', 'sound'];

export interface LettersSettings {
  sounds: boolean;
  voice: Voice;
  saying: Saying;
  /** The hints' spoken tips and stroke words (ADR 0037). The shown hints can't be turned off. */
  tips: boolean;
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
  return { stars: list(raw?.stars), game: list(raw?.game), help: cleanHelp(raw?.help) };
}

/** Help counts as saved, dropping anything that isn't one (older files have none). */
function cleanHelp(raw: unknown): Record<string, LetterHelp> {
  const out: Record<string, LetterHelp> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const count = (v: unknown, max = Infinity) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(max, Math.floor(v)) : 0;
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const h = v as Partial<Record<keyof LetterHelp, unknown>>;
    out[key] = { done: count(h.done), alone: count(h.alone), top: count(h.top, 3) };
  }
  return out;
}

/**
 * Records a finished letter: a star, in the game one more step along the path, and how much help it needed
 * (`step`, the highest hint step shown, 0 to 3).
 */
export async function finishLetter(
  storage: GameStorage,
  kidId: string,
  ch: string,
  inGame: boolean,
  step = 0,
): Promise<KidProgress> {
  const progress = await loadProgress(storage, kidId);
  const key = keyOf(ch);
  if (!progress.stars.includes(key)) progress.stars.push(key);
  if (inGame && !progress.game.includes(key)) progress.game.push(key);
  const help = progress.help[key] ?? { done: 0, alone: 0, top: 0 };
  progress.help[key] = {
    done: help.done + 1,
    alone: help.alone + (wasHelped(step) ? 0 : 1),
    top: Math.max(help.top, Math.min(3, step)),
  };
  await storage.putJson(progressPath(kidId), progress);
  return progress;
}

/** A parent's reset: the kid's stars and game start again. */
export async function resetProgress(storage: GameStorage, kidId: string): Promise<void> {
  await storage.delete(progressPath(kidId));
}

export async function loadLettersSettings(storage: GameStorage): Promise<LettersSettings> {
  const raw = await storage.getJson<Partial<LettersSettings>>(SETTINGS);
  return cleanSettings(raw);
}

/** Settings as saved, with anything unknown or missing back to its default (older files have no `saying`, `tips`). */
function cleanSettings(raw: Partial<LettersSettings> | undefined): LettersSettings {
  return {
    sounds: raw?.sounds !== false,
    voice: raw?.voice === 'own' ? 'own' : 'windows',
    saying: SAYINGS.includes(raw?.saying as Saying) ? (raw!.saying as Saying) : 'name',
    tips: raw?.tips !== false,
  };
}

export async function saveLettersSettings(storage: GameStorage, value: LettersSettings): Promise<void> {
  await storage.putJson(SETTINGS, cleanSettings(value));
}

/** Deletes what the game keeps for a kid, when a parent deletes the kid (ADR 0012). */
export async function forgetKid(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}

// ---- Recordings ----

/** A parent's recording is of a letter's name or of its sound. */
export type Said = 'name' | 'sound';

/** The file name a recording is kept under, without its extension: `cap-A` for a name, `sound-a` for a sound. */
export function recordingKey(ch: string, what: Said = 'name'): string {
  return what === 'sound' ? `sound-${ch.toLowerCase()}` : keyOf(ch);
}

export async function findRecording(storage: GameStorage, ch: string, what: Said = 'name'): Promise<string | undefined> {
  const prefix = `${VOICE_DIR}${recordingKey(ch, what)}.`;
  return (await storage.list(prefix))[0];
}

export async function saveRecording(storage: GameStorage, ch: string, blob: Blob, what: Said = 'name'): Promise<void> {
  const old = await findRecording(storage, ch, what);
  const ext = /ogg/.test(blob.type) ? 'ogg' : /mp4|aac/.test(blob.type) ? 'm4a' : 'webm';
  const path = `${VOICE_DIR}${recordingKey(ch, what)}.${ext}`;
  if (old && old !== path) await storage.delete(old);
  await storage.putBlob(path, blob);
}

export async function deleteRecording(storage: GameStorage, ch: string, what: Said = 'name'): Promise<void> {
  const old = await findRecording(storage, ch, what);
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
