# 0041. Driving game: targets, stacks of boxes to knock over and stars to collect

- Status: Accepted (2026-11-15, by the owner's defaults: stacked boxes and stars, a confetti burst, they come back,
  no score, sounds from shipped files as stand-ins)
- Date: 2026-11-15
- Builds on [ADR 0012](0012-multi-game-shell.md) (no way to lose), [0021](0021-racing-game.md) (things to knock
  around), [0025](0025-driving-game-toy-look-and-engine-sounds.md), [0032](0032-sounds-as-files.md) and
  [0035](0035-driving-vehicles-maps-picker-garage.md); sorted with the [asset catalog](../driving-assets.md).

## Context
The owner asked on 2026-11-15 for "targets to collect and hit": stacked boxes to knock over, coins or stars to
collect, a silly noise and a confetti burst, then they come back; no score and no losing (ADR 0012). It is the
first item of the to-do list's map pieces. The owner took the defaults offered the same day: **stacked boxes** and
**stars** (not coins), confetti, they come back, no score, and stand-in sounds from files the app already ships.

Today's toys (cone, crate, beach ball, hay bale) already fly when hit and come back, with a bump sound each. What a
target adds is the celebration: something a kid aims for, and a little party when they get it.

## Decision

### What a target is: a toy
Sorted with the catalog's rule, a target is a **toy** (category 2): it isn't driven, isn't a road or ground, has no
zone (a set piece is a *place*, a few per map, drawn piece by piece; targets are things, many per map, batched),
isn't alive, and it moves when the car hits it, then goes back to how it was (rule 6). So targets are toys with two
new **knock behaviours** from the catalog's list, and a toy def says it is a target by naming its celebration:
- **`topple`** (already in the catalog's list): a stack falls apart, then rebuilds piece by piece.
- **`collect`** (new): the thing is taken when the kid's car drives through it, spins off, and comes back.

A target is otherwise a toy like the others: one look per id, one batch per kind, registered in
`sim/assets/toys.ts` and `look/toys.ts`, shown in the gallery's toy row.

### The two targets
- **`toy/box-stack`, a stack of boxes**: six bright toy boxes in a pyramid (three, two, one), about 2.2 m high, so
  no taller than a bus and low enough not to hide the car from the chase camera. Each box is a block of the stack
  (its own prop in the simulation, tinted a different colour by the renderer); the stack's id is the asset.
  - **Hit:** the car touching any bottom box knocks the whole stack: every box flies off in the way the car was
    going, the higher ones further, tumbling as crates do.
  - **Back:** each box waits where it landed for 4 s, shrinks away and grows back at home, bottom row first: a box
    grows only once the boxes under it are home. Nothing grows while the kid's car is within 5 m, so a stack never
    rebuilds inside the car or knocks itself straight over again.
- **`toy/star`, a gold star**: about 1 m across, floating at the car's roof height above the road, turning slowly
  and bobbing, so it reads as "drive through me".
  - **Collect:** the kid's car drives through it (generously: anywhere within half a metre of the car's sides).
    The star spins fast, rises and shrinks away in under a second.
  - **Back:** 10 s later, and only once the kid's car is at least 6 m away, it grows back in its place. A kid
    parked on a star doesn't collect it over and over.

### The celebration
When **the kid's car** topples a stack or takes a star:
- **Confetti:** a burst of 40 small paper pieces in the crayon colours, thrown up from the target, fluttering and
  spinning as they fall, gone in under 2 s. It is a new effect, `fx/confetti`, pooled like the others (120 pieces,
  so three bursts at once), drawn as one batch of two-triangle pieces with a colour each.
- **A silly noise** (stand-ins from shipped files, ADR 0032; each is listed with the other stand-ins):
  - the stack: the toys' **boing** played with its pitch sliding up (a "boi-oing"), and a soft pop;
  - the star: the app's **bell** (`ui/cheer.wav`) high and bright, with two quick pops after it, a twinkle.
- **Nothing else:** no score, no counter, no stars to fill, no "all collected" moment. A target taken is just
  taken, and it comes back (ADR 0012). Targets are never anything a kid has to do.

### Traffic
- **Traffic never takes a star.** Stars are for the kid; traffic drives through them and they stay. A star taken
  by a passing bus just before the kid gets there would be a small loss.
- **Traffic knocks stacks over,** as it knocks every other toy, so a truck never drives through boxes as if they
  weren't there. It gets no confetti and no noise (the celebration is the kid's), and the stack comes back the same
  way. Stacks sit just off the road, outside the traffic lanes, so this happens mostly when traffic moves over for
  the kid.

### How a map places them
- **Fixed spots, written in the map file,** in a new `targets` list: each entry is a target id, a place on a road
  (`OnRoad`: a fraction along it and metres from its centre line) and, for a **row**, a count and a gap. A target
  belongs where the car goes, the same place every time (a kid learns where the stars are), and placing by hand is
  what a map does for its set pieces too. The map editor (to-do list) will place them later.
- **Stars sit on the road in rows** of three to five, 4 m apart, on the centre line or a lane, so "follows the road"
  collects them as well as free driving.
- **Stacks sit just off the road** (about 6 m from the centre line), facing along it, or in open ground a map
  wants a kid to drive to (the building site's yard).
- **Clear of everything else:** off the zones (ramps, car wash, garage) by 3 m, out of the flood and the sea, off
  bridges and out of tunnels; scattered toys keep 2.5 m away from them. `maps.test.ts` checks every map keeps this.
- **A sensible number:** about six stacks and five or six rows of stars on each of today's maps, spread round so
  there is something every 10 to 15 seconds of driving (the maps recipe), together with the ramps, puddles and
  herds already there.

### Budgets
- **Looks:** within the toy budget, ≤ 1.5k triangles for one box and for the star.
- **Simulation:** a map's targets are about 60 props on top of its ~400 toys. Stars are checked only against the
  kid's car, and a stack's upper boxes are not checked while it stands, so the step-time cost (every vehicle checks
  every toy, see the gotchas) grows by about a tenth, not more.
- **Effects:** one pool of 120 confetti pieces, one draw call, 240 triangles.

## Consequences
- Two new knock behaviours, written once in `sim/sim.ts`, make any later stack (tyres, skittles) or collectable
  new numbers and a look, not new rules.
- The silly noises are stand-ins; takes of their own wait for the open question of how new sound files are made.
- Targets are placed by hand in each map; a much bigger map (ADR 0040) will want the map editor to place them.
- The picker's map pictures show the targets, so they were drawn again (`npm run pictures:driving`).
- If a playtest finds kids want more (a sticker, a sound that grows with each star), that is a new ADR: the "no
  score" rule stays.
