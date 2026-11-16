# 0040. Driving game: a very large map, a highway in a figure of eight round a building site and a quarry

- Status: Proposed (the owner's choices are in; accepted once the two-level road is proven on a small test map)
- Date: 2026-11-15
- Builds on [ADR 0021](0021-racing-game.md), [0025](0025-driving-game-toy-look-and-engine-sounds.md),
  [0032](0032-sounds-as-files.md), [0035](0035-driving-vehicles-maps-picker-garage.md) and
  [0036](0036-driving-screen-is-a-joystick.md).
- Supersedes, in ADR 0035, once accepted: "two maps" (now three); "every place a kid can reach is within 25 m of a
  road" (45 m, and tested); "cutting a map into tiles waits for the laptop's numbers" (built, see below); "a map
  editor waits until a third map is wanted" (a map viewer first; the editor stays on the to-do list).
- Numbered 0040 because 0038 and 0039 were both taken on the day it was written.

## Context
The owner asked on 2026-11-15 for a very large driving map, "like a highway and construction site", made with the
[recipes](../recipes/README.md). The plan is [highway-map-plan.md](../highway-map-plan.md); this ADR records what
it decides. Measured on `main` that day:
- The island is 3.7 ha with 0.70 km of road; the building site 5.1 ha with 0.80 km.
- One simulation step of the island takes 1.24 ms, nearly all of it every vehicle checking every toy. A stand-in
  map four times as wide took 105 ms a step. A frame has 16.7 ms.
- Stretching a map leaves an empty middle: 69 % of the stand-in's land was more than 40 m from a road.
- ADR 0035's 25 m rule is not what the two maps are (farthest 46 m and 45 m; a quarter of the land over 25 m)
  and nothing tests it.

The owner chose layout B (the figure of eight) over the recommended layout A, then took the recommendation on
every other choice but when to start (plan, D1 to D10).

## Decision

### The map
- **A third map,** an invented place: a four-lane highway in a figure of eight, about 3.1 km round, on land about
  1,080 m by 660 m (about 13 islands), with about 5.5 km of road in all. The picture is
  [highway-layout-b.svg](../design/highway-layout-b.svg). It is written at one size and scaled by one number, so
  the size can still change.
- **The highway crosses over itself** in the middle on an overpass. A kid who only follows the road goes round
  both halves in turn and never meets a choice.
- **West loop:** a building site (crane yard, mud flats and car wash, pipe yard, site office). **East loop:** a
  quarry on a lake (dirt hills, ramps, a gravel chute). On the highway: a long bridge, a tunnel, a rest stop, toll
  gates, a stretch still being built.
- **The lake is the sea come in,** so the land stays one shoreline and the long bridge is today's kind of bridge.

### Rules a very large map keeps (on top of ADR 0021 and 0035)
- **The main road is a loop.** No dead ends anywhere; every district has a way in and a way out.
- **No reachable place is more than 45 m from a road,** on every map, checked by a test. The island's farthest
  point measured 46 m: it is moved under the line or given its own written allowance when the test is added.
- **Land hugs the roads.** What would be an empty middle is water or a hill.
- **Districts,** each about one of today's maps in size, with one idea, its own ground and scatter rules, and one
  tall thing to steer by that is drawn clear of the haze. No two look alike.
- **Something to do about every 200 m of road,** never more than 300 m without one; **a garage within 400 m** of
  everywhere.

### The highway
- **A new road kind:** 17 m wide, two lanes each way, lane dashes, a painted middle, shoulder lines. Lanes become
  data of the road kind. Slip roads are streets that join at a shallow angle.
- **No rules for the kid.** No barrier down the middle and no wrong way: a kid may drive anywhere, either way.
  Traffic keeps to its own side, makes room in any lane, and never blocks or honks at the kid. The toll gates are
  open before any vehicle reaches them.
- **The same top speed as everywhere** (ADR 0035's weights). Traffic cruises faster there, and a hum and wind
  give the feel. Tuned in a playtest.

### Roads on two levels
- **An `overpass` guard:** a stretch of road on a deck that rises about 6 m, with rails like a bridge's. A vehicle
  that enters at an end is on the deck until it leaves at an end; any other vehicle there is under it. Vehicles
  on different levels don't bump; toys, water and zones below leave a car on the deck alone.
- **Level is told by distance along the road,** not by which road, because the highway crosses itself. "Follows
  the road", the rescue and the sounds use the nearest stretch on the car's own level.
- **Piers are round and stand clear of the road below.** The deck fades while the kid's car is under it.
- **Proven first** on a small figure of eight used only by tests and the gallery. If a car can end up on the wrong
  level, this map falls back to layout A (a flat ring round a lake), which needs none of it.

### Only what is near is simulated and drawn
- **A grid over the map** (squares of about 50 m) lists roads, shoreline, trees, toys, water and zones, and
  vehicles look only in the squares around them. Same results as today, checked against the slow way.
- **Toys at home with no vehicle near are skipped.**
- **Traffic lives near the kid:** about ten vehicles by a rule in the map, put back on a road out of sight when
  they fall far behind. Never where the kid can see it happen.
- **Only near trees, toys and animals are sent to the graphics card;** decor and ground are cut into tiles of
  about 100 m.
- **Budgets:** a step under 2 ms on the dev machine; 45 frames a second on the family laptop without the game
  turning its picture down; the map open in under 3 s there.

### The map file, the tools, the start
- **The map format grows:** districts with their own rules, toys in rows along a road, ground areas (dirt,
  asphalt), traffic by rule. A big map is a folder of data files, one per district. Small maps keep working as
  they are.
- **A map viewer** (a dev page, not in the app): any map from above with its roads, zones, districts and
  "too far from a road" shown. The map editor stays on the to-do list.
- **A kid starts at one of four spots in turn,** each beside a set piece, remembered per kid.

### The pieces
- **First set,** each built by its recipe before it is placed: the highway kind, the overpass, a concrete bridge
  look, a works stretch with cones and barrels in rows, dirt and asphalt ground, a mud zone and the muddy state,
  the crane, the gravel chute, the toll gates, the rest stop as a garage, barrels and road barriers, stacks that
  topple (tyres, bricks), rocks and a silo.
- **Later:** giant pipes, a ford, signs and lamp posts that wobble, dirt piles that burst and grow back, a
  building frame, reeds, the place's own sound, and two vehicles, **a road roller and a big lorry**, which then
  follow ADR 0035's rules for every vehicle (a parent switch, traffic, the garage).
- Every piece makes a sound, a stand-in at first (ADR 0032; owner, 2026-11-15).

### Not decided
- **When it starts.** The to-do list's order stands (the pieces in its section 4, the map last) until the owner
  says otherwise.

## Consequences
- This is the biggest piece of driving work yet: about twenty pull requests (the near-only engine, two levels,
  the highway, the first set) before the map itself, which is then built district by district.
- The engine work and the new pieces also help today's two maps, whose behaviour and pictures must not change.
- Two levels is new ground for a simulation that has been flat; it is the one part that could trap a car, so it
  carries the most tests and has a fallback.
- The stricter map tests apply to the island and the building site too; where one fails, it is fixed or its
  allowance is written down.
- The frame rate on the family laptop is unknown until the stand-in map is measured there. If it can't keep up:
  fewer toys and trees per district, then a shorter draw distance, then a smaller map.
- A kid may still get lost or bored on a map this size; the playtest decides, and a smaller size is one number.
- Three recipes get written as they are proven: a road kind, an overpass, a very large map.
