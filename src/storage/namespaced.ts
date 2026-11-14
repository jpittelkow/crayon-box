import type { AppStorage, Backend, GameStorage } from './types';

function checkPath(path: string): void {
  if (path === '' || path.startsWith('/') || path.split('/').some((part) => part === '..' || part === '')) {
    throw new Error(`Bad storage path: "${path}"`);
  }
}

/** A GameStorage that keeps every key under `prefix` in a shared backend. */
export function namespaced(backend: Backend, prefix: string): GameStorage {
  const key = (path: string) => {
    checkPath(path);
    return prefix + path;
  };
  return {
    async getJson<T>(path: string) {
      const value = await backend.get(key(path));
      if (!value) return undefined;
      if (value.kind !== 'json') throw new Error(`Not JSON: ${path}`);
      return JSON.parse(value.json) as T;
    },
    async putJson(path, value) {
      await backend.put(key(path), { kind: 'json', json: JSON.stringify(value) });
    },
    async getBlob(path) {
      const value = await backend.get(key(path));
      if (!value) return undefined;
      if (value.kind !== 'bytes') throw new Error(`Not a file: ${path}`);
      return new Blob([value.bytes], { type: value.type });
    },
    async putBlob(path, blob) {
      // Stored as bytes, not as a Blob, so every backend (and the test double) can keep it.
      const bytes = await blob.arrayBuffer();
      await backend.put(key(path), { kind: 'bytes', type: blob.type, bytes });
    },
    async list(listPrefix) {
      const full = prefix + listPrefix;
      const keys = await backend.keys(full);
      return keys.map((k) => k.slice(prefix.length)).sort();
    },
    async delete(path) {
      await backend.delete(key(path));
    },
  };
}

export function appStorage(backend: Backend): AppStorage {
  return {
    shell: namespaced(backend, 'shell/'),
    game(id: string) {
      if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`Bad game id: "${id}"`);
      return namespaced(backend, `games/${id}/`);
    },
  };
}
