// Contracts between the app shell and the games (ADR 0012).
import type { GameStorage } from '../storage/types';
import type { AiPageMaker } from '../sync/service';

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

export type SoundKind = 'tap' | 'fill' | 'undo' | 'nothing' | 'cheer' | 'page' | 'chime';

/**
 * A game's own short sound from a shipped file (ADR 0032), e.g. a coloring button's (ADR 0038): which file under
 * assets/sounds/, how loud (default 1), how fast (default 1; lower is also lower in pitch), and, to use only the
 * start of a longer file, how many seconds of it to play (it fades out at the end).
 */
export interface Effect {
  file: string;
  gain?: number;
  rate?: number;
  seconds?: number;
}

export interface Sound {
  play(kind: SoundKind): void;
  /** Plays a game's own effect. Optional for test doubles. */
  effect?(effect: Effect): void;
  /** Starts loading effects' files ahead of the first touch. Optional for test doubles. */
  preload?(files: readonly string[]): void;
  /**
   * The crayon sound while a finger draws (ADR 0032): 0 is silent, 1 a fast scribble. `rate` raises its pitch (1 is
   * the coloring crayon). Optional for test doubles.
   */
  scratch?(level: number, rate?: number): void;
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

/** A file waiting in the Windows app's Pages folder (`Pictures\Coloring Book\Pages`, ADR 0005). */
export interface PagesFolderFile {
  /** The folder it is in, inside Pages; '' for Pages itself. A theme's name puts the page in that theme. */
  folder: string;
  name: string;
  path: string;
}

/** The Windows app's Pages folder: files dropped there become family pages at the next start (phase F). */
export interface PagesFolder {
  list(): Promise<PagesFolderFile[]>;
  read(path: string): Promise<Blob>;
  /** Moves a file out of the way once handled: into `Added`, or `Not added` when it couldn't be made a page. */
  done(path: string, added: boolean): Promise<void>;
  openFolder(): Promise<void>;
}

/** A file in the Windows app's maps folder (ADR 0043): its name and its text. */
export interface MapsFolderFile {
  name: string;
  text: string;
  /** Set when the file couldn't be read. */
  error?: string;
}

/**
 * The driving game's maps folder (ADR 0043): `maps\` in the app's local data, which the app may only read. Map
 * files dropped there show on the picker after the built-in maps.
 */
export interface MapsFolder {
  /** Every `.json` file in the folder (not in folders inside it), by name. */
  read(): Promise<MapsFolderFile[]>;
  /** Opens the folder in File Explorer, making it first if it isn't there. */
  openFolder(): Promise<void>;
}

export interface GameContext {
  kid: KidProfile;
  storage: GameStorage;
  sound: Sound;
  exitToHome(): void;
  /** The kid's photo, when a parent gave them one (ADR 0018): for a game that shows it (Letters' "My name"). */
  photo?(): Promise<Blob | undefined>;
  /** Present in the Windows app only. */
  finished?: FinishedPictures;
  /** Present in the Windows app only (and on the dev server with `?fake-maps`). */
  mapsFolder?: MapsFolder;
}

/** What a game's parent-area section gets to work with. */
export interface ParentSectionContext {
  storage: GameStorage;
  kids: KidProfile[];
  /** The kid's name, or their symbol name when they have none. */
  kidLabel(kid: KidProfile): string;
  /** Present in the Windows app only. */
  finished?: FinishedPictures;
  /** Present in the Windows app only. */
  pagesFolder?: PagesFolder;
  /** Present in the Windows app only (and on the dev server with `?fake-maps`). */
  mapsFolder?: MapsFolder;
  /** Family sync's AI page maker (ADR 0029): resolves to null unless a connected server has AI set up. */
  ai?: () => Promise<AiPageMaker | null>;
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
