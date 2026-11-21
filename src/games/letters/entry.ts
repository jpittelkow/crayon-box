import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/**
 * Registry entry: loaded at start-up (ADR 0012). Letter practice (ADR 0026) shows on the home screen by default
 * (ADR 0045); a parent can hide it under Settings, Games.
 */
export const lettersEntry: GameEntry = {
  id: 'letters',
  label: 'Letters',
  tileIcon: icons.letters(),
  tileColor: 'var(--kid-orange-tint)',
  load: () => import('./game').then((m) => m.lettersGame),
};
