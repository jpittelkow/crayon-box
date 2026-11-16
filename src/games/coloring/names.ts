// When the narrator says a coloring button's name (ADR 0038): the first few times each kid picks each button, then
// only its sound plays. A parent can change it to every time or never. What is kept, in the game's storage:
//   button-names.json         the parent's setting, for every kid (its own file, so it syncs on its own, ADR 0024)
//   kids/<id>/names.json      how many times this kid has heard each button's name
import type { GameStorage } from '../../storage/types';

/** How often names are said: the first few picks per button per kid (the default), every pick, or never. */
export type NamesSetting = 'first' | 'always' | 'never';

/** How many picks of a button are named, per kid, with the default setting (owner, C1, 2026-11-15). */
export const NAMED_PICKS = 3;

const SETTING = 'button-names.json';
const kidDir = (kidId: string) => `kids/${kidId}/`;
const countsPath = (kidId: string) => `${kidDir(kidId)}names.json`;

/** Times each button's name has been said to a kid, by the button's key (e.g. `tool-bucket`, `color-red`). */
export type NameCounts = Record<string, number>;

export async function loadNamesSetting(storage: GameStorage): Promise<NamesSetting> {
  const raw = (await storage.getJson<{ say?: unknown }>(SETTING))?.say;
  return raw === 'always' || raw === 'never' ? raw : 'first';
}

export async function saveNamesSetting(storage: GameStorage, say: NamesSetting): Promise<void> {
  await storage.putJson(SETTING, { say });
}

/** Whether a pick says the button's name, given how many times this kid has heard it already. */
export function saysName(setting: NamesSetting, heard: number): boolean {
  if (setting === 'always') return true;
  if (setting === 'never') return false;
  return heard < NAMED_PICKS;
}

/**
 * One kid's counts. A name counts when it is said, so a kid who only ever had names turned off still hears the first
 * few once a parent turns them back on. Counts stop at NAMED_PICKS: past that nothing changes, so nothing is written.
 */
export class NameCounter {
  private counts: NameCounts = {};
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly storage: GameStorage,
    private readonly kidId: string,
  ) {}

  async load(): Promise<void> {
    const raw = await this.storage.getJson<NameCounts>(countsPath(this.kidId));
    this.counts = {};
    for (const [key, n] of Object.entries(raw ?? {})) if (typeof n === 'number' && n > 0) this.counts[key] = n;
  }

  heard(key: string): number {
    return this.counts[key] ?? 0;
  }

  /** Records that a name was said. Resolves once it is saved; saves run one after another. */
  said(key: string): Promise<void> {
    const n = this.heard(key);
    if (n >= NAMED_PICKS) return this.writing;
    this.counts[key] = n + 1;
    const snapshot = { ...this.counts };
    this.writing = this.writing
      .then(() => this.storage.putJson(countsPath(this.kidId), snapshot))
      .catch((err) => console.error('Could not save the button names heard', err));
    return this.writing;
  }
}

/** Deletes a kid's counts, when a parent deletes the kid. */
export async function forgetKidNames(storage: GameStorage, kidId: string): Promise<void> {
  for (const path of await storage.list(kidDir(kidId))) await storage.delete(path);
}
