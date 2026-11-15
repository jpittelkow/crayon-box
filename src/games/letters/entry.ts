import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/**
 * Registry entry: loaded at start-up (ADR 0012). Letter practice (ADR 0026) starts hidden until a parent turns it
 * on under Settings, Games.
 */
export const lettersEntry: GameEntry = {
  id: 'letters',
  label: 'Letters',
  tileIcon: icons.letters(),
  tileColor: 'var(--kid-orange-tint)',
  startsHidden: true,
  load: () => import('./game').then((m) => m.lettersGame),
};
