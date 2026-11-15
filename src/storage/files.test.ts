// What the file backend does beyond the shared storage and sync tests: it survives being closed and reopened,
// a crash at any point of a save, and keys that Windows file names can't hold as they are.
import { describe, expect, it } from 'vitest';
import { fileToKey, keyToFile, memoryFs, openFileBackend, type FileSystem } from './files';
import { appStorage } from './namespaced';
import type { StoredValue } from './types';

const json = (v: unknown): StoredValue => ({ kind: 'json', json: JSON.stringify(v) });
const png = (...bytes: number[]): StoredValue => ({ kind: 'bytes', type: 'image/png', bytes: new Uint8Array(bytes).buffer });

describe('file names', () => {
  it('keeps ordinary keys readable, one folder per path part', () => {
    expect(keyToFile('games/coloring/art/star/p1-abc/paint.png')).toBe('games/coloring/art/star/p1-abc/paint.png');
  });

  it('escapes what Windows would mix up or refuse, and reads it back', () => {
    for (const key of ['shell/A.json', 'shell/a b:c?.json', 'shell/con.json', 'shell/nul', 'shell/x.', 'shell/50%.json', 'shell/é.json']) {
      const file = keyToFile(key);
      expect(file).toMatch(/^([a-z0-9._/-]|%[0-9A-F]{2})+$/);
      expect(file.split('/').every((s) => !/^(con|nul)(\.|$)/.test(s) && !s.endsWith('.'))).toBe(true);
      expect(fileToKey(file)).toBe(key);
    }
    expect(keyToFile('shell/A.json')).not.toBe(keyToFile('shell/a.json'));
  });
});

describe('the file backend on disk', () => {
  it('keeps everything, change records included, across closing and reopening', async () => {
    const fs = memoryFs();
    let t = 1000;
    const first = await openFileBackend(fs, { now: () => t });
    await first.put('shell/settings.json', json({ sounds: true }));
    await first.put('games/coloring/art/star/p1/paint.png', png(1, 2, 3));
    await first.put('shell/local/device.json', json({ id: 'dev-1' }));
    t = 2000;
    await first.put('shell/kids/a/profile.json', json(1));
    await first.delete('shell/kids/a/profile.json');
    await first.markSynced('shell/settings.json', 1000, 7);

    const again = await openFileBackend(fs, { now: () => 9999 });
    expect(await again.get('shell/settings.json')).toEqual(json({ sounds: true }));
    const paint = await again.get('games/coloring/art/star/p1/paint.png');
    expect(paint?.kind === 'bytes' && [...new Uint8Array(paint.bytes)]).toEqual([1, 2, 3]);
    expect(paint?.kind === 'bytes' && paint.type).toBe('image/png');
    expect(await again.get('shell/local/device.json')).toEqual(json({ id: 'dev-1' }));
    expect(await again.meta('shell/settings.json')).toEqual({ modified: 1000, rev: 7 });
    expect(await again.meta('shell/kids/a/profile.json')).toEqual({ modified: 2001, deleted: true });
    expect(await again.keys('shell/')).toEqual(['shell/local/device.json', 'shell/settings.json']);
  });

  it('stores each item as its own file, with JSON as plain text', async () => {
    const fs = memoryFs();
    const b = await openFileBackend(fs);
    await b.put('games/coloring/art/star/p1/art.json', json({ pageId: 'x' }));
    expect(new TextDecoder().decode(fs.files.get('items/games/coloring/art/star/p1/art.json'))).toBe('{"pageId":"x"}');
  });

  it('keeps the old value whole when a save dies before the rename', async () => {
    const fs = memoryFs();
    const b = await openFileBackend(fs);
    await b.put('shell/a.json', json('old'));
    const broken: FileSystem = { ...fs, rename: () => Promise.reject(new Error('disk gone')) };
    const dying = await openFileBackend(broken);
    await expect(dying.put('shell/a.json', json('new'))).rejects.toThrow('disk gone');
    expect(await dying.get('shell/a.json')).toEqual(json('old'));

    const reopened = await openFileBackend(fs);
    expect(await reopened.get('shell/a.json')).toEqual(json('old'));
    expect([...fs.files.keys()].filter((k) => k.startsWith('tmp/'))).toEqual([]);
  });

  it('cleans up temp files a crash left behind', async () => {
    const fs = memoryFs();
    fs.files.set('tmp/abc-0', new Uint8Array([9]));
    await openFileBackend(fs);
    expect(fs.files.has('tmp/abc-0')).toBe(false);
  });

  it('counts a file saved just before a crash, whose index entry was never written, as changed', async () => {
    const fs = memoryFs();
    const b = await openFileBackend(fs, { now: () => 1000 });
    await b.put('shell/a.json', json(1));
    // The crash: a new item's file is in place, the index still doesn't know it.
    fs.files.set('items/games/coloring/art/star/p2/paint.png', new Uint8Array([5]));
    fs.files.set('items/shell/local/seen.json', new TextEncoder().encode('true'));

    const reopened = await openFileBackend(fs, { now: () => 5000 });
    expect(await reopened.keys('games/')).toEqual(['games/coloring/art/star/p2/paint.png']);
    expect(await reopened.meta('games/coloring/art/star/p2/paint.png')).toEqual({ modified: 5000 });
    expect(await reopened.get('shell/local/seen.json')).toEqual({ kind: 'json', json: 'true' });
    expect(await reopened.meta('shell/local/seen.json')).toBeUndefined();
    expect(await reopened.meta('shell/a.json')).toEqual({ modified: 1000 });
  });

  it('rebuilds a broken index from the files', async () => {
    const fs = memoryFs();
    const b = await openFileBackend(fs, { now: () => 1000 });
    await b.put('shell/a.json', json('kept'));
    fs.files.set('index.json', new TextEncoder().encode('{not json'));
    const reopened = await openFileBackend(fs, { now: () => 3000 });
    expect(await reopened.get('shell/a.json')).toEqual(json('kept'));
    expect(await reopened.meta('shell/a.json')).toEqual({ modified: 3000 });
  });

  it('treats an item whose file was removed by hand as deleted', async () => {
    const fs = memoryFs();
    const b = await openFileBackend(fs, { now: () => 1000 });
    await b.put('shell/a.json', json(1));
    fs.files.delete('items/shell/a.json');
    const reopened = await openFileBackend(fs, { now: () => 4000 });
    expect(await reopened.keys('shell/')).toEqual([]);
    expect(await reopened.meta('shell/a.json')).toEqual({ modified: 4000, deleted: true });
  });

  it('keeps many quick saves in order', async () => {
    const fs = memoryFs();
    const storage = appStorage(await openFileBackend(fs));
    const game = storage.game('coloring');
    await Promise.all(Array.from({ length: 20 }, (_, i) => game.putJson(`art/k/p${i}/art.json`, { i })));
    await Promise.all([game.putJson('art/k/p0/art.json', 'last'), game.delete('art/k/p1/art.json')]);
    const reopened = appStorage(await openFileBackend(fs)).game('coloring');
    expect((await reopened.list('art/k/')).length).toBe(19);
    expect(await reopened.getJson('art/k/p0/art.json')).toBe('last');
  });
});
