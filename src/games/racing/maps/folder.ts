// Maps from the device's maps folder (ADR 0043): each `.json` file there is read, checked against the same rules as
// the built-in maps (`check.ts`), and either joins the picker after the built-in maps or is left out with a reason
// for the parent area. Nothing here throws: a bad folder or file never reaches a kid's screen.
import type { MapsFolder } from '../../../shell/types';
import type { GameStorage } from '../../../storage/types';
import type { MapDef } from '../sim/map';
import { placeProblems } from './check';
import { parseMapFile } from './file';

/**
 * A folder map's id in the game is its file's id behind this prefix. Built-in ids are letters, digits and dashes
 * only (`maps.test.ts`), so the two can never clash, and a folder map can't take a built-in map's place.
 */
export const FOLDER_ID = 'folder:';

export interface FolderMap {
  /** The file's name in the folder. */
  file: string;
  /** For screen readers and the parent area. */
  name: string;
  /** The map, its id behind `FOLDER_ID`. */
  map: MapDef;
  /** The picker picture's key (pictureCache.ts): the id and a hash of the file, so an edited file is drawn again. */
  picture: string;
}

export interface FolderProblem {
  /** The file's name; empty for the folder itself. */
  file: string;
  reason: string;
}

export interface FolderMaps {
  maps: FolderMap[];
  problems: FolderProblem[];
}

/** A short hash of a file's text (FNV-1a), for picture keys. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Checking a big map builds its world, so a file's answer is kept for the session, by its text. */
const checked = new Map<string, { ok: true; name: string; map: MapDef } | { ok: false; reason: string }>();

function check(text: string) {
  const known = checked.get(text);
  if (known) return known;
  const parsed = parseMapFile(text);
  let result = parsed;
  if (parsed.ok) {
    const problems = placeProblems(parsed.map);
    if (problems.length) result = { ok: false, reason: problems.join(' ') };
  }
  checked.set(text, result);
  return result;
}

/** Every map in the folder that passes the rules, in file-name order, and why the others were left out. */
export async function loadFolderMaps(folder: MapsFolder): Promise<FolderMaps> {
  const out: FolderMaps = { maps: [], problems: [] };
  let files;
  try {
    files = await folder.read();
  } catch (err) {
    out.problems.push({ file: '', reason: `The maps folder couldn't be read (${String(err)}).` });
    return out;
  }
  const seen = new Map<string, string>();
  for (const f of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    if (f.error) {
      out.problems.push({ file: f.name, reason: `It couldn't be read (${f.error}).` });
      continue;
    }
    let result;
    try {
      result = check(f.text);
    } catch (err) {
      result = { ok: false as const, reason: `It couldn't be checked (${String(err)}).` };
    }
    if (!result.ok) {
      out.problems.push({ file: f.name, reason: result.reason });
      continue;
    }
    const other = seen.get(result.map.id);
    if (other) {
      out.problems.push({ file: f.name, reason: `It has the same id ("${result.map.id}") as ${other}: give one of them another id.` });
      continue;
    }
    seen.set(result.map.id, f.name);
    out.maps.push({
      file: f.name,
      name: result.name,
      map: { ...result.map, id: `${FOLDER_ID}${result.map.id}` },
      picture: `map-folder-${result.map.id}-${textHash(f.text)}`,
    });
  }
  return out;
}

/** For tests: forget what was checked. */
export function forgetCheckedMaps(): void {
  checked.clear();
}

/** Folder maps a parent switched off, by id. Device-only (`local/`, ADR 0024), as the folder is this device's. */
const OFF = 'local/folder-maps.json';

export async function loadFolderMapsOff(storage: GameStorage): Promise<string[]> {
  const raw = await storage.getJson<{ off?: unknown }>(OFF).catch(() => undefined);
  return Array.isArray(raw?.off) ? raw.off.filter((id): id is string => typeof id === 'string') : [];
}

export async function saveFolderMapsOff(storage: GameStorage, off: string[]): Promise<void> {
  await storage.putJson(OFF, { off });
}

/** The folder maps for the picker: those that pass, minus those a parent switched off. Never throws. */
export async function pickerFolderMaps(folder: MapsFolder | undefined, storage: GameStorage): Promise<FolderMap[]> {
  if (!folder) return [];
  try {
    const [{ maps }, off] = await Promise.all([loadFolderMaps(folder), loadFolderMapsOff(storage)]);
    return maps.filter((m) => !off.includes(m.map.id));
  } catch (err) {
    console.error('Maps folder unavailable', err);
    return [];
  }
}
