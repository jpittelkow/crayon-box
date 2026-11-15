// The Windows app's updater (ADR 0009), through Tauri's updater plugin. Loaded only inside the Tauri window
// (`inTauri`). Where it looks (`latest.json` on the newest published release) and the public key every download must
// be signed with are set in `src-tauri/tauri.conf.json`; the plugin refuses a download whose signature doesn't match.
import { getVersion } from '@tauri-apps/api/app';
import { check } from '@tauri-apps/plugin-updater';
import type { AvailableUpdate, Updater } from './updates';

export function tauriUpdater(): Updater {
  return {
    currentVersion: getVersion,
    async check(): Promise<AvailableUpdate | null> {
      const update = await check({ timeout: 30_000 });
      if (!update) return null;
      return {
        version: update.version,
        notes: update.body ?? '',
        date: update.date,
        async install(onProgress) {
          let total: number | undefined;
          let received = 0;
          // On Windows this closes the app once the installer starts; the installer opens the new version.
          await update.downloadAndInstall((event) => {
            if (event.event === 'Started') {
              total = event.data.contentLength || undefined;
              onProgress(total ? 0 : null);
            } else if (event.event === 'Progress') {
              received += event.data.chunkLength;
              onProgress(total ? Math.min(1, received / total) : null);
            } else {
              onProgress(1);
            }
          });
        },
        close: () => update.close(),
      };
    },
  };
}
