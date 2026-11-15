// Runs family sync in the background (ADR 0024): a round shortly after start, then every few minutes, and on
// "Sync now" in the parent area. Kid screens never wait for it or see it; problems are kept, in words, for the
// parent area. The settings live under `local/` (this device only).
import { deviceInfo } from '../storage/ids';
import type { Backend, GameStorage } from '../storage/types';
import type { AiInfo, AiModelsResponse, AiPageRequest } from '../../server/src/api';
import { httpApi, normalizeServer, pairWith, SyncProblem, type AiPageResult, type SyncApi } from './api';

/** AI pages through the family server (ADR 0029), for Parent area › Add pages. */
export interface AiPageMaker {
  info: AiInfo;
  make(req: AiPageRequest): Promise<AiPageResult>;
  /** The models to pick from (ADR 0033); null from an older server. */
  models(): Promise<AiModelsResponse | null>;
  setFavorites(ids: string[]): Promise<string[]>;
}
import { SyncEngine } from './engine';

const PATH = 'local/sync.json';

export interface SyncSettings {
  /** The server, e.g. `http://192.168.1.20:8787`. Absent: not set up (local only). */
  server?: string;
  token?: string;
  /** The newest server revision seen. */
  lastRev: number;
  /** When the last round finished without a problem. */
  lastSync?: number;
  /** The last round's problem, in words. */
  problem?: string;
  /** The parent answered "Do you have a family server?" (set up, or "not now"). */
  asked?: boolean;
}

export async function loadSyncSettings(shell: GameStorage): Promise<SyncSettings> {
  return { lastRev: 0, ...(await shell.getJson<Partial<SyncSettings>>(PATH)) };
}

export async function saveSyncSettings(shell: GameStorage, settings: SyncSettings): Promise<void> {
  await shell.putJson(PATH, settings);
}

/** Minutes between rounds when all is well, and the longest wait after problems. */
const EVERY_MS = 3 * 60_000;
const MAX_BACKOFF_MS = 30 * 60_000;
const FIRST_ROUND_MS = 5_000;

export interface SyncServiceOptions {
  backend: Backend;
  shell: GameStorage;
  makeApi?: (server: string, token: string) => SyncApi;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Timers, replaceable in tests. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class SyncService {
  private readonly opts: SyncServiceOptions;
  private running: Promise<void> | null = null;
  private timer: unknown = null;
  private failures = 0;
  private readonly listeners = new Set<(s: SyncSettings, busy: boolean) => void>();

  constructor(opts: SyncServiceOptions) {
    this.opts = opts;
  }

  private get now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private api(server: string, token: string): SyncApi {
    return this.opts.makeApi ? this.opts.makeApi(server, token) : httpApi(server, token, this.opts.fetchFn);
  }

  settings(): Promise<SyncSettings> {
    return loadSyncSettings(this.opts.shell);
  }

  get busy(): boolean {
    return this.running !== null;
  }

  /** Calls `fn` after every round and on busy changes. Returns the way to stop. */
  subscribe(fn: (s: SyncSettings, busy: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async tell(): Promise<void> {
    const s = await this.settings();
    for (const fn of this.listeners) fn(s, this.busy);
  }

  /** Starts the background rounds (if sync is set up). */
  start(): void {
    this.schedule(FIRST_ROUND_MS);
  }

  stop(): void {
    if (this.timer !== null) (this.opts.clearTimer ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  private schedule(ms: number): void {
    this.stop();
    this.timer = (this.opts.setTimer ?? setTimeout)(() => void this.syncNow().finally(() => this.scheduleNext()), ms);
  }

  private scheduleNext(): void {
    const wait = this.failures === 0 ? EVERY_MS : Math.min(MAX_BACKOFF_MS, EVERY_MS * 2 ** this.failures);
    this.schedule(wait);
  }

  /** The server's AI page maker, when this device is connected and the server has AI set up; else null. */
  async aiMaker(): Promise<AiPageMaker | null> {
    const s = await this.settings();
    if (!s.server || !s.token) return null;
    const api = this.api(s.server, s.token);
    try {
      const info = await api.info();
      if (!info.ai) return null;
      return {
        info: info.ai,
        make: (req) => api.aiPage(req),
        models: () => api.aiModels(),
        setFavorites: (ids) => api.setAiFavorites(ids),
      };
    } catch {
      return null;
    }
  }

  /** Pairs with a server and runs a first round. Throws a SyncProblem the parent area shows. */
  async connect(server: string, code: string): Promise<void> {
    const address = normalizeServer(server);
    const device = (await deviceInfo(this.opts.shell)).id;
    const token = await pairWith(address, code, device, this.opts.fetchFn);
    const s = await this.settings();
    await saveSyncSettings(this.opts.shell, { ...s, server: address, token, lastRev: 0, asked: true, problem: undefined });
    this.failures = 0;
    // A background round that started before the settings were saved read them without a server: let it end,
    // then run one that sees the server, rather than joining it.
    while (this.running) await this.running;
    await this.syncNow();
    this.scheduleNext();
  }

  /** Forgets the server. Everything stays on this device. */
  async disconnect(): Promise<void> {
    this.stop();
    await saveSyncSettings(this.opts.shell, { lastRev: 0, asked: true });
    await this.tell();
  }

  async notNow(): Promise<void> {
    const s = await this.settings();
    await saveSyncSettings(this.opts.shell, { ...s, asked: true });
  }

  /** One round now (or joins the one running). Never throws: problems are saved in words. */
  syncNow(): Promise<void> {
    if (!this.running) {
      this.running = this.round().finally(() => {
        this.running = null;
        void this.tell();
      });
      void this.tell();
    }
    return this.running;
  }

  private async round(): Promise<void> {
    const s = await this.settings();
    if (!s.server || !s.token) return;
    try {
      const result = await new SyncEngine(this.opts.backend, this.api(s.server, s.token)).round(s.lastRev);
      const latest = await this.settings();
      await saveSyncSettings(this.opts.shell, { ...latest, lastRev: result.rev, lastSync: this.now, problem: undefined });
      this.failures = 0;
    } catch (err) {
      this.failures++;
      const problem = err instanceof SyncProblem ? err.message : `Sync stopped: ${err instanceof Error ? err.message : String(err)}`;
      if (!(err instanceof SyncProblem)) console.error('Sync failed', err);
      const latest = await this.settings();
      await saveSyncSettings(this.opts.shell, { ...latest, problem });
    }
  }
}
