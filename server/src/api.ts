// The family sync API, version 1 (ADR 0024). Shared by the server and the app's sync client, so both sides agree
// on the shapes. Plain types only (no code), so the app can import this file without pulling in the server.
//
//   GET    /api/v1/info                       no token: who this is and which API versions it speaks
//   POST   /api/v1/pair     { code, device }  no token: trade the pairing code for a token
//   GET    /api/v1/changes?since=<rev>        what changed after a revision (metadata only), oldest first
//   GET    /api/v1/items/<key>                one item's value; X-Rev, X-Modified headers
//   PUT    /api/v1/items/<key>?modified=&base=[&force=1]   store a value (JSON or bytes)
//   DELETE /api/v1/items/<key>?modified=&base=[&force=1]   remember a deletion
//   POST   /api/v1/ai/page  AiPageRequest      a coloring page made by AI (ADR 0029); answers with the image
//   GET    /api/v1/ai/models                  the models a parent can pick from, and the favorites (ADR 0032)
//   PUT    /api/v1/ai/favorites { favorites } the family's favorite models (ADR 0032)
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
  /** Present when AI pages are set up on the server (ADR 0029). */
  ai?: AiInfo;
}

export interface AiInfo {
  imageModel: string;
  drawModel: string;
  dailyLimit: number;
  usedToday: number;
}

export type Detail = 'simple' | 'more';

/**
 * What to make (ADR 0029): from a photo (a data URL), from an idea, or drawn as SVG from an idea. `model` picks an
 * OpenRouter model from the list (ADR 0032); without it the server's setting for that way is used.
 */
export type AiPageRequest =
  | { kind: 'photo'; image: string; detail: Detail; model?: string }
  | { kind: 'idea'; idea: string; detail: Detail; model?: string }
  | { kind: 'draw'; idea: string; detail: Detail; model?: string };

/** The ways of making a page; a model can do some of them (ADR 0032). */
export type AiWay = AiPageRequest['kind'];

/** One model a parent can pick (ADR 0032). */
export interface AiModel {
  /** OpenRouter's id, e.g. `google/gemini-2.5-flash-image`. */
  id: string;
  name: string;
  ways: AiWay[];
  /** What it gives back, as OpenRouter lists it: `image`, `text`. */
  output: string[];
  /** A short price, e.g. `$0.04 an image` or `free`; absent when unclear. */
  price?: string;
}

export interface AiModelsResponse {
  models: AiModel[];
  /** The family's favorite model ids, in the order they were starred. */
  favorites: string[];
  /** The server's settings, used when a request names no model. */
  defaults: { image: string; draw: string };
  /** When the list was fetched from OpenRouter, ms since 1970; 0 when it never was. */
  fetched: number;
  /** Why the list is empty or old, in words. */
  problem?: string;
}

export interface AiFavoritesRequest {
  favorites: string[];
}

/** The most favorites the server keeps. */
export const MAX_FAVORITES = 30;

/** An OpenRouter model id: `maker/model`, maybe with a `:variant`. */
export function validModelId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 200 && /^[\w.-]+\/[\w.:-]+$/.test(id);
}

/** The longest idea text the server takes. */
export const MAX_IDEA = 300;

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
