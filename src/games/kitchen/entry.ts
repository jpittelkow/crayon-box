import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/**
 * Registry entry: loaded at start-up (ADR 0012). Kitchen (ADR 0044) shows on the home screen by default (ADR 0045);
 * a parent can hide it under Settings, Games.
 */
export const kitchenEntry: GameEntry = {
  id: 'kitchen',
  label: 'Kitchen',
  tileIcon: icons.kitchen(),
  tileColor: 'var(--crayon-lime)',
  load: () => import('./game').then((m) => m.kitchenGame),
};
