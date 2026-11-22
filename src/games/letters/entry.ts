import type { GameEntry } from '../../shell/types';
import { tiles } from '../../ui/tiles';

/**
 * Registry entry: loaded at start-up (ADR 0012). Letter practice (ADR 0026) shows on the home screen by default
 * (ADR 0045); a parent can hide it under Settings, Games.
 */
export const lettersEntry: GameEntry = {
  id: 'letters',
  label: 'Letters',
  tileIcon: tiles.letters(),
  tileColor: '#fffaf0',
  load: () => import('./game').then((m) => m.lettersGame),
};
