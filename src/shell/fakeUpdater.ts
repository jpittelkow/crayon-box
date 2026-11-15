// A stand-in for the Windows app's updater, for the dev server only (browser tests and trying the Updates screen in
// a browser). `main.ts` loads it behind `import.meta.env.DEV`, so it is never in a built app. Picked with
// `?fake-updates=<mode>`:
// - `available`: version 9.9.9 is out, and installing it goes through to "restarting";
// - `none`: this is the newest version;
// - `offline`: the release can't be reached;
// - `broken`: version 9.9.9 is out, but its download fails.
import type { AvailableUpdate, Updater } from './updates';

export const FAKE_VERSION = '0.0.0-dev';
export const FAKE_NEW_VERSION = '9.9.9';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function fakeUpdater(mode: string): Updater {
  return {
    currentVersion: async () => FAKE_VERSION,
    async check(): Promise<AvailableUpdate | null> {
      await pause(150);
      if (mode === 'offline') throw new Error('error sending request');
      if (mode !== 'available' && mode !== 'broken') return null;
      return {
        version: FAKE_NEW_VERSION,
        notes: 'Bigger color buttons.\nThe driving game starts faster.',
        date: '2026-11-14T12:00:00Z',
        async install(onProgress) {
          for (const p of [0, 0.25, 0.5, 0.75]) {
            onProgress(p);
            await pause(60);
          }
          if (mode === 'broken') throw new Error('signature does not match');
          onProgress(1);
        },
      };
    },
  };
}
