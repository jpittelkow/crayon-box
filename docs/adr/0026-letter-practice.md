# 0026. Letter practice: trace big letters with a finger or a stylus

- Status: Accepted (by the owner, 2026-11-14); finishing and checking partly superseded by [0028](0028-letter-tracing-whole-letter-and-confirm.md); letter names by Windows speech superseded by [0032](0032-sounds-as-files.md); starting hidden superseded by [0045](0045-every-game-shows-by-default.md)
- Date: 2026-11-14
- Mockups: boards 19–24 on the mockup canvas (linked from the [ADR index](README.md))

## Context
The owner asked (2026-11-14) for a part of the app where the kids practise writing letters with a finger or a
stylus. It is a third game module under the shell (ADR 0012), milestone 6 in the project state. The kids are 4
and under: most can't write yet and some can't hold a pen well, so this is tracing, not writing, and it must be
fun before it is correct. The toddler rules (ADR 0003) apply: no text in the controls, big targets, no way to
lose, nothing lost.

The laptop may or may not have a pen (open question). Fingers come first; a pen must work well when there is one.

## Decision
### What the kid does
- **Two ways in.** The game's start screen has two big tiles, like the coloring start screen (ADR 0017):
  - **Practice:** every turned-on letter is open. A row of set buttons (A B C, a b c, 1 2 3; only the sets a
    parent turned on) sits above a grid of big letter tiles (at least 80 px, ADR 0003). A finished letter's tile
    gets a star. The letters are the content, not instructions, so they don't break the no-text rule.
  - **Game:** the letters sit on a winding path, in order. Finished ones have a star, the next one pulses, the
    rest are greyed out with a lock. Finishing a letter opens the next one and the done screen's arrow goes
    straight to it. The path runs through the turned-on sets in order (capitals, then small letters, then
    numbers) and scrolls as the kid moves along. A finished letter can be traced again; a locked one does
    nothing when tapped.
- **Trace it.** One huge letter fills about 70 % of the screen's height, drawn as a soft, wide guide (a pale
  "road" in the letter's shape). Where to put the finger is shown before anything is touched: a pulsing green
  start dot on each stroke, a pressing finger on the first one, and a green arrow beside every stroke pointing the
  way it goes, gently moving. Once tracing starts the finger goes and the arrows fade a little. With stroke order
  on, only the current stroke's dot and arrow show. Start dots and arrows come from the stroke data.
  Wherever the kid draws, a crayon line in the kid's color follows the finger or pen.
- **Finish.** When the trace covers enough of the letter, the guide fills in, the letter is said aloud, a cheer
  and a little confetti play, and the tile gets its star. A big arrow button goes to the next letter; the back
  button goes to the letter grid. The trace is not saved.
- **No failure.** Crayon outside the letter just stays as marks; there is no buzzer, no red, no score. If nothing
  happens for about 8 seconds, a small hand shows the first stroke once. A wipe button (pointer-up, ADR 0003)
  clears the trace and starts the letter again.

### How tracing is checked
- **Letters are stroke data, not a font.** Each letter is a list of strokes (lines and arcs in a 100 × 140 box),
  in a simple print style (straight sticks and round balls), written by hand in `src/games/letters/glyphs.ts`.
  Original work under ADR 0011. Stroke data gives the guide, the start dots, the arrows and the demo hand.
- **Checkpoints.** Each stroke is sampled into evenly spaced checkpoints. A checkpoint counts once a trace passes
  within the tolerance of it: 15 glyph units for a finger, 9 for a pen (the guide is 20 wide).
- **Lenient by default:** any order, any direction, any number of strokes; the letter is done when about 85 % of
  its checkpoints are covered and 80 % of every stroke's own checkpoints (those no other stroke passes near), so
  a short stroke like A's bar can't be skipped. A parent setting, per kid, turns on **stroke order**: then only the current
  stroke's checkpoints count, in its direction, and the start dot moves to the next stroke when one is done.
  The numbers (tolerances, 85 %, 80 %) are guesses for the first playtest.
- The checker is plain TypeScript with no DOM (like the driving game's `sim/`), so it has unit tests: a recorded
  good trace finishes, a scribble that covers the whole screen does not.

### Fingers and pens
- Input is pointer events, as in the coloring game. **Every finger draws** (ADR 0003 rule 3): each touch makes
  its own crayon line and any of them can cover checkpoints, so a resting hand never blocks tracing. Palms are
  ignored where the screen reports contact size.
- **A pen wins.** While a pen is near the screen (Windows reports pen hover as pointer events) or touching it,
  and for half a second after, touches are ignored: that is the palm-rejection. The pen draws a slightly
  thinner line and uses the tighter tolerance. Pressure and the eraser end are not used.

### Letter sets and order
- Sets: **capital letters** (on by default), **numbers 0–9**, **small letters**. A parent turns sets on or off
  per kid in the parent area. Capitals come first because they are made of fewer, straighter strokes.
- The grid shows the set in alphabetical order; the next-letter arrow walks it in order, wrapping at the end.

### Saying the letter
- The letter's **name** ("bee", not the "b" sound) is said when it is finished and when its tile is tapped.
  Letter sounds (phonics) may come later as a parent setting.
- First choice: the browser's own speech (`speechSynthesis`) with a Windows voice, so no sound files. If it is
  missing offline in the Windows app, or sounds wrong to the owner, a parent can **record their own voice** for
  each letter in the parent area. Recordings stay on the device (and in family sync, ADR 0024), never in the repo.
- Speech and sounds follow the app's Sounds switch (ADR 0016).

### Saved and shown
- Saved per kid, in the game's own storage namespace (ADR 0012): which letters have a star (practice and game
  share them), how far along the game path the kid is, the turned-on sets and the stroke-order setting. Nothing
  else. A parent can reset a kid's stars and game. Sync works through the storage interface like everything else.
- Drawn on a 2D canvas, no three.js. The crayon line reuses the coloring game's brush look where it fits.
- Lives in `src/games/letters/`, registry id `letters`, and starts hidden (`GameEntry.startsHidden`) until a
  parent turns on "Show Letters" under Settings, Games, like the driving game's prototype.

## Consequences
- A small game: no 3D, no art beyond stroke data and a few icons, no service. It needs nothing from the installer,
  so it can be built and playtested in the web app at any point; where it goes in the build order is the owner's
  call.
- The 62 letters and numbers are written as stroke data by hand, a few lines each. Unit tests catch a broken
  letter: every glyph stays in its box with no gaps, and a good trace of every glyph finishes, in both modes.
- Lenient checking means a kid can "finish" a letter with a messy trace. That is on purpose at this age; stroke
  order is there for an older kid.
- Speech depends on a Windows voice being there; the parent recording is the fallback, at the cost of a parent
  screen for recording.
- Still open, for a playtest: the tolerance and the 85 %, whether the start dot and arrow are understood without
  words, whether the kids want a picture per letter (an apple for A) as a reward, and whether the laptop has a pen.
