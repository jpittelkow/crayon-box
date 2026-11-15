# CLAUDE.md

Guidance for Claude (and any other AI or human contributor) working in this repo.

## What this is
A touch-screen Windows app for kids aged 4 and under. Coloring book first, a simple racing game next, more games
later. TypeScript + HTML canvas, runs in a browser first, then ships as a Tauri 2 installer with a kiosk lock and
in-app updates from GitHub Releases. Design lives in [docs/adr](docs/adr/README.md).

## Start of every session
1. Read [docs/memory/README.md](docs/memory/README.md) and the memory files it lists. They are short.
2. Skim the newest entry in [docs/journal](docs/journal/README.md) to see where the last session stopped, and
   the ordered [to-do list](docs/todo.md) for what comes next.
3. Check the ADR index before changing anything a decision covers.

## End of every session (or after a meaningful chunk of work)
1. Add or update today's journal entry: `docs/journal/YYYY-MM-DD.md` (template in the journal README).
2. Update memory files whose facts changed. Edit in place; delete what is no longer true.
3. A new or changed design decision becomes an ADR (ADR 0001), not just a memory note.

## Privacy rule (hard rule, applies to every file in the repo)
This repo is public (ADR 0013). **Never write anything that identifies the family's kids**, in docs,
code, comments, tests, sample data, commit messages, page names or file names:
- No kids' names, nicknames or initials.
- No birthdays, exact ages tied to a specific child, school, daycare, location or address.
- No photos, drawings or AI-generated pages made from family photos (those stay on the laptop, ADR 0011).
- No other specific identifiers (usernames, device names, account ids, emails).

Refer to kids generically: "the kids", "a kid", "the youngest", "a car-loving kid". The rule is about what gets
committed. Inside the app a parent may give a profile a name and a photo; those stay on the device only and never
reach the repo, file names or any service (ADR 0018). Test data uses symbols and generated images (e.g. `star`).
If you notice an identifier already in the repo, flag it to the owner rather than silently leaving it.

## Working conventions
- Making a coloring page, vehicle, toy, scenery, set piece, map or sound: follow its recipe in
  [docs/recipes](docs/recipes/README.md) (steps, patterns, anti-recipes).
- Kid-facing screens follow the toddler rules in ADR 0003 (no text, big targets, one finger, no escape hatches).
- Built-in art is original or CC0 only; no franchise characters (ADR 0011).
- Secrets (OpenRouter key, updater signing key) never go in the repo (ADR 0006, 0009).
- Dates in docs are absolute (`2026-11-14`), never "yesterday" or "next week".
