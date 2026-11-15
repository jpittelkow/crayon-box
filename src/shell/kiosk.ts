// The kiosk lock (ADR 0014, milestone 2 phase D), as the web side sees it. The Windows app's shell does the work
// (`src-tauri/src/kiosk.rs`, through `tauriKiosk.ts`); this file decides what applies when, so it has no Tauri code
// and has tests. In the browser there is no kiosk: the shell gets none and nothing here runs.
import type { GameStorage } from '../storage/types';

/** What the keyboard may do: everything, nothing but Ctrl+Shift+Q, or that plus the driving keys. */
export type KeyboardMode = 'off' | 'kid' | 'driving';

/** Which kind of screen is showing. */
export type ScreenKind = 'kid' | 'driving' | 'parent';

/** The Windows app's side of the lock. */
export interface KioskBridge {
  setKeyboardMode(mode: KeyboardMode): Promise<void>;
  /** Full screen, not resizable or minimizable, and the close request ignored; or an ordinary window. */
  setLocked(on: boolean): Promise<void>;
  quit(): Promise<void>;
  /** Ctrl+Shift+Q, caught by the keyboard hook. */
  onQuitRequested(fn: () => void): void;
  startAtSignIn(): Promise<boolean>;
  setStartAtSignIn(on: boolean): Promise<void>;
}

/**
 * This laptop's kiosk settings. They stay on the device: kept under `device/`, which family sync leaves alone
 * (ADR 0024), since another laptop or the browser version may want them differently.
 */
export interface KioskSettings {
  /** Full screen that can't be resized, minimized or closed except from the parent area. */
  keepFullScreen: boolean;
  /** The low-level keyboard hook (off if antivirus flags it, ADR 0014). */
  lockKeyboard: boolean;
}

const PATH = 'device/kiosk.json';
export const DEFAULT_KIOSK: KioskSettings = { keepFullScreen: true, lockKeyboard: true };

export async function loadKioskSettings(shell: GameStorage): Promise<KioskSettings> {
  return { ...DEFAULT_KIOSK, ...(await shell.getJson<Partial<KioskSettings>>(PATH)) };
}

export async function saveKioskSettings(shell: GameStorage, settings: KioskSettings): Promise<void> {
  await shell.putJson(PATH, settings);
}

/** The keyboard mode for a screen. The parent area always gets every key: parents type there. */
export function keyboardModeFor(screen: ScreenKind, settings: KioskSettings): KeyboardMode {
  if (!settings.lockKeyboard || screen === 'parent') return 'off';
  return screen === 'driving' ? 'driving' : 'kid';
}

/** Keeps the Windows app's lock in step with the screen and the parent's settings. */
export class KioskControl {
  private screen: ScreenKind = 'kid';
  private applied: KeyboardMode | null = null;

  constructor(
    private readonly bridge: KioskBridge,
    private settings: KioskSettings,
  ) {}

  get current(): KioskSettings {
    return { ...this.settings };
  }

  /** Applies the settings at start-up. */
  async start(): Promise<void> {
    await this.bridge.setLocked(this.settings.keepFullScreen);
    await this.apply();
  }

  async showing(screen: ScreenKind): Promise<void> {
    this.screen = screen;
    await this.apply();
  }

  async update(shell: GameStorage, change: Partial<KioskSettings>): Promise<void> {
    const before = this.settings;
    this.settings = { ...this.settings, ...change };
    await saveKioskSettings(shell, this.settings);
    if (before.keepFullScreen !== this.settings.keepFullScreen) await this.bridge.setLocked(this.settings.keepFullScreen);
    await this.apply();
  }

  quit(): Promise<void> {
    return this.bridge.quit();
  }

  onQuitRequested(fn: () => void): void {
    this.bridge.onQuitRequested(fn);
  }

  startAtSignIn(): Promise<boolean> {
    return this.bridge.startAtSignIn();
  }

  setStartAtSignIn(on: boolean): Promise<void> {
    return this.bridge.setStartAtSignIn(on);
  }

  private async apply(): Promise<void> {
    const mode = keyboardModeFor(this.screen, this.settings);
    if (mode === this.applied) return;
    this.applied = mode;
    try {
      await this.bridge.setKeyboardMode(mode);
    } catch (err) {
      console.error('Keyboard lock unavailable', err);
    }
  }
}

/** The kind of screen a shell screen is, from its `data-screen`. */
export function screenKind(dataScreen: string | undefined): ScreenKind {
  if (dataScreen === 'parent-area') return 'parent';
  if (dataScreen === 'game-racing') return 'driving';
  return 'kid';
}
