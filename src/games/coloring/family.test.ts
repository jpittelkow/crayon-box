import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../../storage/idb';
import { appStorage } from '../../storage/namespaced';
import type { PagesFolder, PagesFolderFile } from '../../shell/types';
import { addFamilyPage, listFamilyPages, OUR_THEME, removeFamilyPage, slugify, updateFamilyPage } from './family';
import { importPagesFolder, themeForFolder } from './folderImport';
import { kindOf, titleFromName, type CleanedPage } from './importPage';

const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
const storage = () => appStorage(memoryBackend()).game('coloring');

describe('family pages (ADR 0005, phase F)', () => {
  it('adds, lists in the order added, renames and removes', async () => {
    const s = storage();
    const a = await addFamilyPage(s, png(), { title: 'Our dragon', theme: OUR_THEME, added: 2, source: 'import' });
    await addFamilyPage(s, png(), { title: 'Fish', theme: 'under-the-sea', added: 1, source: 'folder', file: 'fish.png' });
    expect(a.id).toMatch(/^our-dragon-[a-z0-9]{6}$/);
    expect((await listFamilyPages(s)).map((p) => p.meta.title)).toEqual(['Fish', 'Our dragon']);
    await updateFamilyPage(s, a.id, { title: 'Big dragon' });
    expect((await listFamilyPages(s)).map((p) => p.meta.title)).toContain('Big dragon');
    await removeFamilyPage(s, a.id);
    expect((await listFamilyPages(s)).map((p) => p.meta.title)).toEqual(['Fish']);
  });

  it('lists a page only once its image is there (sync may bring them apart)', async () => {
    const s = storage();
    await s.putJson('family/early-abc123/page.json', { title: 'Early', theme: OUR_THEME, added: 1, source: 'import' });
    expect(await listFamilyPages(s)).toEqual([]);
    await s.putBlob('family/early-abc123/page.png', png());
    expect((await listFamilyPages(s)).map((p) => p.id)).toEqual(['early-abc123']);
  });

  it('names things sensibly', () => {
    expect(slugify('Our Dragon!!')).toBe('our-dragon');
    expect(slugify('***')).toBe('page');
    expect(titleFromName('my-dragon_scan.PNG')).toBe('My dragon scan');
    expect(titleFromName('.png')).toBe('Our page');
    expect(kindOf('a.PDF', '')).toBe('pdf');
    expect(kindOf('a', 'image/svg+xml')).toBe('svg');
    expect(kindOf('a.jpeg', '')).toBe('raster');
    expect(kindOf('a.gif', 'image/gif')).toBeNull();
  });
});

describe('the Pages folder', () => {
  it('puts a theme-named folder in that theme, the rest in Our pages', () => {
    expect(themeForFolder('')).toBe(OUR_THEME);
    expect(themeForFolder('Under the sea')).toBe('under-the-sea');
    expect(themeForFolder('under-the-sea')).toBe('under-the-sea');
    expect(themeForFolder('Dinosaurs')).toBe('dinosaurs');
    expect(themeForFolder('Dragons')).toBe(OUR_THEME);
  });

  it('turns each waiting file into a page and moves it out of the way', async () => {
    const s = storage();
    const files: PagesFolderFile[] = [
      { folder: '', name: 'dragon.png', path: 'dragon.png' },
      { folder: 'Under the sea', name: 'fish.jpg', path: 'Under the sea/fish.jpg' },
      { folder: '', name: 'broken.png', path: 'broken.png' },
      { folder: '', name: 'notes.txt', path: 'notes.txt' },
    ];
    const moved: [string, boolean][] = [];
    const folder: PagesFolder = {
      list: async () => files,
      read: async () => png(),
      done: async (path, added) => void moved.push([path, added]),
      openFolder: async () => {},
    };
    const convert = async (name: string): Promise<CleanedPage> => {
      if (name === 'broken.png') throw new Error('no lines');
      return { png: png(), check: { regions: 3, openShapes: [], smallRegions: [] }, rgba: new Uint8ClampedArray(4) };
    };
    const result = await importPagesFolder(s, folder, convert, () => 5);
    expect(result).toEqual({ added: ['dragon.png', 'Under the sea/fish.jpg'], failed: ['broken.png'] });
    expect(moved).toEqual([
      ['dragon.png', true],
      ['Under the sea/fish.jpg', true],
      ['broken.png', false],
    ]);
    const pages = await listFamilyPages(s);
    expect(pages.map((p) => [p.meta.title, p.meta.theme, p.meta.source])).toEqual([
      ['Dragon', OUR_THEME, 'folder'],
      ['Fish', 'under-the-sea', 'folder'],
    ]);
  });
});
