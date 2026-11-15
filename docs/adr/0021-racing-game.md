# 0021. Driving game: a small 3D island to roam

- Status: Accepted (by the owner, 2026-11-14); the look and sounds superseded by [0025](0025-driving-game-toy-look-and-engine-sounds.md)
- Date: 2026-11-14
- Supersedes:
  - in ADR 0012, the racing sketch: "touch left/right half to steer, car drives itself" and "stickers or
    confetti for finishing a lap". There are no laps.
  - in ADR 0003 rule 4 and ADR 0014's keyboard lock, "every key is blocked": the driving keys work in this game.
  - in ADR 0002, HTML canvas as the only way the app draws: this game draws with WebGL through a 3D library.

## Context
Milestone 3 (ADR 0014) is a racing game, the second game in the shell (ADR 0012). ADR 0012 left its design to
this ADR. On 2026-11-14 the owner asked for a 3D game seen from behind the car, simple, all touch, and "maybe a
little open world".

The players are 4 and under (ADR 0003). They can't read, the youngest can't steer on purpose, and none of them
should be able to lose. Two things usually go wrong when a game like this meets a toddler:
- **Open worlds strand them.** A car nosed into a wall or lost in a corner ends the fun, and a kid can't fix it.
- **Races have losers.** Places, timers and "try again" all break "no way to lose" (ADR 0012).

Options considered, and what the owner chose (2026-11-14):

| Question | Options | Chosen |
|---|---|---|
| World | A track only; a large open world; a small island to roam | Small island |
| Races | Laps with a finish; optional laps inside the island; none, with traffic that drives along with you | None, with traffic |
| Controls | Car always drives, tap a side to steer; touch to go and the car heads to the finger; on-screen wheel and pedals | Touch to go, plus driving keys |
| Drawing | three.js; Babylon.js; hand-written WebGL; flat canvas with a faked 3D road | three.js, after testing both |
| Movement | A physics engine; a simple car model of our own | Our own |

A wheel and pedals need two hands and small precise targets. A large world is easy to get lost in. A physics
engine lets cars flip, wedge and spin, which is exactly what must not happen.

**three.js or Babylon.js** (compared for the owner, 2026-11-14). Both are free, open source, draw with the same
browser graphics and are fast enough for this game on built-in graphics. three.js (MIT) is a drawing library,
with everything beyond drawing left to us. Babylon.js (Apache 2.0) is a full game engine: physics, collisions,
sound, particles, on-screen controls and a debugging inspector are built in. This game uses its own car model,
the shell's sounds and Crayon Box buttons, so most of what Babylon.js adds would go unused. What it would save
us is the small effects (splashes, bubbles) and a ready-made inspector.

The owner called this an important fork and asked for a test, so `spikes/engine-bakeoff/` draws the same small
island with each library from one simulation and one set of shapes, colors and lights (its README has the
details). Measured there on the dev machine on 2026-11-14:
- **The picture is the same:** a frame from each differed in 0.013% of pixels.
- **Download for this scene, compressed:** three.js 131 kB, Babylon.js 278 kB. About double, not the eight times
  that published whole-library sizes suggest.
- **Work to draw a frame, built the way the game would be** (every prop of a kind drawn in one batch): the same,
  0.1 to 0.2 ms with 2,400 props.
- **Work to draw a frame with one object per prop:** Babylon.js took about nine times longer (4.3 ms against
  0.5 ms for 1,200 objects). It adds more work per object, so it punishes a scene that is not batched.
- **Each library's own code** for the scene is about 100 lines; Babylon.js needed three settings found by trial
  to match three.js's handedness and colors.
- **Water** (the owner asked which does it better): the cartoon water this game wants is shared code and came
  out the same in both, 0.009% of pixels apart. Each library also ships ready-made reflecting water, and the
  test can switch to it. It looks realistic, not like Crayon Box, and it is costly: three.js draws the scene a
  second time for the reflection and Babylon.js two more times. Splashes, spray and the wake are our own code in
  either library; Babylon.js has a built-in particle system that would shorten that work, which the test did
  not use.
- Not measured: frame rate, and anything on built-in graphics.

With the test in front of them, the owner chose three.js on 2026-11-14.

## Decision

### The game
- **One small island**, about 30 seconds of driving from end to end: a road loop, a bridge, a tunnel, a beach, a
  ramp and a car wash. Driving around it is the whole game. There are no races, goals, scores, timers, counts or
  text.
- **Things to knock around** (the owner liked these and the sound effects, 2026-11-14). Cones, boxes, beach
  balls and hay bales sit in the car's way on purpose. A bump sends them flying and tumbling with a sound each,
  and they come back to their places a little later, so the island never runs out.
- **Water to drive through** (the owner expects the kids to want puddles and flood water, 2026-11-14).
  Puddles throw up a splash and wheel spray. A flooded stretch of road is deeper: a big splash going in, then
  the car slows to a wade, sinks a little, bobs, and leaves a wake. Water never stops the car. It is drawn as
  cartoon water, flat blue with a pale rim, not as either library's ready-made reflecting water (see Context).
- **Other things react.** The ramp gives a small jump, the car wash covers the car in bubbles, animals answer
  the horn. Each reaction is a sound plus a short animation.
- **Traffic that races along with you.** A few friendly cars drive the roads by themselves. When the kid's car
  comes near one, it matches the kid's speed and drives alongside for a while, then drifts back to its own
  route. There is no start, no finish and no winner. Traffic never blocks the road: it moves aside for the kid's
  car, and a bump only nudges both cars.
- **A kid can't get stuck or lost.** Nothing stops the car dead: solid things slide it along them. At the water's
  edge the car turns itself back toward land. If a car that is being driven makes no progress for a few seconds,
  it is turned toward the nearest road. The car can't flip.

### Controls
- **Touch to go; the car heads toward the finger.** The further the finger is to one side, the sharper the turn.
  Lifting the finger lets the car roll to a stop. There is no reverse; the car turns tightly enough not to need
  one.
- **Any finger works, anywhere on the picture.** The car follows the newest touch and falls back to an older one
  that is still down. Palm-sized touches are ignored where the screen reports contact size (ADR 0003 rule 3).
- **Driving keys work too** (asked by the owner): the arrow keys and W, A, S, D. Up or W goes, left and right or
  A and D steer, down or S slows to a stop, and the space bar is the horn. Touch and keys can be mixed. Every
  other key stays blocked, and these keys do nothing outside this game.
- **An assist level for each kid**, set in the parent area: *steers freely* (the default), or *follows the road*,
  where the car steers itself along the road and a touch or the go key only makes it move. The second is for the
  youngest. The owner confirmed touch driving and both levels on 2026-11-14.
- **Two buttons, both Crayon Box kid buttons** (ADR 0016): back, top-left, and a horn in a bottom corner. Touches
  on a button don't steer.
- **The camera is fixed** behind and above the car and follows smoothly. A kid can't move it. Nothing in the
  world is tall enough to hide the car. With "reduce motion" on, the camera has no shake, bounce or speed zoom.

### Cars
- The game opens on a **car picker**: a few cars as tiles, three across (ADR 0016 rule 6). A tap drives off.
- Cars are original designs with no franchise look-alikes (ADR 0011). In particular, no eyes in the windshield.
- **The kid's color** (ADR 0016 rule 7) tints the picker's ground and, on the island, flies as a flag on the car.

### How it is built
- **three.js** (MIT), drawing with WebGL in a canvas. It lives in `src/games/racing/` and is loaded with the game
  (ADR 0012), so the coloring game's start-up does not pay for it. The same code runs in Edge and in WebView2.
  The owner chose it over Babylon.js on 2026-11-14, after the test described in Context.
- **No physics engine.** The car is a position, a heading and a speed. The ground height comes from the world
  data; collisions are circles against circles and line segments. This simulation is plain TypeScript with no
  three.js import and runs at a fixed step, so it can be unit-tested.
- **Knocked props use the same kind of simple model:** a bump gives a prop a push and a spin, it bounces on the
  ground and settles, and after a pause it returns to its place. A prop never blocks or slows the car.
- **The world is data**: the roads as curves, a list of props, and zones (water, the car wash). The scene is
  built from it, and traffic follows the road curves. Another island later is another data file.
- **The look** ties to Crayon Box (ADR 0016): low-poly shapes, flat colors from the palette, a dark ink outline
  on cars and props, a round blob for each shadow. No textures and no real-time shadows to begin with.
- **Models** are glTF files in the repo, made for the project or taken from CC0 kits. Each third-party kit is
  checked to be CC0 and listed in `CREDITS.md` (ADR 0011).
- **Keys:** the shell's guard (ADR 0003 rule 4) keeps blocking what keys normally do in a browser; the game only
  listens for the driving keys. In the installer, the keyboard lock (ADR 0014) lets the driving keys through
  while this game is open and swallows them everywhere else.
- **Speed target:** 60 frames a second on the family laptop, which has built-in (integrated) graphics and no
  separate graphics card (owner, 2026-11-14). The look above is chosen for that. The render resolution is capped
  and can drop further on a slow machine. If the browser drops the WebGL context, the scene is rebuilt.
- **Saved per kid:** the last car and the assist level, in the game's own storage (ADR 0012). Nothing else.
- **Sounds** (engine, horn, splash, a bump for each kind of prop) are original or CC0 and obey the parent's
  sound setting. The shell's `Sound` interface grows to carry them.

### Testing (ADR 0015)
- **Unit tests** on the simulation: steering toward a touch; keys and touch give the same driving; the car never
  leaves the island; after random input for a minute the car is on land and has moved (never stuck); a knocked
  prop settles and returns to its place; traffic
  joins a nearby car, leaves again, and never boxes it in.
- **One browser test:** the game mounts, a touch moves the car, a key moves the car, back returns to the shell.
  It reads the simulation's state, not pixels.
- **Playtests** decide the feel of the controls and the assist default.

### Build order
1. **Prototype, during milestone 1** (agreed by the owner, 2026-11-14): one car on a flat island with touch and
   keys, hidden unless a parent turns it on, so it can join a playtest. It answers the two big unknowns: whether
   the laptop draws it smoothly, and whether the kids can drive it. Only this step moves early; the rest stays
   after the installer.
2. The island: roads, props and reactions.
3. Traffic.
4. The car picker, sounds and the parent settings.

## Still open
- **How smoothly the family laptop draws it.** Built-in graphics vary a lot by model and year; the prototype
  measures it.
- **Which assist level new kids start on, and how the steering feels,** are guesses until a playtest.
- **A resting hand makes the car go**, because any touch drives. To watch in the playtest.
- **The game's name in the docs:** it is a driving game now, not a race. The folder and registry id stay
  `racing` unless the owner wants them renamed.

## Consequences
- The first 3D code and the first third-party art in the app. This game's download is much bigger than the
  coloring game's, but only a kid who opens it loads it.
- 3D models are a new kind of art to make, check and credit. The design system will need a section for them.
- With two games enabled, the home screen stops being skipped (ADR 0012).
- A kid at a keyboard can now do something with it. The keys are few and only drive, but the keyboard lock gets
  an exception that depends on which game is open, which is more to build and test in milestone 2.
- A simple car model means jumps and bumps are faked. That is a fair price for a car that can't flip or wedge.
- Free driving can't be checked by comparing pictures; the tests cover the rules, and playtests cover the feel.
- Not in this ADR: more islands, two kids driving at once, and painting the car in the coloring game.
