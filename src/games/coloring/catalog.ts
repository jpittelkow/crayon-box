// Every page the coloring game knows: the built-in ones (bundled, ADR 0005) and the family's own (`family.ts`),
// with "Our pages" first in the theme strip when there are any (milestone 2 phase F).
import type { GameStorage } from '../../storage/types';
import { familyPageImage, listFamilyPages, OUR_THEME } from './family';
import { allBuiltinPages, BLANK_PAGE, builtinThemes, type Page, type ThemeMeta } from './pages';

export const OUR_THEME_META: ThemeMeta = { name: 'Our pages', icon: 'our pages', color: '#ff9f1c', order: 0 };

export interface Catalog {
  /** Every page, in theme order, including ones a parent hid from the library. */
  all: Page[];
  themes: Map<string, ThemeMeta>;
  byId(id: string): Page | undefined;
  /** The pages a kid sees: all but the hidden ones. */
  library(hidden: readonly string[]): Page[];
}

/** One object URL per family page per session, so screens don't make (and leak) a new one each time. */
const urls = new Map<string, { blob: Blob; url: string }>();

async function familyUrl(storage: GameStorage, id: string): Promise<string | undefined> {
  const blob = await familyPageImage(storage, id);
  if (!blob) return undefined;
  const cached = urls.get(id);
  if (cached && cached.blob.size === blob.size) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  const url = URL.createObjectURL(blob);
  urls.set(id, { blob, url });
  return url;
}

export async function loadCatalog(storage: GameStorage): Promise<Catalog> {
  const themes = builtinThemes();
  const builtin = allBuiltinPages();
  const family: Page[] = [];
  for (const fp of await listFamilyPages(storage)) {
    const url = await familyUrl(storage, fp.id);
    if (!url) continue;
    const theme = themes.has(fp.meta.theme) ? fp.meta.theme : OUR_THEME;
    family.push({
      id: `family:${fp.id}`,
      theme,
      slug: fp.id,
      meta: { title: fp.meta.title, tags: [], source: 'family', license: 'family', detail: 'simple' },
      url,
    });
  }
  if (family.some((p) => p.theme === OUR_THEME)) themes.set(OUR_THEME, OUR_THEME_META);
  const order = (p: Page) => themes.get(p.theme)?.order ?? 99;
  const all = [...family, ...builtin].sort((a, b) => order(a) - order(b));
  const byId = new Map(all.map((p) => [p.id, p]));
  return {
    all,
    themes,
    byId: (id) => (id === BLANK_PAGE.id ? BLANK_PAGE : byId.get(id)),
    library: (hidden) => {
      const set = new Set(hidden);
      return all.filter((p) => !set.has(p.id));
    },
  };
}
