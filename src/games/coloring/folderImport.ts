// The Windows app's Pages folder (ADR 0005, milestone 2 phase F): at start, each file waiting in
// `Pictures\Coloring Book\Pages` becomes a family page, then moves to `Added` (or `Not added`).
import type { PagesFolder } from '../../shell/types';
import type { GameStorage } from '../../storage/types';
import { addFamilyPage, OUR_THEME, slugify } from './family';
import { kindOf, titleFromName, type CleanedPage } from './importPage';
import { builtinThemes } from './pages';

/** The theme a folder inside Pages stands for: a built-in theme by name or folder name, else Our pages. */
export function themeForFolder(folder: string): string {
  if (!folder) return OUR_THEME;
  const want = slugify(folder);
  for (const [id, meta] of builtinThemes()) {
    if (id === want || slugify(meta.name) === want) return id;
  }
  return OUR_THEME;
}

export async function importPagesFolder(
  storage: GameStorage,
  folder: PagesFolder,
  convert: (name: string, blob: Blob) => Promise<CleanedPage>,
  now: () => number = Date.now,
): Promise<{ added: string[]; failed: string[] }> {
  const added: string[] = [];
  const failed: string[] = [];
  for (const file of await folder.list()) {
    if (!kindOf(file.name, '')) continue;
    try {
      const page = await convert(file.name, await folder.read(file.path));
      await addFamilyPage(storage, page.png, {
        title: titleFromName(file.name),
        theme: themeForFolder(file.folder),
        added: now(),
        source: 'folder',
        file: file.name,
      });
      await folder.done(file.path, true);
      added.push(file.path);
    } catch (err) {
      console.error(`Couldn't make a page from ${file.path}`, err);
      failed.push(file.path);
      await folder.done(file.path, false).catch(() => {});
    }
  }
  return { added, failed };
}
