// The app shell (ADR 0012): kid picker, then the home screen (skipped while one game is enabled), then a game.
// The lock on the shell's screens leads through the gate to the parent area (ADR 0008).
import type { AppStorage } from '../storage/types';
import { icons } from '../ui/icons';
import { el, kidButton } from '../ui/kid';
import { wordmark } from '../ui/wordmark';
import { kidPickerScreen, lockButton } from './kidPicker';
import { enabledGames, getPhoto, kidTintVar, loadProfiles, loadShellSettings } from './profiles';
import { GAMES } from './registry';
import { WebAudioSound } from './sound';
import type { FinishedPictures, GameEntry, KidProfile, PagesFolder } from './types';
import type { UpdateController } from './updates';
import { screenKind, type KioskControl } from './kiosk';
import type { SyncService } from '../sync/service';

export class Shell {
  private unmount: (() => Promise<void>) | null = null;
  private stopParent: (() => void) | null = null;
  private busy = false;
  private urls: string[] = [];
  private sound: WebAudioSound | null = null;

  constructor(
    private readonly frame: HTMLElement,
    private readonly storage: AppStorage,
    private readonly games: readonly GameEntry[] = GAMES,
    /** What only the Windows app has (milestone 2); empty in the browser. */
    private readonly platform: {
      finished?: FinishedPictures;
      pagesFolder?: PagesFolder;
      updates?: UpdateController;
      kiosk?: KioskControl;
      sync?: SyncService;
    } = {},
  ) {}

  async start(): Promise<void> {
    await this.showKidPicker();
  }

  private async leave(): Promise<void> {
    this.stopParent?.();
    this.stopParent = null;
    document.body.dataset.world = 'kid';
    if (!this.unmount) return;
    const unmount = this.unmount;
    this.unmount = null;
    // Wait for the game to finish saving before the next screen (ADR 0012).
    await unmount();
  }

  private show(screen: HTMLElement, ground = screen.style.getPropertyValue('--ground') || 'var(--manila)'): void {
    this.frame.parentElement?.style.setProperty('--ground', ground);
    screen.classList.add('slide-in');
    this.frame.replaceChildren(screen);
    // The keyboard lock follows the screen: off in the parent area, driving keys in the driving game (ADR 0014).
    void this.platform.kiosk?.showing(screenKind(screen.dataset.screen));
  }

  /** Quits the Windows app (the parent area's Quit, or Ctrl+Shift+Q): the open picture is saved first. */
  async quit(): Promise<void> {
    try {
      await this.leave();
    } finally {
      await this.platform.kiosk?.quit();
    }
  }

  private revokeUrls(): void {
    this.urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  }

  /** Sounds for every kid touch (ADR 0016), following the parent's on/off setting. */
  private sounds(): WebAudioSound {
    return (this.sound ??= new WebAudioSound(this.storage.shell));
  }

  async showKidPicker(): Promise<void> {
    await this.leave();
    this.revokeUrls();
    await this.sounds().refresh();
    const kids = await loadProfiles(this.storage.shell);
    const settings = await loadShellSettings(this.storage.shell);
    const photos = new Map<string, string>();
    for (const kid of kids) {
      const blob = await getPhoto(this.storage.shell, kid);
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.urls.push(url);
        photos.set(kid.id, url);
      }
    }
    this.show(
      kidPickerScreen({
        kids,
        photos,
        showNames: settings.showNames,
        onPick: (kid) => {
          this.sounds().play('tap');
          void this.afterKidPicked(kid);
        },
        onUnlock: () => void this.showGate(),
      }),
    );
  }

  private async afterKidPicked(kid: KidProfile): Promise<void> {
    const games = enabledGames(this.games, await loadShellSettings(this.storage.shell));
    if (games.length === 1) return this.openGame(games[0], kid);
    this.show(this.homeScreen(kid, games));
  }

  private homeScreen(kid: KidProfile, games: readonly GameEntry[]): HTMLElement {
    const screen = el('div', 'screen home', { 'data-screen': 'home' });
    screen.style.setProperty('--ground', kidTintVar(kid));
    const back = kidButton({
      kind: 'action-lg',
      label: 'Back',
      html: icons.back(),
      className: 'corner',
      onTap: () => void this.showKidPicker(),
    });
    const row = el('div', 'home-row');
    for (const game of games) {
      const tile = kidButton({
        kind: 'paper',
        label: game.label,
        html: game.tileIcon,
        onTap: () => void this.openGame(game, kid),
      });
      tile.style.background = game.tileColor;
      row.append(tile);
    }
    screen.append(wordmark('md', 'screen-wordmark'), back, row, lockButton(() => void this.showGate()));
    return screen;
  }

  private async openGame(entry: GameEntry, kid: KidProfile): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const module = await entry.load();
      const screen = el('div', 'screen game', { 'data-screen': `game-${entry.id}` });
      screen.style.setProperty('--ground', kidTintVar(kid));
      this.show(screen);
      this.unmount = module.mount(screen, {
        kid,
        storage: this.storage.game(entry.id),
        sound: this.sounds(),
        exitToHome: () => void this.afterGame(kid),
        finished: this.platform.finished,
      });
    } finally {
      this.busy = false;
    }
  }

  /** Leaving a game goes back to the home screen when there is one, else to the kid picker. */
  private async afterGame(kid: KidProfile): Promise<void> {
    const games = enabledGames(this.games, await loadShellSettings(this.storage.shell));
    if (games.length === 1) return this.showKidPicker();
    await this.leave();
    this.show(this.homeScreen(kid, games));
  }

  /** The read-and-tap gate (ADR 0008). The parent world's code loads only from here. */
  private async showGate(): Promise<void> {
    await this.leave();
    const { gateScreen, loadGateSettings } = await import('../parent/gate');
    const gate = gateScreen(
      () => void this.showParentArea(),
      () => void this.showKidPicker(),
      (await loadGateSettings(this.storage.shell)).pinHash,
    );
    this.stopParent = gate.stop;
    document.body.dataset.world = 'parent';
    this.show(gate.el, '#4a4336');
  }

  private async showParentArea(): Promise<void> {
    await this.leave();
    const { parentArea } = await import('../parent/area');
    const area = await parentArea({
      storage: this.storage,
      games: this.games,
      finished: this.platform.finished,
      pagesFolder: this.platform.pagesFolder,
      updates: this.platform.updates,
      kiosk: this.platform.kiosk,
      sync: this.platform.sync,
      quit: () => void this.quit(),
      onExit: () => void this.showKidPicker(),
    });
    this.stopParent = area.stop;
    document.body.dataset.world = 'parent';
    this.show(area.el, 'var(--desk)');
  }
}
