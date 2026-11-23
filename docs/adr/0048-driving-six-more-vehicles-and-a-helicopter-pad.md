# 0048. Driving game: six more vehicles and a helicopter pad

- Status: Accepted (the owner picked the vehicles and the helicopter on 2026-11-23; the details marked *(proposed)*
  were built on defaults the owner can overrule)
- Date: 2026-11-23
- Builds on: [ADR 0035](0035-driving-vehicles-maps-picker-garage.md) (fourteen vehicles built in code, the picker,
  the garage), [0025](0025-driving-game-toy-look-and-engine-sounds.md) (the toy look, an engine per vehicle),
  [0042](0042-driving-more-set-pieces.md) (set pieces as zones). Nothing in them changes.

## Context
The to-do list's next step for the driving game was more vehicles, picked with the owner. From eleven ideas the
owner chose six to drive (forklift, road roller, loader, street sweeper, mail van, quad bike) and the helicopter,
which was offered as a set piece to look at, not a vehicle: it can't follow the rule that every vehicle has the
same controls.

## Decision

### Six more vehicles (twenty in all)
Built in code like the others, under every rule of ADR 0035: same controls, one moving thing, an engine and a horn
of its own (stand-ins), a parent switch, a place in traffic, the garage and the picker.

| Vehicle | Kid's colour | Horn *(proposed)* | Weight *(proposed)* | Its moving thing *(proposed)* |
|---|---|---|---|---|
| forklift | flag | three high beeps | slow | forks with a crate on a pallet rise when it stops |
| road roller | flag | two low honks | slow, the heaviest: pushes toys furthest | its steel drum turns as it drives |
| loader | flag | beep-beep | slow, heavy, wades | a bucket of earth lifts when it stops |
| street sweeper | flag | two notes | slow, light | brushes spin, faster the faster it goes; amber lamps flash |
| mail van | flag | two notes, low then high | normal | its back door rolls up when it stops, showing parcels |
| quad bike | paint | high toot | quick (18 m/s), light, wades | bounces on its springs as it goes |

- **The mail van's door is at the back**, not the side: the camera sits behind the vehicle, so that is where a kid
  sees it open. Its sides carry a picture of an envelope, no words (ADR 0003).
- **The building site's traffic prefers** the loader, the road roller and the forklift as well as its five before.
- **The picker has five pages** for twenty vehicles (five tiles and "more" a page, ADR 0035); the swap tray in the
  game shows all twenty at once, four rows of five, which just fits a 1280 × 800 screen.

### A helicopter pad (`setpiece/helipad`)
- A new zone kind, `helipad`: a round pad on the grass beside a road, placed by its middle, with a helicopter
  standing on it, its rotor turning lazily.
- **For show.** When the kid's car comes within 40 m the rotor spins up and the helicopter lifts off and hovers 7 m
  over the pad, turning slowly; when the kid is more than 55 m away it comes down and the rotor slows. Traffic
  doesn't set it off.
- **Never in the way.** The pad is flat ground a car can cross. The helicopter has no body to bump into; it is
  higher than every vehicle before the fastest one can reach the pad (a test proves it, also for a kid who turns
  back as it lands). Trees and toys keep off the pad.
- **Sound:** a low loop chopped into beats, louder near the pad and as the rotor speeds up (a stand-in from the
  bus's engine loop).
- **The pad is painted with rings**, not a letter (ADR 0003).
- One on the island, inside the loop beside the spur. The map editor can place one.

## Consequences
- 72 more picker pictures ship (six vehicles in twelve colours), about 0.4 MB.
- Five picker pages is a lot of "more" taps to reach the last vehicles; if a playtest shows the new ones are never
  found, the order or the page size is what to change. A parent can also switch off vehicles nobody drives, which
  shortens the picker.
- The swap tray has no room for a fifth row at 800 px high: more vehicles after these need the tray to page or its
  tiles to shrink.
- All new sounds are stand-ins pitched from shipped files, like those of ADR 0035; nobody has heard them yet.
- A helicopter a kid can only watch may make a kid ask to fly it. Flying is a different game (new controls, a new
  camera) and would be its own ADR.
