import { isDeviceOnly, localChange, synced, type Backend, type Change, type ItemMeta, type PutOptions, type StoredValue } from './types';

const DB_NAME = 'crayon-box';
const DB_VERSION = 2;
/** Live values, keyed by full path. */
const FILES = 'files';
/** One change record per synced path, kept after a deletion too (ADR 0024). */
const META = 'meta';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

/**
 * The change time for a write made now. Always later than the item's previous change, even if the clock stood
 * still or stepped back, so "has this changed since?" can be answered by comparing times.
 */
function nextModified(prev: ItemMeta | undefined, now: number): number {
  return prev ? Math.max(now, prev.modified + 1) : now;
}

export interface IdbOptions {
  factory?: IDBFactory;
  keyRange?: typeof IDBKeyRange;
  name?: string;
  now?: () => number;
}

/**
 * IndexedDB backend for the web milestone (ADR 0014). A value and its change record are written in one
 * transaction, which IndexedDB commits atomically, so a crash mid-save never leaves half a picture: this stands
 * in for the temp-file-then-rename of the installed app (ADR 0007).
 */
export async function openIdbBackend(opts: IdbOptions = {}): Promise<Backend> {
  const factory = opts.factory ?? indexedDB;
  const keyRange = opts.keyRange ?? IDBKeyRange;
  const now = opts.now ?? Date.now;

  const open = factory.open(opts.name ?? DB_NAME, DB_VERSION);
  open.onupgradeneeded = (e) => {
    const db = open.result;
    if (e.oldVersion < 1) db.createObjectStore(FILES);
    if (e.oldVersion < 2) {
      const meta = db.createObjectStore(META);
      if (e.oldVersion === 1) {
        // Items saved before change records existed all count as changed at the moment of the upgrade.
        const keys = open.transaction!.objectStore(FILES).getAllKeys();
        keys.onsuccess = () => {
          const stamp = now();
          for (const key of keys.result as string[]) {
            if (!isDeviceOnly(key)) meta.put({ modified: stamp } satisfies ItemMeta, key);
          }
        };
      }
    }
  };
  const db = await request(open);
  const range = (prefix: string) => keyRange.bound(prefix, prefix + '\uffff');

  return {
    async get(key) {
      const tx = db.transaction(FILES, 'readonly');
      return (await request(tx.objectStore(FILES).get(key))) as StoredValue | undefined;
    },
    async put(key, value, putOpts?: PutOptions) {
      const tx = db.transaction([FILES, META], 'readwrite');
      tx.objectStore(FILES).put(value, key);
      if (!isDeviceOnly(key)) {
        const metas = tx.objectStore(META);
        const prev = metas.get(key);
        prev.onsuccess = () => {
          const before = prev.result as ItemMeta | undefined;
          const modified = putOpts?.asDefault ? 0 : nextModified(before, now());
          metas.put(localChange(before, modified), key);
        };
      }
      await done(tx);
    },
    async keys(prefix) {
      const tx = db.transaction(FILES, 'readonly');
      return (await request(tx.objectStore(FILES).getAllKeys(range(prefix)))) as string[];
    },
    async delete(key) {
      const tx = db.transaction([FILES, META], 'readwrite');
      tx.objectStore(FILES).delete(key);
      if (!isDeviceOnly(key)) {
        const metas = tx.objectStore(META);
        const prev = metas.get(key);
        prev.onsuccess = () => {
          const meta = prev.result as ItemMeta | undefined;
          // Something that never existed, or is already deleted, leaves no new record.
          if (meta && !meta.deleted) {
            metas.put(localChange(meta, nextModified(meta, now()), true), key);
          }
        };
      }
      await done(tx);
    },

    async meta(key) {
      const tx = db.transaction(META, 'readonly');
      return (await request(tx.objectStore(META).get(key))) as ItemMeta | undefined;
    },
    async changes(prefix = '') {
      const tx = db.transaction(META, 'readonly');
      const store = tx.objectStore(META);
      const [keys, metas] = await Promise.all([
        request(store.getAllKeys(range(prefix))) as Promise<string[]>,
        request(store.getAll(range(prefix))) as Promise<ItemMeta[]>,
      ]);
      return keys.map((key, i): Change => ({ key, meta: metas[i] }));
    },
    async applyRemote(key, value, meta) {
      if (isDeviceOnly(key)) return;
      const tx = db.transaction([FILES, META], 'readwrite');
      if (value) tx.objectStore(FILES).put(value, key);
      else tx.objectStore(FILES).delete(key);
      const record: ItemMeta = { modified: meta.modified, rev: meta.rev, ...(value ? {} : { deleted: true }) };
      tx.objectStore(META).put(record, key);
      await done(tx);
    },
    async markSynced(key, modified, rev) {
      const tx = db.transaction(META, 'readwrite');
      const metas = tx.objectStore(META);
      const prev = metas.get(key);
      prev.onsuccess = () => {
        const meta = prev.result as ItemMeta | undefined;
        if (meta && meta.modified === modified) metas.put(synced(meta, rev), key);
      };
      await done(tx);
    },
  };
}

/** In-memory backend with the same rules, used when IndexedDB can't be opened and by tests. */
export function memoryBackend(now: () => number = Date.now): Backend {
  const files = new Map<string, StoredValue>();
  const metas = new Map<string, ItemMeta>();
  return {
    async get(key) {
      return files.get(key);
    },
    async put(key, value, putOpts?: PutOptions) {
      files.set(key, value);
      if (!isDeviceOnly(key)) {
        const before = metas.get(key);
        metas.set(key, localChange(before, putOpts?.asDefault ? 0 : nextModified(before, now())));
      }
    },
    async keys(prefix) {
      return [...files.keys()].filter((k) => k.startsWith(prefix)).sort();
    },
    async delete(key) {
      files.delete(key);
      const meta = metas.get(key);
      if (meta && !meta.deleted) metas.set(key, localChange(meta, nextModified(meta, now()), true));
    },
    async meta(key) {
      return metas.get(key);
    },
    async changes(prefix = '') {
      return [...metas.entries()]
        .filter(([k]) => k.startsWith(prefix))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, meta]) => ({ key, meta }));
    },
    async applyRemote(key, value, meta) {
      if (isDeviceOnly(key)) return;
      if (value) files.set(key, value);
      else files.delete(key);
      metas.set(key, { modified: meta.modified, rev: meta.rev, ...(value ? {} : { deleted: true as const }) });
    },
    async markSynced(key, modified, rev) {
      const meta = metas.get(key);
      if (meta && meta.modified === modified) metas.set(key, synced(meta, rev));
    },
  };
}
