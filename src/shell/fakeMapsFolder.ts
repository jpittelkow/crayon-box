// A stand-in for the Windows app's maps folder (ADR 0043), for the dev server only (`?fake-maps`, loaded behind
// `import.meta.env.DEV` in `main.ts`, never in a built app). It holds the generic example map and one broken file,
// unless a test puts its own files on `window.__fakeMaps` before the app starts. Opening the folder is counted on
// `window.__fakeMapsOpened`.
import example from '../games/racing/maps/examples/test-loop.json?raw';
import type { MapsFolder, MapsFolderFile } from './types';

type FakeWindow = Window & { __fakeMaps?: MapsFolderFile[]; __fakeMapsOpened?: number };

/** The files the stand-in holds when a test gives none: the example, and a file that isn't a map. */
export const FAKE_MAPS: MapsFolderFile[] = [
  { name: 'test-loop.json', text: example },
  { name: 'broken.json', text: '{ "format": "crayon-box-map", "version": 1, "name": "Broken" }' },
];

export function fakeMapsFolder(win: Window = window): MapsFolder {
  const w = win as FakeWindow;
  return {
    read: async () => [...(w.__fakeMaps ?? FAKE_MAPS)],
    openFolder: async () => void (w.__fakeMapsOpened = (w.__fakeMapsOpened ?? 0) + 1),
  };
}
