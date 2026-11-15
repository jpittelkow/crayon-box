# Recipe: a driving-game vehicle

Vehicles are built in code with the toy kit (owner, 2026-11-15; ADR 0025, 0035). The fourteen so far are in
`look/vehicles.ts` and `look/fleet.ts`. Paths below are under `src/games/racing/`.

## Recipe
1. **Catalog row** in [driving-assets.md](../driving-assets.md), category 1: id `vehicle/<kind>`, maps, what it does.
2. **Its kind** in `sim/sim.ts`: add it to the `VehicleKind` union, then fill every table keyed by it (TypeScript
   lists each one you missed):
   - `VEHICLE_SIZE` (half-length and half-width, metres) and `VEHICLE_FEEL` (`top` speed, `push` on toys, `wade`
     in the flood) in `sim/sim.ts`;
   - `OWN_COLOR` in `look/vehicles.ts` (its own colour, for vehicles that fly the kid's flag);
   - `VEHICLE_NAMES` in `names.ts` (for screen readers and tests; never shown);
   - `VEHICLES` in `settings.ts` (the picker's order and the parent's switches).
3. **Its look:** a function in `look/fleet.ts` returning `Parts`, then a `case` in `look/vehicles.ts`. Body, wheels,
   lamps, and **one** moving part at most (ladder, bed, arm, drum, hook). Painted in the kid's colour, or keeping
   its own look with the kid's flag (the "mixed" rule, B5).
4. **Its sounds** (see [sounds.md](sounds.md)):
   - an `EngineVoice` row in `ENGINES` (`sound.ts`): a stand-in loop pitched and toned to its size, or a take of its
     own in `assets/sounds/drive/engine-<kind>.wav`;
   - a row in `HORNS`: notes of the horn, a siren pitch for emergency vehicles, or a little original tune.
5. **Its picture** for the picker: `npm run pictures:driving` renders it in every colour into `assets/pictures/`
   (the picker shows shipped pictures first). Commit the new files.
6. **Traffic and the garage** pick it up from `VEHICLES` on their own; add it to a map's `trafficPrefer` if it
   belongs there (diggers on the building site).
7. **Check:**
   - `npx vitest run src/games/racing`: the look's triangle budget (≤ 30k), every table filled, the maps' rules
     with it in traffic, every picture shipped.
   - The gallery: `/tools/driving-gallery.html?row=vehicles` on the dev server, next to the others.
   - Drive it in the game: picker tile, horn, moving part, wading, the garage swap, the quick-swap tray.
   - `npx playwright test tests/e2e/driving.spec.ts --workers=4`.

## Patterns
- **Same controls for every vehicle.** Only size, speed, push, wade, the horn and one moving part differ. No
  vehicle is better at something a kid must do, because there is nothing a kid must do.
- **The moving part plays when it stops** (a ladder rises, a bed tips) or as it drives (a drum turns, a hook
  swings): something to see without a button.
- **A horn that says what it is:** a siren and flashing lamps for emergency vehicles, a beep-beep for building
  machines, a tune for the ice-cream van.
- **Reuse the kit's wheels, lamps and cab shapes** (`look/kit.ts`, `look/vehicleKit.ts`); big vehicles are
  boxes and cylinders well placed.
- **Bigger vehicles get a lower, slower engine loop;** fast ones a higher one (`idleRate`, `perSpeed`, `toneHz`).

## Anti-recipes
- **A real model or brand look** (a known sports car, a cartoon truck's face, a logo): original shapes only
  (ADR 0011). No faces on vehicles.
- **Text or numbers on the vehicle** (a number on the race car, "POLICE" on the side): pictures and colours only.
- **A vehicle that changes the controls,** needs a second button, or can do something others can't.
- **A vehicle that can get stuck:** too long for the roads' curves, too wide for the bridge, too tall for the
  tunnel. Check it drives the whole of every map.
- **More than one moving part,** or a moving part that pokes out beyond its size and clips the scenery.
- **Over the triangle budget** to look nicer. The laptop draws traffic of fourteen kinds at once.
- **Forgetting the picture:** without `npm run pictures:driving` the picker draws it at run time, which is the
  slow, frozen picker the playtest found (2026-11-15).
- **A loud or harsh horn** (a real air horn, a full-volume siren). Parents can switch a scary vehicle off, but it
  shouldn't need it.
- **No sound** because "it'll get one later". Stand-in first.
