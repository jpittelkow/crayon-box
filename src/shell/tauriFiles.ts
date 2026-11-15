// The Windows app's files (milestone 2, phase B; ADR 0007), through Tauri's fs plugin. Loaded only inside the Tauri
// window (`inTauri`), so the browser version never pulls the plugin in.
//
// Two places, both allowed in `src-tauri/capabilities/default.json` and nowhere else:
// - the working copy: `store\` in the app's local data folder, behind `openFileBackend`;
// - finished pictures for parents: `Pictures\Coloring Book\Art\<kid id>\`. Windows says where Pictures is, which
//   follows a move to OneDrive.
import { join, pictureDir } from '@tauri-apps/api/path';
import * as tauriFs from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { openFileBackend, type FileSystem } from '../storage/files';
import type { Backend } from '../storage/types';
import type { FinishedPictures } from './types';

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

/** Finished pictures in the Pictures folder (ADR 0007), for parents to find, back up and share. */
export function tauriFinishedPictures(fs: Fs = tauriFs, open: (path: string) => Promise<void> = openPath): FinishedPictures {
  const files = tauriFileSystem(BaseDirectory.Picture, ART, fs);
  return {
    async save(kidId, name, png) {
      const dir = kidFolder(kidId);
      await files.mkdir(dir);
      // Temp file, then rename, in the same folder: OneDrive may hold the old file open, and then the rename fails
      // with the old picture still whole. The next save tries again.
      const tmp = `${dir}/.${name}.tmp`;
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
