// Every asset the driving game has, by category (driving-assets.md). The gallery lays them out from this list,
// and the tests check every one has both halves: a definition here and a look in look/.
import type { ZoneKind } from '../map';
import { VEHICLE_SIZE, type VehicleKind } from '../sim';
import { ANIMAL_IDS } from './animals';
import { DECOR_IDS, SCENERY_IDS } from './scenery';
import { TOY_IDS } from './toys';

export interface Category { id: string; name: string; assets: readonly string[] }

/** Vehicle ids follow the simulation's vehicle kinds: `vehicle/car` is kind `car`. */
export const VEHICLE_IDS = (Object.keys(VEHICLE_SIZE) as VehicleKind[]).map((k) => `vehicle/${k}` as const);

/**
 * Set pieces (driving-assets.md category 7) by their zone kind: each is a zone on a map plus a look in
 * `look/setpieces.ts` and a sound. The tunnel and bridge are road pieces' set pieces, built from a map's guards.
 */
export const SET_PIECES: Record<ZoneKind, string> = {
  ramp: 'setpiece/ramp', 'car-wash': 'setpiece/car-wash', garage: 'setpiece/garage',
  mud: 'setpiece/mud', ford: 'setpiece/ford', lights: 'setpiece/traffic-lights',
  roundabout: 'setpiece/roundabout', harbour: 'setpiece/harbour',
};
export const SET_PIECE_IDS = Object.values(SET_PIECES);

/** In the order of driving-assets.md. Categories with nothing built yet are listed empty. */
export const CATEGORIES: Category[] = [
  { id: 'vehicles', name: 'Vehicles', assets: VEHICLE_IDS },
  { id: 'toys', name: 'Toys', assets: TOY_IDS },
  { id: 'scenery', name: 'Solid scenery', assets: SCENERY_IDS },
  { id: 'decor', name: 'Decor', assets: DECOR_IDS },
  { id: 'roads', name: 'Roads', assets: ['road/street', 'road/roundabout'] },
  { id: 'ground', name: 'Ground and water', assets: ['ground/grass', 'ground/sand', 'water/puddle', 'water/flood', 'water/stream', 'water/sea'] },
  { id: 'setpieces', name: 'Set pieces', assets: SET_PIECE_IDS },
  { id: 'animals', name: 'Animals', assets: ANIMAL_IDS },
  { id: 'effects', name: 'Effects', assets: ['fx/puff', 'fx/drop', 'fx/ripple', 'fx/confetti', 'fx/mud'] },
  { id: 'sky', name: 'Sky and light', assets: ['sky/sunny'] },
];
