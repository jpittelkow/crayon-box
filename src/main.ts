import { fitFrame, fullscreenOnFirstTouch, installGuards } from './shell/guards';
import { Shell } from './shell/shell';
import { memoryBackend, openIdbBackend } from './storage/idb';
import { appStorage } from './storage/namespaced';
import './ui/tokens.css';
import './ui/kid.css';
import './shell/shell.css';

async function boot(): Promise<void> {
  installGuards();
  fullscreenOnFirstTouch();

  // Ask the browser to keep stored art (ADR 0014). Only granted on a secure origin such as localhost.
  void navigator.storage?.persist?.().catch(() => false);

  let backend;
  try {
    backend = await openIdbBackend();
  } catch (err) {
    console.error('IndexedDB unavailable; pictures will not be kept', err);
    backend = memoryBackend();
  }

  const app = document.getElementById('app')!;
  const frame = document.createElement('div');
  frame.className = 'frame';
  app.replaceChildren(frame);
  fitFrame(frame);

  await new Shell(frame, appStorage(backend)).start();
}

void boot();
