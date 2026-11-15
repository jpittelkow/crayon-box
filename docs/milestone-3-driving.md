# Milestone 3: the driving game, grown up (plan)

Drafted 2026-11-15, from the owner's wishes of 2026-11-14:
- several maps, much bigger than today's island;
- vehicles to choose from;
- customizing them, and maybe coloring them.

This is a plan, not a decision. It needs a new ADR before building, because ADR 0021 has one small island and a
few cars. The choices it needs are listed under each phase and at the end. Sounds follow
[sound-options.md](sound-options.md). The home map (project state, milestone 5) stays its own milestone.

## Where it stands (2026-11-15)
- **One island:**
  - A circle 60 m across the land, with a single ring road (`ROAD_R = 38` m in `src/games/racing/sim/sim.ts`).
  - One lap takes about 14 seconds at full speed.
  - It has a flood, puddles, trees and props to knock.
  - It doesn't have the bridge, tunnel, beach, ramp or car wash that ADR 0021 lists.
- **Roads are hard-coded as that ring, not data.**
  - Traffic stores its place as an angle around the ring.
  - The road assist and the "turn back to the road" rescue both assume a circle.
  - The sim tests cover the rules, not the shape.
- **Vehicles:**
  - Four kinds are built in code (`look/vehicles.ts`): car, police car, monster truck and school bus, each with its
    own engine voice.
  - The kid always drives the car, painted all over in the kid's colour.
  - The car picker from ADR 0021 has not been built.
- **Not yet known:**
  - No playtest with the kids yet.
  - No frame-rate measurement on the family laptop yet.

## Phase 0. Measure before growing
- Play the current island with the kids, and measure frame rate on the family laptop (ADR 0021's open questions).
- Bigger maps cost drawing time, and the laptop has built-in graphics. This number sets how big a map can be and
  how much can be on screen at once.
- **Done when:** both answers are written down. If the laptop is slow, the first change is turning down the look
  (ADR 0025 names shadows and clear-coat), not shrinking the plans.

## Steering feel (small, can come any time)
Asked for by the owner on 2026-11-15 while testing.
> **Changed by [ADR 0031](adr/0031-driving-to-a-spot-and-traffic-company.md) (2026-11-15, Proposed):** a touch
> now picks a spot on the ground and the car drives there and stops, so "how far to the side" no longer sets the
> turn for a finger. A sensitivity setting would now scale the turn rate (keys, and how tightly the car swings
> toward a spot), not soften small touches. The steering wheel can read `World.steer`, the steering the car
> really used, which already includes the road assist and the rescue.
- **Steering sensitivity, a parent setting per kid.**
  - Today a finger at the screen's edge turns at a fixed top rate (`turn` in `sim.ts`, about 2.1 radians a second
    at low speed, less at full speed). A small sideways touch turns in proportion.
  - The setting has three steps, *gentle*, *normal* and *quick*. Each scales the turn rate, and gentle also
    softens small touches (a curve on the input), so a resting or wobbly finger drifts less.
  - It sits beside the assist level in the parent Driving screen and is saved per kid. A sim test checks that
    gentle turns less than quick for the same touch.
- **A steering wheel on screen** that turns as the car steers, so a kid (and a parent watching) can see how much
  the wheel is turned.
  - A round wheel in a bottom corner, opposite the horn, drawn in the Crayon Box style. It turns with the steering
    the car actually uses, which includes the road assist and the rescue, so it never disagrees with the car.
  - It is a display, not a control: touches on it steer like anywhere else on the picture, as ADR 0021 says.
    Whether it becomes something a kid can grab and turn is a later question for a playtest.
  - Optionally, the wheel could be drawn inside the car from a cockpit view later. For now it is a flat overlay.
- **Size:** small. A changed setting and an overlay. It needs a short note in ADR 0021's controls when built.

## Phase A. Maps as data
Groundwork, with nothing new to see yet. Do it first, because every map and every vehicle after it depends on it.
- **Roads become a graph of curves:**
  - Each road is a curve with lanes; junctions join roads.
  - Traffic follows a path and picks a turn at each junction.
  - The road assist steers along the nearest road.
  - The rescue finds the nearest point on any road.
- **What a map file holds:**
  - The ground: an outline and a height field.
  - Roads and water.
  - Zones: the car wash, ramps, mud.
  - Areas where props are scattered, landmarks, and where the kid starts.
  - Maps are plain data under `src/games/racing/maps/`. The home map later uses the same format from a private
    folder.
- **Collision and props use a spatial grid,** so a map with thousands of things costs the same per frame as one
  with hundreds.
- **The island is redrawn as the first map file.** The existing sim tests still pass, plus new ones:
  - traffic never leaves its road;
  - every road can be reached from every other.
- **Size:** medium. It is mostly `sim.ts` and `look/island.ts`.

## Phase B. Bigger maps
- **Size:** each map is about 3 to 5 times the island's width, so 1 to 2 minutes from end to end.
- **Drawing only what's near:**
  - The map is cut into tiles; tiles far away are not drawn and fade into the sky haze.
  - Repeated things (trees, props) stay batched, as they are today.
- **Keeping a kid from getting lost,** since ADR 0021 rules still apply in a bigger world:
  - Every road leads back around; there are no dead ends.
  - Each area has a big landmark you can see from far away.
  - The edges are water or hills that turn the car back gently.
  - No minimap and no text.
- **More of the same, spread out:** more props, puddles, ramps and traffic.
- **Size:** medium per map. The first big map also builds the tile drawing.

## Phase C. A map picker
- **The picker:** tiles with a picture of each map and no words (ADR 0003), three across.
  - It opens after the vehicle is chosen, or the two are combined on one screen (decision 3).
- **Saved per kid:** the last map is remembered.
- **Candidate maps.** The owner picks 2 or 3 to start:

| Map | What's there | Fits |
|---|---|---|
| **The island**, grown | Beach, bridge, tunnel, car wash, flood | Everything; it is today's map |
| **Farm and countryside** | Dirt roads, mud puddles, hay bales, animals that answer the horn, a barn | Tractors, buses |
| **Town** | Streets with gentle corners, a fire station, a car wash, roundabouts, parks | Fire engine, police, garbage truck |
| **Construction site** | Dirt hills, ramps, things to push and dig | Diggers, dump trucks, monster trucks |
| **Snowy hills** | Snow drifts that puff when you drive through (no sliding), pine trees, a frozen pond to drive on | Monster truck, snow plough |

## Phase D. Vehicles to choose from
- **The picker:** ADR 0021's car picker, finally built. It shows vehicle tiles, three across, and a tap drives off.
- **What a vehicle needs:**
  - A model built in code, about 2 to 4 hours each (ADR 0025).
  - Its size for bumping.
  - An engine sound, a horn, and maybe one **special action**.
- **The special action:** the horn button changes into that vehicle's action, so there are still only two kid
  buttons (decision 5).
  - Siren and lights (police, fire, ambulance).
  - Tip the dump bed, or scoop with the digger arm.
  - A spray from the fire engine's hose.
- **Candidates:**
  - Today's car, police car, monster truck and school bus.
  - A fire engine, an ambulance, a tow truck and a tractor.
  - A digger and a dump truck.
  - A race car, an ice-cream van and a garbage truck.
  - All original designs, no franchise look-alikes (ADR 0011).
- **Traffic** draws from the same set of vehicles.
- **Size:** small per vehicle once the picker exists; the special actions vary.

## Phase E. Customizing (a garage)
- **The garage:** a screen between the picker and the drive, with the vehicle turning slowly on a stand.
- **The choices** are all tiles and swatches, no text:
  - **Paint:** the Crayon Box palette (ADR 0016). Tap a swatch and the body changes.
  - **Wheels:** 3 or 4 styles.
  - **A topper:** a flag in the kid's colour (what ADR 0021 asked for), a light bar, a spoiler, a roof box.
  - **Stickers:** stars, stripes, spots, flames, hearts. Original shapes.
- **Saved per kid, per vehicle.** It syncs like other game data (ADR 0024).
- **Skipping:** a kid who doesn't want the garage can drive straight off with the last look.
- **Size:** medium.

## Phase F. Coloring the vehicles
Three ways, from simple to magical:

| Way | How it works | Effort |
|---|---|---|
| **1. Paint by part** in the garage | Tap the hood, door, roof or bumper with a crayon from the palette. Each part takes one colour | Small, on top of phase E |
| **2. Color a vehicle page** in the coloring game | Each vehicle gets a coloring page (side and top views). The finished picture becomes the vehicle's paint in the driving game | Large: the code-built models need texture coordinates, and the page must line up with them. The coloring engine is unchanged |
| **3. Patterns and stickers only** | No free coloring | Already in phase E |

**Suggestion:** way 1 first. Way 2 is the "wow" moment that joins the two games, and it is a good stretch goal
once the garage exists.

## Suggested order
- **Order:** 0, then A, then D (the picker with today's four vehicles), then B and C (the first big map and the
  map picker), then E, then F way 1, then more maps and vehicles.
- **Why D comes early:** choosing a vehicle is the quickest visible win for the kids.
- **Sounds:** they come in alongside, as the files from the sound plan arrive.

## Decisions for the owner
1. **First maps:** which 2 or 3, and is today's island one of them?
2. **Size:** how long should it take to cross a map? The plan assumes 1 to 2 minutes.
3. **Picker flow:** vehicle first and then map, or one screen with both?
4. **First vehicles:** which 6 to 8 to start with?
5. **Special actions:** should the horn button change into the vehicle's action, or should there be a third button?
6. **Garage:** which choices (paint, wheels, toppers, stickers)? Does the garage show every time, or only when
   tapped?
7. **Coloring:** paint-by-part first, with coloring pages as a later goal? Or go straight to coloring pages?
8. **Steering:** do the steering wheel and sensitivity setting first, before phase A? Three steps, or a
   slider for the parent?
9. **Name:** keep "racing" in the code and "Driving" on screen (ADR 0021 left this open)?

## Risks
- **The laptop's frame rate** may cap how big a map can be or how much is on screen. Phase 0 answers this.
- **Getting lost** in a bigger world. Playtest the first big map before making more.
- **Vehicle models are built in code** and cost hours each. CC0 glTF kits are allowed (ADR 0021), but they would
  look different from the polished toy look unless restyled.
- **Choice screens add taps** before the fun starts. Every picker remembers the last choice, so going back in is
  one tap.
