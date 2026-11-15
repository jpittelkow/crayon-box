// Contracts between the app shell and the games (ADR 0012).
import type { GameStorage } from '../storage/types';

export type KidColor = 'orange' | 'pink' | 'purple' | 'green' | 'blue' | 'teal';
export type KidSymbol = 'star' | 'heart' | 'moon' | 'flower' | 'sun' | 'leaf';
export type ColoringMode = 'free' | 'lines';

/**
 * A kid profile (ADR 0007, 0018). Name and photo are optional, set by a parent, and kept on the device only.
 * `id` names the kid's storage folders, so it is never the kid's name.
 */
export interface KidProfile {
  id: string;
  symbol: KidSymbol;
  color: KidColor;
  name?: string;
  /** True when a photo is stored for this kid. */
  hasPhoto?: boolean;
  /** Where this kid's new pictures start (ADR 0004, 0007). */
  startMode: ColoringMode;
  /** When the profile was made (ISO time). Kids are shown in this order. */
  created: string;
}

export type SoundKind = 'tap' | 'fill' | 'undo' | 'nothing' | 'cheer';

export interface Sound {
  play(kind: SoundKind): void;
  /** False when a parent turned sounds off. Games that make other sounds (a voice) follow it too. */
  readonly enabled?: boolean;
}

/**
 * Finished pictures in the Windows Pictures folder, for parents (ADR 0007): `Coloring Book\Art\<kid id>\<name>`.
 * Only the Windows app has them; in the browser this is absent.
 */
export interface FinishedPictures {
  /** Writes the picture, replacing an earlier version of the same name. */
  save(kidId: string, name: string, png: Blob): Promise<void>;
  remove(kidId: string, name: string): Promise<void>;
  /** Opens the Art folder in File Explorer. */
  openFolder(): Promise<void>;
}

export interface GameContext {
  kid: KidProfile;
  storage: GameStorage;
  sound: Sound;
  exitToHome(): void;
  /** Present in the Windows app only. */
  finished?: FinishedPictures;
}

/** What a game's parent-area section gets to work with. */
export interface ParentSectionContext {
  storage: GameStorage;
  kids: KidProfile[];
  /** The kid's name, or their symbol name when they have none. */
  kidLabel(kid: KidProfile): string;
  /** Present in the Windows app only. */
  finished?: FinishedPictures;
}

/** A screen a game adds to the parent area (ADR 0008, 0012). */
export interface SettingsSection {
  id: string;
  title: string;
  render(el: HTMLElement, ctx: ParentSectionContext): Promise<void>;
}

/** The game itself, loaded on demand. */
export interface GameModule {
  /** Draws the game into `el`. Returns an unmount function that resolves once the game has finished saving. */
  mount(el: HTMLElement, ctx: GameContext): () => Promise<void>;
  parentSettings?: SettingsSection[];
  /** Deletes everything the game keeps for a kid, when a parent deletes the kid. */
  forgetKid?(storage: GameStorage, kidId: string): Promise<void>;
}

/** Registry entry, loaded at start-up: enough to draw the home tile. */
export interface GameEntry {
  id: string;
  /** SVG markup for the home tile. */
  tileIcon: string;
  tileColor: string;
  /** Accessible name for tests and tools; never shown (ADR 0003). */
  label: string;
  /** Kept off the kids' screens until a parent turns it on (a game still being tried out). */
  startsHidden?: boolean;
  load(): Promise<GameModule>;
}
