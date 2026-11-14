// The coloring game's screens in the parent area (ADR 0005, 0007, 0012): Pictures and Page library.
import { drawAvatar } from '../../shell/profiles';
import type { KidProfile, ParentSectionContext } from '../../shell/types';
import { button, card, confirmInline, formatDate, h, switchRow } from '../../ui/parent';
import { allBuiltinPages, builtinThemes, pageById } from './pages';
import { deletePicture, getPaint, hasPrevious, listPictures, restorePrevious, type Picture } from './pictures';
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

async function thumb(ctx: ParentSectionContext, picture: Picture): Promise<HTMLElement> {
  const t = h('div', { class: 'pw-thumb', 'aria-hidden': 'true' });
  const paint = await getPaint(ctx.storage, picture);
  if (paint) t.append(h('img', { src: blobUrl(paint), alt: '' }));
  const page = pageById(picture.meta.pageId);
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
    if (pictures.length === 0) {
      list.append(h('p', { class: 'pw-muted' }, `${ctx.kidLabel(current)} has no pictures yet.`));
      return;
    }
    for (const picture of pictures) {
      const title = pageById(picture.meta.pageId)?.meta.title ?? 'Picture';
      const actions = h('div', { class: 'pw-row', style: 'flex-grow: 1; justify-content: flex-end' });
      const row = h(
        'div',
        { class: 'pw-card pw-row', style: 'flex-direction: row; padding: 12px 16px', 'data-picture': picture.id },
        await thumb(ctx, picture),
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
      'Restore brings back how a picture looked before it was last opened; restoring again swaps back. In this web version, pictures live in this browser only.',
    ),
    list,
  );
  await drawList();
}

export async function renderLibrary(el: HTMLElement, ctx: ParentSectionContext): Promise<void> {
  const settings = await loadSettings(ctx.storage);
  const hidden = new Set(settings.hiddenPages);
  const themes = builtinThemes();
  const byTheme = new Map<string, ReturnType<typeof allBuiltinPages>>();
  for (const page of allBuiltinPages()) {
    byTheme.set(page.theme, [...(byTheme.get(page.theme) ?? []), page]);
  }

  el.append(
    h(
      'p',
      { class: 'pw-muted' },
      "Hidden pages leave the kids' library. Pictures already made from them stay in My pictures.",
    ),
  );
  for (const [theme, pages] of byTheme) {
    const section = card(h('h2', {}, themes.get(theme)?.name ?? theme));
    for (const page of pages) {
      section.append(
        h(
          'div',
          { class: 'pw-row', 'data-page': page.id },
          h('div', { class: 'pw-thumb', 'aria-hidden': 'true' }, h('img', { src: page.url, alt: '' })),
          h('span', { class: 'pw-grow', style: 'font-weight: 700' }, page.meta.title),
          switchRow(`Show ${page.meta.title}`, null, !hidden.has(page.id), (on) => {
            if (on) hidden.delete(page.id);
            else hidden.add(page.id);
            void saveSettings(ctx.storage, { hiddenPages: [...hidden] });
          }),
        ),
      );
    }
    el.append(section);
  }
}
