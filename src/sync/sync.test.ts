// Family sync end to end (ADR 0024): the real sync server (server/) in this process, and two or three devices,
// each with its own store, syncing through it over HTTP.
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handler } from '../../server/src/http';
import { Store } from '../../server/src/store';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import type { AppStorage, Backend } from '../storage/types';
import { httpApi, normalizeServer, pairWith, SyncProblem } from './api';
import { pictureFolder, settle, SyncEngine } from './engine';
import { loadSyncSettings, SyncService } from './service';

let dir: string;
let store: Store;
let server: Server;
let address: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cb-sync-client-'));
  store = Store.open(dir);
  server = createServer(handler({ store, version: 'test', pairingCode: 'ABCD-EFGH' }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  address = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  store.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A device: its own store, clock and server token. */
class Device {
  readonly backend: Backend;
  readonly storage: AppStorage;
  private rev = 0;
  private token = '';
  t: number;

  constructor(start: number) {
    this.t = start;
    this.backend = memoryBackend(() => this.t);
    this.storage = appStorage(this.backend);
  }

  async pair(name: string): Promise<this> {
    this.token = await pairWith(address, 'ABCD-EFGH', name);
    return this;
  }

  async sync(): Promise<void> {
    this.rev = (await new SyncEngine(this.backend, httpApi(address, this.token)).round(this.rev)).rev;
  }

  get coloring() {
    return this.storage.game('coloring');
  }
}

const png = (n: number) => new Blob([new Uint8Array([137, 80, 78, 71, n])], { type: 'image/png' });
const bytesOf = async (b: Blob | undefined) => (b ? [...new Uint8Array(await b.arrayBuffer())] : undefined);

describe('family sync (ADR 0024)', () => {
  it('brings one device’s kids, settings and pictures to another', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.storage.shell.putJson('profiles/star.json', { id: 'star', name: 'Star' });
    await a.storage.shell.putJson('settings.json', { showNames: true });
    await a.coloring.putJson('art/star/p1/art.json', { page: 'shapes' });
    await a.coloring.putBlob('art/star/p1/paint.png', png(1));
    await a.sync();
    await b.sync();
    expect(await b.storage.shell.getJson('profiles/star.json')).toEqual({ id: 'star', name: 'Star' });
    expect(await b.storage.shell.getJson('settings.json')).toEqual({ showNames: true });
    expect(await b.coloring.list('art/star/')).toEqual(['art/star/p1/art.json', 'art/star/p1/paint.png']);
    expect(await bytesOf(await b.coloring.getBlob('art/star/p1/paint.png'))).toEqual([137, 80, 78, 71, 1]);
    // Nothing is waiting on either side, and another round changes nothing.
    for (const d of [a, b]) expect((await d.backend.changes()).every((c) => c.meta.rev !== undefined)).toBe(true);
    await a.sync();
    await b.sync();
    expect(await a.coloring.list('art/')).toHaveLength(2);
  });

  it('an ordinary edit after syncing is not a conflict: no second picture', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.coloring.putJson('art/star/p1/art.json', { page: 'shapes' });
    await a.coloring.putBlob('art/star/p1/paint.png', png(1));
    await a.sync();
    await b.sync();
    b.t = 5_000;
    await b.coloring.putBlob('art/star/p1/paint.png', png(2)); // the kid keeps painting on the other laptop
    await b.sync();
    await a.sync();
    expect(await a.coloring.list('art/star/')).toEqual(['art/star/p1/art.json', 'art/star/p1/paint.png']);
    expect(await bytesOf(await a.coloring.getBlob('art/star/p1/paint.png'))).toEqual([137, 80, 78, 71, 2]);
  });

  it('settings changed on two devices: the newest change wins on both', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.storage.shell.putJson('settings.json', { showNames: false });
    await a.sync();
    await b.sync();
    a.t = 2_000;
    await a.storage.shell.putJson('settings.json', { showNames: true }); // older change
    b.t = 3_000;
    await b.storage.shell.putJson('settings.json', { showNames: 'b' }); // newer change
    await a.sync();
    await b.sync();
    await a.sync();
    expect(await a.storage.shell.getJson('settings.json')).toEqual({ showNames: 'b' });
    expect(await b.storage.shell.getJson('settings.json')).toEqual({ showNames: 'b' });
  });

  it('the newest change wins even when it was sent first', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.storage.shell.putJson('settings.json', 0);
    await a.sync();
    await b.sync();
    a.t = 9_000;
    await a.storage.shell.putJson('settings.json', 'newest');
    await a.sync();
    b.t = 2_000;
    await b.storage.shell.putJson('settings.json', 'older');
    await b.sync();
    expect(await b.storage.shell.getJson('settings.json')).toBe('newest');
  });

  it('a picture painted on two devices is kept both ways', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.coloring.putJson('art/star/p1/art.json', { page: 'shapes' });
    await a.coloring.putBlob('art/star/p1/paint.png', png(1));
    await a.sync();
    await b.sync();
    a.t = 2_000;
    await a.coloring.putBlob('art/star/p1/paint.png', png(2));
    b.t = 3_000;
    await b.coloring.putBlob('art/star/p1/paint.png', png(3));
    await a.sync();
    await b.sync();
    await a.sync();
    for (const d of [a, b]) {
      const files = await d.coloring.list('art/star/');
      expect(files.filter((f) => f.endsWith('/art.json'))).toHaveLength(2);
      const paints = await Promise.all(files.filter((f) => f.endsWith('paint.png')).map(async (f) => (await bytesOf(await d.coloring.getBlob(f)))![4]));
      expect(paints.sort()).toEqual([2, 3]);
    }
    // Both devices agree on which version is where.
    expect(await bytesOf(await a.coloring.getBlob('art/star/p1/paint.png'))).toEqual(await bytesOf(await b.coloring.getBlob('art/star/p1/paint.png')));
  });

  it('a deletion reaches the other device and doesn’t come back', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.coloring.putJson('art/star/p1/art.json', { page: 'shapes' });
    await a.sync();
    await b.sync();
    a.t = 2_000;
    await a.coloring.delete('art/star/p1/art.json');
    await a.sync();
    await b.sync();
    await a.sync();
    expect(await a.coloring.list('art/')).toEqual([]);
    expect(await b.coloring.list('art/')).toEqual([]);
  });

  it('a picture deleted on one device but painted on the other comes back', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.coloring.putBlob('art/star/p1/paint.png', png(1));
    await a.sync();
    await b.sync();
    a.t = 2_000;
    await a.coloring.delete('art/star/p1/paint.png');
    b.t = 3_000;
    await b.coloring.putBlob('art/star/p1/paint.png', png(4));
    await b.sync();
    await a.sync();
    expect(await bytesOf(await a.coloring.getBlob('art/star/p1/paint.png'))).toEqual([137, 80, 78, 71, 4]);
  });

  it('never sends device-only data', async () => {
    const a = await new Device(1_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await a.storage.shell.putJson('local/kiosk.json', { lockKeyboard: false });
    await a.storage.shell.putJson('settings.json', 1);
    await a.sync();
    await b.sync();
    expect(await b.storage.shell.getJson('local/kiosk.json')).toBeUndefined();
    expect(store.meta('shell/local/kiosk.json')).toBeUndefined();
  });

  it('a built-in default loses to any real change', async () => {
    const a = await new Device(9_000).pair('dev-a');
    const b = await new Device(1_000).pair('dev-b');
    await b.storage.shell.putJson('settings.json', { chosen: true });
    await b.sync();
    await a.storage.shell.putJson('settings.json', { chosen: false }, { asDefault: true });
    await a.sync();
    expect(await a.storage.shell.getJson('settings.json')).toEqual({ chosen: true });
  });

  it('a fresh device gets everything back', async () => {
    const a = await new Device(1_000).pair('dev-a');
    for (let i = 0; i < 30; i++) await a.coloring.putBlob(`art/star/p${i}/paint.png`, png(i));
    await a.sync();
    const fresh = await new Device(50_000).pair('dev-new');
    await fresh.sync();
    expect(await fresh.coloring.list('art/star/')).toHaveLength(30);
  });
});

describe('sync service', () => {
  it('connects with the pairing code, syncs, and keeps its settings on the device', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    await shell.putJson('settings.json', { showNames: true });
    const service = new SyncService({ backend, shell, setTimer: () => 0, clearTimer: () => {} });
    await service.connect(address.replace('http://', ''), 'abcd-efgh');
    const s = await loadSyncSettings(shell);
    expect(s.server).toBe(address);
    expect(s.token).toHaveLength(64);
    expect(s.lastSync).toBeGreaterThan(0);
    expect(s.problem).toBeUndefined();
    expect(store.meta('shell/settings.json')?.rev).toBe(1);
    expect(store.meta('shell/local/sync.json')).toBeUndefined();
  });

  it('says a wrong pairing code and an unreachable server in words', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    const service = new SyncService({ backend, shell, setTimer: () => 0, clearTimer: () => {} });
    await expect(service.connect(address, 'WRONG-CODE')).rejects.toThrow(/pairing code isn’t right/);
    await expect(service.connect('http://127.0.0.1:1', 'ABCD-EFGH')).rejects.toBeInstanceOf(SyncProblem);
  });

  it('keeps a problem for the parent area, and clears it after a good round', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    const service = new SyncService({ backend, shell, setTimer: () => 0, clearTimer: () => {} });
    await service.connect(address, 'ABCD-EFGH');
    const s = await loadSyncSettings(shell);
    await shell.putJson('local/sync.json', { ...s, token: 'not-a-token' });
    await service.syncNow();
    expect((await loadSyncSettings(shell)).problem).toMatch(/doesn’t know this device/);
    await shell.putJson('local/sync.json', { ...s });
    await service.syncNow();
    expect((await loadSyncSettings(shell)).problem).toBeUndefined();
  });

  it('does nothing until set up, and forgets the server on disconnect', async () => {
    const backend = memoryBackend();
    const shell = appStorage(backend).shell;
    const service = new SyncService({ backend, shell, setTimer: () => 0, clearTimer: () => {} });
    await service.syncNow();
    expect((await loadSyncSettings(shell)).lastSync).toBeUndefined();
    await service.connect(address, 'ABCD-EFGH');
    await service.disconnect();
    const s = await loadSyncSettings(shell);
    expect(s.server).toBeUndefined();
    expect(s.asked).toBe(true);
  });
});

describe('pieces', () => {
  it('normalizes server addresses', () => {
    expect(normalizeServer('192.168.1.20:8787')).toBe('http://192.168.1.20:8787');
    expect(normalizeServer(' http://nas:8787/ ')).toBe('http://nas:8787');
    expect(normalizeServer('https://sync.home')).toBe('https://sync.home');
  });

  it('knows a picture’s folder', () => {
    expect(pictureFolder('games/coloring/art/star/p1/paint.png')).toBe('games/coloring/art/star/p1/');
    expect(pictureFolder('games/coloring/hidden.json')).toBeNull();
    expect(pictureFolder('shell/profiles/star.json')).toBeNull();
  });

  it('settles conflicts by ADR 0024’s rules', () => {
    const pic = 'games/coloring/art/star/p1/paint.png';
    expect(settle(pic, { modified: 2 }, { modified: 1 })).toBe('both');
    expect(settle(pic, { modified: 2 }, { modified: 1, deleted: true })).toBe('local');
    expect(settle(pic, { modified: 2, deleted: true }, { modified: 1 })).toBe('remote');
    expect(settle('shell/settings.json', { modified: 2 }, { modified: 1 })).toBe('local');
    expect(settle('shell/settings.json', { modified: 1 }, { modified: 2 })).toBe('remote');
    expect(settle('shell/settings.json', { modified: 0 }, { modified: 0 })).toBe('remote');
  });
});
