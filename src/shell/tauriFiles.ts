// The Windows app's files (milestone 2, phase B; ADR 0007), through Tauri's fs plugin. Loaded only inside the Tauri
// window (`inTauri`), so the browser version never pulls the plugin in.
//
// Three places, all allowed in `src-tauri/capabilities/default.json` and nowhere else:
// - the working copy: `store\` in the app's local data folder, behind `openFileBackend`;
// - finished pictures for parents: `Pictures\Coloring Book\Art\<kid id>\`. Windows says where Pictures is, which
//   follows a move to OneDrive;
// - the driving game's maps folder, `maps\` in the app's local data folder, read only (ADR 0043).
import { appLocalDataDir, join, pictureDir } from '@tauri-apps/api/path';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { openFileBackend, type FileSystem } from '../storage/files';
import type { Backend } from '../storage/types';
import type { FinishedPictures, MapsFolder, MapsFolderFile, PagesFolder, PagesFolderFile } from './types';

type Fs = Pick<typeof tauriFs, 'readFile' | 'writeFile' | 'rename' | 'remove' | 'mkdir' | 'readDir' | 'exists'>;

/** A FileSystem rooted at `root` under one of Tauri's base folders. */
export function tauriFileSystem(baseDir: BaseDirectory, root: string, fs: Fs = tauriFs): FileSystem {
  const at = (path: string) => (path ? `${root}/${path}` : root);
  const opts = { baseDir };
  return {
    async read(path) {
      try {
        return await fs.readFile(at(path), opts);
      } catch (err) {
        if (!(await fs.exists(at(path), opts))) return undefined;
        throw err;
      }
    },
    write: (path, data) => fs.writeFile(at(path), data, opts),
    rename: (from, to) => fs.rename(at(from), at(to), { oldPathBaseDir: baseDir, newPathBaseDir: baseDir }),
    async remove(path) {
      if (await fs.exists(at(path), opts)) await fs.remove(at(path), opts);
    },
    mkdir: (path) => fs.mkdir(at(path), { ...opts, recursive: true }),
    async listFiles(dir) {
      const out: string[] = [];
      const walk = async (rel: string) => {
        const full = at(rel ? `${dir}/${rel}` : dir);
        for (const entry of await fs.readDir(full, opts)) {
          const child = rel ? `${rel}/${entry.name}` : entry.name;
          if (entry.isDirectory) await walk(child);
          else if (entry.isFile) out.push(child);
        }
      };
      if (await fs.exists(at(dir), opts)) await walk('');
      return out;
    },
  };
}

/** The working copy, in the app's local data folder (not roaming: pictures are too big to roam). */
export function openTauriBackend(): Promise<Backend> {
  return openFileBackend(tauriFileSystem(BaseDirectory.AppLocalData, 'store'));
}

const ART = 'Coloring Book/Art';

/** A kid's folder name. Kid ids are already safe (`star`, `k3f9x2ab`); anything else is made safe. */
export function kidFolder(kidId: string): string {
  return /^[a-z0-9][a-z0-9-]*$/.test(kidId) ? kidId : kidId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase() || 'kid';
}

/** The temp file a finished picture is written to before it takes its real name. Never a dot file (see `save`). */
export function finishedTempName(name: string): string {
  return `${name}.tmp`;
}

/**
 * Whether this account has a Pictures folder. Windows always does. A Linux account only has one when its standard
 * folders are set up (`xdg-user-dirs`); without it there is nowhere for finished pictures or the Pages folder, and
 * the app goes on without them (ADR 0046).
 */
export async function picturesFolderFound(dir: () => Promise<string> = pictureDir): Promise<boolean> {
  try {
    return (await dir()).length > 0;
  } catch {
    return false;
  }
}

/** Finished pictures in the Pictures folder (ADR 0007), for parents to find, back up and share. */
export function tauriFinishedPictures(fs: Fs = tauriFs, open: (path: string) => Promise<void> = openPath): FinishedPictures {
  const files = tauriFileSystem(BaseDirectory.Picture, ART, fs);
  return {
    async save(kidId, name, png) {
      const dir = kidFolder(kidId);
      await files.mkdir(dir);
      // Temp file, then rename, in the same folder: OneDrive may hold the old file open, and then the rename fails
      // with the old picture still whole. The next save tries again. The temp name must not start with a dot: on
      // Linux the fs plugin's scope does not match dot files, and the write is refused (ADR 0046).
      const tmp = `${dir}/${finishedTempName(name)}`;
      await files.write(tmp, new Uint8Array(await png.arrayBuffer()));
      try {
        await files.rename(tmp, `${dir}/${name}`);
      } catch (err) {
        await files.remove(tmp).catch(() => {});
        throw err;
      }
    },
    async remove(kidId, name) {
      await files.remove(`${kidFolder(kidId)}/${name}`);
    },
    async openFolder() {
      await files.mkdir('');
      await open(await join(await pictureDir(), 'Coloring Book', 'Art'));
    },
  };
}

const PAGES = 'Coloring Book/Pages';
const ADDED = 'Added';
const NOT_ADDED = 'Not added';
const PAGE_FILE = /\.(png|jpe?g|svg|pdf)$/i;
const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' };

/** The Pages folder (ADR 0005, phase F): files dropped in become family pages at the next start. */
export function tauriPagesFolder(fs: Fs = tauriFs, open: (path: string) => Promise<void> = openPath): PagesFolder {
  const opts = { baseDir: BaseDirectory.Picture };
  const at = (rel: string) => (rel ? `${PAGES}/${rel}` : PAGES);
  return {
    async list() {
      await fs.mkdir(PAGES, { ...opts, recursive: true });
      const out: PagesFolderFile[] = [];
      for (const entry of await fs.readDir(PAGES, opts)) {
        if (entry.isFile && PAGE_FILE.test(entry.name)) out.push({ folder: '', name: entry.name, path: entry.name });
        if (entry.isDirectory && entry.name !== ADDED && entry.name !== NOT_ADDED) {
          for (const inner of await fs.readDir(at(entry.name), opts)) {
            if (inner.isFile && PAGE_FILE.test(inner.name)) {
              out.push({ folder: entry.name, name: inner.name, path: `${entry.name}/${inner.name}` });
            }
          }
        }
      }
      return out;
    },
    async read(path) {
      const data = await fs.readFile(at(path), opts);
      const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
      return new Blob([data], { type: TYPES[ext] ?? 'application/octet-stream' });
    },
    async done(path, added) {
      const dir = added ? ADDED : NOT_ADDED;
      await fs.mkdir(at(dir), { ...opts, recursive: true });
      const name = path.slice(path.lastIndexOf('/') + 1);
      let target = `${dir}/${name}`;
      if (await fs.exists(at(target), opts)) target = `${dir}/${Date.now()}-${name}`;
      await fs.rename(at(path), at(target), { oldPathBaseDir: BaseDirectory.Picture, newPathBaseDir: BaseDirectory.Picture });
    },
    async openFolder() {
      await fs.mkdir(PAGES, { ...opts, recursive: true });
      await open(await join(await pictureDir(), 'Coloring Book', 'Pages'));
    },
  };
}

const MAPS = 'maps';
const MAP_FILE = /\.json$/i;

/**
 * The driving game's maps folder (ADR 0043): `maps\` in the app's local data folder, next to `store\`. The app may
 * only make the folder and read it (`src-tauri/capabilities/default.json`); files get there by hand for now.
 */
export function tauriMapsFolder(fs: Fs = tauriFs, open: (path: string) => Promise<void> = openPath): MapsFolder {
  const opts = { baseDir: BaseDirectory.AppLocalData };
  const text = new TextDecoder('utf-8');
  return {
    async read() {
      await fs.mkdir(MAPS, { ...opts, recursive: true });
      const names = (await fs.readDir(MAPS, opts)).filter((e) => e.isFile && MAP_FILE.test(e.name)).map((e) => e.name).sort();
      const out: MapsFolderFile[] = [];
      for (const name of names) {
        try {
          out.push({ name, text: text.decode(await fs.readFile(`${MAPS}/${name}`, opts)).replace(/^﻿/, '') });
        } catch (err) {
          out.push({ name, text: '', error: String(err) });
        }
      }
      return out;
    },
    async openFolder() {
      await fs.mkdir(MAPS, { ...opts, recursive: true });
      await open(await join(await appLocalDataDir(), MAPS));
    },
  };
}
