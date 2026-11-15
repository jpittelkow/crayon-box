import { describe, expect, it } from 'vitest';
import { memoryBackend } from '../storage/idb';
import { appStorage } from '../storage/namespaced';
import {
  DEFAULT_KIOSK,
  KioskControl,
  keyboardModeFor,
  loadKioskSettings,
  screenKind,
  type KeyboardMode,
  type KioskBridge,
} from './kiosk';

function recorder() {
  const calls: string[] = [];
  const bridge: KioskBridge = {
    setKeyboardMode: async (m: KeyboardMode) => void calls.push(`keys:${m}`),
    setLocked: async (on) => void calls.push(`locked:${on}`),
    quit: async () => void calls.push('quit'),
    onQuitRequested: () => {},
    startAtSignIn: async () => false,
    setStartAtSignIn: async () => {},
  };
  return { calls, bridge };
}

describe('kiosk lock (ADR 0014)', () => {
  it('locks by default, and keeps its settings on the device', async () => {
    const shell = appStorage(memoryBackend()).shell;
    expect(await loadKioskSettings(shell)).toEqual(DEFAULT_KIOSK);
    expect(DEFAULT_KIOSK).toEqual({ keepFullScreen: true, lockKeyboard: true });
    const { bridge } = recorder();
    const c = new KioskControl(bridge, DEFAULT_KIOSK);
    await c.update(shell, { lockKeyboard: false });
    expect(await shell.list('local/')).toContain('local/kiosk.json');
    expect((await loadKioskSettings(shell)).lockKeyboard).toBe(false);
  });

  it('gives the parent area every key, the driving game its keys, and the rest nothing', () => {
    const on = DEFAULT_KIOSK;
    expect(keyboardModeFor('parent', on)).toBe('off');
    expect(keyboardModeFor('kid', on)).toBe('kid');
    expect(keyboardModeFor('driving', on)).toBe('driving');
    const off = { ...on, lockKeyboard: false };
    expect(keyboardModeFor('kid', off)).toBe('off');
    expect(keyboardModeFor('driving', off)).toBe('off');
  });

  it('tells screens apart by their data-screen', () => {
    expect(screenKind('parent-area')).toBe('parent');
    expect(screenKind('game-racing')).toBe('driving');
    expect(screenKind('kid-picker')).toBe('kid');
    expect(screenKind('parent-gate')).toBe('kid'); // the gate is touch only
    expect(screenKind(undefined)).toBe('kid');
  });

  it('follows the screen, and only tells the shell when the mode changes', async () => {
    const { calls, bridge } = recorder();
    const c = new KioskControl(bridge, DEFAULT_KIOSK);
    await c.start();
    await c.showing('kid');
    await c.showing('parent');
    await c.showing('kid');
    await c.showing('driving');
    expect(calls).toEqual(['locked:true', 'keys:kid', 'keys:off', 'keys:kid', 'keys:driving']);
  });

  it('applies a changed setting at once', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const { calls, bridge } = recorder();
    const c = new KioskControl(bridge, DEFAULT_KIOSK);
    await c.start();
    calls.length = 0;
    await c.update(shell, { keepFullScreen: false });
    await c.update(shell, { lockKeyboard: false });
    expect(calls).toEqual(['locked:false', 'keys:off']);
  });

  it('unlocks the window from the parent area for this visit only', async () => {
    const shell = appStorage(memoryBackend()).shell;
    const { calls, bridge } = recorder();
    const c = new KioskControl(bridge, DEFAULT_KIOSK);
    await c.start();
    await c.showing('parent');
    calls.length = 0;
    expect(c.windowLocked).toBe(true);
    await c.setWindowUnlocked(true);
    expect(c.windowLocked).toBe(false);
    await c.showing('parent'); // moving between parent screens keeps it unlocked
    await c.showing('kid'); // back to the kids: locked again, and the setting never changed
    expect(calls).toEqual(['locked:false', 'locked:true', 'keys:kid']);
    expect(c.windowLocked).toBe(true);
    expect((await loadKioskSettings(shell)).keepFullScreen).toBe(true);
  });

  it('has nothing to unlock when the app is not kept full screen', async () => {
    const { calls, bridge } = recorder();
    const c = new KioskControl(bridge, { ...DEFAULT_KIOSK, keepFullScreen: false });
    await c.start();
    calls.length = 0;
    await c.setWindowUnlocked(true);
    await c.showing('parent');
    await c.showing('kid');
    expect(calls).toEqual(['keys:off', 'keys:kid']); // the keyboard only: the window was never locked
    expect(c.windowLocked).toBe(false);
  });
});
