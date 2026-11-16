// Dev tool: where the map tools get a map from. The built-in maps, the generic example file, a map file (by its URL
// on the dev server, or opened from the computer), or the map the editor hands to the viewer ("look"). Nothing here
// ships in the app.
import { MAPS, MAP_NAMES } from '../games/racing/maps';
import { parseMapFile } from '../games/racing/maps/file';
import example from '../games/racing/maps/examples/test-loop.json?raw';
import { STRESS } from '../games/racing/maps/stress';
import type { MapDef, ZoneKind } from '../games/racing/sim/map';

export interface NamedMap { name: string; map: MapDef }

/** The maps the tools can open by id (`?map=island`): the built-in ones and the example file. */
export function builtInMaps(): Record<string, NamedMap> {
  const out: Record<string, NamedMap> = {};
  for (const map of MAPS) out[map.id] = { name: MAP_NAMES[map.id] ?? map.id, map };
  const parsed = parseMapFile(example);
  if (parsed.ok) out[parsed.map.id] = { name: parsed.name, map: parsed.map };
  // The map tiles' stand-in for a very large map (never in the picker).
  out[STRESS.id] = { name: 'Stand-in large map', map: STRESS };
  return out;
}

/** Where the editor leaves the map it hands to the viewer: this browser's storage, on the dev server's address. */
export const LOOK_KEY = 'crayon-box:map-editor:look';

/**
 * The map named by a page's `?map=`: a built-in id, `editor` (the editor's "look"), or a `.json` file's URL on the dev
 * server (`/src/games/racing/maps/examples/test-loop.json`). The island when there is none.
 */
export async function loadMap(param: string | null): Promise<NamedMap | { error: string }> {
  const builtIn = builtInMaps();
  const id = param ?? 'island';
  if (builtIn[id]) return builtIn[id]!;
  let text: string | null = null;
  if (id === 'editor') {
    try {
      text = localStorage.getItem(LOOK_KEY);
    } catch {
      text = null;
    }
    if (!text) return { error: 'The editor has not handed over a map yet: press "Look" in the map editor.' };
  } else if (id.endsWith('.json')) {
    try {
      const res = await fetch(id);
      if (!res.ok) return { error: `${id} couldn't be fetched (${res.status}).` };
      text = await res.text();
    } catch (err) {
      return { error: `${id} couldn't be fetched (${(err as Error).message}).` };
    }
  } else {
    return { error: `There is no map "${id}": use ${Object.keys(builtIn).join(', ')}, editor, or a .json file's address.` };
  }
  const parsed = parseMapFile(text);
  return parsed.ok ? { name: parsed.name, map: parsed.map } : { error: parsed.reason };
}

/** Each set piece's colour on the tools' flat pictures. */
export const ZONE_COLORS: Record<ZoneKind, string> = {
  ramp: '#e0a030', 'car-wash': '#3ab0e0', garage: '#d23c3c', mud: '#7a5634', ford: '#2f78b8', lights: '#2fa84f',
  roundabout: '#9b59b6', harbour: '#1f5f8b',
};
