# 0011. Licensing policy: line art, sounds, icons and code

- Status: Proposed
- Date: 2026-11-14

## Context
Built-in pages are shipped in a repo and an installer, so their licenses matter. Characters from existing shows,
films, games or brands can't be used. The same goes for everything else that ships: sounds, icons, fonts and the
code itself. Many of the built-in pages are likely to be made with AI, which needs its own rule.

## Decision
- Built-in pages are original line art made for this project and released as CC0, or third-party art whose
  license allows redistribution (CC0 / public domain), recorded in `page.json` with a source link.
- No franchise characters or recognisable copies of them in built-in pages. Jeff asked for Pixar *Cars* pages;
  instead the built-in Race cars theme has original cartoon cars with their own designs and names.
- What the family imports for personal use on their own laptop (ADR 0005) is their call; the app doesn't
  ship, upload or share those pages.
- Family pages (imports and AI pages) stay on the laptop and are never added to the repo automatically.
- The CI page check (ADR 0005) fails a page whose `page.json` has no `license` field.
- **AI-made built-in pages** are allowed when all of these hold: the model's terms allow redistributing its
  output, the prompt names no franchise, character or artist, and a person has looked at the page and found
  nothing recognisable in it. `page.json` records `"source": "ai"` and the model used. They are released as CC0
  like the hand-drawn ones.
- **Sounds, icons and fonts** follow the same rule as line art: original, CC0 / public domain, or a license that
  allows redistribution. Each third-party one is listed in a `CREDITS.md` at the repo root with its source and
  license.
- **Code:** MIT, in the `LICENSE` file at the repo root (decided by the owner, 2026-11-14). MIT was chosen over
  GPL because it is short, matches Tauri and most of the web tooling the app depends on, and puts no obligations
  on the owner. The license covers the code only; built-in line art stays CC0 as above.

## Consequences
- The app and repo can be shared publicly without license problems.
