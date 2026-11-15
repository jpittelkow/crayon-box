// The storage interface (ADR 0007, 0012). Milestone 1 backs it with IndexedDB (ADR 0014); the installer will
// back the same interface with files in the app data folder, so game code does not change. Family sync
// (ADR 0024) sits under this interface too: games save as usual and never know.

export interface PutOptions {
  /**
   * Marks the value as a built-in default rather than something the family chose: a change made on any device,
   * at any time, replaces it when devices sync (ADR 0024).
   */
  asDefault?: boolean;
}

/**
 * One game's private storage. Paths are relative to the game's namespace, e.g. `art/star/<picture>/paint.png`.
 * Everything here syncs between the family's devices, except paths under `local/`, which describe this device
 * only (ADR 0024).
 */
export interface GameStorage {
  getJson<T>(path: string): Promise<T | undefined>;
  putJson(path: string, value: unknown, opts?: PutOptions): Promise<void>;
  getBlob(path: string): Promise<Blob | undefined>;
  putBlob(path: string, blob: Blob, opts?: PutOptions): Promise<void>;
  /** Paths (relative to the namespace) that start with `prefix`, sorted. Deleted items are not listed. */
  list(prefix: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}

/** The app-wide store the shell owns. Each game gets its own namespace and can't reach another's. */
export interface AppStorage {
  /** Shell data: kid profiles and settings. */
  shell: GameStorage;
  game(id: string): GameStorage;
  /** The store underneath, for the sync client (ADR 0024). Games never touch it. */
  backend: Backend;
}

export type StoredValue =
  | { kind: 'json'; json: string }
  | { kind: 'bytes'; type: string; bytes: ArrayBuffer };

/** What sync needs to know about one stored item (ADR 0024). */
export interface ItemMeta {
  /**
   * When the item last changed, on whichever device changed it, in milliseconds since 1970. 0 marks a built-in
   * default, which any real change beats.
   */
  modified: number;
  /** The item was deleted. The record stays, so the deletion reaches the other devices. */
  deleted?: true;
  /** The server revision this state matches. Absent while a change made here is waiting to be sent. */
  rev?: number;
}

export interface Change {
  key: string;
  meta: ItemMeta;
}

/** A raw key-value backend. Values are JSON or bytes; keys are full paths. */
export interface Backend {
  get(key: string): Promise<StoredValue | undefined>;
  put(key: string, value: StoredValue, opts?: PutOptions): Promise<void>;
  /** Keys of live items that start with `prefix`. */
  keys(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;

  // ---- For the sync client (ADR 0024) ----
  meta(key: string): Promise<ItemMeta | undefined>;
  /** Every synced item, deleted ones included, with its change record. Device-only items are left out. */
  changes(prefix?: string): Promise<Change[]>;
  /** Stores what another device changed (a value, or null for a deletion) without counting it as a change here. */
  applyRemote(key: string, value: StoredValue | null, meta: { modified: number; rev: number }): Promise<void>;
  /** The server took our change. Ignored if the item has changed again since `modified`. */
  markSynced(key: string, modified: number, rev: number): Promise<void>;
}

/** Device-only keys: a `local/` folder at the top of the shell's or a game's namespace (ADR 0024). */
export function isDeviceOnly(key: string): boolean {
  return /^(shell|games\/[^/]+)\/local\//.test(key);
}
