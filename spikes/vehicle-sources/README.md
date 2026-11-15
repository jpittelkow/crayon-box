# Driving game: where vehicle models come from

Throwaway samples for [milestone 3](../../docs/milestone-3.md), phase A1. The owner asked to see all three sources
before choosing (2026-11-15). The same new vehicle, a fire truck, made three ways and shown on the driving game's
own island with its lights, camera and simulation. Not part of the app.

| # | Source | How it was made |
|---|---|---|
| 1 | **Built in code** | `src/firetruck.ts`, with the game's toy kit (`src/games/racing/look/kit.ts`), like every vehicle today |
| 2 | **CC0 kit** | `firetruck.glb` from Kenney's [Car Kit](https://kenney.nl/assets/car-kit) 3.1 (CC0), shown as it comes (`kit`) and with the game's clear-coat paint over its colour map (`kit-toy`) |
| 3 | **AI-made** | The Hugging Face Space `prithivMLmods/TRELLIS.2-Text-to-3D`: prompt → picture (Z-Image-Turbo) → background removed (BRIA RMBG-2.0) → 3D (Microsoft TRELLIS.2-4B). Shown as it comes (`ai`) and cut to 15k triangles in the page (`ai-lite`) |

Prompt for 3: *a chunky toy die-cast fire truck, glossy red paint, white ladder on the roof, silver bumper, black
rubber wheels, rounded friendly shapes, three-quarter front view, isolated on plain white background.*

## Run it
From the repo root, either the `vehicles` entry in `.claude/launch.json` (port 5184), or screenshots:

```bash
node spikes/vehicle-sources/shoot.mjs
```

Views: `?view=lineup&shot=front|side|back|top` (add `&bench=1` to time each), and
`?view=drive&truck=code|kit|kit-toy|ai|ai-lite` to drive one with arrows, WASD or touch.
The AI model is not committed (see Licences); to make it again: `uv run --with gradio_client python -I
spikes/vehicle-sources/make-ai.py spikes/vehicle-sources/models` (needs `models/ai-firetruck-image.png`, which
the Space's `/generate_txt2img` makes from the prompt).

## What came out (2026-11-15)
| | 1. Code | 2. CC0 kit | 3. AI-made |
|---|---|---|---|
| Triangles | 27,508 | 2,767 | 48,644 (14,996 cut down) |
| Download | none (code) | 227 kB + a 512² colour map shared by the kit | 4.9 MB, two 1024² textures |
| Draw calls | one per material, wheels separate | 6 meshes, 1 texture | 1 |
| Wheels turn | yes | yes (named nodes) | no: one solid mesh |
| Lights can flash | yes | no; would need new parts | no; would need new parts |
| Time to make | about an hour, by Claude | minutes (download, scale) | about a minute of generation, plus finding the facing |
| Look next to the game's vehicles | matches: same kit, paint, wheels | flat low-poly blocks; reads as a different game even with the toy paint | the most detailed and closest to a real toy; soft, slightly melted edges, texture smears on the shutters and glass |
| Licence | ours | CC0, no strings | 3D step MIT, picture step Apache 2.0, but the Space's background removal (RMBG-2.0) is non-commercial |

Drawing cost: on the dev machine's RTX 3090 none of the three could be told apart from no truck at all, even with
20 copies each (`bench.json`). The cost that matters is on the family laptop's built-in graphics (phase A2). By
triangle count the kit is cheapest; the AI truck is the heaviest unless cut down, and cutting to 15k kept its
shape at driving distance.

## Notes for choosing
- **Code** fits the look exactly and gives working parts (wheels, lamps, a ladder that could rise) for free, but
  each vehicle is hours of work and stays "toy-like" rather than detailed.
- **Kit** is fastest and lightest, but Kenney's style is blockier than ADR 0025's toy look; mixing it in would
  mean either restyling it a lot or moving the whole game toward the kit's look.
- **AI** gives the most detail for the least effort, but every model needs clean-up before use: facing and scale,
  a triangle cut, separating the wheels (and lamps) so they can move, and a check by eye for smears. Run locally
  on the dev machine (TRELLIS.2 is MIT) with our own background removal, the licence question goes away.
- Mixed is possible: code-built vehicles with AI-made scenery, or AI-made bodies on code-built wheels and lamps.
