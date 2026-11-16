# Known bugs

Bugs found and not fixed yet. Remove an item once it is fixed (the fix goes in that day's journal entry).

_Last updated: 2026-11-16_

- **`maps/stress.ts` fails `maps/check.ts` four times** (found 2026-11-16 by the map editor's viewer): two star
  rows sit inside a zone and two box stacks on a road. It is a dev and test stand-in, never in `MAPS`, so no kid
  sees it; from high above its sand and grass also streak where they overlap.
- **Traffic jumps about a lane's width when it turns at a junction** (noted 2026-11-16 while building the
  roundabout, older than that): a kid parked right in a junction's mouth can get a toy bump.
- **A folder map's old picture stays cached** on the device after the file is edited, until the next app version
  (found 2026-11-16, ADR 0043).
