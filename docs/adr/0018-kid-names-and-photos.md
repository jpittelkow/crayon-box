# 0018. Kid profiles with names and photos

- Status: Accepted (by the owner, 2026-11-14); "device only" superseded by [0024](0024-family-sync-server.md)
- Date: 2026-11-14
- Supersedes: in ADR 0007, "each kid has a color and a picture symbol (star, heart, ...) instead of a name" and
  "`<kid>` is the profile's symbol name (`star`, `heart`), never a real name". In ADR 0016, rule 1 gains one
  exception (names under the kid picker's badges), and the kit's "never add a name field or a photo".

## Context
ADR 0007 kept kids nameless so the public repo could never hold a kid's name. The owner pointed out that the
privacy rule is about what gets committed to the repo, not about settings a parent enters into the app on the
family's own device. A parent wants to tell profiles apart by name, and a toddler finds their own face faster
than a symbol.

## Decision
- A kid profile has an optional **name** and an optional **photo**, besides its color, symbol and starting
  coloring mode. All are set in the parent area (ADR 0008).
- The **photo** shows inside the kid's badge, ringed in the kid's color. Without a photo the badge shows the
  symbol, as before. Photos are cropped to a square and scaled to 320 × 320 when chosen, so the original file is
  not kept.
- The **name** shows in the parent area, and under each badge on the kid picker while the parent setting
  "Show names on the kid picker" is on (on by default). That is the only text on a kid screen.
- Names and photos are **kept on the device only**: browser storage in the web milestone, the app data folder in
  the installer. They are never written to the repo, never sent anywhere, and never put in file or folder names:
  a profile's storage id is generated (`kid-…`), or a symbol name for the three starting profiles.
  Syncing between devices would change this and needs its own ADR first.
- The repo's privacy rule (`CLAUDE.md`) is unchanged for everything committed: no names, photos or other
  identifiers in code, docs, tests, sample data or commit messages. Tests use symbols and generated images.

## Consequences
- Parents can tell profiles apart easily; kids can find themselves by face.
- A device now holds the kids' names and faces. Anyone with access to the laptop's account or the browser
  profile can see them, the same as the pictures the kids make.
- The design system artifact and its mockups still say "no names" and need updating to match.
