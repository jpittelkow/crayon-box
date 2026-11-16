# 0042. Driving game: more set pieces, mud, a ford, traffic lights, a roundabout and a harbour

- Status: Accepted (2026-11-15, on the owner's defaults: all five pieces, each a zone with an animation and a
  sound, stand-in sounds from shipped files; built in two parts, mud, the ford and the lights first)
- Date: 2026-11-15
- Builds on [ADR 0012](0012-multi-game-shell.md) (no way to lose), [0021](0021-racing-game.md) (nothing stops or
  traps the car), [0025](0025-driving-game-toy-look-and-engine-sounds.md), [0032](0032-sounds-as-files.md),
  [0035](0035-driving-vehicles-maps-picker-garage.md) (how each vehicle feels) and
  [0041](0041-driving-targets-to-collect-and-hit.md); sorted with the [asset catalog](../driving-assets.md); kept
  compatible with the very large map's plan ([ADR 0040](0040-driving-very-large-map-highway-and-building-site.md),
  [highway-map-plan.md](../highway-map-plan.md)).

## Context
The to-do list's map pieces, second item: more set pieces and zone kinds, "each a zone plus an animation and a
sound, like the ramp and car wash": a mud zone (mud puddles exist; a zone kind doesn't), a ford through a river, a
roundabout, traffic lights for show only (they never stop the kid), and a harbour. The owner accepted all five on
2026-11-15, with stand-in sounds. They are built in two parts: **mud, the ford and the lights now**; the roundabout
and the harbour next, to the design below.

Sorted with the catalog's rule, each is a **set piece** (category 7): something happens when the car arrives. What
a set piece does to the car's look is a **vehicle state** (muddy, wet), not an asset. The ford also needs a **road
piece** (`road/ford`, the road through the water) and **water** to cross (`water/stream`, category 6).

## Decision

### Every new set piece
- **A zone kind** in `sim/map.ts` (`mud`, `ford`, `lights`; later `roundabout`, `harbour`), placed in a map's
  `zones` like the ramp and the car wash: on a road (`OnRoad`) or by its middle. A zone on a road now also knows its
  road and how far along it (`Zone.road`, `Zone.s`).
- **What it does** in its own file under `sim/` (`mud.ts`, `ford.ts`, `lights.ts`), plain numbers, tested in its
  own test file. **The look** in `look/setpieces.ts`, at most 15,000 triangles each. **The sound** in
  `DrivingSound` (`sound.ts`), stand-ins from files the app ships (ADR 0032) until takes of their own.
- **Traffic uses it too**, as it uses the car wash, and every vehicle gets the fun.
- **Nothing stops or traps the car** (ADR 0021): a set piece slows a car at most, and its solid parts are circles
  the car slides past.

### Mud (`setpiece/mud`, built)
- **The zone:** a round patch of mud, 6 to 7 m across its middle, over a track (or anywhere).
- **What happens:** every vehicle in it is held to a squelchy crawl, **7 m/s** (sand is 11, a car wash 5); a vehicle
  that wades well (ADR 0035: the monster truck, the tractor, the digger) goes that much faster. It never stops.
  Bits of mud flick up off the back wheels (`fx/mud`, a pool of 60, from the looks-only random stream).
- **Muddy, a vehicle state** (`Car.mud`, 0 clean to 1 covered): covered in about half a second in the patch.
  Muddy water (the building site's mud puddles and pond) makes a car half muddy at most. **Mud comes off** in the
  car wash (in under a second) or in clean water: a ford as fast as a car wash, a puddle or the flood over 1.5 s.
  **Time alone never washes it off**, so being muddy gives the car wash and the ford a job.
- **The look:** a glossy brown patch in a darker wobbly rim, ruts where wheels go, lumps round its edge, and mud
  bubbles that swell and pop. A muddy vehicle wears brown splats on its sides, wheels and back, more the muddier it
  is (one mesh per vehicle, built by casting rays at its model; `look/states.ts`).
- **The sound:** a squelch going in, and more while driving through, faster the faster it goes (stand-in: the
  puddle splash slowed to half speed, with a low pop).
- **On the maps:** two patches on the building site: across the loop's south side, and on the middle track's north
  end; its car wash washes the mud off.

### A ford (`setpiece/ford` on `road/ford`, through a `water/stream`; built)
- **The stream:** a map's `water.streams`, a path and a width: shallow water all along, **never deep**, on the land
  only (as a chain of puddle-like circles to the simulation, so trees, toys and bushes keep out of it and a car in it
  splashes and gets wet anywhere, as in a puddle; drawn as one strip with banks, a spring at its head, reeds and
  pebbles). A car anywhere in it drives out.
- **The zone:** where a road crosses a stream, about 12 m across. Every vehicle in it is held to a splashy wade,
  **9 m/s** (good waders faster); going in throws a bow wave (a big splash), and spray flies off both sides while it
  crosses. It gets wet, and it comes out clean of mud.
- **The look:** the stream runs over the road; foam shimmers along the road's edges where the water crosses them,
  and ripples drift downstream.
- **The sound:** a big splash going in (stand-in: the splash file, a little high), on top of the puddle splash.
- **On the maps:** the island gets a stream from a spring inside the loop, south-west of the hill, down across the
  loop road and the beach to the sea; the loop crosses it at a ford (one puddle that sat there went).

### Traffic lights (`setpiece/traffic-lights`, built)
- **The zone:** a junction, on the road the other one joins. Three poles stand beside the roads, well clear of
  their edges: one on the right of each way's traffic coming in. The kid's car slides past a pole it drives at.
- **For show:** they cycle green, amber and red for each way in turn, 20 s round (7 s green, 2 s amber, 1 s all red,
  each way). **The kid never waits:** nothing about the lights touches the kid's car (a test drives the same lap
  with and without them and gets the same drive to the step), and as the kid's car comes within 50 m heading for
  them, its own way turns green (the other way's amber and the all-red are hurried to 0.8 s and 0.4 s) and stays
  green while it is near. So a kid never drives through a red light, and never has to stop at one.
- **Traffic** on its own waits at amber and red, its front short of the junction, and queues behind a car already
  waiting there; it goes on green. Traffic keeping the kid company (ADR 0031) doesn't wait.
- **The look:** a grey pole with a lamp head, red, amber and green under visors, lit by the lights' state; stop
  lines across each lane coming in (pictures only, ADR 0003).
- **The sound:** a soft click when they change, heard within 35 m, and a little ding when the kid's way has just
  turned green (stand-ins: the wooden knock, high; the bell).
- **On the maps:** the island, where the shortcut meets the loop in the south.
- The catalog's `toy/traffic-light` idea (a wobbling pole) stays an idea for lights along a street that do nothing;
  the junction's lights are this set piece. When the wobble behaviour is built, the poles can wobble instead of
  being solid.

### A roundabout (`setpiece/roundabout` on `road/roundabout`; next)
- **The road:** a closed ring about 14 m across its centre line, as wide as the roads, with up to four roads joining
  it at its edge (each a three-way junction on the ring, which the road network already has). Traffic goes round one
  way only, anticlockwise seen from above (it keeps right, as on every map); a road can be marked one-way for this.
  The kid's car may go either way; nothing stops it.
- **The zone:** the whole roundabout. **The middle** is a low round bed of grass and flowers inside a kerb the car
  drives over (cutting across is fine), with a fountain in the centre whose basin is a circle the car slides round.
- **What happens:** "follows the road" goes round and takes the exits in turn (the junction rule); traffic gives way
  to the kid's car coming onto the ring (as at every junction).
- **The look and animation:** the fountain's jets rise and fall; painted arrows round the ring (no words). **The
  sound:** the fountain's splashing, louder near it (stand-in: the puddle file, looped softly).
- **On a map:** a town-like junction; on today's maps, where the spur meets the shortcut on the island, if it fits.

### A harbour (`setpiece/harbour`; next)
- **The zone:** a stretch of road along the shore as a stone quay. Its sea side is a low edge with bollards that
  keep the car on the quay, as a bridge's rails do (a guard on one side): the car slides along it and never drives
  into the sea.
- **What happens:** boats moored along it bob (moving parts the set piece owns; the island's moored boats move
  into it), and one boat now and then sails out and comes back. **The kid's horn** in the harbour is answered by a
  ship's horn (stand-in: the horn file, low and long); waves lap louder there.
- **Traffic** drives the quay as any road.
- **On a map:** the island's bay, by the bridge, where its boats already are.

### How a map places them
- In `zones`, like the ramp and car wash; `maps.test.ts` keeps every map's zones apart (more than both radii and
  4 m) and its targets clear of them (ADR 0041). Streams in `water.streams`; a ford goes where a road crosses one.
- About one set piece every 10 to 15 seconds of driving, with the ramps, puddles, herds and targets (the maps
  recipe). The very large map (ADR 0040) places them the same way: its mud flats are several mud zones by the car
  wash, and a ford on a site track needs only a stream; neither needs a new rule.

### Budgets
- **Looks:** each piece within 15,000 triangles (a patch of mud about 3,600; a ford with 60 m of stream about
  3,500; a junction's lights about 4,200), checked in `assets.test.ts`.
- **Effects:** one pool of 60 bits of mud; spray at a ford comes from the drops' pool.
- **Simulation:** a few zone checks per vehicle a step; a stream adds about 40 shallow circles to the map's water
  (the island's water checks grow from about 20 circles to about 60); the lights check the kid's car against two
  roads once a step.

## Consequences
- Muddy is the first vehicle state that lasts until something takes it off; later states (a sandy car, a bubbly
  one that lasts) can follow the same pattern.
- The ford's stream is a new kind of water a map can draw anywhere; ducks paddling on it, and a bridge over it, are
  later work.
- The sounds are stand-ins; takes of their own wait for the open question of how new sound files are made.
- The building site and island pictures in the picker were drawn again (`npm run pictures:driving`).
- If a playtest shows a kid wants the lights to stop them (some kids like to play "red light, green light"), that is
  a new ADR: today the kid never waits.
