// The parent area (ADR 0008): plain text UI on the cool desk ground. Locks itself after 3 minutes without a touch.
import {
  MAX_KIDS,
  drawAvatar,
  getPhoto,
  kidLabel,
  loadProfiles,
  loadShellSettings,
  saveProfile,
  saveShellSettings,
} from '../shell/profiles';
import type { FinishedPictures, GameEntry, GameModule, KidProfile, PagesFolder, SettingsSection } from '../shell/types';
import type { KioskControl } from '../shell/kiosk';
import type { UpdateController } from '../shell/updates';
import type { SyncService } from '../sync/service';
import type { AppStorage } from '../storage/types';
import { button, card, h, segmented, switchRow } from '../ui/parent';
import { wordmark } from '../ui/wordmark';
import { kidEditor } from './kidEditor';
import { moreSettingsCards } from './moreSettings';

export const AUTO_LOCK_MS = 3 * 60 * 1000;

export interface ParentAreaOptions {
  storage: AppStorage;
  games: readonly GameEntry[];
  /** Present in the Windows app only. */
  finished?: FinishedPictures;
  /** Present in the Windows app only (phase F). */
  pagesFolder?: PagesFolder;
  /** Present in the Windows app only (ADR 0009). */
  updates?: UpdateController;
  /** Family sync (ADR 0024), in the browser too. */
  sync?: SyncService;
  /** Present in the Windows app only (ADR 0014). */
  kiosk?: KioskControl;
  /** Quits the Windows app, saving first. */
  quit?(): void;
  onExit(): void;
}

interface GameSection {
  game: GameEntry;
  module: GameModule;
  section: SettingsSection;
}

export async function parentArea(opts: ParentAreaOptions): Promise<{ el: HTMLElement; stop(): void }> {
  const { storage } = opts;
  const modules = await Promise.all(opts.games.map(async (game) => ({ game, module: await game.load() })));
  const sections: GameSection[] = modules.flatMap(({ game, module }) =>
    (module.parentSettings ?? []).map((section) => ({ game, module, section })),
  );

  const urls: string[] = [];
  const revoke = () => urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  const photoUrl = async (kid: KidProfile) => {
    const blob = await getPhoto(storage.shell, kid);
    if (!blob) return undefined;
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return url;
  };
  const avatar = async (kid: KidProfile, size = 44) => {
    const a = h('span', { class: 'pw-avatar', style: `width:${size}px;height:${size}px`, 'aria-hidden': 'true' });
    drawAvatar(a, kid, await photoUrl(kid), Math.round(size * 0.55));
    return a;
  };

  const main = h('main', { class: 'pw-main' });
  const navButtons = new Map<string, HTMLButtonElement>();
  const nav = h(
    'nav',
    { class: 'pw-nav', 'aria-label': 'Parent area' },
    wordmark('sm', 'pw-nav-wordmark'),
    h('div', { class: 'pw-nav-title' }, 'Parent area'),
  );

  let stopScreen: (() => void) | null = null;
  const show = async (id: string) => {
    revoke();
    stopScreen?.();
    stopScreen = null;
    for (const [key, b] of navButtons) {
      if (key === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    main.replaceChildren();
    main.scrollTop = 0;
    if (id === 'settings') return renderSettings();
    if (id === 'laptop' && opts.kiosk) {
      const { renderLaptop } = await import('./laptopScreen');
      await renderLaptop(main, opts.kiosk, storage.shell);
      return;
    }
    if (id === 'sync' && opts.sync) {
      const { renderSync } = await import('./syncScreen');
      stopScreen = await renderSync(main, opts.sync);
      return;
    }
    if (id === 'updates' && opts.updates) {
      const { renderUpdates } = await import('./updatesScreen');
      stopScreen = await renderUpdates(main, opts.updates, storage.shell);
      return;
    }
    const found = sections.find((s) => `${s.game.id}:${s.section.id}` === id);
    if (!found) return;
    const kids = await loadProfiles(storage.shell);
    main.append(h('h1', {}, found.section.title));
    const body = h('div', { style: 'display: contents' });
    main.append(body);
    await found.section.render(body, {
      storage: storage.game(found.game.id),
      kids,
      kidLabel,
      finished: opts.finished,
      pagesFolder: opts.pagesFolder,
      ai: opts.sync ? () => opts.sync!.aiMaker() : undefined,
    });
  };

  const addNav = (id: string, label: string) => {
    const b = h('button', { type: 'button' }, label);
    b.addEventListener('click', () => void show(id));
    navButtons.set(id, b);
    nav.append(b);
  };
  addNav('settings', 'Settings');
  for (const s of sections) addNav(`${s.game.id}:${s.section.id}`, s.section.title);
  if (opts.sync) addNav('sync', 'Family sync');
  if (opts.kiosk) addNav('laptop', 'This laptop');
  let stopDot: (() => void) | null = null;
  if (opts.updates) {
    const updates = opts.updates;
    addNav('updates', 'Updates');
    // A dot on Updates while a newer version waits; kid screens never show it (ADR 0009).
    const dot = () => navButtons.get('updates')!.classList.toggle('pw-nav-dot', updates.hasNews);
    dot();
    stopDot = updates.subscribe(dot);
  }
  const back = h('button', { type: 'button', class: 'pw-nav-back' }, 'Back to the kids');
  back.addEventListener('click', () => exit());
  // Quit sits on every parent screen, just above Back, so it is easy to find (owner, 2026-11-15). Windows app only.
  let quitButton: HTMLElement | null = null;
  if (opts.kiosk && opts.quit) {
    const quit = opts.quit;
    quitButton = h(
      'button',
      { type: 'button', class: 'pw-nav-quit', title: 'Anything open is saved first. Ctrl+Shift+Q does the same from the kids’ screens.' },
      'Quit the app',
    );
    quitButton.addEventListener('click', () => quit());
  }
  nav.append(
    h('div', { class: 'pw-grow' }),
    h('p', { class: 'pw-nav-note' }, 'Locks itself after 3 minutes without a touch.'),
    ...(quitButton ? [quitButton] : []),
    back,
  );

  // ---- Settings ----
  async function renderSettings(): Promise<void> {
    const kids = await loadProfiles(storage.shell);
    const settings = await loadShellSettings(storage.shell);

    const rows = h('div', { style: 'display: flex; flex-direction: column; gap: 6px' });
    for (const kid of kids) {
      const row = h('div', { class: 'pw-row', 'data-kid': kid.id });
      row.append(
        await avatar(kid),
        h('span', { style: 'min-width: 120px; font-weight: 700' }, kidLabel(kid)),
        h('span', { class: 'pw-muted' }, 'New pictures start as'),
        segmented(
          `Starting coloring mode for ${kidLabel(kid)}`,
          [
            ['free', 'Free coloring'],
            ['lines', 'Stay in the lines'],
          ],
          kid.startMode,
          (mode) => {
            kid.startMode = mode;
            void saveProfile(storage.shell, kid);
          },
        ),
        h('div', { class: 'pw-grow' }),
        button(`Edit ${kidLabel(kid)}`, () => void editKid(kid.id)),
      );
      rows.append(row);
    }

    const header = h(
      'div',
      { class: 'pw-row' },
      h('h2', {}, 'Kids'),
      h('span', { class: 'pw-muted' }, 'Names and photos stay on this device.'),
      h('div', { class: 'pw-grow' }),
      kids.length < MAX_KIDS ? button('Add a kid', () => void editKid(null)) : null,
    );

    // The one-time question (ADR 0024): asked here, in the parent area, never on the kids' screens.
    let firstRun: HTMLElement | null = null;
    if (opts.sync) {
      const s = await opts.sync.settings();
      if (!s.asked && !s.server) {
        const { firstRunCard } = await import('./syncScreen');
        firstRun = firstRunCard(opts.sync, () => void show('sync'));
      }
    }
    main.append(
      h('h1', {}, 'Settings'),
      ...(firstRun ? [firstRun] : []),
      card(
        header,
        h(
          'p',
          { class: 'pw-muted' },
          "Free coloring or stay in the lines can be switched on every picture. This only sets where a kid's new pictures start.",
        ),
        rows,
        switchRow(
          'Show names on the kid picker',
          "Each kid's name shows under their badge. Kids who can't read yet find themselves by photo or symbol.",
          settings.showNames,
          (on) => {
            settings.showNames = on;
            void saveShellSettings(storage.shell, settings);
          },
        ),
      ),
      card(
        h('h2', {}, 'Games'),
        h('p', { class: 'pw-muted' }, 'With more than one game on, kids pick a game after picking themselves.'),
        ...opts.games.map((game) =>
          switchRow(
            `Show ${game.label}`,
            game.startsHidden ? 'Still being tried out.' : null,
            settings.games[game.id] ?? !game.startsHidden,
            (on) => {
              settings.games[game.id] = on;
              void saveShellSettings(storage.shell, settings);
            },
          ),
        ),
      ),
    );
    main.append(...(await moreSettingsCards(storage)));
  }

  async function editKid(id: string | null): Promise<void> {
    revoke();
    main.replaceChildren();
    const kids = await loadProfiles(storage.shell);
    const editor = await kidEditor({
      storage,
      kids,
      kidId: id,
      currentPhotoUrl: async (kid) => photoUrl(kid),
      forgetKid: async (kidId) => {
        for (const { game, module } of modules) await module.forgetKid?.(storage.game(game.id), kidId);
      },
      done: () => void show('settings'),
    });
    main.append(editor);
  }

  // ---- Auto-lock ----
  let lockTimer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const touch = () => {
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => exit(), AUTO_LOCK_MS);
  };
  const el = h('div', { class: 'parent-world pw-shell', 'data-screen': 'parent-area' }, nav, main);
  for (const type of ['pointerdown', 'keydown', 'wheel']) el.addEventListener(type, touch, { capture: true });
  touch();

  function stop(): void {
    stopped = true;
    clearTimeout(lockTimer);
    revoke();
    stopScreen?.();
    stopDot?.();
  }
  function exit(): void {
    if (stopped) return;
    stop();
    opts.onExit();
  }

  await show('settings');
  return { el, stop };
}
