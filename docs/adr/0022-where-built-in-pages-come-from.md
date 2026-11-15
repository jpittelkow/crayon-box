# 0022. Where the built-in pages come from

- Status: Accepted (by the owner, 2026-11-14)
- Date: 2026-11-14
- Answers the open question in ADR 0005 of who or what draws the ~48 v1 pages.

## Context
ADR 0005 sets a target of about 48 original built-in pages in 8 themes, and ADR 0011 says what may be shipped.
Neither says who draws them. The options were: Claude drawing them as SVG, AI image models, the family or an
artist, and public-domain collections. Each has a cost: hand-coded SVG looks simple and geometric; AI images
need a clean-up step and a person checking each one; family drawings take time; collections need every license
checked and many fail the page check.

## Decision
A mix, chosen by what suits each theme:
- **Drawn as SVG** (by Claude, in the repo, as the placeholders were) for themes made of clean shapes: Race cars,
  Things that go, Shapes, Yummy food. Recorded as `"source": "original"`, CC0. Race cars comes first.
- **AI-made** for the animal-heavy themes, where drawn SVG looks stiff: Farm and pets, Wild animals, Under the
  sea, Outside. These follow ADR 0011's rules for AI-made built-in pages (terms allow redistribution, no
  franchise, character or artist in the prompt, a person checks each page) and go through the same clean-up as
  imported pages (ADR 0005). That clean-up is needed for the AI page maker anyway (ADR 0006, 0023), so it is built
  once for both.
- Either way, every page follows `pages/README.md` and passes the page check before it is added.
- The `shapes/circle-square-triangle` placeholder stays as a real page in the Shapes theme; it is also what the
  browser tests color.

## Consequences
- The kids get a real library in the clean-shape themes right away, without waiting on AI tooling.
- The library has two looks for a while: crisp geometric SVG and softer AI line art. Line width and ink color
  (`pages/README.md`) keep them close.
- The animal themes wait for the clean-up step, which moves into the web milestone's page work rather than the
  installer.

## Update (2026-11-15): the first animal pages, and a Dinosaurs theme
- The owner asked for the animal pages, "dinos and other animals". They were made with OpenAI's GPT-5 Image Mini
  through OpenRouter, whose terms give the output to the user, from the app's own idea prompt (no franchise,
  character or artist named). Each one went through the clean-up with `tools/clean-pages.mjs` (the batch version
  of `tools/clean-page.html`) and was looked at by a person before it was added.
- Dinosaurs became a ninth theme, between Wild animals and Under the sea, with its own icon. Kids that age
  love them, and a theme of their own is easier to find than dinosaurs mixed in with lions.
