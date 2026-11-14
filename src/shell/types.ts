// Contracts between the app shell and the games (ADR 0012).
import type { GameStorage } from '../storage/types';

export type KidColor = 'orange' | 'pink' | 'purple' | 'green' | 'blue' | 'teal';
export type KidSymbol = 'star' | 'heart' | 'moon' | 'flower' | 'sun' | 'leaf';
export type ColoringMode = 'free' | 'lines';

/** A kid is a color and a symbol, never a name (ADR 0007). The symbol doubles as the storage folder name. */
export interface KidProfile {
  id: KidSymbol;
  color: KidColor;
  /** Where this kid's new pictures start (ADR 0004, 0007). */
  startMode: ColoringMode;
}

export type SoundKind = 'tap' | 'fill' | 'undo' | 'nothing';

export interface Sound {
  play(kind: SoundKind): void;
}

export interface GameContext {
  kid: KidProfile;
  storage: GameStorage;
  sound: Sound;
  exitToHome(): void;
}

/** A section a game adds to the parent area. Shape to be settled with the parent area (ADR 0008). */
export interface SettingsSection {
  title: string;
}

/** The game itself, loaded on demand. */
export interface GameModule {
  /** Draws the game into `el`. Returns an unmount function that resolves once the game has finished saving. */
  mount(el: HTMLElement, ctx: GameContext): () => Promise<void>;
  parentSettings?: SettingsSection[];
}

/** Registry entry, loaded at start-up: enough to draw the home tile. */
export interface GameEntry {
  id: string;
  /** SVG markup for the home tile. */
  tileIcon: string;
  tileColor: string;
  /** Accessible name for tests and tools; never shown (ADR 0003). */
  label: string;
  load(): Promise<GameModule>;
}
