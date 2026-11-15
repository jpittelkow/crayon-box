// Family pages (ADR 0005, milestone 2 phase F): pages a parent adds from a file (a scan, a photo of a drawing,
// a downloaded sheet), cleaned up into a page. They live in the coloring game's storage, `family/<id>/page.png`
// and `page.json`, so family sync (ADR 0024) takes them to every device like everything else.
import { randomId } from '../../storage/ids';
import type { GameStorage } from '../../storage/types';

export interface FamilyPageMeta {
  title: string;
  /** A built-in theme's folder name, or OUR_THEME. */
  theme: string;
  /** When it was added, ms since 1970. */
  added: number;
  /** Where it came from: the parent area, or the Pages folder (with the file's name). */
  source: 'import' | 'folder';
  file?: string;
}

export interface FamilyPage {
  /** The folder id; the page's id is `family:<id>`. */
  id: string;
  meta: FamilyPageMeta;
}

/** The theme for family pages that don't belong to a built-in theme. */
export const OUR_THEME = 'our-pages';

const DIR = 'family/';

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || 'page';
}

export async function listFamilyPages(storage: GameStorage): Promise<FamilyPage[]> {
  const paths = (await storage.list(DIR)).filter((p) => p.endsWith('/page.json'));
  const pages: FamilyPage[] = [];
  for (const path of paths) {
    const meta = await storage.getJson<FamilyPageMeta>(path);
    // A page whose image hasn't arrived yet (sync still running) is left out until it has.
    if (meta && (await storage.list(`${DIR}${path.split('/')[1]}/page.png`)).length > 0) {
      pages.push({ id: path.split('/')[1], meta });
    }
  }
  return pages.sort((a, b) => a.meta.added - b.meta.added);
}

export async function addFamilyPage(storage: GameStorage, png: Blob, meta: FamilyPageMeta): Promise<FamilyPage> {
  const id = `${slugify(meta.title)}-${randomId(6)}`;
  // The image first: a page.json without its image is never listed.
  await storage.putBlob(`${DIR}${id}/page.png`, png);
  await storage.putJson(`${DIR}${id}/page.json`, meta);
  return { id, meta };
}

export async function updateFamilyPage(storage: GameStorage, id: string, change: Partial<Pick<FamilyPageMeta, 'title' | 'theme'>>): Promise<void> {
  const meta = await storage.getJson<FamilyPageMeta>(`${DIR}${id}/page.json`);
  if (meta) await storage.putJson(`${DIR}${id}/page.json`, { ...meta, ...change });
}

/** Removes the page. Pictures already made from it keep their paint but lose their lines. */
export async function removeFamilyPage(storage: GameStorage, id: string): Promise<void> {
  await storage.delete(`${DIR}${id}/page.json`);
  await storage.delete(`${DIR}${id}/page.png`);
}

export function familyPageImage(storage: GameStorage, id: string): Promise<Blob | undefined> {
  return storage.getBlob(`${DIR}${id}/page.png`);
}
