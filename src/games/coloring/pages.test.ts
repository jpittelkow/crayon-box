// A first part of the page check (ADR 0005): every built-in page has its files and a license (ADR 0011).
// The rendered check (open shapes, tiny regions) is still to come.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(process.cwd(), 'pages');
const dirs = (p: string) => readdirSync(p).filter((d) => statSync(join(p, d)).isDirectory());

const themes = dirs(root);
const pages = themes.flatMap((t) => dirs(join(root, t)).map((p) => [t, p] as const));

describe('built-in pages', () => {
  it('exist', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it.each(themes)('theme %s has a theme.json', (theme) => {
    const meta = JSON.parse(readFileSync(join(root, theme, 'theme.json'), 'utf8'));
    expect(meta.name).toBeTypeOf('string');
    expect(meta.icon).toBeTypeOf('string');
    expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(meta.order).toBeTypeOf('number');
  });

  it.each(pages)('%s/%s has line art and a valid page.json with a license', (theme, page) => {
    const dir = join(root, theme, page);
    expect(existsSync(join(dir, 'page.svg')) || existsSync(join(dir, 'page.png'))).toBe(true);
    const meta = JSON.parse(readFileSync(join(dir, 'page.json'), 'utf8'));
    expect(meta.title).toBeTypeOf('string');
    expect(meta.license, 'page.json must name a license (ADR 0011)').toBeTypeOf('string');
    expect(meta.license.length).toBeGreaterThan(0);
    expect(['original', 'ai', 'third-party']).toContain(meta.source);
    expect(['simple', 'more']).toContain(meta.detail);
    if (meta.source === 'ai') expect(meta.model).toBeTypeOf('string');
  });
});
