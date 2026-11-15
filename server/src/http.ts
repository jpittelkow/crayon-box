// The sync server's HTTP side (ADR 0024): the /api/v1 routes in api.ts, and one status page at /.
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_VERSIONS,
  validKey,
  type ChangesResponse,
  type ConflictResponse,
  type PairRequest,
  type PairResponse,
  type ServerInfo,
  type WriteResponse,
} from './api.ts';
import type { Store } from './store.ts';

export interface ServerOptions {
  store: Store;
  version: string;
  /** A fixed pairing code from the environment, instead of the one the server made. */
  pairingCode?: string;
  /** Largest request body, in bytes. */
  maxBody?: number;
  now?: () => number;
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY = 64 * 1024 * 1024;
/** Pairing tries allowed per minute, across all devices: enough for a parent, too few to guess a code. */
const PAIR_TRIES_PER_MINUTE = 10;

/**
 * The app's pages come from their own origin (`http://tauri.localhost` in the Windows app, `localhost` on the dev
 * machine), so the API has to allow cross-origin calls. Any origin is fine: there are no cookies, and every call
 * but info and pair needs the token.
 */
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, x-kind',
  'access-control-expose-headers': 'x-rev, x-modified, x-kind',
  'access-control-max-age': '600',
};

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...headers });
  res.end(text);
}

async function readBody(req: IncomingMessage, max: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > max) throw new HttpError(413, 'Too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function intParam(url: URL, name: string, required = true): number {
  const raw = url.searchParams.get(name);
  if (raw === null) {
    if (required) throw new HttpError(400, `Missing ${name}`);
    return 0;
  }
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0) throw new HttpError(400, `Bad ${name}`);
  return n;
}

export function handler(opts: ServerOptions): (req: IncomingMessage, res: ServerResponse) => void {
  const { store } = opts;
  const now = opts.now ?? Date.now;
  const maxBody = opts.maxBody ?? MAX_BODY;
  let pairWindow = { start: 0, tries: 0 };

  const code = () => store.pairingCode(opts.pairingCode);

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://server');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'OPTIONS' && path.startsWith('/api/')) {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    if (path === '/' && method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(statusPage(opts, code()));
      return;
    }
    if (path === '/api/v1/info' && method === 'GET') {
      const info: ServerInfo = { app: 'crayon-box-sync', versions: [...API_VERSIONS], server: opts.version, rev: store.rev };
      return send(res, 200, info);
    }
    if (path === '/api/v1/pair' && method === 'POST') {
      const t = now();
      if (t - pairWindow.start > 60_000) pairWindow = { start: t, tries: 0 };
      if (++pairWindow.tries > PAIR_TRIES_PER_MINUTE) throw new HttpError(429, 'Too many tries; wait a minute');
      let body: PairRequest;
      try {
        body = JSON.parse((await readBody(req, 4096)).toString('utf8')) as PairRequest;
      } catch {
        throw new HttpError(400, 'Expected JSON');
      }
      if (typeof body.code !== 'string' || typeof body.device !== 'string' || !body.device) throw new HttpError(400, 'Expected code and device');
      const token = store.pair(body.code, code(), body.device, t);
      if (!token) throw new HttpError(403, 'Wrong pairing code');
      const out: PairResponse = { token };
      return send(res, 200, out);
    }

    if (!path.startsWith('/api/v1/')) throw new HttpError(404, 'Not found');
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token || !store.authorize(token, now())) throw new HttpError(401, 'Pair this device first');

    if (path === '/api/v1/changes' && method === 'GET') {
      const since = intParam(url, 'since', false);
      const limit = Math.min(1000, Math.max(1, url.searchParams.has('limit') ? intParam(url, 'limit') : 500));
      const { changes, more } = store.changes(since, limit);
      const out: ChangesResponse = { rev: store.rev, changes, more };
      return send(res, 200, out);
    }

    if (path.startsWith('/api/v1/items/')) {
      let key: string;
      try {
        key = decodeURIComponent(path.slice('/api/v1/items/'.length));
      } catch {
        throw new HttpError(400, 'Bad key');
      }
      if (!validKey(key)) throw new HttpError(400, 'Bad key');

      if (method === 'GET') {
        const item = store.get(key);
        if (!item) {
          const meta = store.meta(key);
          return send(res, 404, { error: meta?.deleted ? 'Deleted' : 'Not found' });
        }
        const headers = { ...CORS, 'x-rev': String(item.meta.rev), 'x-modified': String(item.meta.modified), 'cache-control': 'no-store' };
        if (item.json !== undefined) {
          res.writeHead(200, { ...headers, 'content-type': 'application/json; charset=utf-8', 'x-kind': 'json' });
          res.end(item.json);
        } else {
          res.writeHead(200, { ...headers, 'content-type': item.meta.type ?? 'application/octet-stream', 'x-kind': 'bytes' });
          res.end(item.bytes);
        }
        return;
      }

      if (method === 'PUT' || method === 'DELETE') {
        const modified = intParam(url, 'modified');
        const base = intParam(url, 'base');
        const force = url.searchParams.get('force') === '1';
        let value: Parameters<Store['write']>[0]['value'];
        if (method === 'PUT') {
          const body = await readBody(req, maxBody);
          const type = (req.headers['content-type'] ?? '').split(';')[0].trim();
          if (req.headers['x-kind'] === 'json' || type === 'application/json') {
            const json = body.toString('utf8');
            try {
              JSON.parse(json);
            } catch {
              throw new HttpError(400, 'Not JSON');
            }
            value = { kind: 'json', json };
          } else {
            value = { kind: 'bytes', type: type || 'application/octet-stream', bytes: body };
          }
        }
        const result = store.write({ key, modified, base, force, value });
        if (!result.ok) {
          const out: ConflictResponse = { conflict: result.conflict };
          return send(res, 409, out);
        }
        const out: WriteResponse = { rev: result.rev };
        return send(res, 200, out);
      }
    }
    throw new HttpError(404, 'Not found');
  }

  return (req, res) => {
    route(req, res).catch((err: unknown) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error(err);
      send(res, 500, { error: 'Server error' });
    });
  };
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function when(ms: number | null): string {
  return ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'never';
}

/** The one status page: is it running, the pairing code, what it holds. */
function statusPage(opts: ServerOptions, code: string): string {
  const s = opts.store.stats();
  const devices = opts.store.devices();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Crayon Box sync</title><style>
body{font:17px/1.5 system-ui,sans-serif;margin:0;background:#f1f3f6;color:#23201c}
main{max-width:640px;margin:0 auto;padding:32px 16px}
h1{font-size:28px;margin:0 0 4px}.card{background:#fff;border:1px solid #d3d9e0;border-radius:16px;padding:20px 24px;margin:16px 0}
.code{font:700 34px/1.2 ui-monospace,monospace;letter-spacing:4px}.muted{color:#5a6472;font-size:15px}
table{border-collapse:collapse;width:100%}td{padding:4px 0}td+td{text-align:right}
</style></head><body><main>
<h1>Crayon Box sync</h1><p class="muted">Server ${escape(opts.version)}, API ${API_VERSIONS.join(', ')}. Running.</p>
<div class="card"><h2>Pairing code</h2><p class="code">${escape(code)}</p>
<p class="muted">In the app: Parent area › Family sync. Enter this server's address and this code once per device.</p></div>
<div class="card"><h2>What it holds</h2><table>
<tr><td>Items</td><td>${s.items}</td></tr><tr><td>Remembered deletions</td><td>${s.deleted}</td></tr>
<tr><td>Pictures and photos on disk</td><td>${size(s.bytes)}</td></tr><tr><td>Last change</td><td>${when(s.lastChange)}</td></tr>
<tr><td>Revision</td><td>${opts.store.rev}</td></tr><tr><td>Paired devices</td><td>${devices.length}</td></tr>
</table><p class="muted">Back up the data folder (Unraid: include it in the appdata backup). Keep this server on the home network only.</p></div>
</main></body></html>`;
}
