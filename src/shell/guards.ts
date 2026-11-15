// ADR 0003 rule 4 and ADR 0014: block what a web page can of the escape hatches.

/** Fired on the window when Ctrl+Shift+Q reaches the page. */
export const QUIT_KEYS_EVENT = 'crayonbox:quit-keys';

export function installGuards(win: Window = window): void {
  const doc = win.document;
  const block = (e: Event) => e.preventDefault();

  // The parent area is ordinary text UI (ADR 0016 rule 8): typing and selecting text work there.
  const inParentWorld = () => doc.body.dataset.world === 'parent';
  const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

  // The right-click menu only on the parent area's text boxes, for Cut, Copy and Paste: elsewhere it offers Back,
  // Reload and Print.
  doc.addEventListener('contextmenu', (e) => !(inParentWorld() && isField(e.target)) && e.preventDefault());
  doc.addEventListener('selectstart', (e) => !isField(e.target) && !inParentWorld() && e.preventDefault());
  doc.addEventListener('dragstart', block);
  // Pinch-zoom on touchpads and Ctrl+wheel zoom
  win.addEventListener('wheel', (e) => e.ctrlKey && e.preventDefault(), { passive: false });
  // Safari-style gesture events, harmless elsewhere
  doc.addEventListener('gesturestart', block);
  // Multi-touch pinch and edge swipes that touch-action: none might miss
  doc.addEventListener('touchmove', (e) => e.touches.length > 1 && e.preventDefault(), { passive: false });

  win.addEventListener(
    'keydown',
    (e) => {
      // The one shortcut that stays: Ctrl+Shift+Q, the parent's quit (ADR 0008). The Windows app quits on
      // QUIT_KEYS_EVENT (with the keyboard lock on, its hook catches the keys before the page does). The browser
      // can't quit a tab, so there it only leaves full screen.
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
        win.dispatchEvent(new Event(QUIT_KEYS_EVENT));
        return;
      }
      // While developing, keep reload and the dev tools reachable.
      if (import.meta.env.DEV && (e.key === 'F5' || e.key === 'F12')) return;
      // Parents type names, addresses and codes in the parent area: plain keys, and the editing shortcuts in a text
      // box (paste the sync server's address, owner 2026-11-15). Other browser shortcuts stay blocked even there.
      if (inParentWorld()) {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) return;
        if (isEditingShortcut(e, isField(e.target))) return;
      }
      e.preventDefault();
    },
    { capture: true },
  );
}

const FIELD_CTRL_KEYS = new Set(['a', 'c', 'v', 'x', 'z', 'y', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'home', 'end', 'backspace', 'delete', 'insert']);

/**
 * The Ctrl shortcuts the parent area lets through: Ctrl+C anywhere (copy a code shown on screen); in a text box
 * also select all, cut, paste, undo, redo, word moves and deletes, and Ctrl+Insert. Never Alt or the Windows key.
 * (Shift+Insert has no Ctrl, so it passes as a plain key.)
 */
export function isEditingShortcut(e: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey' | 'key'>, inField: boolean): boolean {
  if (e.altKey || e.metaKey) return false;
  const key = e.key.toLowerCase();
  if (e.ctrlKey && key === 'c') return true;
  return inField && e.ctrlKey && FIELD_CTRL_KEYS.has(key);
}

/** Asks for full screen on the first touch. Browsers only allow it from a user gesture. */
export function fullscreenOnFirstTouch(win: Window = window): void {
  const doc = win.document;
  const go = () => {
    if (!doc.fullscreenElement && doc.documentElement.requestFullscreen) {
      void doc.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
  };
  win.addEventListener('pointerup', go, { capture: true });
}

/**
 * Makes the frame fill the window (ADR 0019). Only a window smaller than the 1280 x 800 reference screen scales the
 * frame down, by just enough to fit; larger windows give the screens more room instead of bigger buttons.
 */
export function fitFrame(frame: HTMLElement, win: Window = window): void {
  const fit = () => {
    const w = win.innerWidth;
    const h = win.innerHeight;
    const scale = Math.min(1, w / 1280, h / 800);
    frame.style.width = `${w / scale}px`;
    frame.style.height = `${h / scale}px`;
    frame.style.setProperty('--frame-scale', String(scale));
  };
  fit();
  win.addEventListener('resize', fit);
}
