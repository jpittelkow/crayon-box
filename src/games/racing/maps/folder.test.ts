// Maps from the device's maps folder (ADR 0043): good files join the picker behind the built-in maps with ids
// that can't clash with them, bad ones are left out with a reason, and a parent can switch one off.
import { beforeEach, describe, expect, it } from 'vitest';
import type { MapsFolder, MapsFolderFile } from '../../../shell/types';
import type { GameStorage } from '../../../storage/types';
import { MAPS } from '.';
import { ISLAND } from './island';
import { mapToFile } from './file';
import { FOLDER_ID, forgetCheckedMaps, loadFolderMaps, loadFolderMapsOff, pickerFolderMaps, saveFolderMapsOff, textHash } from './folder';
import example from './examples/test-loop.json?raw';

const folder = (files: MapsFolderFile[]): MapsFolder => ({ read: async () => files, openFolder: async () => {} });

function fakeStorage(): GameStorage {
  const items = new Map<string, unknown>();
  return {
    getJson: async <T>(path: string) => items.get(path) as T | undefined,
    putJson: async (path, value) => void items.set(path, structuredClone(value)),
    getBlob: async () => undefined,
    putBlob: async () => {},
    list: async (prefix) => [...items.keys()].filter((k) => k.startsWith(prefix)).sort(),
    delete: async (path) => void items.delete(path),
  };
}

beforeEach(() => forgetCheckedMaps());

describe('the maps folder (ADR 0043)', () => {
  it('loads a good file with its name, behind the folder prefix, and leaves a bad one out with the reason', async () => {
    const { maps, problems } = await loadFolderMaps(folder([
      { name: 'z-broken.json', text: '{ "format": "crayon-box-map", "version": 1, "name": "Broken" }' },
      { name: 'test-loop.json', text: example },
      { name: 'newer.json', text: JSON.stringify({ format: 'crayon-box-map', version: 9, name: 'New', map: {} }) },
      { name: 'locked.json', text: '', error: 'Error: in use' },
    ]));
    expect(maps.map((m) => [m.file, m.name, m.map.id])).toEqual([['test-loop.json', 'Test loop', 'folder:test-loop']]);
    expect(problems).toEqual([
      { file: 'locked.json', reason: "It couldn't be read (Error: in use)." },
      { file: 'newer.json', reason: expect.stringMatching(/newer version of the app/) },
      { file: 'z-broken.json', reason: 'map: needs to be an object { }.' },
    ]);
  });

  it('can never clash with a built-in map: a copy of the island is its own map', async () => {
    const { maps } = await loadFolderMaps(folder([{ name: 'island.json', text: mapToFile(ISLAND, 'Our island') }]));
    expect(maps[0]!.map.id).toBe(`${FOLDER_ID}island`);
    expect(MAPS.map((m) => m.id)).not.toContain(maps[0]!.map.id);
    // The built-in map is untouched.
    expect(ISLAND.id).toBe('island');
  });

  it('leaves out a second file with the same id, saying which file has it', async () => {
    const { maps, problems } = await loadFolderMaps(folder([
      { name: 'b.json', text: example },
      { name: 'a.json', text: example.replace('"name": "Test loop"', '"name": "Another"') },
    ]));
    expect(maps.map((m) => m.file)).toEqual(['a.json']);
    expect(problems).toEqual([{ file: 'b.json', reason: 'It has the same id ("test-loop") as a.json: give one of them another id.' }]);
  });

  it('a map that breaks a placing rule is left out with the reason', async () => {
    const noGarage = example.replace(/\{\s*"kind": "garage",[\s\S]*?"r": 4\s*\},\s*/, '');
    expect(noGarage).not.toContain('"garage"');
    const { maps, problems } = await loadFolderMaps(folder([{ name: 'test-loop.json', text: noGarage }]));
    expect(maps).toEqual([]);
    expect(problems[0]!.reason).toMatch(/no garage/);
  });

  it('a folder that can\'t be read is one problem, and the picker gets no maps, never an error', async () => {
    const broken: MapsFolder = { read: async () => Promise.reject(new Error('gone')), openFolder: async () => {} };
    expect(await loadFolderMaps(broken)).toEqual({ maps: [], problems: [{ file: '', reason: "The maps folder couldn't be read (Error: gone)." }] });
    expect(await pickerFolderMaps(broken, fakeStorage())).toEqual([]);
    expect(await pickerFolderMaps(undefined, fakeStorage())).toEqual([]);
  });

  it('a parent can switch a map off for the picker; that stays on this device', async () => {
    const storage = fakeStorage();
    const files = folder([{ name: 'test-loop.json', text: example }]);
    expect((await pickerFolderMaps(files, storage)).length).toBe(1);
    await saveFolderMapsOff(storage, ['folder:test-loop']);
    expect(await loadFolderMapsOff(storage)).toEqual(['folder:test-loop']);
    expect(await pickerFolderMaps(files, storage)).toEqual([]);
    expect(await storage.list('local/')).toEqual(['local/folder-maps.json']);
  });

  it('a map\'s picture is drawn again when its file changes', async () => {
    const a = (await loadFolderMaps(folder([{ name: 'm.json', text: example }]))).maps[0]!;
    const b = (await loadFolderMaps(folder([{ name: 'm.json', text: example.replace('"count": 44', '"count": 40') }]))).maps[0]!;
    expect(a.picture).toBe(`map-folder-test-loop-${textHash(example)}`);
    expect(b.picture).not.toBe(a.picture);
  });
});
