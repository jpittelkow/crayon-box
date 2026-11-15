// The installed app's storage backend (milestone 2, phase B; ADR 0007): every stored item is a file under the
// app data folder, written to a temp file and then renamed over the old one, so a crash mid-save never leaves half
// a picture. The change records for sync (ADR 0024) and each item's kind live in one small index file next to the
// items, written the same way.
//
// The file system itself is behind `FileSystem`, so the same code runs on Tauri's fs plugin in the Windows app
// (`shell/tauriFiles.ts`) and on `memoryFs` in the unit tests.
import { isDeviceOnly, type Backend, type Change, type ItemMeta, type PutOptions, type StoredValue } from './types';

/** The few file operations the backend needs. Paths are relative to the store's folder and use `/`. */
export interface FileSystem {
  /** The file's bytes, or undefined when there is no such file. */
  read(path: string): Promise<Uint8Array | undefined>;
  write(path: string, data: Uint8Array): Promise<void>;
  /** Moves `from` to `to`, replacing `to` if it exists. */
  rename(from: string, to: string): Promise<void>;
  /** Removes a file; a missing file is not an error. */
  remove(path: string): Promise<void>;
  /** Makes a folder and any missing parents; an existing folder is not an error. */
  mkdir(path: string): Promise<void>;
  /** Every file under `dir`, at any depth, as paths relative to `dir`. Empty when `dir` doesn't exist. */
  listFiles(dir: string): Promise<string[]>;
}

const ITEMS = 'items';
const TMP = 'tmp';
const INDEX = 'index.json';
const INDEX_VERSION = 1;

/** What the index knows about one key. */
interface Entry {
  /** Present while the item exists: what kind of value its file holds. */
  value?: { kind: 'json' } | { kind: 'bytes'; type: string };
  /** The sync change record (ADR 0024). Absent for device-only keys. */
  meta?: ItemMeta;
}

interface IndexFile {
  version: number;
  items: Record<string, Entry>;
}

// ---- Key to file name ----

const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/;

function encodeSegment(segment: string): string {
  // Windows file names ignore case, so capitals are escaped too: `A.png` and `a.png` must not land on one file.
  let out = '';
  for (const ch of segment) {
    if (/[a-z0-9._-]/.test(ch)) out += ch;
    else for (const byte of new TextEncoder().encode(ch)) out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  // Names Windows refuses: device names, and a name ending in a dot.
  if (RESERVED.test(out)) out = '%' + out.charCodeAt(0).toString(16).toUpperCase() + out.slice(1);
  if (out.endsWith('.')) out = out.slice(0, -1) + '%2E';
  return out;
}

/** The file that holds `key`, relative to the items folder. Each `/` in the key is a folder. */
export function keyToFile(key: string): string {
  return key.split('/').map(encodeSegment).join('/');
}

/** The key a file under the items folder holds; the inverse of `keyToFile`. */
export function fileToKey(file: string): string {
  return file.split('/').map((s) => decodeURIComponent(s)).join('/');
}

function nextModified(prev: ItemMeta | undefined, now: number): number {
  return prev ? Math.max(now, prev.modified + 1) : now;
}

/** What a file found on disk without an index entry most likely holds. */
function guessValue(key: string): NonNullable<Entry['value']> {
  if (key.endsWith('.json')) return { kind: 'json' };
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
  return { kind: 'bytes', type: types[ext] ?? 'application/octet-stream' };
}

const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

export interface FileBackendOptions {
  now?: () => number;
}

/**
 * Opens the store in `fs`. On opening, the index is checked against the files on disk, which mends the one gap
 * a crash can leave (a value renamed into place, the index not yet written): such a file counts as changed now.
 */
export async function openFileBackend(fs: FileSystem, opts: FileBackendOptions = {}): Promise<Backend> {
  const now = opts.now ?? Date.now;
  const items = new Map<string, Entry>();

  const indexBytes = await fs.read(INDEX);
  let indexChanged = false;
  if (indexBytes) {
    try {
      const parsed = JSON.parse(fromUtf8.decode(indexBytes)) as IndexFile;
      for (const [key, entry] of Object.entries(parsed.items ?? {})) items.set(key, entry);
    } catch (err) {
      // A broken index is rebuilt from the files; their change records restart from now.
      console.error('Storage index unreadable; rebuilding it from the files', err);
      indexChanged = true;
    }
  }

  // Leftover temp files are from a write that never finished; the old file is still whole.
  for (const file of await fs.listFiles(TMP)) await fs.remove(`${TMP}/${file}`);

  const onDisk = new Set<string>();
  for (const file of await fs.listFiles(ITEMS)) {
    try {
      onDisk.add(fileToKey(file));
    } catch {
      // A file this app didn't name (dropped in by hand) is left alone.
    }
  }
  const stamp = now();
  for (const key of onDisk) {
    const entry = items.get(key);
    if (entry?.value) continue;
    const meta = isDeviceOnly(key) ? undefined : { modified: nextModified(entry?.meta, stamp) };
    items.set(key, { value: guessValue(key), ...(meta ? { meta } : {}) });
    indexChanged = true;
  }
  for (const [key, entry] of items) {
    if (!entry.value || onDisk.has(key)) continue;
    // The index says it exists but its file is gone (removed by hand): treat it as deleted here.
    if (entry.meta) items.set(key, { meta: { modified: nextModified(entry.meta, stamp), deleted: true } });
    else items.delete(key);
    indexChanged = true;
  }

  // Every change goes through this queue, one at a time, so the index is never written by two changes at once.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };

  const madeDirs = new Set<string>();
  async function ensureDir(dir: string): Promise<void> {
    if (madeDirs.has(dir)) return;
    await fs.mkdir(dir);
    madeDirs.add(dir);
  }

  let tmpCounter = 0;
  /** Writes `data` to `path` through a temp file, so `path` is always either the old file or the new one. */
  async function writeAtomic(path: string, data: Uint8Array): Promise<void> {
    await ensureDir(TMP);
    const slash = path.lastIndexOf('/');
    if (slash > 0) await ensureDir(path.slice(0, slash));
    const tmp = `${TMP}/${Date.now().toString(36)}-${tmpCounter++}`;
    await fs.write(tmp, data);
    try {
      await fs.rename(tmp, path);
    } catch (err) {
      await fs.remove(tmp).catch(() => {});
      throw err;
    }
  }

  async function saveIndex(): Promise<void> {
    const file: IndexFile = { version: INDEX_VERSION, items: Object.fromEntries(items) };
    await writeAtomic(INDEX, utf8.encode(JSON.stringify(file)));
  }

  if (indexChanged) await saveIndex();

  const itemPath = (key: string) => `${ITEMS}/${keyToFile(key)}`;

  /** Applies an index change, saves it, and puts the old entry back if saving fails. */
  async function commit(key: string, next: Entry | undefined): Promise<void> {
    const prev = items.get(key);
    if (next) items.set(key, next);
    else items.delete(key);
    try {
      await saveIndex();
    } catch (err) {
      if (prev) items.set(key, prev);
      else items.delete(key);
      throw err;
    }
  }

  function encode(value: StoredValue): { data: Uint8Array; kind: NonNullable<Entry['value']> } {
    if (value.kind === 'json') return { data: utf8.encode(value.json), kind: { kind: 'json' } };
    return { data: new Uint8Array(value.bytes), kind: { kind: 'bytes', type: value.type } };
  }

  return {
    async get(key) {
      // Wait for changes already asked for, so a read right after a write sees it.
      await queue;
      const entry = items.get(key);
      if (!entry?.value) return undefined;
      const data = await fs.read(itemPath(key));
      if (!data) return undefined;
      if (entry.value.kind === 'json') return { kind: 'json', json: fromUtf8.decode(data) };
      const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      return { kind: 'bytes', type: entry.value.type, bytes };
    },
    put(key, value, putOpts?: PutOptions) {
      return serial(async () => {
        const { data, kind } = encode(value);
        await writeAtomic(itemPath(key), data);
        const prev = items.get(key);
        const meta = isDeviceOnly(key)
          ? undefined
          : { modified: putOpts?.asDefault ? 0 : nextModified(prev?.meta, now()) };
        await commit(key, { value: kind, ...(meta ? { meta } : {}) });
      });
    },
    async keys(prefix) {
      await queue;
      return [...items.entries()]
        .filter(([k, e]) => e.value && k.startsWith(prefix))
        .map(([k]) => k)
        .sort();
    },
    delete(key) {
      return serial(async () => {
        const prev = items.get(key);
        if (!prev) return;
        await fs.remove(itemPath(key));
        if (!prev.meta) return commit(key, undefined);
        // Something already deleted leaves no new record.
        if (prev.meta.deleted) return;
        await commit(key, { meta: { modified: nextModified(prev.meta, now()), deleted: true } });
      });
    },

    async meta(key) {
      await queue;
      return items.get(key)?.meta;
    },
    async changes(prefix = '') {
      await queue;
      return [...items.entries()]
        .filter(([k, e]) => e.meta && k.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, e]): Change => ({ key, meta: e.meta! }));
    },
    applyRemote(key, value, meta) {
      if (isDeviceOnly(key)) return Promise.resolve();
      return serial(async () => {
        if (value) {
          const { data, kind } = encode(value);
          await writeAtomic(itemPath(key), data);
          await commit(key, { value: kind, meta: { modified: meta.modified, rev: meta.rev } });
        } else {
          await fs.remove(itemPath(key));
          await commit(key, { meta: { modified: meta.modified, rev: meta.rev, deleted: true } });
        }
      });
    },
    markSynced(key, modified, rev) {
      return serial(async () => {
        const entry = items.get(key);
        if (!entry?.meta || entry.meta.modified !== modified) return;
        await commit(key, { ...entry, meta: { ...entry.meta, rev } });
      });
    },
  };
}

/** A FileSystem kept in memory, for tests. `files` is exposed so tests can look at or break what's "on disk". */
export function memoryFs(): FileSystem & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async read(path) {
      const data = files.get(path);
      return data && new Uint8Array(data);
    },
    async write(path, data) {
      files.set(path, new Uint8Array(data));
    },
    async rename(from, to) {
      const data = files.get(from);
      if (!data) throw new Error(`No such file: ${from}`);
      files.delete(from);
      files.set(to, data);
    },
    async remove(path) {
      files.delete(path);
    },
    async mkdir() {},
    async listFiles(dir) {
      const prefix = dir + '/';
      return [...files.keys()].filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length));
    },
  };
}
