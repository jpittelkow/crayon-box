// ADR 0003 rule 4 and ADR 0014: block what a web page can of the escape hatches.

export function installGuards(win: Window = window): void {
  const doc = win.document;
  const block = (e: Event) => e.preventDefault();

  // The parent area is ordinary text UI (ADR 0016 rule 8): typing and selecting text work there.
  const inParentWorld = () => doc.body.dataset.world === 'parent';
  const isField = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

  doc.addEventListener('contextmenu', block);
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
      // The one shortcut that stays: Ctrl+Shift+Q, the parent's quit (ADR 0008). The browser can't quit a tab, so
      // in the web milestone it only leaves full screen.
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        if (doc.fullscreenElement) void doc.exitFullscreen().catch(() => {});
        return;
      }
      // While developing, keep reload and the dev tools reachable.
      if (import.meta.env.DEV && (e.key === 'F5' || e.key === 'F12')) return;
      // Parents type names in the parent area; browser shortcuts stay blocked even there.
      if (inParentWorld() && !e.ctrlKey && !e.altKey && !e.metaKey) return;
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
