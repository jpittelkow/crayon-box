# Milestone 3: the driving game (plan)

The driving game of [ADR 0021](adr/0021-racing-game.md) (a 3D island to roam, no races) with the toy look and
engine voices of [ADR 0025](adr/0025-driving-game-toy-look-and-engine-sounds.md), finished, then grown into
**a choice of vehicles and two or three much bigger maps**, the owner's post-MVP wishes. Drafted 2026-11-15.
The map of the family's own area stays its own milestone (5), but the map format here is built so it can load
one from a folder outside the repo.

This is a plan, not a decision: phases can be reordered or split. Decisions it needs are listed per phase and at
the end; anything that changes an accepted ADR gets a new ADR first (ADR 0001).

## Where it starts (2026-11-15)
The prototype (ADR 0021 step 1) is built in `src/games/racing/`, off until a parent turns on "Show Driving":
- **Built:** one round island with a ring road, trees, 150 things to knock around (cones, crates, balls, bales),
  puddles and a flood; traffic (a school bus, a police car with flashing lamps, a monster truck) that drives
  alongside the kid's car and moves over for it; touch to go, arrows and WASD, the horn; both assist levels per
  kid; nothing gets stuck or leaves the island; toy look with sun shadows; an engine voice per vehicle; the
  drawing context rebuilt if lost.
- **Not built from ADR 0021:** the bridge, tunnel, ramp, beach, car wash and animals that answer the horn; the
  car picker; the kid's color as a flag (today the whole car is painted in it); the world as a data file (today
  the ring road and island are written into the code); app-wide Sounds switch; credits for any third-party art.
- **Not known:** whether the family laptop draws it at 60 frames a second; whether the kids can drive it. Neither
  has been tried. Known bug: the owner finds the engine voices and other sounds not good enough
  ([known bugs](memory/known-bugs.md)).

## Decided for this plan (owner, 2026-11-15)
- **Scope:** finish the MVP first, then vehicles, then bigger maps, all in this milestone.
- **Maps:** each map is its own place, chosen from **map picker tiles** after the vehicle picker; a kid never
  drives from one map into another. Each map loads alone, which keeps memory and drawing work down.
- **Changing vehicles:** a **vehicle picker** when the game opens, plus a **garage on every map**: drive in and
  come out in the next vehicle, without leaving the map.
- **Where the models come from: built in code** with the toy kit, like every vehicle today (owner, 2026-11-15,
  after the samples in phase A1). No kit or AI-made vehicles. Each vehicle costs hours, so the list in phase D
  is kept short and the fire truck from the samples is the first one.

## Assets
Everything the game draws is sorted into ten categories (vehicles, toys, solid scenery, decor, roads, ground and
water, set pieces, animals, effects, sky) in [driving-assets.md](driving-assets.md), with each category's rules,
budget and catalog. New things are added there first.

## Phases

### A. Samples and the laptop check
Two quick tests that decide how much the rest can hold. Both are throwaway (`spikes/`), like the engine test.
- **A1 status (2026-11-15): done**, in `spikes/vehicle-sources/` (its README has the comparison and
  screenshots script). The owner chose **built in code**.
- **A1, vehicle samples:** the same vehicle (a fire truck, new to the game) three ways, side by side on the
  prototype island, each driveable and with its draw cost shown:
  1. **Built in code**, with the toy kit in `look/` (ADR 0025).
  2. **From a CC0 kit** (e.g. Kenney's Car Kit or Quaternius's vehicles), loaded as glTF, recolored to the toy
     look's paint and materials as far as it goes.
  3. **AI-made**, from a text prompt by a 3D model generator, cleaned up and shrunk to a polygon budget.
  For each: how it looks next to the existing vehicles, download size, triangles, draw cost, time to make it,
  and the license. The owner chooses, and the answer goes into the vehicles-and-maps ADR (phase C).
- **A2, the laptop check:** the prototype as it is, in the installer from CI, on the family laptop. A parent-area
  readout (hidden behind a long press on the Driving screen) shows frames a second and draw time. Run it with the
  island as is, then with 2× and 4× the props and trees, standing in for a bigger map.
  - If it keeps 60: go on as planned.
  - If not: add quality steps that turn down by themselves (shadows, clear-coat, picture size, then 30 frames a
    second), in the order ADR 0025 names, before anything else is added.
- **First driving playtest** with the kids, if the playtest of milestone 1 has not covered it yet
  ([playtest guide](playtest.md)): assist level, a resting hand, whether the horn and back buttons are found.
- **Done when:** the owner has picked a model source, and the laptop's numbers are in the open questions.
- **Needs:** downloads (a CC0 kit; an AI generator or its model) approved by the owner; the installer on the
  laptop (milestone 2, phase A is done, so a CI artifact will do).

### B. The island finished (ADR 0021 steps 2 to 4: the MVP)
- **The world as data.** Move the ring road, island shape, zones and prop spots out of `sim.ts` into a map file
  (`src/games/racing/maps/island.ts`): roads as curves, the ground as a height grid or a set of shapes, zones
  (water, car wash, garage), prop spots, set pieces. The simulation and the look read the map; traffic follows
  any road curve, not only a circle. Every later map is another file in this format, and milestone 5's home map
  is one loaded from a folder.
- **The asset registry** ([driving-assets.md](driving-assets.md), "Where it goes in the code"): each asset gets
  a definition in `sim/assets/` and a look in `look/`, and maps name assets by id (`toy/cone`) instead of
  today's prop numbers. Plus the asset gallery dev page, grown from the samples' line-up.
- **Set pieces** from ADR 0021, each a sound plus a short animation: a bridge over water, a tunnel, a ramp with a
  small faked jump (the car can't flip), a beach, a car wash that covers the car in bubbles, a few animals that
  answer the horn.
- **The vehicle picker:** the game opens on tiles of the vehicles, three across (ADR 0016 rule 6), a tap drives
  off. The last vehicle is saved per kid. To begin, the four that exist: car, police car, school bus, monster
  truck. The kid's color as a flag on the vehicle (ADR 0021), or keep painting the whole vehicle: the owner
  chooses with a mockup.
- **Sounds, second pass** (the known bug): judge the engine voices and effects again. If voices made by the
  browser can't get good enough, CC0 or original recorded sounds, which ADR 0025 rules out ("no sound files"), so
  that needs a new ADR. The driving game also follows the app-wide Sounds switch.
- **The keyboard lock exception** for the driving keys comes with milestone 2's phase D, not here.
- **Done when:** a kid picks a vehicle and drives the whole island, through every set piece, on the family laptop
  at the frame rate phase A set, and the playtest has not turned up something that blocks it. That is the MVP.

### C. ADR: vehicles and maps
One new ADR before any vehicle or map work, superseding ADR 0021's "one small island" and car picker parts:
- Vehicles built in code (phase A1, decided 2026-11-15) and their triangle budget per vehicle.
- The vehicle list and what makes each one different (below).
- The maps, their size, and the map picker (two pickers in a row, or one combined screen: mockups first).
- The garage.
- How "a kid can't get lost" holds on a bigger map (below).
- Mockups added to the canvas for the vehicle picker, the map picker and the garage.

### D. Vehicles
- **Candidates** (owner's list plus ideas, to trim in the ADR): fire truck (ladder, siren), ambulance, tow truck,
  digger, dump truck, tractor, garbage truck, cement mixer, ice-cream van, race car. Monster truck, school bus
  and police car exist already.
- **What makes each one different**, kept small so the controls never change:
  - its own model, size and engine voice (ADR 0025);
  - **its own horn:** the horn button plays the vehicle's sound (siren, bell, bus horn, an original ice-cream
    tune) and, on emergency vehicles, flashes their lights;
  - its own weight in the simulation: a monster truck pushes props further and wades the flood faster, a race car
    is quicker, a tractor is slow. No vehicle is better at anything a kid has to do, because there is nothing a
    kid has to do.
  - Optional, one per vehicle at most: a small idle animation (digger arm, mixer drum, dump bed) when it stops.
- **The garage:** a building on each map. Driving in fades to a short animation and the vehicle comes out as the
  next one in the list. No choice to make, nothing to read.
- **Traffic** draws from the same vehicles, so every vehicle a kid can drive can also be met on the road.
- **Parent area:** under Driving, a switch per vehicle (hide one a kid finds scary, like a loud siren).
- **Done when:** the chosen vehicles are in the picker, the garage and traffic, each with its voice and horn,
  and the laptop still keeps its frame rate with the busiest traffic.

### E. Bigger maps
- **Two or three maps**, each about three to five times the island's area, with more of what the prototype had
  and more water. Ideas to pick from in the ADR:
  - **The island**, grown: the set pieces of phase B, more beach, a harbour.
  - **Town:** streets in blocks, a roundabout, a fire station (the garage), a car wash, traffic lights that are
    only for show (they never stop the kid), a park.
  - **Countryside:** a farm with animals, a river crossed by fords and a bridge, hills, a tunnel through one,
    lots of puddles and a flooded field.
- **The map picker:** picture tiles of the maps after the vehicle picker. The last map is saved per kid.
- **Can't get lost on a big map:** roads everywhere a kid can reach, the edge turning the car back as today,
  "follows the road" keeps working on every road, and a car that goes nowhere for a few seconds is turned toward
  the nearest road. Possibly a gentle pull back toward the busy middle after a long time in a quiet corner, to
  settle in a playtest.
- **Drawing a bigger map on built-in graphics:** everything that repeats stays batched; the map is cut into
  tiles and only the tiles near the camera are drawn; far trees and props use simpler shapes; traffic far away
  is moved by the simulation but not drawn. The phase A2 numbers say how far this needs to go.
- **Making maps:** maps are data files, and a big one is too much to write by hand. A dev tool page
  (`tools/map-editor.html`, like `tools/clean-page.html`) to draw roads, paint water and place props and set
  pieces on a top-down view, and save the map file. Not part of the app.
- **Done when:** a kid picks a map and a vehicle and drives the whole map without getting stuck or lost, and the
  laptop keeps its frame rate everywhere on it.

### F. Ready for the kids
- Unit tests for each map (the car never leaves it; random input for a minute leaves the car on land and
  moving; traffic follows every road), and the browser tests for the pickers and the garage (ADR 0015).
- A playtest of vehicles and maps; fixes.
- `CREDITS.md` for any kit or sound used. The design system artifact gains a section for 3D models (ADR 0021).
- The game stops starting hidden: Driving shows on the home screen by default (owner's call).
- **Done when:** it ships in an installer update and the kids use it.

## Order and what can run side by side
```
A1 (samples) ──► C (ADR) ──► D (vehicles) ──┐
A2 (laptop)  ──► B (MVP) ──────► E (maps) ──┴──► F
```
- **A1 and A2 can run at the same time.** B needs A2's numbers; C needs A1's choice.
- B's map format comes before E. D and E can run side by side once C is accepted.
- Milestone 2 goes on alongside: the keyboard lock (its phase D) is needed before the family uses the keys in the
  installed app.

## Decisions to make along the way
| When | Decision |
|---|---|
| Before C | ~~Where vehicle models come from~~: built in code (2026-11-15) |
| Before B is done | The kid's color: a flag on the vehicle, or the whole vehicle painted |
| Before B is done | Browser-made sounds or recorded files (a new ADR if files) |
| In C | Which vehicles; which maps and how big; one picker screen or two |
| After F | Whether Driving shows by default, and whether the folder and id stay `racing` |
