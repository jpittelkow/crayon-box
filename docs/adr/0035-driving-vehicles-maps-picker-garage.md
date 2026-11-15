# 0035. Driving game: fourteen vehicles, two big maps, one picker screen and a garage

- Status: Accepted (owner, 2026-11-15)
- Date: 2026-11-15
- Supersedes, in [ADR 0021](0021-racing-game.md): "one small island" (now one of several maps) and the car picker
  (now one picker screen for vehicles and maps). Builds on [ADR 0025](0025-driving-game-toy-look-and-engine-sounds.md)
  (the toy look, an engine per vehicle) and [ADR 0031](0031-driving-to-a-spot-and-traffic-company.md).

## Context
Milestone 3 ([plan](../milestone-3.md)) grows the driving game after its first full version (phase B): more
vehicles, bigger maps, and a way to pick them. On 2026-11-15 the owner chose:
- vehicles **built in code** with the toy kit, after a three-way sample (code, a CC0 kit, AI-made);
- **all ten** new vehicles offered: fire truck, ambulance, tow truck; digger, dump truck, cement mixer; tractor,
  garbage truck; ice-cream van, race car;
- **two maps**: the island grown, and a building site;
- **one picker screen** with both the vehicles and the maps;
- the kid's colour **mixed** (paint where it fits, a flag where it doesn't; B5);
- sounds as files (ADR 0032), with **stand-ins** until new takes can be made; horns for the monster truck and the
  bus come with these vehicles; the tunnel echo is made by the app.

## Decision

### Vehicles
Fourteen in all: the four of today and the ten new ones. Each is built in code from the toy kit (ADR 0025), at
most 30,000 triangles, with an engine voice and a horn of its own.

| Vehicle | Kid's colour | Horn (stand-in until a take of its own) | Weight *(proposed)* | When it stops *(proposed)* |
|---|---|---|---|---|
| car | paint | bicycle horn | normal | — |
| police car | flag | siren, lamps flash | quick | — |
| monster truck | paint | big low horn | heavy: pushes toys further, wades faster | — |
| school bus | flag | bus horn | slow, long | — |
| fire truck | flag | siren, lamps flash | heavy | ladder rises |
| ambulance | flag | siren (higher), lamps flash | quick | — |
| tow truck | paint | low horn | normal | hook swings |
| digger | flag | beep-beep | slow, heavy | arm scoops |
| dump truck | flag | low horn | heavy | bed tips |
| cement mixer | flag | low horn | slow | drum keeps turning |
| tractor | paint | low honk | slow | — |
| garbage truck | flag | horn | slow | — |
| ice-cream van | flag | its own little tune | slow | — |
| race car | paint | high toot | quick | — |

- **Paint or flag:** vehicles whose look *is* their colour (a fire truck is red, a school bus yellow, a digger
  orange) keep it and fly the kid's flag; the others are painted *(proposed for the new ten)*.
- **Weight** changes only feel: top speed (quick 19, normal 17, slow 13 m/s), how far toys fly, how fast it
  wades. Nothing a kid has to do is easier with any vehicle.
- **Traffic** draws from all of them, so every vehicle a kid can drive can be met on the road.
- **A parent switch per vehicle** under Settings, Driving, for the whole family: a hidden vehicle is not in the
  picker, the garage or traffic (say, a siren a kid finds scary). All are on at first.

### Maps
- **The island, grown** *(proposed size)*: about twice today's width (four times the area, 1 to 2 minutes from
  end to end), with every set piece of phase B, a longer beach, a harbour with boats to look at, and the loop and
  shortcut lengthened into a figure of roads with three-way junctions.
- **The building site** *(proposed)*: about the same size. Dirt roads (they slow nothing, they only look and sound
  different), dirt hills the car drives round, several ramps, muddy puddles (the car gets muddy, the car wash
  cleans it), stacks of tyres, barrels and building blocks to knock down, and the building vehicles working in
  traffic. A cow field at its edge.
- Both stay inside today's rules (ADR 0021): no way to lose, nothing that stops the car dead, the shore or the
  map's edge turns the car back, "follows the road" works on every road, and a car that goes nowhere is turned
  toward the nearest road. Every place a kid can reach is within 25 m of a road.
- A map is a data file (`src/games/racing/maps/`), as the island is today.

### One picker screen
- The game opens on one screen, on the kid's colour *(proposed layout)*:
  - **the maps along the top**, as wide tiles with a picture of each; the one picked is ringed;
  - **the vehicles below**, five tiles and a "more" tile per page (ADR 0016 rule 6);
  - **a tap on a vehicle drives off** on the map that is ringed. A tap on a map only rings it.
- The last map and vehicle are saved per kid, so going back in is one tap.
- No text: names are for screen readers and tests only (ADR 0003).

### The garage
- **A building on each map** *(proposed)*: driving in fades to a short animation (doors close, a spanner turns,
  doors open) and the car comes out as the **next vehicle** in the list of vehicles the parent has on. No choice
  to make and nothing to read. It is a zone like the car wash.

### Drawing bigger maps
- The renderer hides trees, toys and decor beyond about 150 m (the haze already starts at 90 m) and does not draw
  traffic it can't see. Cutting a map into tiles waits for the laptop's numbers (phase B7): if it keeps 60 frames
  a second on the grown island without tiles, none are built.

## Consequences
- Ten vehicles at a few hours each is most of phase D; each also adds an engine and a horn stand-in now, and a
  take of its own later (open question: how new sound files are made).
- Two maps of this size take far longer to lay out than the island; they are written as data in code, like the
  island. A map editor (plan, phase E) waits until a third map is wanted.
- The picker holds 14 vehicles and 2 maps on one screen, with paging; if the playtest finds it too busy, the maps
  can move to their own screen without changing anything else.
- Frame rate on the family laptop is still unmeasured (B7). If it can't keep up, the look turns down first (ADR
  0025), then the maps' size.
