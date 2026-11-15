// The Windows app's kiosk lock (ADR 0014), through Tauri: the window API for full screen, the app's own commands
// in `src-tauri/src/kiosk.rs` for the keyboard hook and quitting, and the autostart plugin. Loaded only inside the
// Tauri window (`inTauri`).
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import type { KeyboardMode, KioskBridge } from './kiosk';

export function tauriKiosk(): KioskBridge {
  const win = getCurrentWindow();
  return {
    setKeyboardMode: (mode: KeyboardMode) => invoke('set_keyboard_mode', { mode }),
    async setLocked(on) {
      await win.setFullscreen(on);
      await win.setResizable(!on);
      await win.setMinimizable(!on);
      await invoke('set_close_allowed', { allowed: !on });
    },
    quit: () => invoke('quit_app'),
    onQuitRequested(fn) {
      void listen('kiosk://quit-requested', () => fn());
    },
    startAtSignIn: () => isEnabled(),
    setStartAtSignIn: (on) => (on ? enable() : disable()),
  };
}
