// The driving game's maps (ADR 0035), in the picker's order. A map is a data file in this folder.
import type { MapDef } from '../sim/map';
import { ISLAND } from './island';
import { SITE } from './site';

export const MAPS: readonly MapDef[] = [ISLAND, SITE];

/** The maps' names, for screen readers and tests: the picker shows pictures, no text (ADR 0003). */
export const MAP_NAMES: Record<string, string> = { island: 'Island', site: 'Building site' };
