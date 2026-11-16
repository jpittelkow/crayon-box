# Open questions

Decisions waiting on the owner. Remove an item once it is answered (and record the answer in an ADR or the
relevant memory file).

_Last updated: 2026-11-15_

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

Closed by the owner on 2026-11-15: the playtest questions (brush sizes, colour buttons, touch-down or lift,
letter tracing, the driving playtest), the sounds by ear and new sound files (the stand-ins are fine for now), the
laptop check, the default AI models, and search for AI pages from an idea (dropped). What is left to build is in
[the to-do list](../todo.md).
