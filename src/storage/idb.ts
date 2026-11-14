import type { Backend, StoredValue } from './types';

const DB_NAME = 'crayon-box';
const STORE = 'files';

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
 * IndexedDB backend for the web milestone (ADR 0014). One object store keyed by full path. Each put is its own
 * transaction, which IndexedDB commits atomically, so a crash mid-save never leaves half a picture: this stands
 * in for the temp-file-then-rename of the installed app (ADR 0007).
 */
export async function openIdbBackend(
  factory: IDBFactory = indexedDB,
  keyRange: typeof IDBKeyRange = IDBKeyRange,
  name = DB_NAME,
): Promise<Backend> {
  const open = factory.open(name, 1);
  open.onupgradeneeded = () => {
    open.result.createObjectStore(STORE);
  };
  const db = await request(open);

  return {
    async get(key) {
      const tx = db.transaction(STORE, 'readonly');
      return (await request(tx.objectStore(STORE).get(key))) as StoredValue | undefined;
    },
    async put(key, value) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      await done(tx);
    },
    async keys(prefix) {
      const tx = db.transaction(STORE, 'readonly');
      const range = keyRange.bound(prefix, prefix + '\uffff');
      return (await request(tx.objectStore(STORE).getAllKeys(range))) as string[];
    },
    async delete(key) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      await done(tx);
    },
  };
}

/** In-memory backend, used when IndexedDB can't be opened and by tests. */
export function memoryBackend(): Backend {
  const map = new Map<string, StoredValue>();
  return {
    async get(key) {
      return map.get(key);
    },
    async put(key, value) {
      map.set(key, value);
    },
    async keys(prefix) {
      return [...map.keys()].filter((k) => k.startsWith(prefix));
    },
    async delete(key) {
      map.delete(key);
    },
  };
}
