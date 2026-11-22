import type { GameEntry } from '../../shell/types';
import { tiles } from '../../ui/tiles';

/** Registry entry: loaded at start-up. The game's code loads only when it is opened (ADR 0012). */
export const coloringEntry: GameEntry = {
  id: 'coloring',
  label: 'Coloring',
  tileIcon: tiles.coloring(),
  tileColor: 'var(--paper)',
  load: () => import('./game').then((m) => m.coloringGame),
};
