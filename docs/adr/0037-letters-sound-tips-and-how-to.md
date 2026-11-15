# 0037. Letters: more sound, a hint ladder, a first-time how-to, and every narrator line made before 2026-12-31

- Status: Proposed (drafted 2026-11-15 from [letters-plan.md](../letters-plan.md); waits on the owner's
  decisions D1 to D12 there, and on mockups)
- Date: 2026-11-15
- Builds on: [ADR 0026](0026-letter-practice.md), [0028](0028-letter-tracing-whole-letter-and-confirm.md),
  [0032](0032-sounds-as-files.md). Would supersede 0026's single idle hint ("a small hand shows the first stroke
  once") and its "letter sounds may come later"; everything else in those ADRs stands.

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

Left to the owner and not decided here: an easy-first order on the game path, a lines-and-shapes set, and a
fading guide with a "draw it" turn (plan phases E and F). Writing words gets its own ADR (plan phase G); its
narrator lines are made now under point 1.

## Consequences
- About 80 more short clips (well under 1 MB as MP3) and one spend on AI takes, made in the family server's
  container as before (ADR 0029).
- The batch has to happen in November and early December 2026, ahead of the code that uses some of it; lines for
  words and later levels are made on a guess about what those levels need.
- More logic on the tracing screen; the ladder is a plain state machine with unit tests, like the checker.
- Kids under about 3 may still need a parent beside them; the app says so to parents rather than trying to
  replace them.
- The timings and tries are guesses until the kids play; the research gives no exact numbers.
