# Known bugs

Bugs found and not fixed yet. Remove an item once it is fixed (the fix goes in that day's journal entry).

_Last updated: 2026-11-14_

- **Audio and voices aren't good enough** (reported by the owner, 2026-11-14): re-evaluate the app's sounds and
  voices overall. Includes the letter names said by Windows speech (`speechSynthesis`, ADR 0026), the shell's
  sounds and the driving game's engine voices (ADR 0025). Options to weigh: recorded or pre-generated voice
  files instead of live browser speech, better sound assets (original or CC0, ADR 0011).
  Owner (2026-11-15): sounds ship as files made ahead of time. Picks are in
  [ADR 0032](../adr/0032-sounds-as-files.md) (Accepted 2026-11-15). Part 1 (touch sounds, narrator, praise, page
  turn) and part 2 (driving engines and effects, police siren, crayon sound) are built; remove this item once the
  owner has listened on the laptop.
