# 0043. Driving game: maps loaded from a folder on the device

- Status: Accepted (2026-11-16, on the owner's defaults: one folder in the app's own local data, read only; files
  get there by hand for now, family sync later)
- Date: 2026-11-16
- Builds on [ADR 0007](0007-artwork-storage-and-kid-profiles.md) (the app's files), [0009](0009-install-and-update-from-github.md),
  [0014](0014-web-first-then-kiosk-installer.md) (the browser is a stepping stone), [0018](0018-kid-names-and-photos.md)
  (private things stay on the device), [0024](0024-family-sync-server.md) (device-only data), [0035](0035-driving-vehicles-maps-picker-garage.md)
  (the map picker), [0041](0041-driving-targets-to-collect-and-hit.md) and [0042](0042-driving-more-set-pieces.md)
  (what a map holds); needed by the home map (milestone 5 in [project-state.md](../memory/project-state.md)).

## Context
The to-do list's last map piece: "the game loads a map file from a folder outside the repo (dropped on the device or
synced from the family server). Needed by the home map; the repo holds only the loading code." A map today is a
TypeScript file in `src/games/racing/maps/` (a `MapDef` from `sim/map.ts`), built into the app. The home map, a map
of the family's own area, must never be committed (privacy rule), so the app needs to read a map it was not built
with. On 2026-11-16 the owner accepted the default: one folder in the app's own data on the device, which the
Windows app may only read; getting files there through family sync is a later step.

## Decision

### The file
- **JSON, one map per file**, ending in `.json`: today's `MapDef` as it is, wrapped with what the file is:

  ```json
  { "format": "crayon-box-map", "version": 1, "name": "Test loop", "map": { "id": "test-loop", ... } }
  ```

- **`format`** says it is a map file; **`version`** is the format's version, 1 today. It goes up only when a field
  changes its meaning so an older app would read a newer file wrongly; a new optional field (the roundabout's, the
  harbour's) doesn't change it, because **fields the app doesn't know are carried through untouched** and an older
  app ignores them. A file for a newer format is turned away with "made for a newer version of the app … Update the
  app."
- **`name`** (1 to 60 characters) is for screen readers and the parent area; the picker shows only the map's
  picture (ADR 0003).
- `maps/file.ts` writes (`mapToFile`) and reads (`parseMapFile`) it. Points are written a few to a line so a person
  can read the file, and numbers exactly as the app holds them (`-0` too), so **every built-in map written to a file
  and read back is the same map**, drives the same and is written the same again (a unit test, on the island with
  its targets, stream, ford and lights, and the building site with its mud). Any built-in map can be the start of a
  new one this way.
- Files over 10 MB are left out, so a stray file can't stall the laptop.

### The checks, at load
- **The same rules as the built-in maps**, in one place, `maps/check.ts`, which `maps.test.ts` now uses too:
  - **The shape:** every field `MapDef` needs, of the right kind; numbers finite and in sensible ranges (places
    within 5 km, at most 20,000 points to a path, 5,000 trees or toys); roads, spawns and zones only on roads that
    exist; only names of things the game has (zone kinds, vehicles, trees, toys, targets, decor, animals). The map's
    own id is lower case letters, digits and dashes.
  - **Where things are**, from the world built as the game builds it: the start on land and out of hills, a garage,
    zones apart, targets clear of water, bridges, tunnels, hills, zones and the start, stars on the road and stacks
    just off it, no toy inside a stack.
  - Not at load: the minute of random driving and the traffic run stay in `maps.test.ts` (too slow on the laptop at
    every start), and the built-in maps' bar of at least 15 stars and 5 stacks.
- **A bad file is skipped, never a crash on a kid's screen.** Nothing in the loading throws: a file that can't be
  read, isn't JSON, isn't a map, is for a newer app or breaks a rule is left out with the first few problems (as
  "where: what", e.g. `map.roads[0].from: there is no road 3.`), shown in the parent area. A folder that can't be
  read gives the picker no folder maps. The answer for a file is kept for the session, by its text, so a big map is
  checked once.

### Where the folder is
- **`maps\` in the app's local data folder** (`%LOCALAPPDATA%\org.crayonbox.coloring\maps`), next to the working
  copy `store\`: on this device only, not roaming, and not in Pictures, which parents browse and OneDrive syncs.
- The Windows app's capability (`src-tauri/capabilities/default.json`) adds, for that folder only: make it, list it,
  read the files in it, and open it in File Explorer. It may not write, rename or delete there; the existing scope
  for `store\` and `Pictures\Coloring Book` is unchanged. Read through the existing Tauri file layer
  (`src/shell/tauriFiles.ts`, `tauriMapsFolder`), which reads every `.json` file at the top of the folder.
- **The folder is read each time** the driving game opens its picker and each time the parent area's Driving
  screen opens, so a dropped file shows without restarting the app.
- **Getting files there** is by hand for now (copy a file in). Syncing them from the family server is a later step,
  with its own decision; it will only need to put files in this folder.

### In the picker
- **Folder maps come after the built-in maps**, in file-name order. The map row shares its width between however
  many maps there are (smaller tiles as more come; a parent can switch maps off). A map that has gone from the
  folder, or been switched off, falls back to the first map for a kid who had picked it.
- **Ids can't clash:** a folder map's id in the game is `folder:` and its file's id. Built-in ids are letters,
  digits and dashes only (checked in `maps.test.ts`), so a folder map can never replace a built-in map, even a
  copy of the island. Two files with the same id: the second (by file name) is left out, naming the first.
- **Its picture** is drawn on the device with the same drawing the built-in maps fall back to (`look/thumbs.ts`,
  `mapPicture`), and kept like them (`look/pictureCache.ts`): in memory, and in a release build under `local/` keyed
  by the app's version. The key carries a hash of the file, so an edited file is drawn again. Pictures never ship
  for folder maps.

### The parent's view
- **Parent area › Driving › Maps from the folder** (Windows app only): each map that loaded, by its name and file
  name, with an on/off switch that takes it off the picker; each file that was left out, with why; and **Open the
  maps folder**, as the Pages folder has. With nothing in the folder it says so.
- The switches are **device-only** (`local/folder-maps.json`, ADR 0024): the folder is this device's.

### The web app (browser)
- **No folder, so nothing:** no folder maps, no card in the parent area. The browser is a stepping stone (ADR 0014).
- **On the dev server only, `?fake-maps`** stands in for the folder (`src/shell/fakeMapsFolder.ts`, like
  `?fake-kiosk`): the generic example map and a file that isn't a map, or whatever a test puts on
  `window.__fakeMaps` before the app starts. The browser tests use it.

### Privacy
- **A home map's file never enters the repo.** It is made and kept outside it and dropped in the device's folder.
  `.gitignore` refuses a `maps/` or `home-map*/` folder at the top of a checkout and any `*.home-map.json`, in case
  one is made in a checkout by mistake.
- **Tests use only generic maps:** the built-in ones and `src/games/racing/maps/examples/test-loop.json`, a ring
  road round a round island with symbols for names. A map's `name` and id are the family's own business on the
  device (ADR 0018): they show in the parent area and are sent nowhere.

## Consequences
- The home map (milestone 5) can be built as a file outside the repo and tried on the laptop by dropping it in the
  folder; its design (where the data comes from) is still its own step.
- The map format is now an outside interface: a field's meaning can't change without a new format version, and a
  new field must be optional. New zone kinds, toys and the like extend the check's lists automatically (they come
  from the asset lists), so a file using them loads once the app has them.
- `maps.test.ts` and the load check can't drift apart: they are the same code.
- Each edit of a folder map leaves its older picture on the device until the next app version clears the picture
  cache; small, and not worth its own cleanup yet.
- Not decided here: syncing map files from the family server, a map editor writing these files (the to-do list's
  map editor can write this format), and a way to load a file in the browser outside the dev server.
