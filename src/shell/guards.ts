// ADR 0003 rule 4 and ADR 0014: block what a web page can of the escape hatches.

export function installGuards(win: Window = window): void {
  const doc = win.document;
  const block = (e: Event) => e.preventDefault();

  doc.addEventListener('contextmenu', block);
  doc.addEventListener('selectstart', block);
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
      // The one shortcut that stays: Ctrl+Shift+Q, the parent's quit (ADR 0008). The browser can't quit a tab, so
      // in the web milestone it only leaves full screen.
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
        return;
      }
      // While developing, keep reload and the dev tools reachable.
      if (import.meta.env.DEV && (e.key === 'F5' || e.key === 'F12')) return;
      e.preventDefault();
    },
    { capture: true },
  );
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

/** Keeps the 1280 x 800 reference frame as large as the window allows (ADR 0016). */
export function fitFrame(frame: HTMLElement, win: Window = window): void {
  const fit = () => {
    const scale = Math.min(win.innerWidth / 1280, win.innerHeight / 800);
    frame.style.setProperty('--frame-scale', String(scale));
  };
  fit();
  win.addEventListener('resize', fit);
}
