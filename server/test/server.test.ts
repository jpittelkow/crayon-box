// The sync server end to end: a real HTTP server on a free port, a fresh data folder per test.
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { ChangesResponse, ConflictResponse, ServerInfo, WriteResponse } from '../src/api.ts';
import { validKey } from '../src/api.ts';
import { handler } from '../src/http.ts';
import { Store, newPairingCode } from '../src/store.ts';

let dir: string;
let store: Store;
let server: Server;
let base: string;
let clock = 1_000;

async function start(opts: { pairingCode?: string } = {}): Promise<void> {
  store = Store.open(dir);
  server = createServer(handler({ store, version: '1.0.0-test', now: () => clock, ...opts }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function stop(): Promise<void> {
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cb-sync-'));
  clock = 1_000;
  await start({ pairingCode: 'ABCD-EFGH' });
});

afterEach(async () => {
  await stop();
  rmSync(dir, { recursive: true, force: true });
});

async function pair(device = 'dev-1'): Promise<string> {
  const res = await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'abcd-efgh', device }) });
  assert.equal(res.status, 200);
  return ((await res.json()) as { token: string }).token;
}

const item = (key: string) => `${base}/api/v1/items/${encodeURIComponent(key)}`;

async function put(token: string, key: string, value: unknown, q: { modified: number; base: number; force?: boolean }, type?: string) {
  const isBytes = value instanceof Uint8Array;
  const params = new URLSearchParams({ modified: String(q.modified), base: String(q.base), ...(q.force ? { force: '1' } : {}) });
  return fetch(`${item(key)}?${params}`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': isBytes ? (type ?? 'image/png') : 'application/json',
      'x-kind': isBytes ? 'bytes' : 'json',
    },
    body: isBytes ? value : JSON.stringify(value),
  });
}

async function del(token: string, key: string, q: { modified: number; base: number; force?: boolean }) {
  const params = new URLSearchParams({ modified: String(q.modified), base: String(q.base), ...(q.force ? { force: '1' } : {}) });
  return fetch(`${item(key)}?${params}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
}

async function changes(token: string, since = 0, limit?: number): Promise<ChangesResponse> {
  const res = await fetch(`${base}/api/v1/changes?since=${since}${limit ? `&limit=${limit}` : ''}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  return (await res.json()) as ChangesResponse;
}

describe('sync server (ADR 0024)', () => {
  it('says who it is without a token', async () => {
    const info = (await (await fetch(`${base}/api/v1/info`)).json()) as ServerInfo;
    assert.deepEqual(info, { app: 'crayon-box-sync', versions: [1], server: '1.0.0-test', rev: 0 });
  });

  it('pairs with the right code only, and wants a token for everything else', async () => {
    const wrong = await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'XXXX-XXXX', device: 'd' }) });
    assert.equal(wrong.status, 403);
    assert.equal((await fetch(`${base}/api/v1/changes`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/changes`, { headers: { authorization: 'Bearer nope' } })).status, 401);
    const token = await pair();
    assert.equal(token.length, 64);
    assert.equal((await changes(token)).rev, 0);
    assert.deepEqual(store.devices().map((d) => d.device), ['dev-1']);
  });

  it('limits pairing tries to stop guessing', async () => {
    for (let i = 0; i < 10; i++) {
      await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'XXXX-XXXX', device: 'd' }) });
    }
    const blocked = await fetch(`${base}/api/v1/pair`, { method: 'POST', body: JSON.stringify({ code: 'ABCD-EFGH', device: 'd' }) });
    assert.equal(blocked.status, 429);
    clock += 61_000;
    assert.ok(await pair());
  });

  it('stores JSON and bytes, and hands out a revision per change', async () => {
    const t = await pair();
    const a = await put(t, 'shell/settings.json', { showNames: true }, { modified: 5, base: 0 });
    assert.equal(((await a.json()) as WriteResponse).rev, 1);
    const png = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const b = await put(t, 'games/coloring/art/star/p1/paint.png', png, { modified: 6, base: 0 });
    assert.equal(((await b.json()) as WriteResponse).rev, 2);

    const j = await fetch(item('shell/settings.json'), { headers: { authorization: `Bearer ${t}` } });
    assert.equal(j.headers.get('x-kind'), 'json');
    assert.equal(j.headers.get('x-rev'), '1');
    assert.equal(j.headers.get('x-modified'), '5');
    assert.deepEqual(await j.json(), { showNames: true });
    const p = await fetch(item('games/coloring/art/star/p1/paint.png'), { headers: { authorization: `Bearer ${t}` } });
    assert.equal(p.headers.get('content-type'), 'image/png');
    assert.deepEqual(new Uint8Array(await p.arrayBuffer()), png);

    const c = await changes(t);
    assert.equal(c.rev, 2);
    assert.deepEqual(
      c.changes.map((m) => [m.key, m.rev, m.modified, m.kind, m.size]),
      [
        ['shell/settings.json', 1, 5, 'json', 18],
        ['games/coloring/art/star/p1/paint.png', 2, 6, 'bytes', 7],
      ],
    );
    assert.deepEqual((await changes(t, 1)).changes.map((m) => m.rev), [2]);
  });

  it('pages through many changes', async () => {
    const t = await pair();
    for (let i = 0; i < 5; i++) await put(t, `shell/n${i}.json`, i, { modified: i + 1, base: 0 });
    const first = await changes(t, 0, 2);
    assert.equal(first.more, true);
    assert.deepEqual(first.changes.map((m) => m.rev), [1, 2]);
    const last = await changes(t, 4, 2);
    assert.equal(last.more, false);
    assert.deepEqual(last.changes.map((m) => m.rev), [5]);
  });

  it('answers a write based on an old revision with the newer copy, unless forced', async () => {
    const one = await pair('dev-1');
    const two = await pair('dev-2');
    await put(one, 'shell/settings.json', { a: 1 }, { modified: 10, base: 0 }); // rev 1
    await put(one, 'shell/settings.json', { a: 2 }, { modified: 20, base: 1 }); // rev 2
    // Device two last saw rev 1.
    const stale = await put(two, 'shell/settings.json', { a: 3 }, { modified: 15, base: 1 });
    assert.equal(stale.status, 409);
    const { conflict } = (await stale.json()) as ConflictResponse;
    assert.deepEqual(conflict, { key: 'shell/settings.json', rev: 2, modified: 20, kind: 'json', size: 7 });
    // Up to date: accepted. Forced: accepted.
    assert.equal((await put(two, 'shell/settings.json', { a: 4 }, { modified: 30, base: 2 })).status, 200);
    assert.equal((await put(two, 'shell/settings.json', { a: 5 }, { modified: 5, base: 0, force: true })).status, 200);
  });

  it('remembers deletions, and frees the bytes', async () => {
    const t = await pair();
    await put(t, 'games/coloring/art/star/p1/paint.png', new Uint8Array([1, 2, 3]), { modified: 1, base: 0 });
    assert.deepEqual(readdirSync(join(dir, 'blobs')), ['1.bin']);
    const d = await del(t, 'games/coloring/art/star/p1/paint.png', { modified: 2, base: 1 });
    assert.equal(((await d.json()) as WriteResponse).rev, 2);
    assert.deepEqual(readdirSync(join(dir, 'blobs')), []);
    const gone = await fetch(item('games/coloring/art/star/p1/paint.png'), { headers: { authorization: `Bearer ${t}` } });
    assert.equal(gone.status, 404);
    assert.deepEqual((await gone.json()) as unknown, { error: 'Deleted' });
    const c = await changes(t);
    assert.deepEqual(c.changes, [{ key: 'games/coloring/art/star/p1/paint.png', rev: 2, modified: 2, deleted: true }]);
    // Deleting it again, or something never stored, changes nothing.
    await del(t, 'games/coloring/art/star/p1/paint.png', { modified: 3, base: 2 });
    await del(t, 'shell/never.json', { modified: 3, base: 0 });
    assert.equal((await changes(t)).rev, 2);
  });

  it('replacing a picture keeps only the newest bytes on disk', async () => {
    const t = await pair();
    await put(t, 'games/coloring/art/star/p1/paint.png', new Uint8Array([1]), { modified: 1, base: 0 });
    await put(t, 'games/coloring/art/star/p1/paint.png', new Uint8Array([2]), { modified: 2, base: 1 });
    assert.deepEqual(readdirSync(join(dir, 'blobs')), ['2.bin']);
  });

  it('refuses device-only keys, odd keys and bad JSON', async () => {
    const t = await pair();
    assert.equal((await put(t, 'shell/local/device.json', {}, { modified: 1, base: 0 })).status, 400);
    assert.equal((await put(t, 'other/x.json', {}, { modified: 1, base: 0 })).status, 400);
    const badJson = await fetch(`${item('shell/a.json')}?modified=1&base=0`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: '{nope',
    });
    assert.equal(badJson.status, 400);
    const noModified = await fetch(`${item('shell/a.json')}?base=0`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
      body: '1',
    });
    assert.equal(noModified.status, 400);
  });

  it('keeps everything, tokens included, across a restart', async () => {
    const t = await pair();
    await put(t, 'shell/settings.json', { a: 1 }, { modified: 1, base: 0 });
    await stop();
    await start({ pairingCode: 'ABCD-EFGH' });
    assert.equal((await changes(t)).rev, 1);
  });

  it('lets the app's pages call it from their own origin (CORS)', async () => {
    const pre = await fetch(item('shell/a.json'), {
      method: 'OPTIONS',
      headers: { origin: 'http://tauri.localhost', 'access-control-request-method': 'PUT' },
    });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), '*');
    assert.match(pre.headers.get('access-control-allow-headers') ?? '', /authorization/);
    const t = await pair();
    await put(t, 'shell/a.json', 1, { modified: 1, base: 0 });
    const got = await fetch(item('shell/a.json'), { headers: { authorization: `Bearer ${t}` } });
    assert.match(got.headers.get('access-control-expose-headers') ?? '', /x-rev/);
  });

  it('shows a status page with the pairing code', async () => {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /ABCD-EFGH/);
    assert.match(html, /Crayon Box sync/);
  });
});

describe('pieces', () => {
  it('makes readable pairing codes', () => {
    const code = newPairingCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('keeps the made pairing code across restarts', () => {
    const d = mkdtempSync(join(tmpdir(), 'cb-code-'));
    const a = Store.open(d);
    const code = a.pairingCode();
    a.close();
    const b = Store.open(d);
    assert.equal(b.pairingCode(), code);
    b.close();
    rmSync(d, { recursive: true, force: true });
  });

  it('accepts the app’s keys and refuses the rest', () => {
    for (const k of ['shell/profiles/star.json', 'games/coloring/art/star/p1/paint.png', 'games/letters/progress/A.json']) {
      assert.equal(validKey(k), true, k);
    }
    for (const k of ['shell/local/device.json', 'games/x/local/a', 'shell/../x', 'x/y', 'shell/', 'shell//a', 'shell/a\\b', 'shell/a\nb']) {
      assert.equal(validKey(k), false, k);
    }
  });
});
