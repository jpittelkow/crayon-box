// A driving map as a file (ADR 0043): today's `MapDef` (sim/map.ts) as JSON, wrapped with a format name, a format
// version and the map's name. Maps from the device's maps folder are read with `parseMapFile`; `mapToFile` writes
// one, so any built-in map can be the start of a new one. Plain TypeScript, no three.js.
import type { MapDef } from '../sim/map';
import { shapeProblems } from './check';

/** What every map file says it is. */
export const MAP_FORMAT = 'crayon-box-map';
/**
 * The format's version. It goes up only when an old file would be read wrongly by the new app (a field changing
 * its meaning). A new optional field doesn't change it: an older app ignores fields it doesn't know.
 */
export const MAP_FORMAT_VERSION = 1;
/** Bigger files are left out, so a stray file can't stall the laptop. The island is about 0.2 MB. */
export const MAX_MAP_FILE_BYTES = 10 * 1024 * 1024;
/** A map's name, for screen readers and the parent area (the picker shows only its picture, ADR 0003). */
export const MAX_NAME = 60;

export interface MapFile {
  format: typeof MAP_FORMAT;
  version: number;
  name: string;
  map: MapDef;
}

export type ParsedMap = { ok: true; name: string; map: MapDef } | { ok: false; reason: string };

/**
 * A map as a file's text. Short lists of numbers (points, sizes) stay on one line, so a person can read and edit
 * it. Numbers are written exactly as JavaScript holds them (`-0` too), so reading it back gives the same map.
 */
export function mapToFile(map: MapDef, name: string): string {
  const file: MapFile = { format: MAP_FORMAT, version: MAP_FORMAT_VERSION, name, map };
  return `${write(file, '')}\n`;
}

function write(v: unknown, indent: string): string {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`A map can't hold ${v}`);
    return Object.is(v, -0) ? '-0' : JSON.stringify(v);
  }
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const inner = `${indent}  `;
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    if (v.every((x) => typeof x === 'number')) return `[${v.map((x) => write(x, '')).join(', ')}]`;
    // A list of points: several to a line.
    if (v.every((x) => Array.isArray(x) && x.length <= 3 && x.every((n) => typeof n === 'number'))) {
      const items = v.map((x) => write(x, ''));
      const lines: string[] = [];
      for (let i = 0; i < items.length; i += 4) lines.push(inner + items.slice(i, i + 4).join(', '));
      return `[\n${lines.join(',\n')}\n${indent}]`;
    }
    return `[\n${v.map((x) => inner + write(x, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return '{}';
  return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${write(x, inner)}`).join(',\n')}\n${indent}}`;
}

/**
 * Reads a map file's text. A file that isn't a map, is for a newer app, or has a map that breaks the rules
 * (`check.ts`) comes back with the reason, for the parent area; it never throws. Fields this version doesn't know
 * are kept as they are, so a newer optional field passes through untouched.
 */
export function parseMapFile(text: string): ParsedMap {
  if (text.length > MAX_MAP_FILE_BYTES) return { ok: false, reason: `It is too big (over ${MAX_MAP_FILE_BYTES / 1024 / 1024} MB).` };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, reason: `It isn't a map file: it isn't valid JSON (${(err as Error).message}).` };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || (raw as { format?: unknown }).format !== MAP_FORMAT) {
    return { ok: false, reason: `It isn't a map file: it needs "format": "${MAP_FORMAT}".` };
  }
  const file = raw as Partial<Record<keyof MapFile, unknown>>;
  const version = file.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, reason: 'It has no format version: it needs "version": 1.' };
  }
  if (version > MAP_FORMAT_VERSION) {
    return {
      ok: false,
      reason: `It was made for a newer version of the app (map format ${version}; this one reads format ${MAP_FORMAT_VERSION}). Update the app.`,
    };
  }
  if (typeof file.name !== 'string' || !file.name.trim() || file.name.length > MAX_NAME) {
    return { ok: false, reason: `It needs a "name" of 1 to ${MAX_NAME} characters.` };
  }
  const problems = shapeProblems(file.map);
  if (problems.length) return { ok: false, reason: problems.join(' ') };
  return { ok: true, name: file.name.trim(), map: file.map as MapDef };
}
