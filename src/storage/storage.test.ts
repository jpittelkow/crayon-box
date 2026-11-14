import { describe, expect, it } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { memoryBackend, openIdbBackend } from './idb';
import { appStorage } from './namespaced';
import type { Backend } from './types';

const backends: [string, () => Promise<Backend>][] = [
  ['memory', async () => memoryBackend()],
  ['indexeddb', () => openIdbBackend(new IDBFactory(), IDBKeyRange, 'test')],
];

describe.each(backends)('storage on %s', (_name, make) => {
  it('round-trips JSON and files', async () => {
    const storage = appStorage(await make());
    const game = storage.game('coloring');
    await game.putJson('art/star/p1/art.json', { pageId: 'builtin:shapes/circle', mode: 'free' });
    expect(await game.getJson('art/star/p1/art.json')).toEqual({ pageId: 'builtin:shapes/circle', mode: 'free' });

    await game.putBlob('art/star/p1/paint.png', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));
    const blob = await game.getBlob('art/star/p1/paint.png');
    expect(blob?.type).toBe('image/png');
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it('returns undefined for missing paths and deletes', async () => {
    const game = appStorage(await make()).game('coloring');
    expect(await game.getJson('nope.json')).toBeUndefined();
    expect(await game.getBlob('nope.png')).toBeUndefined();
    await game.putJson('a.json', 1);
    await game.delete('a.json');
    expect(await game.getJson('a.json')).toBeUndefined();
  });

  it('lists by prefix, relative to the namespace', async () => {
    const game = appStorage(await make()).game('coloring');
    await game.putJson('art/star/p2/art.json', {});
    await game.putJson('art/star/p1/art.json', {});
    await game.putJson('art/heart/p3/art.json', {});
    expect(await game.list('art/star/')).toEqual(['art/star/p1/art.json', 'art/star/p2/art.json']);
  });

  it("keeps games and the shell out of each other's data", async () => {
    const storage = appStorage(await make());
    await storage.game('coloring').putJson('settings.json', { a: 1 });
    await storage.game('racing').putJson('settings.json', { b: 2 });
    await storage.shell.putJson('settings.json', { c: 3 });
    expect(await storage.game('coloring').getJson('settings.json')).toEqual({ a: 1 });
    expect(await storage.game('racing').getJson('settings.json')).toEqual({ b: 2 });
    expect(await storage.shell.getJson('settings.json')).toEqual({ c: 3 });
    expect(await storage.game('coloring').list('')).toEqual(['settings.json']);
  });

  it('refuses paths that could climb out of a namespace', async () => {
    const game = appStorage(await make()).game('coloring');
    await expect(game.putJson('../racing/x.json', 1)).rejects.toThrow();
    await expect(game.putJson('/abs.json', 1)).rejects.toThrow();
    expect(() => appStorage(memoryBackend()).game('../shell')).toThrow();
  });
});
