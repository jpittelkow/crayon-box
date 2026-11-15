// The family sync client (ADR 0024, milestone 2 phase C2). It sits under the storage interface: games save as
// usual, and this moves the changes between the device's own store and the family server in the background.
//
// One round: pull what changed on the server since the last revision seen, then push what changed here. Two
// devices changing the same thing is settled by ADR 0024's rules:
// - settings, profiles and everything else: the newest change wins;
// - a picture (`games/coloring/art/<kid>/<picture>/`) changed on both: kept both ways. This device's version
//   moves to a new picture next to it, and the other device's takes the original's place. Nothing a kid made is
//   lost; at worst My pictures shows two versions. A picture deleted on one device and painted on the other comes
//   back.
import { randomId } from '../storage/ids';
import { isDeviceOnly, type Backend, type Change, type ItemMeta, type StoredValue } from '../storage/types';
import { checkVersions, SyncProblem, type RemoteMeta, type SyncApi } from './api';

/** A coloring picture's folder for a key inside one, or null. */
export function pictureFolder(key: string): string | null {
  const m = /^(games\/coloring\/art\/[^/]+\/[^/]+\/)[^/]+$/.exec(key);
  return m ? m[1] : null;
}

type Outcome = 'remote' | 'local' | 'both';

/** Who wins when the same item changed here and on another device. */
export function settle(key: string, local: ItemMeta, remote: Pick<RemoteMeta, 'modified' | 'deleted'>): Outcome {
  if (pictureFolder(key)) {
    if (remote.deleted && local.deleted) return 'remote';
    if (remote.deleted) return 'local'; // painted here, deleted there: keep the painting
    if (local.deleted) return 'remote'; // deleted here, painted there: it comes back
    return 'both';
  }
  return local.modified > remote.modified ? 'local' : 'remote';
}

export interface RoundResult {
  /** The newest server revision now seen. */
  rev: number;
  pulled: number;
  pushed: number;
  /** Pictures kept both ways this round. */
  keptBoth: number;
}

export class SyncEngine {
  private readonly backend: Backend;
  private readonly api: SyncApi;
  private pulled = 0;
  private pushed = 0;
  private keptBoth = 0;

  constructor(backend: Backend, api: SyncApi) {
    this.backend = backend;
    this.api = api;
  }

  /** One full round. `since` is the last revision seen; the result's `rev` is the next one to ask from. */
  async round(since: number): Promise<RoundResult> {
    this.pulled = this.pushed = this.keptBoth = 0;
    checkVersions(await this.api.info());
    const rev = await this.pull(since);
    // Pushing can turn up more: a picture kept both ways leaves a new copy to send. A few passes settle it.
    for (let pass = 0; pass < 3; pass++) {
      if (!(await this.push())) break;
    }
    return { rev, pulled: this.pulled, pushed: this.pushed, keptBoth: this.keptBoth };
  }

  private async pull(since: number): Promise<number> {
    let at = since;
    for (;;) {
      const page = await this.api.changes(at);
      for (const remote of page.changes) {
        await this.receive(remote);
        at = remote.rev;
      }
      if (!page.more) return Math.max(at, page.rev);
    }
  }

  /** One change from the server. */
  private async receive(remote: RemoteMeta): Promise<void> {
    if (isDeviceOnly(remote.key)) return;
    const local = await this.backend.meta(remote.key);
    if (local?.rev === remote.rev) return; // ours, or already here
    const waiting = local && local.rev === undefined;
    if (!waiting) return this.take(remote);
    // A change here waits to be sent. If it was made on top of this very revision there's nothing to settle.
    if (local.base === remote.rev) return;
    await this.resolve(remote, local);
  }

  private async resolve(remote: RemoteMeta, local: ItemMeta): Promise<'local' | 'done'> {
    const outcome = settle(remote.key, local, remote);
    if (outcome === 'local') return 'local';
    if (outcome === 'remote') await this.take(remote);
    else await this.keepBoth(pictureFolder(remote.key)!);
    return 'done';
  }

  /** Takes the server's state of an item. */
  private async take(remote: Pick<RemoteMeta, 'key' | 'rev' | 'modified' | 'deleted'>): Promise<void> {
    if (remote.deleted) {
      if ((await this.backend.meta(remote.key)) || (await this.backend.get(remote.key))) {
        await this.backend.applyRemote(remote.key, null, { modified: remote.modified, rev: remote.rev });
        this.pulled++;
      }
      return;
    }
    const got = await this.api.get(remote.key);
    if (!got) return; // deleted since; a later change says so
    await this.backend.applyRemote(remote.key, got.value, { modified: got.modified, rev: got.rev });
    this.pulled++;
  }

  /**
   * A picture changed here and elsewhere: this device's version becomes a new picture beside it, and the
   * original folder goes back to the server's version.
   */
  private async keepBoth(folder: string): Promise<void> {
    const copy = `${folder.slice(0, -1)}-${randomId(4)}/`;
    for (const key of await this.backend.keys(folder)) {
      const value = await this.backend.get(key);
      if (value) await this.backend.put(copy + key.slice(folder.length), value);
    }
    const waiting = (await this.backend.changes(folder)).filter((c) => c.meta.rev === undefined);
    for (const { key, meta } of waiting) {
      const got = await this.api.get(key);
      if (got) await this.backend.applyRemote(key, got.value, { modified: got.modified, rev: got.rev });
      else await this.backend.applyRemote(key, null, { modified: meta.modified, rev: meta.base ?? 0 });
    }
    this.keptBoth++;
  }

  /** Sends everything waiting. Returns whether anything was sent. */
  private async push(): Promise<boolean> {
    const waiting: Change[] = (await this.backend.changes()).filter((c) => c.meta.rev === undefined && !isDeviceOnly(c.key));
    let sent = false;
    for (const change of waiting) {
      // It may have been settled by a keep-both earlier in this pass.
      const meta = await this.backend.meta(change.key);
      if (!meta || meta.rev !== undefined) continue;
      if (await this.send(change.key, meta)) sent = true;
    }
    return sent;
  }

  private async send(key: string, meta: ItemMeta): Promise<boolean> {
    let value: StoredValue | null = null;
    if (!meta.deleted) {
      value = (await this.backend.get(key)) ?? null;
      if (!value) return false;
    }
    let result = await this.api.write(key, value, meta.modified, meta.base ?? 0, false);
    if ('conflict' in result) {
      if ((await this.resolve(result.conflict, meta)) === 'done') return false;
      result = await this.api.write(key, value, meta.modified, result.conflict.rev, true);
      if ('conflict' in result) throw new SyncProblem('server', 'The family server refused a change. Try again later.');
    }
    await this.backend.markSynced(key, meta.modified, result.rev);
    this.pushed++;
    return true;
  }
}
