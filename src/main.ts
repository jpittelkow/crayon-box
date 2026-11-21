import { QUIT_KEYS_EVENT, fitFrame, fullscreenOnFirstTouch, installGuards } from './shell/guards';
import { inTauri } from './shell/platform';
import { Shell } from './shell/shell';
import { memoryBackend, openIdbBackend } from './storage/idb';
import { deviceInfo } from './storage/ids';
import { appStorage } from './storage/namespaced';
import type { Backend } from './storage/types';
import type { FinishedPictures, MapsFolder, PagesFolder } from './shell/types';
import { UpdateController, loadUpdateSettings } from './shell/updates';
import { KioskControl, loadKioskSettings, type KioskBridge } from './shell/kiosk';
import { SyncService } from './sync/service';
import '@fontsource/fredoka/600.css';
import './ui/tokens.css';
import './ui/kid.css';
import './shell/shell.css';

async function boot(): Promise<void> {
  document.body.dataset.world = 'kid';
  installGuards();
  // In the browser the page asks for full screen itself; the Windows app's window handles that (phase D, ADR 0014).
  if (!inTauri()) fullscreenOnFirstTouch();

  // Ask the browser to keep stored art (ADR 0014). Only granted on a secure origin such as localhost. Harmless in
  // the Windows app, whose web storage lives in its own app data folder.
  void navigator.storage?.persist?.().catch(() => false);

  // The Windows app keeps everything as files (milestone 2, phase B); the browser keeps it in IndexedDB.
  let backend: Backend | undefined;
  let finished: FinishedPictures | undefined;
  let pagesFolder: PagesFolder | undefined;
  let mapsFolder: MapsFolder | undefined;
  let noPicturesFolder = false;
  if (inTauri()) {
    try {
      const files = await import('./shell/tauriFiles');
      backend = await files.openTauriBackend();
      // Both live in the account's Pictures folder, which a bare Linux account may not have (ADR 0046).
      if (await files.picturesFolderFound()) {
        finished = files.tauriFinishedPictures();
        pagesFolder = files.tauriPagesFolder();
      } else {
        noPicturesFolder = true;
        console.warn('This account has no Pictures folder; finished pictures and the Pages folder are off');
      }
      mapsFolder = files.tauriMapsFolder();
    } catch (err) {
      console.error('App files unavailable; using browser storage instead', err);
    }
  } else if (import.meta.env.DEV && new URLSearchParams(location.search).has('fake-maps')) {
    // The browser has no maps folder (ADR 0043); on the dev server `?fake-maps` stands in for it (`fakeMapsFolder.ts`).
    mapsFolder = (await import('./shell/fakeMapsFolder')).fakeMapsFolder();
  }
  if (!backend) {
    try {
      backend = await openIdbBackend();
    } catch (err) {
      console.error('IndexedDB unavailable; pictures will not be kept', err);
      backend = memoryBackend();
    }
  }

  const app = document.getElementById('app')!;
  const frame = document.createElement('div');
  frame.className = 'frame';
  app.replaceChildren(frame);
  fitFrame(frame);

  const storage = appStorage(backend);
  await deviceInfo(storage.shell);
  const updates = await openUpdates();
  const kiosk = await openKiosk(storage.shell);
  // Family sync runs in the background when a parent has set it up (ADR 0024); kid screens never wait for it.
  const sync = new SyncService({ backend, shell: storage.shell });
  const shell = new Shell(frame, storage, undefined, { finished, pagesFolder, noPicturesFolder, mapsFolder, updates, kiosk, sync });
  kiosk?.onQuitRequested(() => void shell.quit());
  if (kiosk) window.addEventListener(QUIT_KEYS_EVENT, () => void shell.quit());
  await shell.start();
  sync.start();
  // Files waiting in the Pages folder become family pages (phase F), in the background after start.
  if (pagesFolder) {
    const folder = pagesFolder;
    setTimeout(() => {
      void (async () => {
        const [{ importPagesFolder }, { importFile }] = await Promise.all([
          import('./games/coloring/folderImport'),
          import('./games/coloring/importPage'),
        ]);
        await importPagesFolder(storage.game('coloring'), folder, importFile);
      })().catch((err) => console.error('Pages folder import failed', err));
    }, 3000);
  }
  // Look for a newer version in the background (ADR 0009). It only shows in the parent area; nothing installs on
  // its own, and a failed check is only reported there too.
  if (updates && (await loadUpdateSettings(storage.shell)).checkOnStart) void updates.check();
}

/** The Windows app's kiosk lock (ADR 0014); on the dev server, `?fake-kiosk` stands in for it (`fakeKiosk.ts`). */
async function openKiosk(shell: Parameters<typeof loadKioskSettings>[0]): Promise<KioskControl | undefined> {
  try {
    let bridge: KioskBridge | undefined;
    if (inTauri()) bridge = (await import('./shell/tauriKiosk')).tauriKiosk();
    else if (import.meta.env.DEV && new URLSearchParams(location.search).has('fake-kiosk')) {
      bridge = (await import('./shell/fakeKiosk')).fakeKiosk();
    }
    if (!bridge) return undefined;
    const control = new KioskControl(bridge, await loadKioskSettings(shell));
    await control.start();
    return control;
  } catch (err) {
    console.error('Kiosk lock unavailable', err);
    return undefined;
  }
}

/** The Windows app's updater; on the dev server, `?fake-updates=<mode>` stands in for it (`fakeUpdater.ts`). */
async function openUpdates(): Promise<UpdateController | undefined> {
  try {
    if (inTauri()) return new UpdateController((await import('./shell/tauriUpdater')).tauriUpdater());
    if (import.meta.env.DEV) {
      const mode = new URLSearchParams(location.search).get('fake-updates');
      if (mode) return new UpdateController((await import('./shell/fakeUpdater')).fakeUpdater(mode));
    }
  } catch (err) {
    console.error('Updates unavailable', err);
  }
  return undefined;
}

void boot();
