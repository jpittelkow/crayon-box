import { el, kidButton } from '../ui/kid';
import { drawAvatar, kidLabel } from './profiles';
import type { KidProfile } from './types';

/** How long the lock must be held before the parent gate shows (ADR 0008). */
export const LOCK_HOLD_MS = 1000;

export interface KidPickerOptions {
  kids: KidProfile[];
  photos: Map<string, string>;
  showNames: boolean;
  onPick(kid: KidProfile): void;
  onUnlock(): void;
}

/**
 * The first screen: one big badge per kid (ADR 0007, 0016, 0018), the kid's photo or symbol on their color, and
 * their name under it when the parent turned names on. Manila ground, since no kid is picked yet.
 */
export function kidPickerScreen(opts: KidPickerOptions): HTMLElement {
  const screen = el('div', 'screen kid-picker', { 'data-screen': 'kid-picker' });
  screen.style.setProperty('--ground', 'var(--manila)');
  for (const cls of ['deco deco-a', 'deco deco-b', 'deco deco-c']) {
    screen.append(el('div', cls, { 'aria-hidden': 'true' }));
  }

  const row = el('div', 'kid-picker-row');
  if (opts.kids.length > 4) row.classList.add('is-crowded');
  for (const kid of opts.kids) {
    const badge = kidButton({ kind: 'badge-xl', label: `${kidLabel(kid)} kid`, onTap: () => opts.onPick(kid) });
    drawAvatar(badge, kid, opts.photos.get(kid.id), 124);
    badge.dataset.kid = kid.id;
    const column = el('div', 'kid-column');
    column.append(badge);
    if (opts.showNames && kid.name) {
      // The one piece of text on a kid screen, and only when a parent turned it on (ADR 0018).
      const name = el('div', 'kid-name', { 'aria-hidden': 'true' });
      name.textContent = kid.name;
      column.append(name);
    }
    row.append(column);
  }
  screen.append(row, lockButton(opts.onUnlock));
  return screen;
}

/**
 * Small, quiet, and only answers a 1-second hold with no animation, so stray taps and a curious toddler watching a
 * fill bar get nothing (ADR 0008).
 */
export function lockButton(onUnlock: () => void): HTMLElement {
  const lock = el('button', 'lock-button', { type: 'button', 'aria-label': 'Grown-ups: press and hold' });
  lock.innerHTML =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--lock-ink)" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/>' +
    '<path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointer: number | null = null;
  const cancel = () => {
    clearTimeout(timer);
    pointer = null;
  };
  lock.addEventListener('pointerdown', (e) => {
    if (pointer !== null) return;
    pointer = e.pointerId;
    try {
      lock.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events may not be capturable.
    }
    timer = setTimeout(() => {
      pointer = null;
      onUnlock();
    }, LOCK_HOLD_MS);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    lock.addEventListener(type, (e) => {
      if (e.pointerId === pointer) cancel();
    });
  }
  return lock;
}
