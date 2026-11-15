// The picker's pictures, kept so the picker opens at once (playtest, 2026-11-15: drawing all of them every time
// the picker opened froze the screen for about 6 s). Each picture is kept in memory for the session and, in a
// release build, on this device under `local/`, keyed by the app's version so a new release draws them afresh.
import type { GameStorage } from '../../../storage/types';
import { shippedPicture } from './shippedPictures';

const memory = new Map<string, string>();

/** Where a picture is kept on the device: `local/` never syncs (ADR 0024). */
export const picturePath = (version: string, key: string) => `local/pictures/${version}/${key.replace(/[^a-z0-9-]/gi, '_')}.png`;

/**
 * A picture's URL: shipped with the app (shippedPictures.ts) when there is one, else from memory, else from the
 * device, else drawn with `draw` (a data URL) and kept. `storage` is
 * left out in development, where the models change without the version changing.
 */
export async function cachedPicture(key: string, draw: () => string, storage?: GameStorage, version = ''): Promise<string> {
  const shipped = shippedPicture(key);
  if (shipped) return shipped;
  const known = memory.get(key);
  if (known) return known;
  const path = picturePath(version, key);
  const saved = storage ? await storage.getBlob(path).catch(() => undefined) : undefined;
  if (saved) {
    const url = URL.createObjectURL(saved);
    memory.set(key, url);
    return url;
  }
  const url = draw();
  memory.set(key, url);
  if (storage) {
    void (async () => {
      try {
        // Pictures from an older version are dropped first, so they don't pile up.
        for (const old of await storage.list('local/pictures/')) if (!old.startsWith(`local/pictures/${version}/`)) await storage.delete(old);
        await storage.putBlob(path, await (await fetch(url)).blob());
      } catch {
        // Keeping it is only a speed-up.
      }
    })();
  }
  return url;
}

/** For tests: forget what is in memory. */
export function forgetPictures(): void {
  memory.clear();
}
