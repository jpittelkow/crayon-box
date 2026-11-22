import type { GameEntry } from '../../shell/types';
import { tiles } from '../../ui/tiles';

/**
 * Registry entry: loaded at start-up (ADR 0012). Kitchen (ADR 0044) shows on the home screen by default (ADR 0045);
 * a parent can hide it under Settings, Games.
 */
export const kitchenEntry: GameEntry = {
  id: 'kitchen',
  label: 'Kitchen',
  tileIcon: tiles.kitchen(),
  tileColor: 'var(--crayon-pale-blue)',
  load: () => import('./game').then((m) => m.kitchenGame),
};
