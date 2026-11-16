# Recipe: sounds

Every sound is a file in `assets/sounds/` (ADR 0032), loaded through `src/shell/soundFiles.ts`. The driving game's
tables are in `src/games/racing/sound.ts`: `ENGINES` (one idle loop per vehicle kind), `EFFECTS` (one-shot files),
`HORNS` (each vehicle's horn as notes or a siren), the toys' bumps (`BUMP`) and the animals' calls.
`assets/sounds/sounds.json` records every file's source and license; it is written by a tool, never by hand.

## Two ways to give a thing its sound
**A. Stand-in from a file that exists (no new file).** Point the new entry at a shipped file and change its
pitch (`rate`, `idleRate`), tone (`toneHz`) and loudness. This is how the ten new vehicles of 2026-11-15 got
engines and horns, and the car wash its bubbles (`ui/fill.wav`). Say "stand-in" in a comment next to it, and add
it to the stand-ins listed in [milestone-3.md](../milestone-3.md) B6, so it can be replaced later.

**B. A new file.**
1. **Find or make the take.** CC0 from OpenGameArt (or another CC0 source), or AI-made: add the request to
   `tools/sounds/generate.mjs`, which runs inside the family sync server's container so the OpenRouter key never
   leaves it. Make three takes and pick by ear. Paid AI takes and downloads need the owner's OK first.
2. **Describe it in `tools/sounds/picks.json`:** its source (title, url, license), the original file name, where it
   ships (`drive/…`, `ui/…`, `voice/…`) and its kind (`ui` one-shot, `loop`, `voice`).
3. **Prepare:** `node tools/sounds/prepare.mjs <sources folder>` (needs ffmpeg and ffprobe on PATH or `FFMPEG_DIR`).
   For a later narrator batch without the first batch's downloads: `NARRATOR_ONLY=1` prepares only the clips in
   `<sources folder>/narrator/` and keeps every other entry in `sounds.json`.
   It trims silence, levels every file to its kind's loudness, writes WAV for short one-shots and MP3 for voice,
   cuts loops, and rewrites `sounds.json`.
4. **Use it:** add the path to `ENGINES`, `EFFECTS` or the shell's sound list, and play it where the thing happens.
5. **Listen in the game,** next to the sounds around it, with the app-wide sound switch on and off.
6. **Tests:** `src/games/racing/sound.test.ts` checks every vehicle has an engine and every effect a file;
   `src/shell/sound.test.ts` checks every shipped file is listed with a source and license. Run `npx vitest run`.
   Update the engine test's list of vehicles with loops of their own when a stand-in gets a real take.

## Patterns
- **The sound belongs to the thing that makes it:** an engine to its vehicle, a bump to its toy, a call to its
  animal, waves and birds to the map's sky (driving-assets.md). Never a free-floating "sounds" list per map.
- **One file, many voices.** Pitch and tone one good take for several things before making new files.
- **Sounds the app can make itself** (the tunnel echo, the sand hiss) are made in code; no file needed (owner,
  2026-11-15).
- **Engines are loops cut from a take's idle,** raised in pitch with speed; a new vehicle needs only a new
  `EngineVoice` row.
- **Every file starts loading when the game starts** (`DrivingSound`); an effect not loaded yet is skipped, so keep
  one-shots short and small.

## Anti-recipes
- **Editing `sounds.json` or `assets/sounds/` by hand.** The next `prepare.mjs` run throws it away. Change
  `picks.json` and rerun.
- **A sound with no license recorded,** or "found on the internet". CC0 or our own AI takes only (ADR 0011, 0032).
- **A recognisable tune or jingle** (an ice-cream van's real song, a show's theme): original notes only.
- **Scary sounds:** a harsh real siren at full volume, crashes, screams, explosions with a bang. Cheerful and soft
  (the siren is a toy siren; a target's "explosion" is a pop and confetti).
- **Loud spikes.** Everything is levelled by `prepare.mjs`; don't set an entry's volume above the others to make
  it stand out.
- **The OpenRouter key on the dev machine or in the repo** (ADR 0006, 0029). AI takes are made in the container.
- **Silence as "done".** A new asset ships with a stand-in at least.
- **Browser speech** for anything a kid hears (it sounded poor, 2026-11-14): narrator clips are files.
