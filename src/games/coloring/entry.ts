import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/** Registry entry: loaded at start-up. The game's code loads only when it is opened (ADR 0012). */
export const coloringEntry: GameEntry = {
  id: 'coloring',
  label: 'Coloring',
  tileIcon: icons.coloring(),
  tileColor: 'var(--crayon-pink)',
  load: () => import('./game').then((m) => m.coloringGame),
};
