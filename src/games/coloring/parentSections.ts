// The coloring game's screens in the parent area (ADR 0005, 0007, 0012, 0038): Coloring, Pictures and Page library.
import { drawAvatar } from '../../shell/profiles';
import type { KidProfile, ParentSectionContext } from '../../shell/types';
import { button, card, confirmInline, formatDate, h, segmented, switchRow } from '../../ui/parent';
import { loadCatalog, type Catalog } from './catalog';
import { removeFamilyPage } from './family';
import { NAMED_PICKS, loadNamesSetting, saveNamesSetting, type NamesSetting } from './names';
import { deletePicture, finishedName, getPaint, hasPrevious, listPictures, restorePrevious, type Picture } from './pictures';
import { loadSettings, saveSettings } from './settings';

const urls: string[] = [];
function blobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  urls.push(url);
  return url;
}
function revoke(): void {
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
}

async function thumb(ctx: ParentSectionContext, picture: Picture, catalog: Catalog): Promise<HTMLElement> {
  const t = h('div', { class: 'pw-thumb', 'aria-hidden': 'true' });
  const paint = await getPaint(ctx.storage, picture);
  if (paint) t.append(h('img', { src: blobUrl(paint), alt: '' }));
  const page = catalog.byId(picture.meta.pageId);
  if (page) t.append(h('img', { src: page.url, alt: '' }));
  return t;
}

export async function renderPictures(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  revoke();
  let current: KidProfile | undefined = ctx.kids[0];
  const tabs = h('div', { class: 'pw-tabs', role: 'tablist', 'aria-label': 'Kids' });
  const list = h('div', { style: 'display: flex; flex-direction: column; gap: 10px' });

  const drawTabs = () => {
    tabs.replaceChildren(
      ...ctx.kids.map((kid) => {
        const dot = h('span', { class: 'pw-avatar', style: 'width: 32px; height: 32px; border-width: 2px' });
        drawAvatar(dot, kid, undefined, 18);
        const tab = h('button', { type: 'button', class: 'pw-tab', role: 'tab', 'aria-selected': String(kid === current) }, dot, ctx.kidLabel(kid));
        tab.addEventListener('click', () => {
          current = kid;
          drawTabs();
          void drawList();
        });
        return tab;
      }),
    );
  };

  const drawList = async () => {
    list.replaceChildren();
    if (!current) return;
    const pictures = await listPictures(ctx.storage, current.id);
    const catalog = await loadCatalog(ctx.storage);
    if (pictures.length === 0) {
      list.append(h('p', { class: 'pw-muted' }, `${ctx.kidLabel(current)} has no pictures yet.`));
      return;
    }
    for (const picture of pictures) {
      const title = catalog.byId(picture.meta.pageId)?.meta.title ?? 'Picture';
      const actions = h('div', { class: 'pw-row', style: 'flex-grow: 1; justify-content: flex-end' });
      const row = h(
        'div',
        { class: 'pw-card pw-row', style: 'flex-direction: row; padding: 12px 16px', 'data-picture': picture.id },
        await thumb(ctx, picture, catalog),
        h('div', { style: 'display: flex; flex-direction: column' }, h('span', { style: 'font-weight: 700' }, title), h('span', { class: 'pw-muted' }, `Changed ${formatDate(picture.meta.updated)}`)),
        actions,
      );
      if (await hasPrevious(ctx.storage, picture)) {
        actions.append(
          button(`Restore previous ${title}`, async () => {
            await restorePrevious(ctx.storage, picture);
            await drawList();
          }),
        );
      } else {
        actions.append(h('span', { class: 'pw-muted' }, 'No earlier version'));
      }
      actions.append(
        button(
          `Delete ${title}`,
          () =>
            confirmInline(actions, 'Delete this picture for good?', 'Delete', async () => {
              await deletePicture(ctx.storage, picture);
              // ADR 0007: deleting removes the finished picture in Pictures too.
              await ctx.finished?.remove(picture.kid, finishedName(picture)).catch((err) => console.error(err));
              await drawList();
            }),
          'danger',
        ),
      );
      list.append(row);
    }
  };

  drawTabs();
  el.append(
    tabs,
    h(
      'p',
      { class: 'pw-muted' },
      ctx.finished
        ? 'Restore brings back how a picture looked before it was last opened; restoring again swaps back. A copy of each picture, with its lines, is kept in Pictures, Coloring Book, Art, in one folder per kid.'
        : 'Restore brings back how a picture looked before it was last opened; restoring again swaps back. In this web version, pictures live in this browser only.',
    ),
    ...(ctx.finished ? [h('div', { class: 'pw-row' }, button('Open the pictures folder', () => void ctx.finished?.openFolder().catch((err) => console.error(err))))] : []),
    list,
  );
  await drawList();
}

/** The game's own settings (ADR 0038): how often the narrator says a button's name. */
export async function renderColoring(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const say = await loadNamesSetting(ctx.storage);
  el.append(
    card(
      h('h2', {}, 'Button names'),
      h(
        'p',
        { class: 'pw-muted' },
        `Each button on the coloring screen makes its own sound. The narrator also says its name ("Paint bucket", "Red") ` +
          `the first ${NAMED_PICKS} times each kid picks it, then only the sound plays. Names follow the Sounds switch under Settings.`,
      ),
      segmented<NamesSetting>(
        'Say button names',
        [
          ['first', `First ${NAMED_PICKS} times`],
          ['always', 'Every time'],
          ['never', 'Never'],
        ],
        say,
        (value) => void saveNamesSetting(ctx.storage, value),
      ),
    ),
  );
}

export async function renderLibrary(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const settings = await loadSettings(ctx.storage);
  const hidden = new Set(settings.hiddenPages);
  const catalog = await loadCatalog(ctx.storage);
  const byTheme = new Map<string, Catalog['all']>();
  for (const page of catalog.all) byTheme.set(page.theme, [...(byTheme.get(page.theme) ?? []), page]);

  el.append(
    h(
      'p',
      { class: 'pw-muted' },
      "Hidden pages leave the kids' library. Pictures already made from them stay in My pictures. Add your own pages under Add pages.",
    ),
  );
  for (const [theme, pages] of byTheme) {
    const section = card(h('h2', {}, catalog.themes.get(theme)?.name ?? theme));
    for (const page of pages) {
      const family = page.id.startsWith('family:');
      const row = h(
        'div',
        { class: 'pw-row', 'data-page': page.id },
        h('div', { class: 'pw-thumb', 'aria-hidden': 'true' }, h('img', { src: page.url, alt: '' })),
        h('span', { class: 'pw-grow', style: 'font-weight: 700' }, page.meta.title),
        switchRow(`Show ${page.meta.title}`, null, !hidden.has(page.id), (on) => {
          if (on) hidden.delete(page.id);
          else hidden.add(page.id);
          void saveSettings(ctx.storage, { hiddenPages: [...hidden] });
        }),
      );
      if (family) {
        const actions = h('div', { class: 'pw-row' });
        actions.append(
          button(
            `Remove ${page.meta.title}`,
            () =>
              confirmInline(actions, 'Remove this page from every device?', 'Remove', async () => {
                await removeFamilyPage(ctx.storage, page.slug);
                row.remove();
              }),
            'danger',
          ),
        );
        row.append(actions);
      }
      section.append(row);
    }
    el.append(section);
  }
}
