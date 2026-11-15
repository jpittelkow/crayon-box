// The server's data (ADR 0024): one folder holding a SQLite database (items, revisions, deletions, devices) and
// the byte values as files named by revision. That folder is all there is to back up.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync, renameSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { RemoteMeta } from './api.ts';

/** The database's layout version; `open` upgrades older ones (ADR 0024: the server upgrades itself on start). */
const SCHEMA = 1;

export interface StoredItem {
  meta: RemoteMeta;
  /** JSON text, or the bytes. */
  json?: string;
  bytes?: Buffer;
}

export type WriteResult = { ok: true; rev: number } | { ok: false; conflict: RemoteMeta };

export interface Write {
  key: string;
  modified: number;
  /** The revision the change was based on; 0 for an item this device never had from the server. */
  base: number;
  force?: boolean;
  /** Absent for a deletion. */
  value?: { kind: 'json'; json: string } | { kind: 'bytes'; type: string; bytes: Buffer };
}

interface Row {
  key: string;
  rev: number;
  modified: number;
  deleted: number;
  kind: string | null;
  type: string | null;
  size: number | null;
  json: string | null;
}

/** Pairing codes avoid look-alike characters (no 0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newPairingCode(random = randomBytes): string {
  const bytes = random(8);
  const chars = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export class Store {
  readonly dir: string;
  private readonly db: DatabaseSync;
  private readonly blobs: string;

  private constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.blobs = join(dir, 'blobs');
    mkdirSync(this.blobs, { recursive: true });
    this.db = new DatabaseSync(join(dir, 'sync.sqlite'));
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  static open(dir: string): Store {
    return new Store(dir);
  }

  close(): void {
    this.db.close();
  }

  private migrate(): void {
    const version = (this.db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (version > SCHEMA) throw new Error(`The data folder is from a newer server (schema ${version}); update the server.`);
    if (version < 1) {
      this.db.exec(`
        CREATE TABLE items (
          key TEXT PRIMARY KEY,
          rev INTEGER NOT NULL UNIQUE,
          modified INTEGER NOT NULL,
          deleted INTEGER NOT NULL DEFAULT 0,
          kind TEXT,
          type TEXT,
          size INTEGER,
          json TEXT
        );
        CREATE TABLE devices (
          token_hash TEXT PRIMARY KEY,
          device TEXT NOT NULL,
          paired INTEGER NOT NULL,
          seen INTEGER NOT NULL
        );
        CREATE TABLE settings (name TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
    }
    this.db.exec(`PRAGMA user_version = ${SCHEMA}`);
  }

  // ---- Settings: the revision counter and the pairing code ----

  private setting(name: string): string | undefined {
    return (this.db.prepare('SELECT value FROM settings WHERE name = ?').get(name) as { value: string } | undefined)?.value;
  }

  private setSetting(name: string, value: string): void {
    this.db.prepare('INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value').run(name, value);
  }

  get rev(): number {
    return Number(this.setting('rev') ?? 0);
  }

  /** The pairing code: made on first start, kept until replaced. `fixed` (from the environment) wins. */
  pairingCode(fixed?: string): string {
    if (fixed) return fixed.toUpperCase();
    let code = this.setting('pairing_code');
    if (!code) {
      code = newPairingCode();
      this.setSetting('pairing_code', code);
    }
    return code;
  }

  newPairingCode(): string {
    const code = newPairingCode();
    this.setSetting('pairing_code', code);
    return code;
  }

  // ---- Devices ----

  pair(code: string, expected: string, device: string, now = Date.now()): string | null {
    const given = Buffer.from(code.trim().toUpperCase());
    const want = Buffer.from(expected);
    if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
    const token = randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO devices (token_hash, device, paired, seen) VALUES (?, ?, ?, ?)').run(hashToken(token), device.slice(0, 64), now, now);
    return token;
  }

  /** The device a token belongs to, noting that it was seen. */
  authorize(token: string, now = Date.now()): string | null {
    const hash = hashToken(token);
    const row = this.db.prepare('SELECT device FROM devices WHERE token_hash = ?').get(hash) as { device: string } | undefined;
    if (!row) return null;
    this.db.prepare('UPDATE devices SET seen = ? WHERE token_hash = ?').run(now, hash);
    return row.device;
  }

  devices(): { device: string; paired: number; seen: number }[] {
    return this.db.prepare('SELECT device, paired, seen FROM devices ORDER BY seen DESC').all() as {
      device: string;
      paired: number;
      seen: number;
    }[];
  }

  // ---- Items ----

  private toMeta(row: Row): RemoteMeta {
    const meta: RemoteMeta = { key: row.key, rev: row.rev, modified: row.modified };
    if (row.deleted) meta.deleted = true;
    else {
      meta.kind = row.kind as 'json' | 'bytes';
      if (row.type) meta.type = row.type;
      if (row.size !== null) meta.size = row.size;
    }
    return meta;
  }

  private row(key: string): Row | undefined {
    return this.db.prepare('SELECT * FROM items WHERE key = ?').get(key) as Row | undefined;
  }

  meta(key: string): RemoteMeta | undefined {
    const row = this.row(key);
    return row && this.toMeta(row);
  }

  get(key: string): StoredItem | undefined {
    const row = this.row(key);
    if (!row || row.deleted) return undefined;
    const meta = this.toMeta(row);
    if (row.kind === 'json') return { meta, json: row.json ?? 'null' };
    return { meta, bytes: readFileSync(this.blobPath(row.rev)) };
  }

  /** Changes after `since`, oldest first, at most `limit`. */
  changes(since: number, limit = 500): { changes: RemoteMeta[]; more: boolean } {
    const rows = this.db.prepare('SELECT * FROM items WHERE rev > ? ORDER BY rev LIMIT ?').all(since, limit + 1) as unknown as Row[];
    const more = rows.length > limit;
    return { changes: rows.slice(0, limit).map((r) => this.toMeta(r)), more };
  }

  write(w: Write): WriteResult {
    const existing = this.row(w.key);
    // A deletion of something the server never had, or already deleted, changes nothing.
    if (!w.value && (!existing || existing.deleted)) {
      return { ok: true, rev: existing?.rev ?? this.rev };
    }
    if (existing && existing.rev > w.base && !w.force) return { ok: false, conflict: this.toMeta(existing) };

    const rev = this.rev + 1;
    // The bytes go to a temp file first, then into place: a crash never leaves a half-written value behind a row.
    if (w.value?.kind === 'bytes') {
      const tmp = `${this.blobPath(rev)}.tmp`;
      writeFileSync(tmp, w.value.bytes);
      renameSync(tmp, this.blobPath(rev));
    }
    this.db.exec('BEGIN');
    try {
      const v = w.value;
      this.db
        .prepare(
          `INSERT INTO items (key, rev, modified, deleted, kind, type, size, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET rev = excluded.rev, modified = excluded.modified, deleted = excluded.deleted,
             kind = excluded.kind, type = excluded.type, size = excluded.size, json = excluded.json`,
        )
        .run(
          w.key,
          rev,
          w.modified,
          v ? 0 : 1,
          v?.kind ?? null,
          v?.kind === 'bytes' ? v.type : null,
          v ? (v.kind === 'json' ? Buffer.byteLength(v.json) : v.bytes.length) : null,
          v?.kind === 'json' ? v.json : null,
        );
      this.setSetting('rev', String(rev));
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      rmSync(this.blobPath(rev), { force: true });
      throw err;
    }
    // The old value's bytes are no longer needed.
    if (existing?.kind === 'bytes' && !existing.deleted) rmSync(this.blobPath(existing.rev), { force: true });
    return { ok: true, rev };
  }

  private blobPath(rev: number): string {
    return join(this.blobs, `${rev}.bin`);
  }

  // ---- For the status page ----

  stats(): { items: number; deleted: number; bytes: number; lastChange: number | null } {
    const counts = this.db
      .prepare('SELECT SUM(deleted = 0) AS live, SUM(deleted = 1) AS dead, MAX(modified) AS last FROM items')
      .get() as { live: number | null; dead: number | null; last: number | null };
    let bytes = 0;
    if (existsSync(this.blobs)) for (const f of readdirSync(this.blobs)) bytes += statSync(join(this.blobs, f)).size;
    return { items: counts.live ?? 0, deleted: counts.dead ?? 0, bytes, lastChange: counts.last };
  }
}
