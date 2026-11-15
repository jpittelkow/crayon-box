// The family sync API, version 1 (ADR 0024). Shared by the server and the app's sync client, so both sides agree
// on the shapes. Plain types only (no code), so the app can import this file without pulling in the server.
//
//   GET    /api/v1/info                       no token: who this is and which API versions it speaks
//   POST   /api/v1/pair     { code, device }  no token: trade the pairing code for a token
//   GET    /api/v1/changes?since=<rev>        what changed after a revision (metadata only), oldest first
//   GET    /api/v1/items/<key>                one item's value; X-Rev, X-Modified headers
//   PUT    /api/v1/items/<key>?modified=&base=[&force=1]   store a value (JSON or bytes)
//   DELETE /api/v1/items/<key>?modified=&base=[&force=1]   remember a deletion
//
// Every request but info and pair carries `Authorization: Bearer <token>`. A write names the revision its change
// was based on (`base`, 0 for "never seen"); when the server's copy has moved on since, it answers 409 with that
// copy's meta and the client decides (newest change wins, pictures are kept both ways). `force=1` overwrites.

export const API_VERSIONS = [1] as const;

export interface ServerInfo {
  app: 'crayon-box-sync';
  /** API versions this server speaks. */
  versions: number[];
  /** The server's own version (its package version). */
  server: string;
  /** The newest revision on the server. */
  rev: number;
}

export interface PairRequest {
  code: string;
  /** The device's random id (`local/device.json`), never a name. */
  device: string;
}

export interface PairResponse {
  token: string;
}

/** One item's state on the server. */
export interface RemoteMeta {
  key: string;
  rev: number;
  /** When the item last changed on the device that changed it, ms since 1970; 0 is a built-in default. */
  modified: number;
  deleted?: true;
  /** For live items: JSON, or bytes with a media type. */
  kind?: 'json' | 'bytes';
  type?: string;
  size?: number;
}

export interface ChangesResponse {
  /** The newest revision on the server; ask from here next time once `more` is false. */
  rev: number;
  changes: RemoteMeta[];
  /** More changes wait after the last one returned: ask again with `since` set to its rev. */
  more: boolean;
}

export interface WriteResponse {
  rev: number;
}

/** 409's body: the server's copy, which moved on since the change's base. */
export interface ConflictResponse {
  conflict: RemoteMeta;
}

export interface ErrorResponse {
  error: string;
}

/** Keys the server refuses: device-only paths (ADR 0024) and anything that isn't a plain relative path. */
export function validKey(key: string): boolean {
  if (key.length === 0 || key.length > 400) return false;
  // Keys are only ever database rows on the server (values are stored by revision), so the rule is about shape:
  // a namespace, then printable path parts, no backslashes.
  if (!/^(shell|games\/[^/]+)\/[^\x00-\x1f\\]+$/.test(key)) return false;
  if (/^(shell|games\/[^/]+)\/local\//.test(key)) return false;
  return !key.split('/').some((part) => part === '' || part === '.' || part === '..');
}
