// The app shell (ADR 0012): kid picker, then the home screen (skipped while one game is enabled), then a game.
import type { AppStorage } from '../storage/types';
import { icons } from '../ui/icons';
import { el, kidButton } from '../ui/kid';
import { kidPickerScreen } from './kidPicker';
import { kidTintVar, loadProfiles } from './profiles';
import { GAMES } from './registry';
import { silentSound } from './sound';
import type { GameEntry, KidProfile } from './types';

export class Shell {
  private unmount: (() => Promise<void>) | null = null;
  private busy = false;

  constructor(
    private readonly frame: HTMLElement,
    private readonly storage: AppStorage,
    private readonly games: readonly GameEntry[] = GAMES,
  ) {}

  async start(): Promise<void> {
    await this.showKidPicker();
  }

  private async leaveGame(): Promise<void> {
    if (!this.unmount) return;
    const unmount = this.unmount;
    this.unmount = null;
    // Wait for the game to finish saving before the next screen (ADR 0012).
    await unmount();
  }

  private show(screen: HTMLElement): void {
    const ground = screen.style.getPropertyValue('--ground') || 'var(--manila)';
    this.frame.parentElement?.style.setProperty('--ground', ground);
    screen.classList.add('slide-in');
    this.frame.replaceChildren(screen);
  }

  async showKidPicker(): Promise<void> {
    await this.leaveGame();
    const kids = await loadProfiles(this.storage.shell);
    this.show(kidPickerScreen(kids, (kid) => void this.afterKidPicked(kid)));
  }

  private async afterKidPicked(kid: KidProfile): Promise<void> {
    if (this.games.length === 1) return this.openGame(this.games[0], kid);
    this.show(this.homeScreen(kid));
  }

  private homeScreen(kid: KidProfile): HTMLElement {
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
    for (const game of this.games) {
      const tile = kidButton({
        kind: 'paper',
        label: game.label,
        html: game.tileIcon,
        onTap: () => void this.openGame(game, kid),
      });
      tile.style.background = game.tileColor;
      row.append(tile);
    }
    screen.append(back, row);
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
        sound: silentSound,
        exitToHome: () => void this.showKidPicker(),
      });
    } finally {
      this.busy = false;
    }
  }
}
