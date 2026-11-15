// In-app updates (ADR 0009, milestone 2 phase E). The Windows app asks GitHub Releases for `latest.json`; only
// published releases count, so a draft a parent hasn't tried never reaches the laptop. Everything here shows in the
// parent area only: kid screens never show an update prompt (ADR 0009).
//
// The updater itself is behind `Updater`, so this file has no Tauri code: `tauriUpdater.ts` is the real one, loaded
// only inside the Windows app; `fakeUpdater.ts` stands in for it in browser tests.
import type { GameStorage } from '../storage/types';

/** A newer version, announced by the release's `latest.json`. */
export interface AvailableUpdate {
  version: string;
  /** Release notes, plain text. May be empty. */
  notes: string;
  /** When it was published (RFC 3339), if the release says. */
  date?: string;
  /**
   * Downloads, checks the signature and installs. `onProgress` gets 0..1, or null while the size is unknown.
   * On Windows the installer closes the app and starts the new version, so this may never return.
   */
  install(onProgress: (fraction: number | null) => void): Promise<void>;
  /** Lets go of what the updater holds for this update, when it won't be installed. */
  close?(): Promise<void>;
}

export interface Updater {
  currentVersion(): Promise<string>;
  /** The newer version, or null when this one is the newest. Throws when the release can't be reached. */
  check(): Promise<AvailableUpdate | null>;
}

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'upToDate'; checkedAt: Date }
  | { kind: 'available'; version: string; notes: string; date?: string }
  | { kind: 'installing'; version: string; progress: number | null }
  | { kind: 'restarting'; version: string }
  | { kind: 'failed'; during: 'check' | 'install'; detail: string };

/** Runs checks and installs, one at a time, and tells the Updates screen what is happening. */
export class UpdateController {
  private current: UpdateState = { kind: 'idle' };
  private update: AvailableUpdate | null = null;
  private readonly listeners = new Set<(state: UpdateState) => void>();
  private versionPromise: Promise<string> | null = null;

  constructor(private readonly updater: Updater) {}

  get state(): UpdateState {
    return this.current;
  }

  /** True while there is something for a parent to look at: a newer version, or one being installed. */
  get hasNews(): boolean {
    return this.current.kind === 'available' || this.current.kind === 'installing' || this.current.kind === 'restarting';
  }

  currentVersion(): Promise<string> {
    this.versionPromise ??= this.updater.currentVersion();
    return this.versionPromise;
  }

  /** Calls `fn` on every change. Returns the way to stop. */
  subscribe(fn: (state: UpdateState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(state: UpdateState): void {
    this.current = state;
    for (const fn of this.listeners) fn(state);
  }

  private get busy(): boolean {
    const k = this.current.kind;
    return k === 'checking' || k === 'installing' || k === 'restarting';
  }

  async check(): Promise<void> {
    if (this.busy) return;
    this.set({ kind: 'checking' });
    const previous = this.update;
    this.update = null;
    await previous?.close?.().catch(() => undefined);
    try {
      const found = await this.updater.check();
      this.update = found;
      if (found) this.set({ kind: 'available', version: found.version, notes: found.notes.trim(), date: found.date });
      else this.set({ kind: 'upToDate', checkedAt: new Date() });
    } catch (err) {
      this.set({ kind: 'failed', during: 'check', detail: describe(err) });
    }
  }

  async install(): Promise<void> {
    const update = this.update;
    if (!update || this.current.kind !== 'available') return;
    const { version } = update;
    this.set({ kind: 'installing', version, progress: 0 });
    try {
      await update.install((progress) => {
        if (this.current.kind === 'installing') this.set({ kind: 'installing', version, progress });
      });
      this.set({ kind: 'restarting', version });
    } catch (err) {
      // Nothing was replaced: the installer only runs once the download's signature checks out. Offer it again.
      this.set({ kind: 'failed', during: 'install', detail: describe(err) });
    }
  }

  /** After a failed install, the same update can be tried again without checking first. */
  get canRetryInstall(): boolean {
    return this.current.kind === 'failed' && this.current.during === 'install' && this.update !== null;
  }

  async retryInstall(): Promise<void> {
    if (!this.canRetryInstall || !this.update) return;
    const { version, notes, date } = this.update;
    this.set({ kind: 'available', version, notes: notes.trim(), date });
    await this.install();
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

// ---- The parent's setting ----

const PATH = 'updates.json';

export interface UpdateSettings {
  /** Look for a newer version each time the app starts. It is only announced in the parent area. */
  checkOnStart: boolean;
}

export async function loadUpdateSettings(shell: GameStorage): Promise<UpdateSettings> {
  return { checkOnStart: true, ...(await shell.getJson<Partial<UpdateSettings>>(PATH)) };
}

export async function saveUpdateSettings(shell: GameStorage, settings: UpdateSettings): Promise<void> {
  await shell.putJson(PATH, settings);
}
