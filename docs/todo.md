# To-do

The one ordered list of what is left, agreed with the owner on 2026-11-15. Work top to bottom; a later part can
start early only when it doesn't depend on an earlier one. Tick items off by deleting them (history goes in the
[journal](journal/README.md)); details live in the linked plans and ADRs.

New maps come last on purpose: first every piece a map is made from (vehicles, targets, set pieces, tiles, the
editor, loading a map from a folder), then the maps themselves.

## 1. Finish what is in flight
- **PR #40, playtest fixes part 2:** the screen as a joystick, car colours on the picker, a quick swap in the
  game, the picker's pictures shipped with the app. Merge.
- **PR #42, AI pages:** show that a page is being made, say why when only one of two came back. Merge.
- **The unlock window** (`parent/unlock-window`): finish, PR, merge.
- **Release 0.8.0** once those are in: milestone 3 is then done ([release checklist](release-checklist.md)).

## 2. Coloring: finish milestone 1
- **The Outside theme** (trees, flowers, sun, a house and garden), six pages, made like the animal pages
  (ADR 0022, `tools/clean-pages.mjs`). The last page theme.
- **Buttons a kid can work out:** a kid in a playtest didn't know what any coloring button does. Design first,
  with no text (ADR 0003), for example a short demo when a button is pressed and held; mockup, then an ADR.
- **A colour wheel** next to the swatches (asked in the same playtest). Design with the item above.

## 3. Driving: more vehicles
- **Pick the next vehicles with the owner** (ideas: digger loader, crane, street sweeper, mail van, taxi, camper
  van, quad bike, forklift, helicopter on a pad for show). Built in code like the fourteen in `look/fleet.ts`:
  each with a moving part, a feel (`VEHICLE_FEEL`), an engine and horn, a parent switch, and a place in traffic
  and the garage (ADR 0035). The picker already pages five at a time.
- **Steering feel** (optional, from [milestone-3.md](milestone-3.md)): a steering wheel shown on screen and a
  per-kid steering sensitivity in the parent Driving screen.

## 4. Driving: the pieces maps are made of
In this order; each one makes the next map richer or easier to build.
- **Targets to collect and hit** (owner, 2026-11-15): stacked boxes to knock over, coins or stars to collect, a
  silly noise and a confetti burst, then they come back. No score, no losing (ADR 0012). Needs an ADR first.
- **More set pieces and zone kinds** for the maps after these: a mud zone (mud puddles exist; a zone kind
  doesn't), a ford through a river, a roundabout, traffic lights for show only (they never stop the kid), a
  harbour. Each a zone plus an animation and a sound, like the ramp and car wash.
- **Map tiles:** cut a map into tiles and draw only the ones near the camera, with simpler far trees and props,
  so a much bigger map keeps its frame rate. The laptop is fine on today's two maps (owner, 2026-11-15).
- **The map editor** (`tools/map-editor.html`, a dev tool, not in the app): draw roads, paint water and ground,
  place props, set pieces, targets and the garage on a top-down view; save a map file that passes
  `maps/maps.test.ts`.
- **Maps from a folder:** the game loads a map file from a folder outside the repo (dropped on the device or
  synced from the family server). Needed by the home map; the repo holds only the loading code.

## 5. Letters: writing words
- **Tracing short words** letter by letter, the next level after single letters (owner, 2026-11-14). Needs its
  own ADR (ADR 0026 covers single letters). Can move earlier if wanted; nothing above depends on it.

## 6. More maps (last)
- **New maps** made with the editor: ideas are a town (streets in blocks, a fire station garage, a park) and the
  countryside (a farm, a river with fords and a bridge, a flooded field). Which ones: the owner's pick.
- **The home map** (milestone 5): a map of the family's own area from real map and terrain data, with the house
  and a few neighbours'. Built only in the private folder, never committed ([privacy rule](../CLAUDE.md)). Needs a
  short design first: where the data comes from and how the folder reaches the device.

## Parked (not planned)
- iPad version ([ADR 0030](adr/0030-ipad-home-screen-web-app.md), a draft kept for later).
- Printing and export (ADR 0010, Deferred).
- Real sound files for the driving stand-ins (set pieces, the new vehicles' engines and horns): the stand-ins are
  fine for now (owner, 2026-11-15).
- The design system artifact's 3D section (the rules are in [driving-assets.md](driving-assets.md) for now).
