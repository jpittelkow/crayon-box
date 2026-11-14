# Owner preferences

What the owner (the parent building this) has asked for, beyond what the ADRs spell out.
_Last confirmed: 2026-11-14_

## Product
- Wants to test early as a web app before any installer (ADR 0014). The web app is only a stepping stone to the
  installer, not something to host or keep.
- **Free coloring is the default**; stay-in-the-lines is a per-kid option (ADR 0004, 0007).
- Printing is not needed for v1 (ADR 0010).
- Wants lots of pages and an easy way for the family to add more, including from photos via AI (ADR 0005, 0006).
- A car theme matters to at least one kid; asked for a well-known animated car franchise, which was replaced by
  original cartoon cars for licensing reasons (ADR 0011).

- The AI page maker must not steer or discourage which photos a parent uses; that choice is the parent's
  (ADR 0006).
- Expects the racing game to use 3D models and to need a lot of design, so it comes after the installer.

## Tooling and hosting
- The repo is public, one repo for code and releases (ADR 0013).
- GitHub Releases are only for the Windows installer; keep the release workflow focused on that (ADR 0009).
- The web app runs locally only (dev server or a local container on the dev machine). No online hosting, no
  published container image, and no home-server setup for this app (ADR 0014). Asked on 2026-11-14 to drop a
  proposed home-server container and template.
- Install from GitHub and update inside the app; no dev tools on the family laptop (ADR 0009).
- GitHub is fine as the main host; a self-hosted Gitea exists and may mirror (ADR 0013).
- Uses OpenRouter for AI image models, with their own key (ADR 0006).

## Working style
- Keep docs and repo free of the kids' names and any specific identifiers (see [CLAUDE.md](../../CLAUDE.md)).
- Wants a local memory + journal in the repo so work carries across sessions.
