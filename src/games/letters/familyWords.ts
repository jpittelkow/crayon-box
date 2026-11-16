// Family words (ADR 0039, W8): words a parent types for the family (people, pets, a favourite thing), shared by all
// the kids on the device. Each one is its own file, so sync settles each on its own (ADR 0024):
//   words/<id>.json             { text, added }: the word as typed and when it was added (the tiles' order)
//   words/<id>.jpg              its photo for the tile, cropped square like a kid's (optional)
//   voice/family-<id>.<ext>     a parent's recording of it (optional)
// The id is random (`fam-…`), never made from the word. A family word, its photo and its recording stay on the device
// and the family's own sync server: never in a file name, and never sent to any other service (no AI voice).
import { randomId } from '../../storage/ids';
import type { GameStorage } from '../../storage/types';
import { audioExt, VOICE_DIR } from './progress';
import { familyCells, lettersIn } from './words';

export const WORDS_DIR = 'words/';
/** At most this many family words, so every tile still fits on one screen at a size a finger can hit. */
export const MAX_FAMILY_WORDS = 10;
/** A family word is at most this many characters as typed. */
export const MAX_WORD_LENGTH = 16;

export interface FamilyWord {
  /** `fam-` and random characters: a tile's id and its star's key (`word-fam-…`). */
  id: string;
  /** The word as the parent typed it. */
  text: string;
  /** When it was added (ISO time): family words show oldest first. */
  added: string;
}

/** A family word with the storage paths of its photo and recording, when it has them. */
export interface FamilyWordFiles extends FamilyWord {
  photo?: string;
  recording?: string;
}

const ID = /^fam-[a-z0-9]+$/;
const jsonPath = (id: string) => `${WORDS_DIR}${id}.json`;
const photoPath = (id: string) => `${WORDS_DIR}${id}.jpg`;
const recordingPrefix = (id: string) => `${VOICE_DIR}family-${id}.`;

export function newFamilyId(): string {
  return `fam-${randomId()}`;
}

export function isFamilyId(id: string): boolean {
  return ID.test(id);
}

/** The word as it is kept: spaces trimmed and runs of them made one, at most MAX_WORD_LENGTH characters. */
export function cleanWordText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH).trim();
}

/** A word can be kept when it has at least one letter A to Z to trace (accents count as their plain letter). */
export function hasLetters(text: string): boolean {
  return lettersIn(familyCells(text, false)).length > 0;
}

/** Every family word, oldest first, with its photo and recording. Files that don't read as a word are skipped. */
export async function loadFamilyWords(storage: GameStorage): Promise<FamilyWordFiles[]> {
  const [files, voices] = await Promise.all([storage.list(WORDS_DIR), storage.list(`${VOICE_DIR}family-`)]);
  const words: FamilyWordFiles[] = [];
  for (const path of files) {
    const id = path.slice(WORDS_DIR.length).replace(/\.json$/, '');
    if (!path.endsWith('.json') || !isFamilyId(id)) continue;
    const raw = await storage.getJson<Partial<FamilyWord>>(path);
    const text = typeof raw?.text === 'string' ? cleanWordText(raw.text) : '';
    if (!hasLetters(text)) continue;
    const word: FamilyWordFiles = { id, text, added: typeof raw?.added === 'string' ? raw.added : '' };
    if (files.includes(photoPath(id))) word.photo = photoPath(id);
    const recording = voices.find((v) => v.startsWith(recordingPrefix(id)));
    if (recording) word.recording = recording;
    words.push(word);
  }
  return words.sort((a, b) => a.added.localeCompare(b.added) || a.id.localeCompare(b.id));
}

/** Adds or changes a family word (its text); its photo and recording are kept apart. */
export async function saveFamilyWord(storage: GameStorage, word: FamilyWord): Promise<void> {
  await storage.putJson(jsonPath(word.id), { text: cleanWordText(word.text), added: word.added });
}

/** Deletes a family word with its photo and recording. Kids' stars for it are left; they show nowhere. */
export async function deleteFamilyWord(storage: GameStorage, id: string): Promise<void> {
  await deleteFamilyPhoto(storage, id);
  await deleteFamilyRecording(storage, id);
  await storage.delete(jsonPath(id));
}

export async function saveFamilyPhoto(storage: GameStorage, id: string, photo: Blob): Promise<void> {
  await storage.putBlob(photoPath(id), photo);
}

export async function deleteFamilyPhoto(storage: GameStorage, id: string): Promise<void> {
  if ((await storage.list(photoPath(id))).length > 0) await storage.delete(photoPath(id));
}

export async function findFamilyRecording(storage: GameStorage, id: string): Promise<string | undefined> {
  return (await storage.list(recordingPrefix(id)))[0];
}

export async function saveFamilyRecording(storage: GameStorage, id: string, blob: Blob): Promise<void> {
  const old = await findFamilyRecording(storage, id);
  const path = `${recordingPrefix(id)}${audioExt(blob)}`;
  if (old && old !== path) await storage.delete(old);
  await storage.putBlob(path, blob);
}

export async function deleteFamilyRecording(storage: GameStorage, id: string): Promise<void> {
  const old = await findFamilyRecording(storage, id);
  if (old) await storage.delete(old);
}
