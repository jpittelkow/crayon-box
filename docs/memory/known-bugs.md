# Known bugs

Bugs found and not fixed yet. Remove an item once it is fixed (the fix goes in that day's journal entry).

_Last updated: 2026-11-14_

- **Letter tracing finishes too soon** (reported by the owner, 2026-11-14): a letter counts as done before the
  whole letter is traced. The owner wants the kid to complete the entire letter, with more input and a clear
  moment where the kid confirms it is done. Today the checker finishes at about 85 % of checkpoints (80 % per
  stroke) with a 15-unit finger tolerance ([ADR 0026](../adr/0026-letter-practice.md)); changing the finish rule
  or adding a confirm step changes that ADR, so it needs a new ADR that supersedes it.
- **Audio and voices aren't good enough** (reported by the owner, 2026-11-14): re-evaluate the app's sounds and
  voices overall. Includes the letter names said by Windows speech (`speechSynthesis`, ADR 0026), the shell's
  sounds and the driving game's engine voices (ADR 0025). Options to weigh: recorded or pre-generated voice
  files instead of live browser speech, better sound assets (original or CC0, ADR 0011).
