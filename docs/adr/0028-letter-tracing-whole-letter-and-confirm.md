# 0028. Letter tracing: letters formed as taught in school, the whole letter traced, then a check to finish

- Status: Accepted (asked for by the owner, 2026-11-14; the numbers are Claude's, to tune in a playtest)
- Date: 2026-11-14
- Supersedes: the "Finish" and "How tracing is checked" parts of [ADR 0026](0026-letter-practice.md) (the rest
  of 0026 stands)

## Context
After trying letter practice, the owner reported (2026-11-14) that a letter counts as done too soon: the kid
should have to trace the entire letter, with more input, and have a clear moment where they say it is done.
ADR 0026 finished a letter on its own as soon as about 85 % of its checkpoints (80 % per stroke) were covered,
so a kid could stop well short of a stroke's end and still get the cheer.

## Decision
- **The whole letter.** A trace is complete when every stroke has been traced from end to end: both ends of every
  stroke, at least 92 % of each stroke's own checkpoints and 95 % of the letter's. In stroke order, the next stroke
  starts only once the current one reaches its end. Tolerances stay as in ADR 0026 (15 glyph units for a finger,
  9 for a pen); any direction still counts in lenient mode.
- **What is left is shown.** When the kid lifts their finger with at least half the letter traced but not all of
  it, small pulsing green dots mark the parts still to trace (in stroke order, only the current stroke's). They go
  as soon as the kid touches the letter again. The idle hint (a fingertip along the first unfinished stroke)
  still runs after 8 seconds.
- **Then the kid confirms.** A complete trace does not finish on its own. The letter fills in with the kid's
  color, a soft sound plays, and a big round green check button (160 px, pulsing gently; no text, ADR 0003)
  appears beside the letter. Tapping it finishes the letter as ADR 0026 describes: the name said aloud, the cheer,
  confetti, the star, and the arrow to the next letter. Until then the kid can keep drawing, or wipe and start
  again, which also takes the check away.
- **Letters are formed the way schools teach them.** Checked against the US manuscript programs (Zaner-Bloser and
  Handwriting Without Tears, which agree on these points), at the owner's request: start at the top; lines go
  down, then across left to right, with crossbars last; round letters (c, o, a, d, g, q, C, O, G, 0, 9) go
  counterclockwise from the top ("magic c"); b, h, m, n, p and r go down and push back up the same line, then over,
  in one stroke without lifting (u likewise pushes up and comes back down); B's two bumps, R's bump and leg, K and
  k's slant in and slant out, and G's bar (right to left) go on without a lift; the 4 is the open 4 (short line
  down, across, then the long line down); W and w reach the top and middle lines in the middle. Where the programs
  differ (T's order, where the circle starts, D'Nealian's slanted letters) the app follows Zaner-Bloser. A stroke
  that turns back on itself gets an arrow for each way.

## Consequences
- More effort per letter, and a moment of "I did it" that is the kid's own. Whether 4-year-olds manage the last
  few percent without frustration is for the playtest; the dots for what is left are there to help.
- If the kids' school uses a different program (D'Nealian, or another country's style), the stroke data in
  `glyphs.ts` is the one place to change; that's an open question for the owner.
- The numbers live in `src/games/letters/trace.ts` (`DONE_SHARE`, `STROKE_SHARE`) and `game.ts` (`LEFT_FROM`).
