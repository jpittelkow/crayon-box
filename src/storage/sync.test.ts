// The sync groundwork in the storage layer (ADR 0024): change times, remembered deletions, device-only paths,
// and the two hooks the sync client will use.
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { openFileBackend, memoryFs } from './files';
import { memoryBackend, openIdbBackend } from './idb';
import { appStorage } from './namespaced';
import { isDeviceOnly, type Backend, type StoredValue } from './types';

/** A clock the test moves by hand. */
function clock(start = 1000) {
  let t = start;
  return { now: () => t, set: (v: number) => (t = v) };
}

const backends: [string, (now: () => number) => Promise<Backend>][] = [
  ['memory', async (now) => memoryBackend(now)],
  ['indexeddb', (now) => openIdbBackend({ factory: new IDBFactory(), keyRange: IDBKeyRange, name: 'test', now })],
  ['files', (now) => openFileBackend(memoryFs(), { now })],
];

const json = (v: unknown): StoredValue => ({ kind: 'json', json: JSON.stringify(v) });

describe.each(backends)('sync groundwork on %s', (_name, make) => {
  it('stamps every write with its change time, waiting to be sent', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('shell/settings.json', json(1));
    expect(await b.meta('shell/settings.json')).toEqual({ modified: 1000 });
    c.set(2500);
    await b.put('shell/settings.json', json(2));
    expect(await b.meta('shell/settings.json')).toEqual({ modified: 2500 });
  });

  it('never lets a change time go backwards or repeat', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('shell/a.json', json(1));
    await b.put('shell/a.json', json(2)); // same millisecond
    expect((await b.meta('shell/a.json'))?.modified).toBe(1001);
    c.set(500); // the clock stepped back
    await b.put('shell/a.json', json(3));
    expect((await b.meta('shell/a.json'))?.modified).toBe(1002);
  });

  it('remembers a deletion, and stops listing the item', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('games/coloring/art/star/p1/paint.png', json('x'));
    c.set(2000);
    await b.delete('games/coloring/art/star/p1/paint.png');
    expect(await b.get('games/coloring/art/star/p1/paint.png')).toBeUndefined();
    expect(await b.keys('games/coloring/')).toEqual([]);
    expect(await b.meta('games/coloring/art/star/p1/paint.png')).toEqual({ modified: 2000, deleted: true });
    expect(await b.changes('games/coloring/')).toHaveLength(1);
  });

  it('leaves no record for deleting something that never existed, or twice', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.delete('shell/nothing.json');
    expect(await b.changes()).toEqual([]);
    await b.put('shell/a.json', json(1));
    c.set(2000);
    await b.delete('shell/a.json');
    c.set(3000);
    await b.delete('shell/a.json');
    expect((await b.meta('shell/a.json'))?.modified).toBe(2000);
  });

  it('brings an item back when it is saved again after a deletion', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('shell/a.json', json(1));
    await b.delete('shell/a.json');
    c.set(5000);
    await b.put('shell/a.json', json(2));
    expect(await b.meta('shell/a.json')).toEqual({ modified: 5000 });
    expect(await b.keys('shell/')).toEqual(['shell/a.json']);
  });

  it('keeps device-only paths out of sync entirely', async () => {
    const b = await make(clock().now);
    await b.put('shell/local/device.json', json({ id: 'dev-1' }));
    await b.put('games/coloring/local/cache.json', json(1));
    await b.put('games/coloring/art/local/not-special.json', json(1)); // only a top-level local/ counts
    expect(await b.meta('shell/local/device.json')).toBeUndefined();
    expect((await b.changes()).map((ch) => ch.key)).toEqual(['games/coloring/art/local/not-special.json']);
    await b.delete('shell/local/device.json');
    expect(await b.get('shell/local/device.json')).toBeUndefined();
    expect(await b.meta('shell/local/device.json')).toBeUndefined();
    await b.applyRemote('shell/local/device.json', json({ id: 'other' }), { modified: 1, rev: 1 });
    expect(await b.get('shell/local/device.json')).toBeUndefined();
  });

  it('marks built-in defaults so any real change beats them', async () => {
    const b = await make(clock().now);
    await b.put('shell/kids/star/profile.json', json({ id: 'star' }), { asDefault: true });
    expect(await b.meta('shell/kids/star/profile.json')).toEqual({ modified: 0 });
  });

  it("stores another device's change without counting it as a change here", async () => {
    const b = await make(clock().now);
    await b.applyRemote('shell/settings.json', json({ showNames: false }), { modified: 777, rev: 12 });
    expect(await b.get('shell/settings.json')).toEqual(json({ showNames: false }));
    expect(await b.meta('shell/settings.json')).toEqual({ modified: 777, rev: 12 });
    // A deletion made elsewhere removes the item and keeps the record.
    await b.applyRemote('shell/settings.json', null, { modified: 900, rev: 13 });
    expect(await b.get('shell/settings.json')).toBeUndefined();
    expect(await b.meta('shell/settings.json')).toEqual({ modified: 900, rev: 13, deleted: true });
  });

  it('marks a change as sent, unless the item changed again meanwhile', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('shell/a.json', json(1));
    await b.markSynced('shell/a.json', 1000, 5);
    expect(await b.meta('shell/a.json')).toEqual({ modified: 1000, rev: 5 });

    c.set(2000);
    await b.put('shell/a.json', json(2)); // a new change: waiting to be sent again, made on top of rev 5
    expect(await b.meta('shell/a.json')).toEqual({ modified: 2000, base: 5 });
    await b.markSynced('shell/a.json', 1000, 6); // the server's answer to the older change arrives late
    expect(await b.meta('shell/a.json')).toEqual({ modified: 2000, base: 5 });
    await b.markSynced('shell/a.json', 2000, 7);
    expect(await b.meta('shell/a.json')).toEqual({ modified: 2000, rev: 7 });
  });

  it('remembers which revision a change and a deletion were made on top of', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.applyRemote('shell/a.json', json(1), { modified: 900, rev: 3 });
    c.set(2000);
    await b.put('shell/a.json', json(2));
    c.set(3000);
    await b.put('shell/a.json', json(3)); // still on top of rev 3: nothing was sent in between
    expect(await b.meta('shell/a.json')).toEqual({ modified: 3000, base: 3 });
    c.set(4000);
    await b.delete('shell/a.json');
    expect(await b.meta('shell/a.json')).toEqual({ modified: 4000, base: 3, deleted: true });
  });

  it('lists what is waiting to be sent', async () => {
    const c = clock();
    const b = await make(c.now);
    await b.put('shell/a.json', json(1));
    await b.put('shell/b.json', json(1));
    await b.markSynced('shell/a.json', 1000, 1);
    const waiting = (await b.changes()).filter((ch) => ch.meta.rev === undefined).map((ch) => ch.key);
    expect(waiting).toEqual(['shell/b.json']);
  });
});

describe('device-only paths', () => {
  it('are a local/ folder at the top of a namespace', () => {
    expect(isDeviceOnly('shell/local/device.json')).toBe(true);
    expect(isDeviceOnly('games/coloring/local/x.json')).toBe(true);
    expect(isDeviceOnly('shell/kids/star/profile.json')).toBe(false);
    expect(isDeviceOnly('games/coloring/art/local/x.png')).toBe(false);
    expect(isDeviceOnly('local/x.json')).toBe(false);
  });

  it('are reached through the same storage interface as everything else', async () => {
    const backend = memoryBackend();
    const storage = appStorage(backend);
    await storage.shell.putJson('local/device.json', { id: 'dev-1' });
    await storage.shell.putJson('settings.json', { showNames: true });
    expect(await storage.shell.getJson('local/device.json')).toEqual({ id: 'dev-1' });
    expect((await backend.changes()).map((ch) => ch.key)).toEqual(['shell/settings.json']);
  });
});

describe('upgrading a database saved before change records existed', () => {
  it('gives every existing item a change record and keeps its value', async () => {
    const factory = new IDBFactory();
    // Version 1, as the first web build wrote it: one store, raw values.
    await new Promise<void>((resolve, reject) => {
      const open = factory.open('old', 1);
      open.onupgradeneeded = () => {
        const files = open.result.createObjectStore('files');
        files.put(json([{ id: 'star' }]), 'shell/profiles.json');
        files.put(json({ pageId: 'builtin:shapes/x' }), 'games/coloring/art/star/p1/art.json');
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });

    const b = await openIdbBackend({ factory, keyRange: IDBKeyRange, name: 'old', now: () => 4242 });
    expect(await b.get('shell/profiles.json')).toEqual(json([{ id: 'star' }]));
    expect(await b.meta('shell/profiles.json')).toEqual({ modified: 4242 });
    expect((await b.changes()).map((ch) => ch.key)).toEqual([
      'games/coloring/art/star/p1/art.json',
      'shell/profiles.json',
    ]);
  });
});
