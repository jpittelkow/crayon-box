# 0025. Driving game: a polished toy look and an engine sound for every vehicle

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Supersedes: in ADR 0021, "The look" (flat palette colours, ink outlines, blob shadows, no real-time shadows)
  and the short list of sounds (engine, horn, splash).

## Context
After trying the prototype the owner asked for more realism across the board, above all in the vehicles, and for
many more sound effects: engine noise from every car, with each vehicle its own engine sound.

Four looks were rendered from the same island (`spikes/realism/`, with a grading sheet): today's flat look, toy
simple, toy polished, and near-photo. Drawing cost on the dev machine's desktop graphics card was 1.1, 1.8, 4.9
and 29 ms a frame, unbatched. The family laptop has built-in graphics, many times slower. The owner chose
**level 2, toy polished**.

## Decision
### The look: die-cast toys on a sunny island
- **Vehicles** are built in code as toys: rounded bodies, glass with painted pillars, clear-coat paint that
  reflects the sky, wheels with spoked rims and tread, lamps, bumpers and mirrors. A police car's lamps flash red
  and blue and light the car. Vehicles are original designs (ADR 0011).
- **The island:** real shadows from the sun, patchy grass, road edge lines, bushes, a sky that fades to a haze at
  the horizon, shiny puddles. Trees stay low enough never to hide the car (ADR 0021).
- **No ink outlines and no blob shadows** in this game. ADR 0016's Crayon Box still rules the kid buttons on top
  of the picture (back, horn) and every other screen.
- **Drawing:** everything that repeats (props, trees, road marks, splashes) is drawn in batches; vehicles, being
  few, are drawn piece by piece. One sun shadow follows the car. The picture is capped at 1.5 real pixels per CSS
  pixel (ADR 0021). Whether the family laptop keeps 60 frames a second is checked there before more is added.

### Sounds
- **Every vehicle has its own engine**, made by the browser as it plays (no sound files, ADR 0011): a voice of
  its own pitch and tone (a car hums, a police car runs higher, a monster truck rumbles, a school bus chugs like a
  diesel) whose pitch and loudness follow its speed. Traffic is heard only nearby and fades with distance. A new
  vehicle comes with a new engine voice.
- **More effects:** tyres squeal on a hard turn at speed, brakes squeak on a quick stop, each kind of prop has its
  own bump, puddles and the flood splash, and the horn.
- Sounds follow the driving game's own **Sounds** switch in the parent area. Following the app-wide Sounds
  switch (ADR 0016) too needs a small change to the shell's sound contract, left for later.

## Consequences
- The driving game no longer looks like the coloring screens; the shared buttons keep the two in one family.
- Each new vehicle costs a few hours to build in code, plus its engine voice.
- Clear-coat paint, shadows and reflections cost the graphics chip most. If the laptop can't keep up, they are
  the first things to turn down.
- Engines that run all the time can be tiring to hear; their loudness is kept low and checked in a playtest.
