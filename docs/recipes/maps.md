# Recipe: a driving map

A map is one data file in `src/games/racing/maps/` (a `MapDef` from `sim/map.ts`), listed in `maps/index.ts`. The
two so far are `island.ts` and `site.ts`; `ring.ts` is the tests' small map. The rules for maps are ADR 0021 and
0035; the road rules are in [driving-assets.md](../driving-assets.md), category 5. Paths below are under
`src/games/racing/`.

Per the [to-do list](../todo.md), new maps wait until the map pieces are built (targets, more set pieces, map
tiles, the map editor, maps from a folder). A map can be written by hand as below, or drawn in the map editor
(below, "Making a map with the editor") and kept as a map file.

A **very large map** (many times the island) needs more than this recipe: see the draft recipe, patterns and
anti-recipes in [highway-map-plan.md](../highway-map-plan.md) (planned 2026-11-15). They move into this file as
each one is proven by building it.

## Recipe
1. **A theme and a picture first:** what the map is (a town, the countryside), its set pieces, its garage, and a
   rough top-down sketch in `docs/design/` like [island-layout-a.svg](../design/island-layout-a.svg). The owner
   picks the layout.
2. **The land:** `land`, a shoreline of any shape. The car turns back before its edge.
3. **Roads:** `roads`, point paths joined at junctions (`from`, `to`). Loops and junctions only, no dead ends; wide
   enough for the biggest vehicle; gentle curves. A roundabout's ring is `ringRoad` (one-way, ADR 0042); the roads
   that meet there end or start on it.
4. **Road pieces:** `guards` for bridges and tunnels (fractions along a road), `hills` (a tunnel goes through one),
   `sand`, `water` (pools, the flood, puddles along roads, `mud`, `streams`: shallow water along a path, ADR 0042).
5. **Set pieces:** `zones` (ramps, car wash, the **garage**, which every map needs; mud, a ford where a road
   crosses a stream, traffic lights at a junction, a roundabout by its ring's middle, a harbour on a road along the
   shore with the shore drawn 2 m past the road's edge there and a `sail` path out to sea, ADR 0042). Keep zones
   apart.
6. **Filling:** `trees`, `props` (toys by share, some near the roads), `targets` (rows of stars on the roads,
   stacks of boxes just off them, ADR 0041), `decor` clumps, `animals` herds, `boats`.
7. **Traffic and the start:** `spawn` on a road, `traffic` (kind, place, cruise speed), `trafficPrefer` for the
   map's own vehicles. A big map gives a rule instead, `trafficNear` (how many, which roads, a pace from and to):
   its vehicles live near the kid and are put back out of sight when they fall far behind
   ([highway plan](../highway-map-plan.md), phase 2).
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

## A map from the folder (ADR 0043)
A map that must not be in the repo (the home map) is a JSON file instead, dropped in the device's maps folder
(`%LOCALAPPDATA%\org.crayonbox.coloring\maps`; Parent area › Driving › Open the maps folder).
1. **Start from a map that works:** `mapToFile(map, name)` in `maps/file.ts` writes any `MapDef` as a file (the
   format is in ADR 0043; `maps/examples/test-loop.json` is a small one). Make and keep the file **outside the
   repo**.
2. **Edit it** with the same steps as above; the map's `id` is lower case letters, digits and dashes.
3. **Drop it in the folder** and open Parent area › Driving: it is listed with a switch, or left out with the
   reason (the same rules as `maps.test.ts`, from `maps/check.ts`). Fix and look again; the folder is read each time.
4. **Drive it** as in step 11; the random-driving and traffic checks don't run on the device, so drive the whole map.

## Making a map with the editor
Two dev pages, served by `npm run dev` only (Vite builds `index.html` alone, so neither is in the app):
- **The map editor**, `http://localhost:5173/tools/map-editor.html?map=island` (or `site`, `test-loop`, a `.json`
  file's address on the dev server, or **Choose File** for a file on the computer). A flat picture from above, north
  up, east right. The coordinates shown and saved are the map file's own x and z, and **x grows westward**.
- **The map viewer**, `tools/driving-map.html?map=…` (the same names, or `editor`): the map drawn by the game from
  straight above, with layers to switch on: road numbers, lengths and ends (yellow joined, red a dead end), set
  pieces, targets, the start and traffic, a grid, problems, and places a kid can reach that are further than the
  reach (45 m, the highway plan's D6; `farFromRoad` in `maps/check.ts`) from every road, in red. Scroll to zoom, drag
  to move. `node tools/shoot-map.mjs [maps…]` saves pictures of it in `test-results/map/` for a pull request.

Steps:
1. **Open the closest map** and give it a new name and, in **Map settings**, a new `id`. Saving writes the whole
   map, so a built-in map is a fine start.
2. **Land and roads:** **Land outline** and **Loop road**/**Road** are drawn by clicking points and double-clicking
   (or Enter) to finish. A road's end dropped on another road joins it (a junction); the editor says where an end
   joins nothing. A **Set piece** of kind roundabout makes its one-way ring where you click; drag a road's end onto
   the ring to meet it. To reshape, **Select** a road, the shore, a stream or sand: its control points show; drag
   one, double-click the line to add one, Delete to take one off. Roads joined to a moved road keep their ends on
   it, and whatever sits on a road (set pieces, targets, water, traffic) moves with it.
3. **Water and ground:** **Stream** and **Sand** are drawn like roads; **Pool** (deep is the flood, shallow, mud)
   and **Puddle** go by the nearest road; **Hill** anywhere (its size in the details box).
4. **Set pieces, targets, the rest:** **Set piece** (pick the kind) on the nearest road, **Star row** on it, **Box
   stack** beside it, **Traffic**, **Herd**, **Boat**, **Start**. Drag any of them to move it. The details box shows
   the selected thing as it is in the file; edit and **Apply** for sizes and counts. Trees, toys and bushes are
   scattered by the game from **Map settings** (tick "Trees and toys" to see where they land).
5. **Problems** update as you edit: the same checks a map file gets when the game loads it (`maps/check.ts`), plus
   the editor's own (a road in the sea, a dead end, a junction end off its road). Click one to go to it. **Undo**
   (Ctrl+Z) and **Redo** (Ctrl+Y) step back and forth.
6. **Look** shows the map in the viewer, drawn by the game. **Save map file** downloads `<id>.json`.
7. **Into the game:** drop the file in the maps folder (ADR 0043, "A map from the folder" above) and drive it. A map
   meant for the repo still becomes a `.ts` file in `maps/` by hand, with its places worked out from roads. A map of
   a real place never goes in the repo folder at all (privacy rule): keep its file outside it.

Not in the editor yet: drawing bridges and tunnels (shown, and changed in the details box), a harbour's sailing route
(the details box), single trees or toys (the format scatters them), districts and roads on two levels (not in the
format yet). The editor's code is `src/tools/mapEditor.ts` (the page) and `src/tools/mapEdit.ts` (editing, undo and
its checks, unit-tested).

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
