// A stand-in for the Windows app's kiosk lock, for the dev server only (`?fake-kiosk`, loaded behind
// `import.meta.env.DEV` in `main.ts`, never in a built app). It records what it is asked on `window.__kiosk`, so
// browser tests can check the keyboard mode per screen, the full-screen switch and quitting.
import type { KeyboardMode, KioskBridge } from './kiosk';

export interface FakeKioskLog {
  mode: KeyboardMode | null;
  locked: boolean | null;
  startAtSignIn: boolean;
  quits: number;
  /** Simulates Ctrl+Shift+Q from the keyboard hook. */
  pressQuitKeys(): void;
}

export function fakeKiosk(win: Window = window): KioskBridge {
  let quitHandler: (() => void) | null = null;
  const log: FakeKioskLog = {
    mode: null,
    locked: null,
    startAtSignIn: false,
    quits: 0,
    pressQuitKeys: () => quitHandler?.(),
  };
  (win as unknown as { __kiosk: FakeKioskLog }).__kiosk = log;
  return {
    setKeyboardMode: async (mode) => void (log.mode = mode),
    setLocked: async (on) => void (log.locked = on),
    quit: async () => void log.quits++,
    onQuitRequested: (fn) => void (quitHandler = fn),
    startAtSignIn: async () => log.startAtSignIn,
    setStartAtSignIn: async (on) => void (log.startAtSignIn = on),
  };
}
