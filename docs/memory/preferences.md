# Owner preferences

What the owner (the parent building this) has asked for, beyond what the ADRs spell out.
_Last confirmed: 2026-11-21_

## Product
- Wants to test early as a web app before any installer (ADR 0014). The web app is only a stepping stone to the
  installer, not something to host or keep.
- **Free coloring or stay in the lines is chosen on each picture**, not only per kid (asked 2026-11-14). Free
  coloring is where a kid's new pictures start unless a parent changes it (ADR 0004, 0007).
- Wants **a lot more preset colors** on the coloring screen than the first 12 (asked 2026-11-14). The mockups now
  show 23 plus rainbow, the most that fits at full button size (ADR 0003, 0016); the owner has not yet said
  whether that is enough.
- Printing is not needed for v1 (ADR 0010).
- **Pages can be colored again and again**: a page tap always starts a new picture; old ones are continued from
  My pictures (asked 2026-11-14, ADR 0017).
- **The coloring page should be as big as possible**; accepted 64 px color buttons for it (2026-11-14, ADR 0019).
- **Profiles get names and photos**, names shown under the badges as a setting (asked 2026-11-14, ADR 0018). The
  owner's view: the privacy rule is about what gets committed to the repo, not settings inside the app. Said
  again for sync (2026-11-14): the app and the family's own server need no privacy limits; don't raise it as a
  design concern, only keep private data out of the repo.
- Would like settings (and maybe more) to **sync across devices** later, knowing it is a big lift (2026-11-14).
- Wants lots of pages and an easy way for the family to add more, including from photos via AI (ADR 0005, 0006).
- A car theme matters to at least one kid; asked for a well-known animated car franchise, which was replaced by
  original cartoon cars for licensing reasons (ADR 0011).

- The AI page maker must not steer or discourage which photos a parent uses; that choice is the parent's
  (ADR 0006).
- Expects the racing game to use 3D models and to need a lot of design, so it comes after the installer.
- **The racing game** (asked 2026-11-14, ADR 0021): 3D, seen from behind the car, simple, a little open world.
  Roam only, no races; maybe traffic that "sort of races with you". Touch to go, and keyboard driving too (arrow
  keys and WASD). **three.js is the 3D library**, chosen over Babylon.js on 2026-11-14 after a
  side-by-side test; CC0 model kits are fine. For a choice this size the owner wants to see both options
  running, not only read a comparison. Fine with a prototype during milestone 1.
  Confirmed touch driving and both assist levels (steers freely, follows the road). Likes the sound effects and
  things to knock around. Expects the kids to want water to drive through: puddles and flood water. Cares how
  the models look and asked which library gives better-looking ones. The family laptop has integrated graphics,
  no separate graphics card.
- **After the driving MVP** (asked 2026-11-14): a choice of vehicles (monster trucks, school buses, emergency
  vehicles with working lights, "a bunch of other options"); two or three maps, a lot bigger than the
  prototype, with more of everything the test had and more water. A map of the family's own area as its own
  milestone, kept out of the repo in a folder for the family's server. Planned on the owner's request
  2026-11-15 ([milestone-3.md](../milestone-3.md)): separate maps chosen from picker tiles, a vehicle picker
  plus a garage on the map to swap vehicles. Chose vehicles **built in code** over a CC0 kit or AI-made
  models after seeing all three (2026-11-15).
- **More realism and more sound in the driving game** (asked 2026-11-14, after trying the prototype: "it looks
  great"): more realistic across the board, above all the vehicle models; many more sound effects, engine
  noise from every car, and each vehicle its own engine sound. Wanted before the next step. Changes ADR 0021's
  flat Crayon Box look, so it needs a new ADR.

- **Milestone 3, worked through without stopping** (asked 2026-11-15): each step's PR may be merged into main
  by Claude once its checks pass; the owner reviews afterwards. Nothing merges on red.

- **Every game shows on the home screen by default** ([ADR 0045](../adr/0045-every-game-shows-by-default.md)):
  Driving since 2026-11-15 (owner, after milestone 3 was built), Letters and Kitchen since 2026-11-21, when the
  owner looked for them, didn't find them, and said "Show both". A parent can still hide any game.
- **Hands-on "make a thing" games** (asked 2026-11-21: the kids want games like the make-a-cupcake, cake and pizza
  ones on a kids' games site). The owner picked a Kitchen game, pizza first (ADR 0044), asked for mockups before
  building, then said to build.

## Tooling and hosting
- The repo is public, one repo for code and releases (ADR 0013). The owner renamed it from `kidsapp` to
  `crayon-box` on 2026-11-14; the local checkout folder may still be called `kidsapp`.
- GitHub Releases are only for the Windows installer; keep the release workflow focused on that (ADR 0009).
- The sync server's container image **is** published from this repo (GitHub's container registry), with an Unraid
  template (yes on 2026-11-14, ADR 0024). The declined image was the web app's, not this.
- The web app runs from the dev server only: no local container (dropped 2026-11-14, ADR 0020), no online
  hosting, no published image, and no home-server setup for this app (ADR 0014).
- Install from GitHub and update inside the app; no dev tools on the family laptop (ADR 0009).
- **Windows app builds run only in CI** (2026-11-14). Windows-side changes are tried by pushing a branch and
  installing the CI artifact. A Rust toolchain is on the dev machine for `cargo check`/`cargo test` only.
- GitHub is fine as the main host; a self-hosted Gitea exists and may mirror (ADR 0013).
- Uses OpenRouter for AI image models, with their own key (ADR 0006).

## Working style
- Keep docs and repo free of the kids' names and any specific identifiers (see [CLAUDE.md](../../CLAUDE.md)).
- Wants a local memory + journal in the repo so work carries across sessions.
