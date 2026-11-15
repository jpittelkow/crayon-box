// The picker's pictures as they ship with the app (owner, 2026-11-15): drawn once on the dev machine by
// `npm run pictures:driving` (scripts/render-driving-pictures.mjs) and kept in `assets/pictures/driving/`, so the
// laptop shows a picture instead of drawing one. Drawing in the game stays only as a fallback for a picture that
// is missing (`maps.test.ts` and `fleet.test.ts` check none is).

const files = import.meta.glob<string>('/assets/pictures/driving/*.webp', { eager: true, query: '?url', import: 'default' });

/** File name (no folder or extension) → URL. */
const byName = new Map(Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.webp$/g, ''), url]));

/** The file name for a vehicle in a colour (`#rrggbb`). */
export const vehicleFile = (kind: string, color: string) => `vehicle-${kind}-${color.replace('#', '').toLowerCase()}`;
/** The file name for a map. */
export const mapFile = (id: string) => `map-${id}`;

/** A shipped picture's URL, or undefined when there is none. */
export function shippedPicture(name: string): string | undefined {
  return byName.get(name);
}
