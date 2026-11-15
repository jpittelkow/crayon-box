// Every asset the driving game has, by category (driving-assets.md). The gallery lays them out from this list,
// and the tests check every one has both halves: a definition here and a look in look/.
import { VEHICLE_SIZE, type VehicleKind } from '../sim';
import { ANIMAL_IDS } from './animals';
import { DECOR_IDS, SCENERY_IDS } from './scenery';
import { TOY_IDS } from './toys';

export interface Category { id: string; name: string; assets: readonly string[] }

/** Vehicle ids follow the simulation's vehicle kinds: `vehicle/car` is kind `car`. */
export const VEHICLE_IDS = (Object.keys(VEHICLE_SIZE) as VehicleKind[]).map((k) => `vehicle/${k}` as const);

/** In the order of driving-assets.md. Categories with nothing built yet are listed empty. */
export const CATEGORIES: Category[] = [
  { id: 'vehicles', name: 'Vehicles', assets: VEHICLE_IDS },
  { id: 'toys', name: 'Toys', assets: TOY_IDS },
  { id: 'scenery', name: 'Solid scenery', assets: SCENERY_IDS },
  { id: 'decor', name: 'Decor', assets: DECOR_IDS },
  { id: 'roads', name: 'Roads', assets: ['road/street'] },
  { id: 'ground', name: 'Ground and water', assets: ['ground/grass', 'ground/sand', 'water/puddle', 'water/flood', 'water/sea'] },
  { id: 'setpieces', name: 'Set pieces', assets: [] },
  { id: 'animals', name: 'Animals', assets: ANIMAL_IDS },
  { id: 'effects', name: 'Effects', assets: ['fx/puff', 'fx/drop', 'fx/ripple'] },
  { id: 'sky', name: 'Sky and light', assets: ['sky/sunny'] },
];
