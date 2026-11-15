# Driving game: realism samples

Throwaway pictures for choosing how real the driving game should look (the owner asked on 2026-11-14 for more
realism, above all in the vehicles). Not part of the app. The same island from the game's own world data,
drawn at four levels:

| Level | Name | What it adds |
|---|---|---|
| 0 | Today | The prototype's own renderer: boxes, flat colours, ink outlines, blob shadows |
| 1 | Toy, simple | Rounded bodies, real wheels, glass, lamps, real sun shadows, plain paint |
| 2 | Toy, polished | Clear-coat paint with reflections, spoked rims, tread, mirrors, road lines, patchy grass, bushes, sky and haze |
| 3 | Near-photo | Level 2 plus textured ground, kerbs, grass tufts, a reflecting sea, contact shadows and lamp glow |

Vehicles (car, police car with lit lamps, monster truck, school bus) are built in code in `src/vehicles.ts`;
none come from a model kit.

## Make the pictures
From the repo root (uses the app's three.js and Playwright):

```bash
node spikes/realism/shoot.mjs
```

It writes `shots/<level>-<shot>.png` and `shots/sheet.png`, the grading sheet. `shots/` is not committed. One
picture can be redone with e.g. `node spikes/realism/shoot.mjs 2-car`. To look at one live, run the `realism`
entry in `.claude/launch.json` and open `?level=2&shot=car` (shots: `play`, `car`, `lineup`; add `&bench=1` to
time 60 frames into `window.bench`).

## Drawing cost (2026-11-14)
Measured on the dev machine's desktop graphics card (an RTX 3090), driving camera, 1280 × 800:

| Level | ms a frame | Draw calls |
|---|---|---|
| 0 | 1.1 | 30 |
| 1 | 1.8 | 313 |
| 2 | 4.9 | 1,202 |
| 3 | 29.0 | 4,452 |

A laptop's built-in graphics are many times slower than this card, so level 3 is out of reach there and level 2
needs the game's usual batching (the samples draw each piece separately) and a test on the family laptop.
