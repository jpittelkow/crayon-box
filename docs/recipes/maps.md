# Recipe: a driving map

A map is one data file in `src/games/racing/maps/` (a `MapDef` from `sim/map.ts`), listed in `maps/index.ts`. The
two so far are `island.ts` and `site.ts`; `ring.ts` is the tests' small map. The rules for maps are ADR 0021 and
0035; the road rules are in [driving-assets.md](../driving-assets.md), category 5. Paths below are under
`src/games/racing/`.

Per the [to-do list](../todo.md), new maps wait until the map pieces are built (targets, more set pieces, map
tiles, the map editor, maps from a folder). Until the editor exists, maps are written by hand as below.

A **very large map** (many times the island) needs more than this recipe: see the draft recipe, patterns and
anti-recipes in [highway-map-plan.md](../highway-map-plan.md) (planned 2026-11-15). They move into this file as
each one is proven by building it.

## Recipe
1. **A theme and a picture first:** what the map is (a town, the countryside), its set pieces, its garage, and a
   rough top-down sketch in `docs/design/` like [island-layout-a.svg](../design/island-layout-a.svg). The owner
   picks the layout.
2. **The land:** `land`, a shoreline of any shape. The car turns back before its edge.
3. **Roads:** `roads`, point paths joined at junctions (`from`, `to`). Loops and junctions only, no dead ends; wide
   enough for the biggest vehicle; gentle curves.
4. **Road pieces:** `guards` for bridges and tunnels (fractions along a road), `hills` (a tunnel goes through one),
   `sand`, `water` (pools, the flood, puddles along roads, `mud`).
5. **Set pieces:** `zones` (ramps, car wash, the **garage**, which every map needs). Keep zones apart.
6. **Filling:** `trees`, `props` (toys by share, some near the roads), `targets` (rows of stars on the roads,
   stacks of boxes just off them, ADR 0041), `decor` clumps, `animals` herds, `boats`.
7. **Traffic and the start:** `spawn` on a road, `traffic` (kind, place, cruise speed), `trafficPrefer` for the
   map's own vehicles.
8. **Sounds of the map** ([sounds.md](sounds.md)): what is underfoot sounds already (sand hiss, bridge planks,
   tunnel echo, puddles, mud); each set piece brings its own; the place's own sound (waves, birds, wind, a
   building site's clanks) belongs to its sky and light. Every new surface or set piece on the map has a sound,
   stand-in at least.
9. **List it:** add it to `MAPS` and `MAP_NAMES` in `maps/index.ts` (the name is for screen readers and tests).
10. **Its picture** for the picker: `npm run pictures:driving`, commit the new files.
11. **Check:**
    - `npx vitest run src/games/racing/maps`: `maps.test.ts` runs every map through the same rules (a name, roads,
      a garage, zones apart; a minute of random driving stays on land and goes somewhere; traffic and "follows the
      road" stay on the roads).
    - Drive all of it, in the biggest and the smallest vehicle, at full speed, through every set piece both ways.
    - Watch the frame rate (the game turns its picture down below about 45 frames a second; it shouldn't need to
      on the dev machine).
    - `npx playwright test tests/e2e/driving.spec.ts --workers=4`.

## Patterns
- **Roads first, everything else placed from them.** Things are placed on a road (`OnRoad`: a fraction along it
  and an offset) so moving a road moves what sits by it.
- **A loop plus a shortcut** (layout A): a kid can go round forever, and a junction gives a choice without a dead end.
- **Something every 10 to 15 seconds of driving:** a ramp, a puddle, a herd, the car wash. Empty road is boring.
- **The map's own vehicles in traffic** (`trafficPrefer`) make the place feel like itself.
- **Grow a map by scaling it** (the island grew 1.8 times across) before making a new one.
- **Things far from the camera aren't drawn** (beyond 150 m); a much bigger map needs map tiles (to-do list).

## Anti-recipes
- **A dead end, a narrow gap, a corner the car can wedge into,** or a curve too tight for "follows the road".
- **A map without a garage,** or with zones sitting on each other.
- **A place a kid can get lost:** a big empty area far from any road, a maze, a dark forest.
- **Water deep enough to sink in without a way out,** or the sea reachable anywhere but the edge.
- **A real place by name, or a real address, house or street plan in the repo.** The home map (milestone 5) is built
  only in a folder kept out of the repo; the repo holds only the code that loads it (privacy rule).
- **Text on the map** (street names, signs with words, a town's name on the picker): pictures only.
- **A new map before its pieces exist:** build the set piece, toy or vehicle first with its own recipe, then place
  it. A map file is only data.
- **Hand-placing hundreds of things** in a big map: that is what the map editor is for.
- **A silent map:** no sound on its new surface, set piece or place.
