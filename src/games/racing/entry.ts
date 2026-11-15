import type { GameEntry } from '../../shell/types';
import { icons } from '../../ui/icons';

/**
 * Registry entry: loaded at start-up (ADR 0012). The driving game shows on the home screen by default (owner,
 * 2026-11-15, milestone-3 F); a parent can still hide it under Settings, Games. The folder and id stay `racing`
 * from ADR 0012.
 */
export const racingEntry: GameEntry = {
  id: 'racing',
  label: 'Driving',
  tileIcon: icons.driving(),
  tileColor: 'var(--kid-teal-tint)',
  load: () => import('./game').then((m) => m.drivingGame),
};
