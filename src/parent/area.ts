// The parent area (ADR 0008): plain text UI on the cool desk ground. Locks itself after 3 minutes without a touch.
import {
  MAX_KIDS,
  drawAvatar,
  getPhoto,
  kidLabel,
  loadProfiles,
  loadShellSettings,
  saveProfiles,
  saveShellSettings,
} from '../shell/profiles';
import type { GameEntry, GameModule, KidProfile, SettingsSection } from '../shell/types';
import type { AppStorage } from '../storage/types';
import { button, card, h, segmented, switchRow } from '../ui/parent';
import { kidEditor } from './kidEditor';

export const AUTO_LOCK_MS = 3 * 60 * 1000;

export interface ParentAreaOptions {
  storage: AppStorage;
  games: readonly GameEntry[];
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
  const nav = h('nav', { class: 'pw-nav', 'aria-label': 'Parent area' }, h('div', { class: 'pw-nav-title' }, 'Parent area'));

  const show = async (id: string) => {
    revoke();
    for (const [key, b] of navButtons) {
      if (key === id) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    main.replaceChildren();
    main.scrollTop = 0;
    if (id === 'settings') return renderSettings();
    const found = sections.find((s) => `${s.game.id}:${s.section.id}` === id);
    if (!found) return;
    const kids = await loadProfiles(storage.shell);
    main.append(h('h1', {}, found.section.title));
    const body = h('div', { style: 'display: contents' });
    main.append(body);
    await found.section.render(body, { storage: storage.game(found.game.id), kids, kidLabel });
  };

  const addNav = (id: string, label: string) => {
    const b = h('button', { type: 'button' }, label);
    b.addEventListener('click', () => void show(id));
    navButtons.set(id, b);
    nav.append(b);
  };
  addNav('settings', 'Settings');
  for (const s of sections) addNav(`${s.game.id}:${s.section.id}`, s.section.title);
  const back = h('button', { type: 'button', class: 'pw-nav-back' }, 'Back to coloring');
  back.addEventListener('click', () => exit());
  nav.append(
    h('div', { class: 'pw-grow' }),
    h('p', { class: 'pw-nav-note' }, 'Locks itself after 3 minutes without a touch.'),
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
            void saveProfiles(storage.shell, kids);
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

    main.append(
      h('h1', {}, 'Settings'),
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
          (on) => void saveShellSettings(storage.shell, { ...settings, showNames: on }),
        ),
      ),
    );
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
  }
  function exit(): void {
    if (stopped) return;
    stop();
    opts.onExit();
  }

  await show('settings');
  return { el, stop };
}
