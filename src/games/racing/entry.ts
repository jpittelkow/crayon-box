import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/**
 * Registry entry: loaded at start-up (ADR 0012). The driving game is a prototype (ADR 0021 step 1), so it starts
 * hidden until a parent turns it on. The folder and id stay `racing` from ADR 0012.
 */
export const racingEntry: GameEntry = {
  id: 'racing',
  label: 'Driving',
  tileIcon: icons.driving(),
  tileColor: 'var(--kid-teal-tint)',
  startsHidden: true,
  load: () => import('./game').then((m) => m.drivingGame),
};
