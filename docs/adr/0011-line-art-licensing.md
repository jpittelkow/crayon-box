# 0011. Line art licensing policy

- Status: Proposed
- Date: 2026-11-14

## Context
Built-in pages are shipped in a repo and an installer, so their licenses matter. Characters from existing shows,
films, games or brands can't be used.

## Decision
- Built-in pages are original line art made for this project and released as CC0, or third-party art whose
  license allows redistribution (CC0 / public domain), recorded in `page.json` with a source link.
- No franchise characters or recognisable copies of them in built-in pages. Jeff asked for Pixar *Cars* pages;
  instead the built-in Race cars theme has original cartoon cars with their own designs and names.
- What the family imports for personal use on their own laptop (ADR 0005) is their call; the app doesn't
  ship, upload or share those pages.
- Family pages (imports and AI pages) stay on the laptop and are never added to the repo automatically.
- The CI page check (ADR 0005) fails a page whose `page.json` has no `license` field.

## Consequences
- The app and repo can be shared publicly without license problems.
