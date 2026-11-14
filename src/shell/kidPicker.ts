import { symbolIcon } from '../ui/icons';
import { el, kidButton } from '../ui/kid';
import { kidColorVar } from './profiles';
import type { KidProfile } from './types';

/** The first screen: one big badge per kid (ADR 0007, 0016). Manila ground, since no kid is picked yet. */
export function kidPickerScreen(kids: KidProfile[], onPick: (kid: KidProfile) => void): HTMLElement {
  const screen = el('div', 'screen kid-picker', { 'data-screen': 'kid-picker' });
  screen.style.setProperty('--ground', 'var(--manila)');

  for (const [cls] of [['deco deco-a'], ['deco deco-b'], ['deco deco-c']]) {
    screen.append(el('div', cls, { 'aria-hidden': 'true' }));
  }

  const row = el('div', 'kid-picker-row');
  for (const kid of kids) {
    const badge = kidButton({
      kind: 'badge-xl',
      label: `${kid.id[0].toUpperCase()}${kid.id.slice(1)} kid`,
      html: symbolIcon(kid.id, 124),
      onTap: () => onPick(kid),
    });
    badge.style.background = kidColorVar(kid);
    badge.dataset.kid = kid.id;
    row.append(badge);
  }
  screen.append(row);
  return screen;
}
