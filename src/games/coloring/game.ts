// The coloring game (ADR 0004, 0007, 0016, 0017). Loaded only when the game is opened (ADR 0012).
import type { GameContext, GameModule } from '../../shell/types';
import { icons, themeIcon } from '../../ui/icons';
import { el, kidButton, setPicked } from '../../ui/kid';
import './coloring.css';
import { loadCatalog, type Catalog } from './catalog';
import { BLANK_PAGE, type Page } from './pages';
import { forgetKid, getPaint, keepPreviousVersion, listPictures, newPicture, type Picture } from './pictures';
import { ColoringSession } from './session';
import { loadSettings } from './settings';

export const coloringGame: GameModule = {
  mount(root, ctx) {
    const game = new ColoringGame(root, ctx);
    void game.start();
    return () => game.unmount();
  },
  parentSettings: [
    {
      id: 'pictures',
      title: 'Pictures',
      render: async (el, ctx) => (await import('./parentSections')).renderPictures(el, ctx),
    },
    {
      id: 'library',
      title: 'Page library',
      render: async (el, ctx) => (await import('./parentSections')).renderLibrary(el, ctx),
    },
    {
      id: 'add-pages',
      title: 'Add pages',
      render: async (el, ctx) => (await import('./addPages')).renderAddPages(el, ctx),
    },
  ],
  forgetKid,
};

/** Six tiles at most; with more, the sixth is a "more" arrow (ADR 0016 rule 6). */
const TILES_PER_SCREEN = 6;

class ColoringGame {
  private session: ColoringSession | null = null;
  private urls: string[] = [];
  private offsets = { library: 0, pictures: 0 };
  /** The theme picked in the strip; kept while the game is open. */
  private theme: string | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly ctx: GameContext,
  ) {}

  private revokeUrls(): void {
    for (const u of this.urls) URL.revokeObjectURL(u);
    this.urls = [];
  }

  private async closeSession(): Promise<void> {
    const session = this.session;
    this.session = null;
    if (session) await session.close();
  }

  async unmount(): Promise<void> {
    await this.closeSession();
    this.revokeUrls();
  }

  /** The start screen: New picture or My pictures (ADR 0017). Straight to the library when there are no pictures. */
  async start(): Promise<void> {
    await this.closeSession();
    this.revokeUrls();
    const pictures = await listPictures(this.ctx.storage, this.ctx.kid.id);
    if (pictures.length === 0) return this.showLibrary();

    const screen = this.screen('coloring-start', () => this.ctx.exitToHome());
    const row = el('div', 'start-row');
    row.append(
      kidButton({
        kind: 'paper',
        label: 'New picture',
        html: icons.newPicture(),
        className: 'big-tile',
        onTap: () => void this.showLibrary(),
      }),
    );
    const mine = kidButton({
      kind: 'paper',
      label: 'My pictures',
      className: 'big-tile',
      onTap: () => void this.showPictures(),
    });
    await this.fillPictureTile(mine, pictures[0], await loadCatalog(this.ctx.storage));
    const badge = el('span', 'tile-badge', { 'aria-hidden': 'true' });
    badge.innerHTML = icons.gallery(56);
    mine.append(badge);
    row.append(mine);
    screen.append(row);
    this.root.replaceChildren(screen);
  }

  /** A screen with the one way back in the top-left corner (ADR 0016 rule 5). */
  private screen(name: string, back: () => void): HTMLElement {
    const screen = el('div', 'tile-screen', { 'data-screen': name });
    screen.append(kidButton({ kind: 'action-lg', label: 'Back', html: icons.back(), className: 'corner', onTap: back }));
    return screen;
  }

  private tileGrid<T>(items: T[], key: 'library' | 'pictures', tile: (item: T) => Promise<HTMLElement>, redraw: () => void) {
    const grid = el('div', 'tile-grid');
    const paged = items.length > TILES_PER_SCREEN;
    const per = paged ? TILES_PER_SCREEN - 1 : TILES_PER_SCREEN;
    if (this.offsets[key] >= items.length) this.offsets[key] = 0;
    const shown = items.slice(this.offsets[key], this.offsets[key] + per);
    return (async () => {
      for (const item of shown) grid.append(await tile(item));
      if (paged) {
        grid.append(
          kidButton({
            kind: 'paper',
            label: 'More',
            html: icons.more(),
            className: 'more-tile',
            onTap: () => {
              this.offsets[key] += per;
              redraw();
            },
          }),
        );
      }
      return grid;
    })();
  }

  /** The page library: every tap starts a new picture (ADR 0017). */
  private async showLibrary(): Promise<void> {
    await this.closeSession();
    this.revokeUrls();
    const settings = await loadSettings(this.ctx.storage);
    const catalog = await loadCatalog(this.ctx.storage);
    const all = catalog.library(settings.hiddenPages);
    // The theme strip (ADR 0016): one round button per theme that has pages to show, then the blank page. A theme
    // with every page hidden has no button, so nothing on the strip leads to an empty screen.
    const themes = catalog.themes;
    const shownThemes = [...new Set(all.map((p) => p.theme))];
    if (!this.theme || !shownThemes.includes(this.theme)) this.theme = shownThemes[0] ?? null;
    const pages = all.filter((p) => p.theme === this.theme);
    // Back goes to the start screen, or to the kid picker when the kid has no pictures (and so no start screen).
    const back = async () => {
      if ((await listPictures(this.ctx.storage, this.ctx.kid.id)).length > 0) await this.start();
      else this.ctx.exitToHome();
    };
    const screen = this.screen('page-library', () => void back());
    screen.classList.add('has-strip');
    const strip = el('div', 'cb-panel theme-strip', { role: 'group', 'aria-label': 'Themes' });
    const themeButtons: HTMLElement[] = [];
    for (const id of shownThemes) {
      const meta = themes.get(id);
      const b = kidButton({
        kind: 'choice',
        label: meta?.name ?? id,
        html: themeIcon(meta?.icon ?? id),
        className: 'theme-button',
        onTap: () => {
          this.ctx.sound.play('tap');
          this.theme = id;
          this.offsets.library = 0;
          void this.showLibrary();
        },
      });
      b.style.background = meta?.color ?? 'var(--paper)';
      b.dataset.theme = id;
      themeButtons.push(b);
    }
    setPicked(themeButtons, themeButtons[shownThemes.indexOf(this.theme ?? '')]);
    const blank = kidButton({
      kind: 'choice',
      label: 'Blank page',
      html: themeIcon('blank page'),
      className: 'theme-button',
      onTap: () => void this.openNew(BLANK_PAGE, () => void this.showLibrary()),
    });
    strip.append(...themeButtons, blank);
    screen.append(strip);
    const grid = await this.tileGrid(
      pages,
      'library',
      async (page) => {
        const tile = kidButton({
          kind: 'paper',
          label: `${page.meta.title} page`,
          onTap: () => void this.openNew(page, () => void this.showLibrary()),
        });
        tile.dataset.page = page.id;
        tile.append(Object.assign(document.createElement('img'), { src: page.url, alt: '' }));
        return tile;
      },
      () => void this.showLibrary(),
    );
    screen.append(grid);
    this.root.replaceChildren(screen);
  }

  /** My pictures: the kid's pictures, newest first; a tap continues one (ADR 0017). */
  private async showPictures(): Promise<void> {
    await this.closeSession();
    this.revokeUrls();
    const pictures = await listPictures(this.ctx.storage, this.ctx.kid.id);
    if (pictures.length === 0) return this.start();
    const catalog = await loadCatalog(this.ctx.storage);
    const screen = this.screen('my-pictures', () => void this.start());
    const grid = await this.tileGrid(
      pictures,
      'pictures',
      async (picture) => {
        const page = catalog.byId(picture.meta.pageId);
        const tile = kidButton({
          kind: 'paper',
          label: `${page?.meta.title ?? 'Picture'} picture`,
          onTap: () => void this.openExisting(picture, () => void this.showPictures()),
        });
        tile.dataset.picture = picture.id;
        await this.fillPictureTile(tile, picture, catalog);
        return tile;
      },
      () => void this.showPictures(),
    );
    screen.append(grid);
    this.root.replaceChildren(screen);
  }

  /** Draws a picture as it is now: its paint under the page's lines. */
  private async fillPictureTile(tile: HTMLElement, picture: Picture, catalog: Catalog): Promise<void> {
    const paint = await getPaint(this.ctx.storage, picture);
    if (paint) {
      const url = URL.createObjectURL(paint);
      this.urls.push(url);
      tile.append(Object.assign(document.createElement('img'), { src: url, alt: '' }));
    }
    const page = catalog.byId(picture.meta.pageId);
    if (page) tile.append(Object.assign(document.createElement('img'), { src: page.url, alt: '' }));
  }

  private async openNew(page: Page, back: () => void): Promise<void> {
    if (this.session) return;
    await this.openSession(page, newPicture(this.ctx.kid, page.id), undefined, back);
  }

  private async openExisting(picture: Picture, back: () => void): Promise<void> {
    if (this.session) return;
    const page = (await loadCatalog(this.ctx.storage)).byId(picture.meta.pageId);
    if (!page) return;
    const paint = await keepPreviousVersion(this.ctx.storage, picture);
    await this.openSession(page, picture, paint, back);
  }

  private async openSession(page: Page, picture: Picture, paint: Blob | undefined, back: () => void): Promise<void> {
    this.revokeUrls();
    this.session = new ColoringSession(this.root, this.ctx, page, picture, back);
    await this.session.start(paint);
    // A paper sound as the page appears (ADR 0032).
    this.ctx.sound.play('page');
  }
}
