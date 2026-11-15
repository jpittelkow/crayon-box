# Recipe: toys, scenery, decor, animals and set pieces

Everything a map places, other than vehicles, roads and ground. The categories and their rules are in
[driving-assets.md](../driving-assets.md); **sort the idea there first** ("Which category?") and add its row.
Every asset has two halves: a **definition** in `sim/` (plain TypeScript, no three.js) and a **look** in `look/`.
Paths below are under `src/games/racing/`.

## Recipe: a toy (knocked about, comes back)
1. Definition in `sim/assets/toys.ts`: `half` (half its height, metres), `behaviour` (`tumble` or `roll`; a new
   behaviour from the catalog's list is its own piece of work in `sim/sim.ts`), `bump` (`ping`, `knock`, `boing`,
   `thump`).
2. Look in `look/toys.ts` (`TOY_LOOKS`): one small group, centred, ≤ 1.5k triangles.
3. **Sound:** pick its `bump`. A new kind of bump is a new row in `BUMP` in `sound.ts` (a pitch and loudness of the
   knock) or a new effect file ([sounds.md](sounds.md)).
4. Place it: add its id to a map's `props.kinds` with a share.

## Recipe: solid scenery (stays put, the car slides along it)
1. Definition in `sim/assets/scenery.ts`: `radius` (kept out of, at scale 1) and `shrinks` (shrinks away between
   the camera and the car).
2. Look in `look/scenery.ts` (`SCENERY_LOOKS`): trees ≤ 1k triangles, buildings ≤ 6k.
3. **Sound:** none, or a soft thud when the car slides along it (a `BUMP` row).
4. Place it: a map's `trees.kinds` (scattered) or, for a few placed by hand, a set piece.

## Recipe: decor (the car drives through it)
1. Its id in `DECOR_IDS` (`sim/assets/scenery.ts`) and a look in `DECOR_LOOKS` (`look/scenery.ts`), ≤ 300 triangles.
2. **Sound:** none.
3. Place it: a map's `decor` clumps.

## Recipe: an animal (steps aside, answers the horn)
1. Definition in `sim/assets/animals.ts`: `shy` (how close the car may come before it steps aside), `pace`,
   `hop` (its answer to the horn) and `call` (a new call is added to `AnimalCall`).
2. Look in `look/animals.ts` (`ANIMAL_LOOKS`), ≤ 3k triangles, with a simple walk or hop.
3. **Sound:** its call. Today's moo, baa and quack are stand-ins pitched from one file (the calls table in
   `sound.ts`); a call of its own is a new effect file ([sounds.md](sounds.md)).
4. Place it: a herd in a map's `animals` (kind, middle, count, `roam`).
5. Test in `sim/animals.test.ts`: never hit by the car, at any speed.

## Recipe: a set piece (a place where something happens)
1. **Zone kind:** add it to `ZoneKind` in `sim/map.ts`. The simulation reports entering and leaving zones.
2. **What happens** in the simulation, in its own file like `sim/ramps.ts`: plain numbers, with a test file like
   `sim/ramps.test.ts` and `sim/carwash.test.ts`. If it changes the car (muddy, bubbly, wet) it switches a
   **vehicle state**, not a new asset.
3. **Look** in `look/setpieces.ts`: the model, its animation, and any walls (they follow the solid scenery rules)
   or moving parts it owns (a boat, doors). ≤ 15k triangles.
4. **Sound:** what you hear going in and while inside (the car wash's whoosh and bubbles, the ramp's landing thump,
   the tunnel's echo, made in code). Hook it in `DrivingSound` where `world.zone` changes (see the car wash in
   `sound.ts`), stand-in first ([sounds.md](sounds.md)).
5. **Place it** on a map's `zones`; traffic should use it too.
6. Check in the gallery and on a map: drive in from both ways, at full speed and slowly, in every vehicle.

## Patterns
- **Pick a behaviour, not new rules:** a new toy is new numbers and a look with an existing behaviour.
- **Set pieces own their walls and moving parts,** so a car wash or bridge is built in one place.
- **Poles, signs and fences are toys** (they wobble or tumble), so less in the world can stop the car.
- **Things taller than the car fade or shrink** when they come between the camera and the car.
- **Animals move first,** always: they start stepping aside before the car could reach them.
- **Everything repeats in batches** (one batch per kind), so a map can have a hundred toys.

## Anti-recipes
- **Something that stops the car dead or traps it** (a box corner, a gap between two rocks, a fence pen).
- **Something that hides the car** (a tall building by the road that doesn't fade).
- **A toy that doesn't come back,** a score, a counter, anything to lose or win (ADR 0012).
- **Hurt or scared animals,** an animal the car can hit, roadkill, an animal that runs into the road.
- **Scary things:** fire, a crash with debris, a storm, a dark place without light. Targets "explode" in confetti
  and puffs only.
- **Text on signs or shops:** pictures only (ADR 0003).
- **A new category invented in code** because the idea fit none: change the catalog first.
- **three.js in `sim/`:** the simulation stays plain TypeScript so it can be tested and run anywhere.
- **Placing by index number** instead of by id (`toy/cone`): maps refer to assets by id.
- **A silent set piece.** Every set piece makes a sound when the car arrives.
