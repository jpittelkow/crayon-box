// Talking to the family sync server (ADR 0024) over its HTTP API (`server/src/api.ts`). The engine only sees
// `SyncApi`, so its tests run against an in-memory server.
import {
  API_VERSIONS,
  type AiModelsResponse,
  type AiPageRequest,
  type ChangesResponse,
  type ConflictResponse,
  type PairResponse,
  type RemoteMeta,
  type ServerInfo,
  type WriteResponse,
} from '../../server/src/api';
import type { StoredValue } from '../storage/types';

export type { RemoteMeta } from '../../server/src/api';

export interface RemoteValue {
  value: StoredValue;
  rev: number;
  modified: number;
}

export type WriteResult = { rev: number } | { conflict: RemoteMeta };

export interface SyncApi {
  info(): Promise<ServerInfo>;
  changes(since: number): Promise<ChangesResponse>;
  /** The item's value now, or null when it is gone. */
  get(key: string): Promise<RemoteValue | null>;
  /** A value, or null for a deletion. */
  write(key: string, value: StoredValue | null, modified: number, base: number, force: boolean): Promise<WriteResult>;
  /**
   * A page made by AI on the server (ADR 0029): the raw image and the model that made it. Problems come back as
   * SyncProblem, in words.
   */
  aiPage(req: AiPageRequest): Promise<AiPageResult>;
  /** The models a parent can pick and the family's favorites (ADR 0032); null from a server too old to have them. */
  aiModels(): Promise<AiModelsResponse | null>;
  /** Saves the family's favorite models on the server; answers with the list it kept. */
  setAiFavorites(ids: string[]): Promise<string[]>;
}

export interface AiPageResult {
  image: Blob;
  /** The OpenRouter model that made it. */
  model?: string;
}

/** A problem a parent can act on, said in words (ADR 0024: the parent area shows problems in words). */
export class SyncProblem extends Error {
  readonly kind: 'unreachable' | 'unpaired' | 'version' | 'server';
  constructor(kind: SyncProblem['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

/** `192.168.1.20:8787` or `http://nas:8787/` → `http://nas:8787`. */
export function normalizeServer(address: string): string {
  let a = address.trim();
  if (!/^https?:\/\//i.test(a)) a = `http://${a}`;
  const url = new URL(a);
  return `${url.protocol}//${url.host}`;
}

async function call(fetchFn: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncProblem('unreachable', 'Can’t reach the family server. Is it on, and is this device on the home network?');
  }
  if (res.status === 401) throw new SyncProblem('unpaired', 'The family server doesn’t know this device any more. Connect it again with the pairing code.');
  return res;
}

async function fail(res: Response): Promise<never> {
  let message = `${res.status}`;
  try {
    message = ((await res.json()) as { error?: string }).error ?? message;
  } catch {
    // not JSON
  }
  throw new SyncProblem('server', `The family server said: ${message}`);
}

/** Checks the server speaks our API version. */
export function checkVersions(info: ServerInfo): void {
  if (info.app !== 'crayon-box-sync') throw new SyncProblem('server', 'That address isn’t a Crayon Box family server.');
  if (!info.versions.some((v) => (API_VERSIONS as readonly number[]).includes(v))) {
    const newer = Math.max(...info.versions) > Math.max(...API_VERSIONS);
    throw new SyncProblem(
      'version',
      newer ? 'The family server is newer than this app. Update the app (Parent area › Updates).' : 'The family server is older than this app. Update the server.',
    );
  }
}

/** Trades the pairing code for a token. */
export async function pairWith(server: string, code: string, device: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const base = normalizeServer(server);
  const info = await call(fetchFn, `${base}/api/v1/info`);
  if (!info.ok) await fail(info);
  checkVersions((await info.json()) as ServerInfo);
  const res = await call(fetchFn, `${base}/api/v1/pair`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, device }),
  });
  if (res.status === 403) throw new SyncProblem('unpaired', 'That pairing code isn’t right. It’s on the server’s page.');
  if (res.status === 429) throw new SyncProblem('server', 'Too many tries. Wait a minute, then try again.');
  if (!res.ok) await fail(res);
  return ((await res.json()) as PairResponse).token;
}

export function httpApi(server: string, token: string, fetchFn: typeof fetch = fetch): SyncApi {
  const base = normalizeServer(server);
  const auth = { authorization: `Bearer ${token}` };
  const itemUrl = (key: string) => `${base}/api/v1/items/${encodeURIComponent(key)}`;
  return {
    async info() {
      const res = await call(fetchFn, `${base}/api/v1/info`);
      if (!res.ok) await fail(res);
      return (await res.json()) as ServerInfo;
    },
    async changes(since) {
      const res = await call(fetchFn, `${base}/api/v1/changes?since=${since}`, { headers: auth });
      if (!res.ok) await fail(res);
      return (await res.json()) as ChangesResponse;
    },
    async get(key) {
      const res = await call(fetchFn, itemUrl(key), { headers: auth });
      if (res.status === 404) return null;
      if (!res.ok) await fail(res);
      const rev = Number(res.headers.get('x-rev'));
      const modified = Number(res.headers.get('x-modified'));
      const value: StoredValue =
        res.headers.get('x-kind') === 'json'
          ? { kind: 'json', json: await res.text() }
          : { kind: 'bytes', type: res.headers.get('content-type') ?? 'application/octet-stream', bytes: await res.arrayBuffer() };
      return { value, rev, modified };
    },
    async write(key, value, modified, baseRev, force) {
      const params = new URLSearchParams({ modified: String(modified), base: String(baseRev) });
      if (force) params.set('force', '1');
      const init: RequestInit = value
        ? {
            method: 'PUT',
            headers: {
              ...auth,
              'x-kind': value.kind,
              'content-type': value.kind === 'json' ? 'application/json' : value.type || 'application/octet-stream',
            },
            body: value.kind === 'json' ? value.json : value.bytes,
          }
        : { method: 'DELETE', headers: auth };
      const res = await call(fetchFn, `${itemUrl(key)}?${params}`, init);
      if (res.status === 409) return { conflict: ((await res.json()) as ConflictResponse).conflict };
      if (!res.ok) await fail(res);
      return { rev: ((await res.json()) as WriteResponse).rev };
    },
    async aiPage(req) {
      const res = await call(fetchFn, `${base}/api/v1/ai/page`, {
        method: 'POST',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) {
        let message = `The family server answered ${res.status}.`;
        try {
          message = ((await res.json()) as { error?: string }).error ?? message;
        } catch {
          // not JSON
        }
        throw new SyncProblem('server', message);
      }
      return { image: await res.blob(), model: res.headers.get('x-ai-model') ?? undefined };
    },
    async aiModels() {
      const res = await call(fetchFn, `${base}/api/v1/ai/models`, { headers: auth });
      if (res.status === 404) return null;
      if (!res.ok) await fail(res);
      return (await res.json()) as AiModelsResponse;
    },
    async setAiFavorites(ids) {
      const res = await call(fetchFn, `${base}/api/v1/ai/favorites`, {
        method: 'PUT',
        headers: { ...auth, 'content-type': 'application/json' },
        body: JSON.stringify({ favorites: ids }),
      });
      if (!res.ok) await fail(res);
      return ((await res.json()) as { favorites: string[] }).favorites;
    },
  };
}
