// The storage interface (ADR 0007, 0012). Milestone 1 backs it with IndexedDB (ADR 0014); the installer will
// back the same interface with files in the app data folder, so game code does not change.

/** One game's private storage. Paths are relative to the game's namespace, e.g. `art/star/<picture>/paint.png`. */
export interface GameStorage {
  getJson<T>(path: string): Promise<T | undefined>;
  putJson(path: string, value: unknown): Promise<void>;
  getBlob(path: string): Promise<Blob | undefined>;
  putBlob(path: string, blob: Blob): Promise<void>;
  /** Paths (relative to the namespace) that start with `prefix`, sorted. */
  list(prefix: string): Promise<string[]>;
  delete(path: string): Promise<void>;
}

/** The app-wide store the shell owns. Each game gets its own namespace and can't reach another's. */
export interface AppStorage {
  /** Shell data: kid profiles and settings. */
  shell: GameStorage;
  game(id: string): GameStorage;
}

/** A raw key-value backend. Values are JSON or bytes; keys are full paths. */
export interface Backend {
  get(key: string): Promise<StoredValue | undefined>;
  put(key: string, value: StoredValue): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export type StoredValue =
  | { kind: 'json'; json: string }
  | { kind: 'bytes'; type: string; bytes: ArrayBuffer };
