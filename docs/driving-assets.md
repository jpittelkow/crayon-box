# Driving game: the asset catalog (plan)

Everything the driving game draws, sorted by **how it behaves**, so each new thing goes into a category that
already says how it collides, sounds, is drawn and is tested. Drafted 2026-11-15 for
[milestone 3](milestone-3.md). This is a plan, not a decision: the vehicles-and-maps ADR (phase C) adopts or
changes it.

All assets are **built in code** with the toy kit (owner, 2026-11-15; ADR 0025), original designs (ADR 0011).

## The categories

| # | Category | What it is | Can the car hit it? | Drawn as | Examples today |
|---|---|---|---|---|---|
| 1 | **Vehicles** | Drivable, and the same models drive as traffic | Bumps and nudges, never stops | Piece by piece, wheels and lamps separate | car, police car, monster truck, school bus |
| 2 | **Toys** | Light things placed in the car's way to knock about; they come back | Yes: flies, tumbles, returns | Batched, one batch per toy kind | cone, crate, beach ball, hay bale |
| 3 | **Solid scenery** | Things that stay put; the car slides along them | Slides along, never stuck | Batched per kind | two kinds of tree |
| 4 | **Decor** | Small things the car drives straight through | No, passes through | Merged into the map's static mesh | bushes |
| 5 | **Roads** | The road network: curves the map defines, which traffic, the road-following assist and the rescue all use | Drives on it | Static meshes per map, built from the curves | the round road with its dashes and edge lines |
| 6 | **Ground and water** | The map's surface away from the roads, made from map data, not placed one by one | Drives on it; water slows it | Static meshes per map | grass, sand, puddles, the flood, the sea |
| 7 | **Set pieces** | A place that does something when the car arrives: a zone plus an animation and a sound | Drives into or through it | Piece by piece, a few per map | none yet (ramp, car wash, tunnel, bridge are planned) |
| 8 | **Animals** | Live things that answer the horn and step aside | Never: they move away first | Few, animated | none yet |
| 9 | **Effects** | Short-lived bits: splashes, spray, wake, dust, bubbles | No | Pooled and batched | puffs, drops, ripples |
| 10 | **Sky and light** | Per map: sky colours, haze, sun, the sea's colour | No | Scene settings | one sunny sky |

Sounds belong to the thing that makes them (an engine to its vehicle, a bump to its toy), not a category of
their own. Sounds of the place itself (waves, birds, wind) belong to the map's sky and light.

**Not in this catalog:** the buttons on top of the picture (back, horn) and the vehicle and map pickers. They are
Crayon Box screens and follow the design system (ADR 0016), not these categories.

### Which category? (the sorting rule)
Ask in this order; the **first yes** decides. Every asset lands in exactly one category.
1. Can a kid drive it? → **Vehicles**
2. Is it something the car drives along that the simulation follows (traffic, the assist, the rescue)? → **Roads**
3. Is it a surface or water, made from map shapes rather than placed as an object? → **Ground and water**
4. Does something happen when the car arrives (a zone with an animation and a sound)? → **Set pieces**
5. Is it alive, and does it move out of the car's way by itself? → **Animals**
6. Does it move when the car hits it, then go back to how it was? → **Toys**
7. Does the car drive straight through it? → **Decor**
8. Does it stay put while the car slides along it? → **Solid scenery**
9. Does it last only a moment? → **Effects**
10. Is it the light, the sky or the sound of the whole map? → **Sky and light**

A new idea that gets "no" to every question, or "yes" to two with no clear first, means a category is missing:
stop and change this catalog (and the ADR, once it exists) before building it.

### Border cases, settled (2026-11-15)
- **Set pieces may contain parts of other kinds.** A garage, car wash or tunnel mouth has walls, and a bridge has
  a boat under it. The walls follow the solid scenery rules (slide along, never hide the car) and the moving
  parts (boat, train, windmill sails, garage doors) are animated by the set piece. They are not assets of their
  own: a boat that only appears under the bridge belongs to `setpiece/bridge`.
- **Things that move on their own but aren't driven or alive** (boats, a train, sails) are always part of a set
  piece, by the rule above.
- **Poles and fences are toys, not solid scenery.** Lamp posts, traffic lights and signs **wobble** (a new knock
  behaviour, below); fence panels tumble and come back. Only trees, rocks and buildings are solid, so there is
  less in the world that can stop the car.
- **A road piece owns its sides.** Bridge railings and tunnel walls are part of `road/bridge-deck` and
  `road/tunnel-floor`, so a bridge or tunnel is built in one place. The rock around a tunnel is solid scenery.
- **Changes to how the car looks are vehicle states, not assets.** Muddy, bubbly (car wash) and wet are states
  every vehicle has; ground, water and set pieces only switch them on and off.
- **Puddles are water, even though a map places them one by one,** because the car drives into them and the
  simulation treats them as a surface (rule 3).

### Rules for every category
- **Nothing hides the car.** Anything taller than the car near the road shrinks away or fades when it is between
  the camera and the car, as trees do now (ADR 0021). Buildings follow the same rule or sit back from the road.
- **Nothing stops the car dead or traps it.** Solid things are circles or line segments the car slides along.
- **Nothing gets hurt.** Animals always move first; toys always come back; vehicles only nudge.
- **No text, no franchise looks, no scary things** (ADR 0003, 0011). Signs are pictures.
- **Batched where it repeats** (ADR 0025): toys, scenery and decor are drawn in one batch per kind.

## What each category needs

Every asset has two halves, so the simulation stays free of three.js (ADR 0021):
- **Definition** (`sim/`, plain TypeScript): id, size, collision shape, behaviour numbers, which sound.
- **Look** (`look/`, three.js): the model, built with the kit.

Maps (phase B's map files) refer to assets by **id**, e.g. `toy/cone`, `road/street`, `scenery/pine`, `setpiece/car-wash`, never
by a number as today's props do.

| Category | Definition holds | Look holds | Sound | Budget (triangles, a guess until the laptop check, phase A2) |
|---|---|---|---|---|
| Vehicles | size, top speed, how hard it pushes toys, how it wades, horn kind | body, wheels, lamps, optional moving part (ladder, digger arm) | engine voice, horn | ≤ 30k each (the code fire truck is 27.5k) |
| Toys | half-size, weight, **knock behaviour** (below), return time | one shape, centred | its own bump | ≤ 1.5k each, since a map has 100+ |
| Solid scenery | collision circle or segments, whether it shrinks away | one shape, maybe 2–3 variants | none, or a soft thud | trees ≤ 1k; buildings ≤ 6k |
| Decor | nothing (no collision) | one shape | none | ≤ 300 each, merged |
| Roads | the curves, each road's kind and width, junctions, lanes for traffic, which stretches are bridge, tunnel or ford | asphalt or dirt, kerbs, markings, built along the curves | wheel sound per road kind | per map; markings merged into one mesh |
| Ground and water | surface kind per area (grass, sand, dirt, puddle, deep water, mud) | built from the map's shapes | wheel sound per surface, splash | per map |
| Set pieces | the zone, what happens there (jump, wash, swap vehicle), timing | the model and its animation | its own | ≤ 15k each |
| Animals | where it wanders, how far it steps aside, its answer to the horn | body with a simple walk or hop | its call | ≤ 3k each |
| Effects | pool size, life, motion | one tiny shape | via the thing that caused it | tiny, pooled |
| Sky and light | per map settings | — | ambient (waves, birds, wind) | — |

### Knock behaviours (toys)
Giving each toy one of a few behaviours makes the toys feel different without new rules per toy. Built so far
(2026-11-15): tumble and roll, set per toy in `sim/assets/toys.ts`.
- **Tumble** (today's default): pushed, spins, bounces, settles, returns. Cone, crate, bale.
- **Roll**: keeps rolling along the ground, slows, then returns. Beach ball, barrel, pumpkin.
- **Topple**: a stack or row falls apart piece by piece, then rebuilds. Tyre stack, block tower, skittles.
- **Chain**: one knocked piece knocks the next. A row of dominoes.
- **Burst and rebuild**: breaks into bits (a puff of leaves, straw, sand) and grows back in place. Sandcastle,
  leaf pile, hay pile.
- **Wobble**: bends away on a spring and swings back upright; never leaves its spot. Lamp post, traffic light,
  sign.

## The catalog
Status: **built** (in the game), **sample** (in a spike), **planned** (in this plan), **idea** (to pick from).
Maps: all, island, town, country (the maps of milestone-3 phase E).

### 1. Vehicles
| Id | Status | Maps | Notes |
|---|---|---|---|
| `vehicle/car` | built | all | the kid's colour when the kid drives it (painted, like the monster truck; the police car and bus fly the kid's flag instead, B5) |
| `vehicle/police` | built | all, town | flashing lamps; horn becomes a siren (phase D) |
| `vehicle/monster` | built | all, country | pushes toys furthest, wades fastest |
| `vehicle/bus` | built | all, town | flashing top lamps |
| `vehicle/fire-truck` | built (2026-11-15, `look/fleet.ts`) | all, town | ladder rises when it stops; siren (stand-in), lamps flash |
| `vehicle/ambulance` | built (2026-11-15, `look/fleet.ts`) | town | siren (stand-in, higher), lamps flash |
| `vehicle/tow-truck` | built (2026-11-15, `look/fleet.ts`) | all | hook swings as it drives |
| `vehicle/digger` | built (2026-11-15, `look/fleet.ts`) | country | arm scoops when it stops; beep-beep |
| `vehicle/dump-truck` | built (2026-11-15, `look/fleet.ts`) | country | bed tips when it stops |
| `vehicle/tractor` | built (2026-11-15, `look/fleet.ts`) | country | slow, big back wheels; painted in the kid's colour |
| `vehicle/garbage-truck` | built (2026-11-15, `look/fleet.ts`) | town | amber lamp |
| `vehicle/cement-mixer` | built (2026-11-15, `look/fleet.ts`) | town | drum turns |
| `vehicle/ice-cream-van` | built (2026-11-15, `look/fleet.ts`) | island | a cone on the roof; its horn is a little tune (stand-in) |
| `vehicle/race-car` | built (2026-11-15, `look/fleet.ts`) | all | quickest; painted in the kid's colour |

**States every vehicle has** (switched by ground, water and set pieces, not assets of their own):
| State | Status | Switched on by | Switched off by |
|---|---|---|---|
| wet | built (drips, wading) | puddles, the flood | time |
| muddy | idea | `ground/mud` | `setpiece/car-wash`, deep water |
| bubbly | built (`Car.soap`) | `setpiece/car-wash` | its rinse |

### 2. Toys
| Id | Status | Maps | Behaviour |
|---|---|---|---|
| `toy/cone` | built | all | tumble |
| `toy/crate` | built | all | tumble |
| `toy/beach-ball` | built | island | roll |
| `toy/hay-bale` | built | country | tumble (roll later: it should roll about its own axis, unlike a ball) |
| `toy/barrel` | idea | all | roll |
| `toy/tyre-stack` | idea | town | topple |
| `toy/block-tower` | idea | all | topple (plain colours, no letters) |
| `toy/skittles` | idea | all | topple, a set of ten |
| `toy/dominoes` | idea | town | chain |
| `toy/sandcastle` | idea | island | burst and rebuild |
| `toy/leaf-pile` | idea | country | burst and rebuild |
| `toy/pumpkin` | idea | country | roll |
| `toy/swim-ring` | idea | island | tumble, floats in water |
| `toy/road-barrier` | idea | town | tumble |
| `toy/sign` | idea | town | wobble; picture signs only |
| `toy/lamp-post` | idea | town | wobble; lit on an evening map |
| `toy/traffic-light` | idea | town | wobble; for show, never stops anyone |
| `toy/fence-panel` | idea | country | tumble; a map lines them up along a field or road |

### 3. Solid scenery
| Id | Status | Maps | Notes |
|---|---|---|---|
| `scenery/pine` | built | all | shrinks away |
| `scenery/round-tree` | built | all | shrinks away |
| `scenery/palm` | idea | island | |
| `scenery/rock` | idea | all, country | 2–3 sizes |
| `scenery/house` | idea | town, country | 2–3 colour variants; set back or fades |
| `scenery/shop` | idea | town | picture shop fronts, no words |
| `scenery/barn` | idea | country | |
| `scenery/lighthouse` | idea | island | far from the road (tall) |
| `scenery/tunnel-rock` | planned (ADR 0021) | island, country | the hill a tunnel goes through; the camera must stay out of it |

### 4. Decor
| Id | Status | Maps |
|---|---|---|
| `decor/bush` | built | all |
| `decor/flowers` | idea | all |
| `decor/grass-tuft` | idea | all |
| `decor/reeds` | idea | island, country (water edges) |
| `decor/shells` | idea | island |

### 5. Roads
Roads are the backbone of every map: the simulation follows them (traffic lanes, "follows the road", turning a
stuck car toward the nearest road, toys placed in the car's way), so they are data first and a picture second.
A map's road network is a set of **curves** joined at **junctions**; each stretch has a **kind** and may be a
**piece** (bridge, tunnel, ford). Since 2026-11-15 roads come from the map file (`maps/island.ts` has one ring
road) as point paths: `sim/roads.ts` follows them and `look/roads.ts` draws them. Junctions and road kinds other
than `street` are still to come.

Rules for roads:
- **No dead ends.** Every road joins another or ends in a loop, so a kid driving along a road is never stopped.
- **Wide and gentle.** Wide enough for the kid's biggest vehicle and a passing truck; curves gentle enough that
  "follows the road" never runs off them.
- **Traffic gives way.** At junctions and on bridges traffic always waits for the kid's car; nothing ever blocks
  the road (ADR 0021).
- **Bridges, tunnels and fords are road pieces.** The road holds the deck, floor or shallow water; the set piece
  of the same name (category 7) adds what happens there (echo, a boat passing under).

**Kinds of road**
| Id | Status | Maps | Notes |
|---|---|---|---|
| `road/street` | built | all | asphalt, two lanes, centre dashes and edge lines (today's ring) |
| `road/lane` | idea | country | narrower, no centre line, grass verges |
| `road/dirt-track` | idea | country | packed earth, dust puffs, puddles likely |
| `road/sand-track` | idea | island | along the beach, wheel ruts |

**Pieces**
| Id | Status | Notes |
|---|---|---|
| `road/curve` | built | any stretch between junctions; the ring is one closed curve |
| `road/junction` | built (three-way, 2026-11-15) | an open road joins another at its ends (`from`, `to`); traffic and "follows the road" pick a way there, and traffic gives way to the kid's car. Four-way is still to do |
| `road/roundabout` | idea | town; a toy or fountain in the middle |
| `road/bridge-deck` | built (2026-11-15, a `bridge` guard) | a wooden deck over the water with white rails the car slides along; the shore doesn't turn the car back on or near it |
| `road/tunnel-floor` | built (2026-11-15, a `tunnel` guard) | walls keep the car on the road; stone portals at both ends; the hill around it is a map `hill`. Lamps were tried and dropped: with no tunnel walls drawn, they float when the hill fades |
| `road/ford` | idea | a shallow stretch across a river: puddle splash, never deep |
| `road/ramp` | planned (ADR 0021) | the slope; the jump is the set piece |

**Markings and roadside**
| Id | Status | Notes |
|---|---|---|
| `road/centre-dash` | built | |
| `road/edge-line` | built | |
| `road/crossing` | idea | zebra stripes; picture only, no one waits at it |
| `road/kerb` | idea | town streets; the car rolls over it |
| `road/verge` | idea | grass strip along lanes |
| `road/arrow` | idea | painted arrows at a roundabout, no words |

Things that stand along roads (lamp posts, traffic lights, signs, fence panels) are toys that wobble or tumble
(see Border cases); a map can line them up along a road curve.

### 6. Ground and water
| Id | Status | Notes |
|---|---|---|
| `ground/grass` | built | patchy colour |
| `ground/sand` | built | the beach ring, and sand areas a map draws (`sand`): top speed 11 and wheel puffs |
| `ground/mud` | idea | splatters the car; washes off in the car wash |
| `water/puddle` | built | splash and spray |
| `water/flood` | built | deep: wade, sink, bob, wake |
| `water/sea` | built | edge of every map; the car turns back at it |
| `water/river` | idea | crossed by a bridge deck and a ford (road pieces) |
| `water/pond` | idea | ducks |

### 7. Set pieces
A set piece may contain walls (solid scenery rules) and moving parts it animates itself (boat, train, doors,
sails); see Border cases.

| Id | Status | Maps | What happens |
|---|---|---|---|
| `setpiece/ramp` | built (2026-11-15, `sim/ramps.ts`, `look/setpieces.ts`) | all | a yellow hump across the road, either way; cars follow its height and a fast one hops off the top and lands (a thump); traffic hops too |
| `setpiece/car-wash` | built (2026-11-15, `look/setpieces.ts`) | all | an open arch over the road with spinning brushes; cars crawl through, come out soapy and shed bubbles while they rinse (3.5 s); the roof fades while the camera passes; traffic uses it too. Washing off mud comes with `ground/mud` |
| `setpiece/tunnel` | built, without sound (2026-11-15) | island, country | the hill turns see-through while the kid is inside; the echo on the engine and horn comes with the sound files |
| `setpiece/bridge` | planned (ADR 0021) | island, country | on a `road/bridge-deck`: a boat passes under sometimes |
| `setpiece/garage` | planned (phase D) | all | drive in, come out in the next vehicle |
| `setpiece/fire-station` | idea | town | the town's garage, doors roll up |
| `setpiece/fountain` | idea | town | drive through the spray |
| `setpiece/harbour` | idea | island | boats bob, a ship's horn answers |
| `setpiece/windmill` | idea | country | sails turn faster when the car is near |
| `setpiece/level-crossing` | idea | country | a train crosses on a bridge overhead, never across the road |

### 8. Animals
| Id | Status | Maps | Answer to the horn |
|---|---|---|---|
| `animal/cow` | built (2026-11-15) | building site, later maps | moo (stand-in), a hop |
| `animal/sheep` | built (2026-11-15) | island | baa (stand-in), small hop |
| `animal/chicken` | idea | country | cluck, flaps |
| `animal/duck` | built (2026-11-15) | island | quack (stand-in), a hop; paddling on a pond is still to do |
| `animal/seagull` | idea | island | flies up and lands again |
| `animal/dog` | idea | town | woof, wags |

### 9. Effects
| Id | Status | Used by |
|---|---|---|
| `fx/puff` | built | dust, toys landing |
| `fx/drop` | built | splashes, spray |
| `fx/ripple` | built | wake |
| `fx/bubble` | planned | car wash |
| `fx/leaf` / `fx/straw` / `fx/sand` | idea | burst-and-rebuild toys |
| `fx/mud` | idea | mud splatter |

### 10. Sky and light
| Id | Status | Maps |
|---|---|---|
| `sky/sunny` | built | all; ambient sound (waves, birds) to add |
| `sky/evening` | idea | a map variant with lamps lit |

## Where it goes in the code
Proposed for phase B, when the world becomes data (a refactor of today's `look/` and `sim/`). Built so far
(2026-11-15): `sim/map.ts` (the map format), `sim/roads.ts`, `look/roads.ts`, `maps/island.ts`, and the
registry for toys, scenery and decor: `sim/assets/toys.ts` and `scenery.ts` (definitions), `look/toys.ts` and
`look/scenery.ts` (looks, keyed by id), and `sim/assets/index.ts` (every asset by category). Vehicles keep
their kinds (`car`, `police`...) with ids `vehicle/<kind>`; their definitions stay in `sim.ts` for now.
```
src/games/racing/
  sim/assets/        definitions, one file per category: vehicles.ts, toys.ts, scenery.ts, setpieces.ts, animals.ts
  sim/roads.ts       the road network: curves, junctions, lanes; nearest road, follow the road, traffic routes
  look/kit.ts        shared materials and shapes (as now)
  look/vehicles/     one file per vehicle (they are big)
  look/toys.ts       all toys (they are small)
  look/scenery.ts    solid scenery and decor
  look/setpieces/    one file per set piece
  look/animals.ts
  look/roads.ts      road surfaces, kerbs and markings, built along the curves
  look/ground.ts     ground and water, from a map
  maps/              island.ts, later town.ts, country.ts: the road network, then asset ids with places
```
A **registry** maps each id to its definition and its look, so a new asset is: a definition, a look, a line in
the registry, and a place on a map. `src/games/racing/assets.test.ts` checks every id has both halves, that every
look builds within its category's triangle budget, and that a map uses only registered ids.

## How a new asset gets made
1. Add its row here (or move it from idea to planned).
2. Definition and look, with the category's budget.
3. Shown in the **asset gallery**: `/tools/driving-gallery.html` on the dev server (built 2026-11-15). It lays
   out every registered asset in rows by category on a small gallery map, drawn by the game's own renderer,
   labelled with its id and triangle count; `?row=vehicles` (or `toys`, `scenery`, `effects`) shows one row
   close up. `node tools/shoot-gallery.mjs` saves screenshots to `test-results/gallery/`. This is where a new
   asset is checked by eye next to the others.
4. Unit test from its category: a toy settles and returns; scenery never traps the car; an animal is never hit.
5. Placed on a map.

## Open
- The budgets are guesses until the laptop check (milestone-3 phase A2).
- Buildings in town: fade them, shrink them, or keep them back from the road (camera rule above).
- Whether toys keep the "returns to its place" rule on big maps, or only return once the car is out of sight.
