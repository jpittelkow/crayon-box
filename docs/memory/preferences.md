# Owner preferences

What the owner (the parent building this) has asked for, beyond what the ADRs spell out.
_Last confirmed: 2026-11-14_

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
  owner's view: the privacy rule is about what gets committed to the repo, not settings inside the app.
- Would like settings (and maybe more) to **sync across devices** later, knowing it is a big lift (2026-11-14).
- Wants lots of pages and an easy way for the family to add more, including from photos via AI (ADR 0005, 0006).
- A car theme matters to at least one kid; asked for a well-known animated car franchise, which was replaced by
  original cartoon cars for licensing reasons (ADR 0011).

- The AI page maker must not steer or discourage which photos a parent uses; that choice is the parent's
  (ADR 0006).
- Expects the racing game to use 3D models and to need a lot of design, so it comes after the installer.

## Tooling and hosting
- The repo is public, one repo for code and releases (ADR 0013). The owner renamed it from `kidsapp` to
  `crayon-box` on 2026-11-14; the local checkout folder may still be called `kidsapp`.
- GitHub Releases are only for the Windows installer; keep the release workflow focused on that (ADR 0009).
- The web app runs from the dev server only: no local container (dropped 2026-11-14, ADR 0020), no online
  hosting, no published image, and no home-server setup for this app (ADR 0014).
- Install from GitHub and update inside the app; no dev tools on the family laptop (ADR 0009).
- GitHub is fine as the main host; a self-hosted Gitea exists and may mirror (ADR 0013).
- Uses OpenRouter for AI image models, with their own key (ADR 0006).

## Working style
- Keep docs and repo free of the kids' names and any specific identifiers (see [CLAUDE.md](../../CLAUDE.md)).
- Wants a local memory + journal in the repo so work carries across sessions.
