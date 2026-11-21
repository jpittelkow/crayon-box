# Open questions

Decisions waiting on the owner. Remove an item once it is answered (and record the answer in an ADR or the
relevant memory file).

_Last updated: 2026-11-16_

- **Sync security trade-offs** (flagged by an automated review, 2026-11-14, kept as ADR 0024 decided): plain `http`
  on the home network carries the sync token; the Windows app may connect to any `http:`/`https:` address (CSP);
  the gate PIN's hash syncs, so whoever can read the server's data folder could work out the 4-digit PIN. Fine
  for a home server and a PIN that only keeps young kids out; revisit if the server ever leaves the home network.
- **Family pages** (phase F, decided overnight 2026-11-14 to keep going): they live in the app's storage and
  sync; `Pictures\Coloring Book\Pages` is an inbox that empties into `Added`. Say if the Pictures folder should
  also keep a copy of every family page.
- **Sync server defaults** (phase C, picked overnight 2026-11-14 to keep going): port 8787, data in
  `/mnt/user/appdata/crayon-box-sync`, runs as 99:100. Change in the Unraid template if any of that is wrong. The
  image on ghcr.io must be public for Unraid to pull it without logging in: check the package's visibility after
  the first publish.

- **iPad version** ([ADR 0030](../adr/0030-ipad-home-screen-web-app.md), a draft the owner is keeping for later,
  2026-11-14): accept or not; which iPad and Pencil model the family has (hover needs an M2 iPad Pro or later).
  The family's server can have HTTPS, which the ADR requires (owner, 2026-11-14).

- **The very large map** ([ADR 0040](../adr/0040-driving-very-large-map-highway-and-building-site.md), Proposed 2026-11-15): when it starts. The to-do list's order
  stands (its pieces in section 4, the map last) unless the owner moves it up. Accepting the ADR waits for the
  two-level road to be proven on a small test map.

- **From the overnight build (2026-11-16)**, each built on a default the owner can overrule:
  - **Coloring:** a parent switch to turn the first-time demos off (none now)? Back says "Back" the first 3 times
    as it leaves: keep? The laptop's display scale: at 125 % (1536 × 864) the wheel is hidden.
  - **Letters:** do the dots shown after a lift count as a hint for "All by yourself!" (now no)? Should the
    Letters Sounds switch also silence the finish bell (now no)? The "Spoken tips" switch also silences stroke
    words and "Your turn!": right? Stroke words that are judgement calls: J, U and 5 say "Down.", u and f
    "Around." (table in `hints.test.ts`). Kids who played before see the how-to once: fine?
  - **Words:** after the check, a kid's name recording plays in place of "You wrote your name!": right? Letters
    traced inside a word also earn that letter's star: right? Which slow take for each word. Family words: at
    most 10, 16 characters each, and the typed case kept when small letters are on. The word pictures' white
    backgrounds blend into the tile tint.
  - **Driving:** mud never wears off with time (only the car wash or water); the lights turn green as the kid comes
    so the kid never stops; muddy puddles make a car half muddy; the roundabout is 16 m across (ADR said about 14);
    the island's bay was reshaped for the harbour. The stand-in noises for targets and set pieces.

Closed by the owner on 2026-11-15: the playtest questions (brush sizes, colour buttons, touch-down or lift,
letter tracing, the driving playtest), the sounds by ear and new sound files (the stand-ins are fine for now), the
laptop check, the default AI models, and search for AI pages from an idea (dropped). What is left to build is in
[the to-do list](../todo.md).
