# 0037. Letters: more sound, a hint ladder, a first-time how-to, and every narrator line made before 2026-12-31

- Status: Accepted (2026-11-15). Drafted from [letters-plan.md](../letters-plan.md); the owner settled D1 to D12
  the same day, taking every recommendation, then accepted it without mockups: the built screens are judged
  instead
- Date: 2026-11-15
- Builds on: [ADR 0026](0026-letter-practice.md), [0028](0028-letter-tracing-whole-letter-and-confirm.md),
  [0032](0032-sounds-as-files.md). Would supersede 0026's single idle hint ("a small hand shows the first stroke
  once"), its "letter sounds may come later", and its alphabetical game path; everything else in those ADRs
  stands.

## Context
The owner asked (2026-11-15) for more sound in letter practice, spoken tips when a kid is stuck, and a first-time
demo of how to trace, before a later level for writing words. The research behind this ADR is in
[research/letters-learning.md](../research/letters-learning.md). In short: tracing is a good first step but help
should fade; the same words for the same stroke, with start dots and arrows, is the best-supported cue; hints
work best as most help first then less, with a wait of a few seconds; praise should be about what the kid did;
spoken lines should be short; children under about 3 follow a person more than an app; names and sounds taught
together do slightly better; error sounds don't teach.

The narrator's voice (ElevenLabs Matilda) can't be used after 2026-12-31
([ElevenLabs](https://elevenlabs.io/docs/help-center/product/voices/my-voices/what-are-default-voices)), and the
new features need new lines in the same voice.

## Decision
1. **All new narrator lines are made in one batch in Matilda's voice, before 2026-12-31**, on the dated schedule
   in the plan (last planned run 2026-12-13): letter sounds, tips, stroke words, the demo's two lines, four praise
   lines about effort, shape names, two spares for a later level and 26 lines for words (77 in all). Ten lines are
   also made in Matilda's suggested replacement, Maisie, for comparison only. After 2026-12-31 the set is
   frozen: a missing line is a parent's recording, or the whole set moves to a new voice by a new ADR.
2. **More sound while tracing**, all as files (ADR 0032): the letter's name when it opens; a soft drawing sound
   only while the finger is on the letter, which simply stops when it leaves (no error sound); a quiet chime per
   finished stroke; praise that includes what the kid did, never the same line twice in a row.
3. **Letter sounds are a parent setting**: name (the default, as today), name then sound, or sound only.
4. **A hint ladder replaces the single idle hint**: the dot pulses with a spoken "Start at the green dot." after
   about 5 s with no progress; the fingertip runs along the next stroke with its stroke word ("Down.") 5 s later;
   the whole letter is shown stroke by stroke, then "Your turn!", 8 s after that; then it rests. Short triggers
   for going off the road, lifting early and not tapping the check. A letter the kid has done well gets less help.
   Every number lives in one file (`hints.ts`) to tune in a playtest. Spoken tips can be turned off by a parent;
   the shown part can't.
5. **A first-time how-to**: before a kid's first letter, and after 14 days away, the narrator and a hand trace an
   `L` on the real tracing screen ("Watch me." … "Your turn!"), then the kid traces it. A touch ends the demo at
   once. A parent can replay it, and the parent area tells parents that sitting with the youngest helps most.
6. Kid screens still show no text (ADR 0003), and nothing about the kids goes in the repo (CLAUDE.md).

7. **Easy letters first on the game path** (straight lines, then curves and slants, in groups that share a
   start, plan phase E); the practice grid stays alphabetical.
8. **A lines-and-shapes set** before capitals (line down, line across, circle, cross, slant, square, X,
   triangle), traced like letters, off by default and turned on per kid by a parent.

Not decided here: a fading guide with a "draw it" turn (plan phase F) waits for a playtest and gets its own
short ADR. Writing words gets its own ADR (plan phase G). Both have their narrator lines made now under point 1.

## Settled by the owner (2026-11-15)
Every recommendation in the plan's decisions table: Matilda now with spares and 10 Maisie samples (D1); the line
list as written (D2); name as the default saying, with name-then-sound and sound-only as settings (D3); going off
the line just stops the drawing sound, no boop (D4); 5 s before the first hint (D5); `L` as the demo letter
(D6); the demo comes back after 14 days away (D7); easy first on the game path (D8); the shapes set, off by
default (D9); the fading guide after a playtest (D10); keep today's praise and add four (D11); the spend for the
batch (D12).

## Consequences
- About 80 more short clips (well under 1 MB as MP3) and one spend on AI takes, made in the family server's
  container as before (ADR 0029).
- The batch has to happen in November and early December 2026, ahead of the code that uses some of it; lines for
  words and later levels are made on a guess about what those levels need.
- More logic on the tracing screen; the ladder is a plain state machine with unit tests, like the checker.
- Kids under about 3 may still need a parent beside them; the app says so to parents rather than trying to
  replace them.
- The timings and tries are guesses until the kids play; the research gives no exact numbers.
