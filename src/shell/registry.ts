// The game registry (ADR 0012). Adding a game = a new folder under src/games/ plus one line here.
import { coloringEntry } from '../games/coloring/entry';
import { lettersEntry } from '../games/letters/entry';
import { racingEntry } from '../games/racing/entry';
import type { GameEntry } from './types';

export const GAMES: readonly GameEntry[] = [coloringEntry, racingEntry, lettersEntry];
