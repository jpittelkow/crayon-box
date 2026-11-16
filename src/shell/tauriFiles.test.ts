// The Tauri side of phase B, tested against a fake of the fs plugin (the real one only runs inside the Windows app).
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/path', () => ({
  pictureDir: async () => 'C:/Users/someone/OneDrive/Pictures',
  appLocalDataDir: async () => 'C:/Users/someone/AppData/Local/app',
  join: async (...parts: string[]) => parts.join('/'),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openPath: vi.fn(async () => {}) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ BaseDirectory: { AppLocalData: 1, Picture: 2 } }));

import { openFileBackend } from '../storage/files';
import { kidFolder, tauriFileSystem, tauriFinishedPictures, tauriMapsFolder } from './tauriFiles';

/** A fake of the fs plugin's functions: files and folders in maps, keyed by `<base>:<path>`. */
function fakePlugin() {
  const files = new Map<string, Uint8Array>();
  const dirs = new Set<string>();
  const k = (path: string, o?: { baseDir?: number }) => `${o?.baseDir}:${path}`;
  const missing = (p: string) => Object.assign(new Error(`not found: ${p}`), { code: 'ENOENT' });
  const fs = {
    files,
    dirs,
    readFile: vi.fn(async (p: string, o?: { baseDir?: number }) => {
      const data = files.get(k(p, o));
      if (!data) throw missing(p);
      return new Uint8Array(data);
    }),
    writeFile: vi.fn(async (p: string, d: Uint8Array, o?: { baseDir?: number }) => void files.set(k(p, o), new Uint8Array(d))),
    rename: vi.fn(async (a: string, b: string, o?: { oldPathBaseDir?: number; newPathBaseDir?: number }) => {
      const data = files.get(`${o?.oldPathBaseDir}:${a}`);
      if (!data) throw missing(a);
      files.delete(`${o?.oldPathBaseDir}:${a}`);
      files.set(`${o?.newPathBaseDir}:${b}`, data);
    }),
    remove: vi.fn(async (p: string, o?: { baseDir?: number }) => {
      if (!files.delete(k(p, o))) throw missing(p);
    }),
    mkdir: vi.fn(async (p: string, o?: { baseDir?: number }) => {
      const parts = p.split('/');
      for (let i = 1; i <= parts.length; i++) dirs.add(k(parts.slice(0, i).join('/'), o));
    }),
    exists: vi.fn(async (p: string, o?: { baseDir?: number }) => files.has(k(p, o)) || dirs.has(k(p, o))),
    readDir: vi.fn(async (p: string, o?: { baseDir?: number }) => {
      const prefix = k(p, o) + '/';
      const names = new Map<string, boolean>();
      for (const key of [...files.keys(), ...dirs]) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const [name, ...more] = rest.split('/');
        const isDir = more.length > 0 || dirs.has(key);
        names.set(name, (names.get(name) ?? false) || isDir);
      }
      return [...names].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }));
    }),
  };
  return fs;
}

describe('the fs plugin as a FileSystem', () => {
  it('runs the file backend in the app data folder, and finds its files again on reopening', async () => {
    const plugin = fakePlugin();
    const fs = tauriFileSystem(1, 'store', plugin as never);
    const b = await openFileBackend(fs);
    await b.put('games/coloring/art/star/p1/paint.png', { kind: 'bytes', type: 'image/png', bytes: new Uint8Array([7]).buffer });
    expect(plugin.files.has('1:store/items/games/coloring/art/star/p1/paint.png')).toBe(true);
    expect([...plugin.files.keys()].some((key) => key.startsWith('1:store/tmp/'))).toBe(false);

    expect(await fs.listFiles('items')).toEqual(['games/coloring/art/star/p1/paint.png']);
    const reopened = await openFileBackend(fs);
    expect(await reopened.keys('games/')).toEqual(['games/coloring/art/star/p1/paint.png']);
  });

  it('reads a missing file as nothing, and removes one quietly', async () => {
    const fs = tauriFileSystem(1, 'store', fakePlugin() as never);
    expect(await fs.read('index.json')).toBeUndefined();
    await expect(fs.remove('nothing.json')).resolves.toBeUndefined();
    expect(await fs.listFiles('items')).toEqual([]);
  });

  it('passes on a read that fails for another reason', async () => {
    const plugin = fakePlugin();
    plugin.files.set('1:store/index.json', new Uint8Array([1]));
    plugin.readFile.mockRejectedValueOnce(new Error('locked'));
    await expect(tauriFileSystem(1, 'store', plugin as never).read('index.json')).rejects.toThrow('locked');
  });
});

describe('finished pictures in Pictures', () => {
  it('writes into a folder per kid, replacing the earlier version, and removes it', async () => {
    const plugin = fakePlugin();
    const finished = tauriFinishedPictures(plugin as never);
    await finished.save('k3f9x2ab', 'race-car-2026-11-14-090000.png', new Blob([new Uint8Array([1])]));
    await finished.save('k3f9x2ab', 'race-car-2026-11-14-090000.png', new Blob([new Uint8Array([2])]));
    expect([...plugin.files.keys()]).toEqual(['2:Coloring Book/Art/k3f9x2ab/race-car-2026-11-14-090000.png']);
    expect([...plugin.files.values()][0]).toEqual(new Uint8Array([2]));
    await finished.remove('k3f9x2ab', 'race-car-2026-11-14-090000.png');
    expect(plugin.files.size).toBe(0);
  });

  it('keeps the old picture and leaves no temp file when the rename fails (OneDrive holding it)', async () => {
    const plugin = fakePlugin();
    const finished = tauriFinishedPictures(plugin as never);
    await finished.save('star', 'a.png', new Blob([new Uint8Array([1])]));
    plugin.rename.mockRejectedValueOnce(new Error('in use'));
    await expect(finished.save('star', 'a.png', new Blob([new Uint8Array([2])]))).rejects.toThrow('in use');
    expect([...plugin.files.entries()]).toEqual([['2:Coloring Book/Art/star/a.png', new Uint8Array([1])]]);
  });

  it('opens the Art folder wherever Windows keeps Pictures', async () => {
    const open = vi.fn(async () => {});
    await tauriFinishedPictures(fakePlugin() as never, open).openFolder();
    expect(open).toHaveBeenCalledWith('C:/Users/someone/OneDrive/Pictures/Coloring Book/Art');
  });

  it('names kid folders by id, made safe if needed', () => {
    expect(kidFolder('star')).toBe('star');
    expect(kidFolder('k3f9x2ab')).toBe('k3f9x2ab');
    expect(kidFolder('../Odd Id')).toBe('-odd-id');
  });
});

describe('the maps folder (ADR 0043)', () => {
  it('reads the .json files in maps\\ in local app data, by name, and nothing else', async () => {
    const plugin = fakePlugin();
    const put = (path: string, text: string) => plugin.files.set(`1:${path}`, new TextEncoder().encode(text));
    put('maps/b.json', '\uFEFF{"b":1}');
    put('maps/a.JSON', '{"a":1}');
    put('maps/notes.txt', 'not a map');
    put('maps/inner/c.json', '{}');
    put('store/index.json', '{}');
    const files = await tauriMapsFolder(plugin as never).read();
    // The byte-order mark some editors write is dropped.
    expect(files).toEqual([{ name: 'a.JSON', text: '{"a":1}' }, { name: 'b.json', text: '{"b":1}' }]);
    // Only reads and the folder itself: nothing is written there.
    expect(plugin.writeFile).not.toHaveBeenCalled();
    expect(plugin.mkdir).toHaveBeenCalledWith('maps', { baseDir: 1, recursive: true });
  });

  it("makes the folder when it isn't there; a file that can't be read is reported, the rest still come", async () => {
    const plugin = fakePlugin();
    expect(await tauriMapsFolder(plugin as never).read()).toEqual([]);
    plugin.files.set('1:maps/a.json', new TextEncoder().encode('{}'));
    plugin.files.set('1:maps/b.json', new TextEncoder().encode('{}'));
    plugin.readFile.mockRejectedValueOnce(new Error('in use'));
    const files = await tauriMapsFolder(plugin as never).read();
    expect(files).toEqual([{ name: 'a.json', text: '', error: 'Error: in use' }, { name: 'b.json', text: '{}' }]);
  });

  it('opens the folder in local app data', async () => {
    const open = vi.fn(async () => {});
    await tauriMapsFolder(fakePlugin() as never, open).openFolder();
    expect(open).toHaveBeenCalledWith('C:/Users/someone/AppData/Local/app/maps');
  });
});
