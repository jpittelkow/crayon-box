# three.js or Babylon.js: the same drive, drawn twice

A throwaway test for [ADR 0021](../../docs/adr/0021-racing-game.md). It is not part of the app and has its own
`package.json`, so neither library is a dependency of the app yet.

One small island with a ring road, trees, traffic, things to knock around, puddles and a flooded stretch of
road, drawn by three.js, by Babylon.js, or by both side by side from the same simulation.

## Run it
From the repo root:

```bash
npm --prefix spikes/engine-bakeoff install
```

```bash
npm --prefix spikes/engine-bakeoff run dev
```

Then open http://localhost:5180 in Edge. Touch the picture to drive (the car heads toward the finger), or use the
arrow keys or W, A, S, D. Space or the yellow button is the horn. H hides the panel.

## What is the same in both
Everything except the drawing:
- **The simulation** (`src/sim.ts`): the car, traffic, knocked props, and the water: splashes, wheel spray, a
  wake, and a car that slows, sinks a little and bobs in the flood. No 3D library is imported.
- **The shapes** (`src/shapes.ts`): built as raw triangles and handed to both libraries, so both draw the very
  same vertices. The ink outline is our own "inverted hull" shape, not either library's outline feature.
- **Colors, lights and camera** (`src/scene.ts`): one set of numbers. With both libraries set to use colors as
  written, a frame from each differed in 0.013% of pixels (edge smoothing) when compared on 2026-11-14.
- **Sounds** (`src/sound.ts`): browser oscillators, neither library's audio.

Each library's own code is one file: `src/three-renderer.ts` (120 lines) and `src/babylon-renderer.ts`
(145 lines). About 30 lines of each are the optional "own water" below.

## The panel
- **Draw with:** one library alone (use this to measure), or both side by side (use this to compare the look).
- **Things to knock:** 150 is roughly what the game would have; 600 and 2400 are there to find the limit.
- **Props drawn as:** *batches* draws every prop of a kind in one go, which is how the game would be built.
  *Separate objects* gives each prop its own object, which shows how much work a library adds per object.
- **Picture size:** fewer pixels, for a slow graphics chip.
- **Water:** *cartoon* is flat blue with a pale rim, drawn the same by both. *Each library's own* swaps the
  puddles and the flood for the ready-made water each library ships: three.js's `Water` add-on (a mirror) and
  Babylon's `WaterMaterial` (a mirror you can also see through). This is the one option where the two pictures
  are meant to differ. Splashes, spray and wake rings stay shared in both.
- **Measure 15 s:** restarts the world, drives it by itself along the same route, and adds a row to the table.
  Results are kept in the browser until *Clear results*.

Reading the table: *Avg fps* can't go above the screen's refresh rate, so on a fast machine both show 60 (or
120, 144). *Worst 1% fps* shows stutter. *Draw work, ms* is the time the page's own code spends asking for a
frame; it does not include the graphics chip's time, and it is the number that separates the two libraries.

## Measured so far (dev machine, 2026-11-14)
Download, for this scene, built for release and compressed:

| | three.js r187 | Babylon.js 9.36 |
|---|---|---|
| Library code loaded | 131 kB (536 kB unpacked) | 288 kB (1,209 kB unpacked) |
| The same, with its own water | 134 kB | 323 kB |

Draw work per frame, in milliseconds (a 60 fps frame has 16.7 ms in all):

| Things to knock, drawn as | three.js | Babylon.js |
|---|---|---|
| 150, batches, cartoon water | 0.09 | 0.15 |
| 150, batches, the library's own water | 0.45 | 0.45 |
| 150, batches, before water was added | 0.06 | 0.11 |
| 2400, batches | 0.11 | 0.17 |
| 600, separate objects (1,200 objects) | 0.49 | 4.27 |
| 2400, separate objects (4,800 objects) | 1.93 | 17.84 |

These were taken with the page hidden and its frames run by hand, so they are draw work only, not frame rate.
The frame rate, and anything on a laptop's built-in graphics, is not measured yet. The other rows were measured
before water was added.

Ready-made water costs more than the table shows. To get its reflection, three.js draws the whole scene a second
time and Babylon draws it two more times (88 draw calls against 30). That extra work lands on the graphics chip,
which this table does not measure and which is the weak part of a laptop.

## Things learned while matching the two
- Babylon is left-handed unless `scene.useRightHandedSystem = true`, and even then each mesh needed
  `sideOrientation = Material.CounterClockWiseSideOrientation` or it showed its inside.
- Babylon compiles its shaders in the background and draws nothing for the first frames. A timing taken straight
  after loading measures an empty picture.
- Babylon's `WaterMaterial` must not have its own sheet in its reflection list. If it does, the material ends
  up setting the sheet's `isVisible` to `undefined` and the water silently never draws.
- three.js's `Water` expects a sheet standing in the x-y plane and turned flat, not one built lying down.
- three.js needs `ColorManagement.enabled = false`, a linear output color space and light strengths multiplied
  by pi to give the plain "color times light" that Babylon's standard material gives.
