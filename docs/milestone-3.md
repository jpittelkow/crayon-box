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
  - **Status (2026-11-15): first step done.** `sim/map.ts` (the map format: land, roads, spawn, traffic, water,
    tree and prop scatter rules), `maps/island.ts` (the island as data), `sim/roads.ts` (roads as point paths:
    nearest point, a point along a road, smoothing a few points into a curve), `look/roads.ts` (road surface and
    markings along any path). Traffic, the assist, the rescue, the island's edge and placement all read the map;
    tests drive a second, bent, off-centre map. Still to do: ground as shapes or heights instead of a round
    island, zones (car wash, garage), set pieces, junctions.
- **The asset registry** ([driving-assets.md](driving-assets.md), "Where it goes in the code"). **Status
  (2026-11-15): built** for toys, scenery and decor, with knock behaviours as data (tumble, and roll for the beach
  ball), a test that every asset has both halves and fits its budget, and the gallery dev page. Was: each asset gets
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

#### Finishing B, step by step (planned 2026-11-15)
Seven steps. B1 to B5 are code anyone can build now; B6 is shared with the sound work; B7 needs the family laptop
and the kids. Each step lands as its own PR with unit tests on the simulation and, where something new is on
screen, a browser test and screenshots.

| Step | What | Needs the owner? | Size |
|---|---|---|---|
| **B1. One branch, one plan** | Merge [ADR 0031](adr/0031-driving-to-a-spot-and-traffic-company.md) (PR #18: drive to a touched spot, traffic that rides alongside). Land the map-file work (this plan, the asset catalog, the world as data, the asset registry) on `main` with ADR 0031 ported onto its roads. One milestone 3 plan: this file (the older `milestone-3-driving.md` is folded in below). | Taking those commits off the in-app updates branch rewrites it: owner's OK | small |
| **B2. Ground, zones and junctions** | The map format grows: the land as an outline (not only a circle), surfaces (grass, sand, dirt), **zones** (a named area with a kind: `car-wash`, `ramp`, `garage`, later `mud`), and **junctions** (roads join; traffic picks a turn; the assist follows the road it is on). Every rule that reads the island today (the edge turn-back, the rescue, placement) reads the outline. Tests: the car never leaves a non-round map; traffic reaches every road; a zone reports a car entering and leaving. | no | medium |
| **B3. Set pieces, one PR each** | In this order, simplest first; each is a zone plus a short animation and a sound hook (category 7 in [driving-assets.md](driving-assets.md)): **ramp** (a faked hop: the car rises and lands on its wheels, never flips); **car wash** (drive in, brushes turn, the car comes out *bubbly* then rinsed; also washes off *wet*); **beach** (sand surface, wheel puffs, the car slows a little, never stops); **bridge** (a road stretch over water: drawn deck and rails, the car stays on it); **tunnel** (a road stretch under a hill: the hill turns see-through or the camera drops inside, so the car is never hidden, ADR 0021). | no | small to medium each |
| **B4. The island redrawn** | A new island layout as one map file using B2 and B3: a main loop plus one cross road (one junction each end), the bridge over an inlet, the tunnel through one hill, the beach on one side, the ramp and car wash beside the loop, the flood kept. Still about 30 s end to end. **Layout A chosen by the owner (2026-11-15)**: [the picture](design/island-layout-a.svg), over B ([one winding loop](design/island-layout-b.svg)). So B4 builds junctions: traffic and "follows the road" pick a way at each one. | decided | medium |
| **B5. Vehicle picker and the kid's colour** | Tiles of the four vehicles that exist, three across, a tap drives off; the last one saved per kid; the kid drives that vehicle (traffic keeps the others). The kid's colour, **mixed (owner, 2026-11-15; [mockup](design/kid-colour-options.png))**: the car and monster truck painted in it, as today; vehicles with a look of their own (police car, school bus, and later the fire truck and others) keep it and fly a flag in the kid's colour. Optional here: the steering wheel overlay and steering sensitivity (below). | decided | medium |
| **B6. Sounds** | The driving game already plays files (ADR 0032, PR #23) and follows the app-wide switch. Left: each set piece's sound, horns for the monster truck and bus, and a tunnel echo; see "B6, researched" below. | decided (2026-11-15) | small to medium |
| **B7. Laptop and kids** | Phase A2 (the frame-rate readout, on the installed app on the family laptop) and the first driving playtest: assist level, a resting hand, whether a finger held still ending in a stop reads as "got there" (ADR 0031), whether the horn and back buttons are found. Fixes from it; accept ADR 0031. | yes: run it | depends on findings |

**Status (2026-11-15):** B1: PR #18 merged; the map-file work with ADR 0031 ported is the PR from `driving/milestone-3-mvp`. Taking those commits off the in-app updates branch waits on the owner. B2: the land as an outline (`sim/land.ts`: depth from the shore, inland direction, placing things; the ground drawn from it) and zones with enter and leave events are built; surfaces and junctions come with B3 (beach) and B4 (the new layout). B3: the **ramp** and the **car wash** are built. B4: **done** (2026-11-15). The game drives the new island, layout A (`maps/island.ts`; the old ring is kept as the tests' map, `maps/ring.ts`), with three-way junctions, a bridge over the bay, a tunnel through a hill that turns see-through while the kid is inside, and a sandy beach. B3 is finished too (2026-11-15): **animals** (sheep and ducks on the island; a cow is built for later maps) wander near home, step aside before the car can reach them, and answer the horn with a hop and their call (stand-in sounds). **Traffic gives way**: a cruising traffic car slows and waits for the kid's car in its lane, at a junction, on the bridge or anywhere. B5: **done** (2026-11-15): the game opens on a vehicle picker (four tiles, pictures drawn from the game's own models in the kid's colours, on the kid's tint); the last pick is saved per kid; the kid drives it and the car takes its place in traffic. The kid's colour is mixed, as decided: paint on the car and monster truck, a flag on the police car and bus. The chase camera pulls back for a longer vehicle.

**B6 status (2026-11-15): built with stand-ins.** The simulation reports what is under the kid's car (`World.under`: sand, bridge, tunnel). The tunnel has an echo and sand a hiss, both made by the app; the bridge's planks knock (the wooden bump, high and quiet); the car wash has a whoosh going in and bubbles popping while the car is soapy (the splash and the app's pop). The targets (ADR 0041, 2026-11-15) are stand-ins too: a stack's silly noise is the boing with its pitch sliding up and a pop, a star's twinkle the app's bell (`ui/cheer.wav`) high with two pops. Still to come: takes of their own for the landing, the car wash, the planks and the targets, once new sound files can be fetched or made (needs the owner's OK: a download from OpenGameArt or paid AI takes; ffmpeg is also needed on the dev machine for `tools/sounds/prepare.mjs`).

#### B6, researched (2026-11-15)
The sound-files work (ADR 0032, PR #23) has landed, so the driving game already plays files from `assets/sounds/drive/` (an engine per vehicle, horn, siren, squeal, brake, bump, boing, puddle, splash), with its own loader in `src/games/racing/sound.ts`, and plays only when its own switch and the app-wide switch are both on. Engines are loops whose playback rate and brightness follow speed; traffic fades with distance. What B6 still has to do:
- **Set-piece sounds, wired to events the simulation already has:** ramp landing (`landings`, now a stand-in thump), car wash brushes and bubbles (`zoneEvents`, `soap`; the take ADR 0032 picked is not in `tools/sounds/picks.json` yet), sand under the wheels and bridge planks (need an "on sand", "on bridge" signal from the simulation).
- **Horns per vehicle:** the monster truck and bus play the car's horn lowered; the police car's siren is a placeholder take.
- **A tunnel echo** on the engine and horn, made in the browser (a delay or reverb while in the tunnel), unless every sound must be a file.
- **Smaller:** play an effect late rather than skip it before its file has loaded; whether the driving game moves onto the shell's shared sound bank; two stale doc lines (`docs/sound-options.md` still says engines are oscillators).

Owner's choices for B6 (2026-11-15): the new set-piece sounds may be AI-made or CC0 recordings, whichever sounds better; horns for the monster truck and bus wait for the vehicles of phase D; the tunnel echo may be made by the app (a delay or reverb), not a file.

B2 to B5 can start before B7, but B7's frame rate may turn the look down (ADR 0025's order), so B4 is checked
on the laptop before B5 adds more.

#### Steering feel (folded in from the older plan, 2026-11-15)
Asked for by the owner on 2026-11-15 while testing. Optional within B5; small.
- **A steering wheel on screen** that turns as the car steers: a round Crayon Box wheel in the bottom corner
  opposite the horn, turned by `World.steer` (the steering the car really used, including the road assist and the
  rescue), so it never disagrees with the car. A display, not a control.
- **Steering sensitivity, a parent setting per kid** (*gentle*, *normal*, *quick*). Since ADR 0031 a touch picks a
  spot, so this scales the turn rate (keys, and how tightly the car swings toward a spot) rather than softening
  small touches. Beside the assist level in the parent Driving screen.

### C. ADR: vehicles and maps
One new ADR before any vehicle or map work, superseding ADR 0021's "one small island" and car picker parts:
- Vehicles built in code (phase A1, decided 2026-11-15) and their triangle budget per vehicle.
- The vehicle list and what makes each one different (below).
- The maps, their size, and the map picker (two pickers in a row, or one combined screen: mockups first).
- The garage.
- How "a kid can't get lost" holds on a bigger map (below).
- Mockups added to the canvas for the vehicle picker, the map picker and the garage.

### D. Vehicles
**Status (2026-11-15): built** (ADR 0035, Proposed). Ten new vehicles in code (`look/fleet.ts`), each with a moving part (a ladder that rises, a bed that tips, a digger that scoops, a drum that turns, a hook that swings), a feel (`VEHICLE_FEEL`: top speed, how far it knocks toys, wading), a stand-in engine and horn (sirens, a beep-beep, an ice-cream tune). The picker pages five at a time; traffic comes from the vehicles switched on; a parent can switch any vehicle but the car off; a garage on the island's shortcut hands out the next vehicle. Real engine and horn takes wait for new sound files.

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
**Status (2026-11-15): built** (ADR 0035). Two maps (`maps/index.ts`): **the island**, layout A grown 1.8 times across (a spur road and a third junction, two ramps, more puddles, herds and toys, boats in the bay), and **the building site** (`maps/site.ts`: dirt tracks, dirt hills, three ramps, mud puddles and a muddy pond, a sand pit, cones and crates, cows, the site office as the garage, the building vehicles first in traffic). **One picker screen**: the maps along the top as pictures from above, the vehicles below; a tap on a map rings it, a tap on a vehicle drives off there; the last map is saved per kid. Things further than 150 m from the chase camera are not drawn. Not built: map tiles (wait for the laptop's numbers, B7) and the map editor (waits for a third map). Every map passes the same rules in `maps/maps.test.ts`.

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
**Status (2026-11-15):** the per-map tests (`maps/maps.test.ts`) and the browser tests for the picker are built; `CREDITS.md` says the 3D models are original. Driving shows on the home screen by default since 2026-11-15 (owner); a parent can still hide it under Settings, Games. Left for the owner: the playtest and the laptop check (B7), and accepting ADRs 0031 and 0035. Left for later: the design system artifact's 3D section (the look's rules are in `driving-assets.md` for now), and real sound files to replace the stand-ins.

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
| ~~Before B is done~~ | ~~The kid's color~~: mixed, paint where it fits and a flag where it doesn't (2026-11-15) |
| ~~Before B is done~~ | ~~Browser-made sounds or recorded files~~: files (ADR 0032); the tunnel echo is made by the app (2026-11-15) |
| ~~In C~~ | Decided 2026-11-15: **all ten new vehicles** (fire truck, ambulance, tow truck; digger, dump truck, cement mixer; tractor, garbage truck; ice-cream van, race car); **two maps**, the island grown and a building site; **one picker screen** with both the vehicles and the maps. Horns for the monster truck and bus come with these vehicles. |
| After F | Whether Driving shows by default, and whether the folder and id stay `racing` |

## Backlog (after milestone 3)
- **Targets to collect and hit on the maps** (owner, 2026-11-15). Things placed for the kids to drive into on
  purpose: stacked boxes to knock over, coins or stars to collect. Each one makes a crazy noise and a big, silly
  explosion (confetti, puffs, bits flying) when hit, then comes back like the toys do. No score and no way to
  lose (ADR 0012): hitting them is the fun. Not designed yet; needs an ADR before it is built.
