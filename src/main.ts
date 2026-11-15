import { fitFrame, fullscreenOnFirstTouch, installGuards } from './shell/guards';
import { inTauri } from './shell/platform';
import { Shell } from './shell/shell';
import { memoryBackend, openIdbBackend } from './storage/idb';
import { deviceInfo } from './storage/ids';
import { appStorage } from './storage/namespaced';
import type { Backend } from './storage/types';
import type { FinishedPictures } from './shell/types';
import { UpdateController, loadUpdateSettings } from './shell/updates';
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
  if (inTauri()) {
    try {
      const files = await import('./shell/tauriFiles');
      backend = await files.openTauriBackend();
      finished = files.tauriFinishedPictures();
    } catch (err) {
      console.error('App files unavailable; using browser storage instead', err);
    }
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
  // Family sync runs in the background when a parent has set it up (ADR 0024); kid screens never wait for it.
  const sync = new SyncService({ backend, shell: storage.shell });
  await new Shell(frame, storage, undefined, { finished, updates, sync }).start();
  sync.start();
  // Look for a newer version in the background (ADR 0009). It only shows in the parent area; nothing installs on
  // its own, and a failed check is only reported there too.
  if (updates && (await loadUpdateSettings(storage.shell)).checkOnStart) void updates.check();
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
