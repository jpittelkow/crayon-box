// Built-in pages, bundled from the repo's pages/ folder (ADR 0005).

export interface ThemeMeta {
  name: string;
  icon: string;
  color: string;
  order: number;
  hidden?: boolean;
}

export interface PageMeta {
  title: string;
  tags: string[];
  source: string;
  license: string;
  detail: 'simple' | 'more';
  hidden?: boolean;
}

export interface Page {
  /** `<library>:<theme>/<page>`, e.g. `builtin:farm-and-pets/cat` (ADR 0005). */
  id: string;
  theme: string;
  slug: string;
  meta: PageMeta;
  url: string;
}

const themeFiles = import.meta.glob<ThemeMeta>('/pages/*/theme.json', { eager: true, import: 'default' });
const pageFiles = import.meta.glob<PageMeta>('/pages/*/*/page.json', { eager: true, import: 'default' });
const svgFiles = import.meta.glob<string>('/pages/*/*/page.svg', { eager: true, query: '?url', import: 'default' });
const pngFiles = import.meta.glob<string>('/pages/*/*/page.png', { eager: true, query: '?url', import: 'default' });

function folderOf(path: string): { theme: string; slug: string } {
  const parts = path.split('/');
  return { theme: parts[2], slug: parts[3] };
}

export function builtinPages(): Page[] {
  const themes = new Map<string, ThemeMeta>();
  for (const [path, meta] of Object.entries(themeFiles)) themes.set(path.split('/')[2], meta);

  const pages: Page[] = [];
  for (const [path, meta] of Object.entries(pageFiles)) {
    const { theme, slug } = folderOf(path);
    const base = `/pages/${theme}/${slug}/`;
    const url = svgFiles[`${base}page.svg`] ?? pngFiles[`${base}page.png`];
    if (!url || meta.hidden || themes.get(theme)?.hidden) continue;
    pages.push({ id: `builtin:${theme}/${slug}`, theme, slug, meta, url });
  }
  const order = (p: Page) => themes.get(p.theme)?.order ?? 99;
  return pages.sort((a, b) => order(a) - order(b) || a.meta.title.localeCompare(b.meta.title));
}
