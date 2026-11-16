# 0038. Coloring buttons a kid can work out: names and sounds, the tool at the finger, a show-how, a colour wheel

- Status: Proposed (drafted 2026-11-15 from [coloring-buttons-plan.md](../coloring-buttons-plan.md)); the owner
  settled C1 to C8 on 2026-11-15, taking every recommendation; acceptance waits on the mockups
- Date: 2026-11-15
- Builds on: [ADR 0003](0003-toddler-first-interaction-rules.md), [0016](0016-visual-design-language.md),
  [0019](0019-bigger-coloring-page.md), [0032](0032-sounds-as-files.md). Would supersede, in ADR 0003: rule 1's
  "feedback is a sound plus a small bounce" (each button gets its own sound and a spoken name), rule 2's pointer-up
  for pick buttons (picks fire on touch-down), and rule 5's fixed set of 24 colours (a colour wheel adds 12 where
  the screen has room).

## Context
In the playtest of 2026-11-15 a kid didn't know what any coloring button does, and the owner asked for a colour
wheel next to the swatches. Research the same day (summarised with sources in the plan) found that under 3, kids
can't read icons and learn only from a person showing them; from about 3, spoken prompts and demos start to work
if paired with speech; press-and-hold is too hard at this age; sounds matching the action help; and nothing
tested a colour wheel or undo with under-4s.

## Decision
1. **Every button has its own sound, and says its name** the first few times a kid picks it (tools, sizes, modes
   and colours). Names are narrator clips made before the voice retires on 2026-12-31. A parent setting changes
   how often names are said.
2. **Pick buttons fire on touch-down;** undo, start over and back stay on lift.
3. **The current tool is shown at the finger:** a small badge of the tool on a dot of the colour follows a finger
   on the page. The picked tool is ringed and bigger; sizes grey out while the bucket is picked.
4. **A short show-how on the page,** the first time a kid opens a page and the first time they pick each tool: the
   tool's badge does the thing on its own in a corner of the page, with the narrator's one-line "what it does".
   It changes nothing on the picture and any touch stops it. No cartoon hand, no press-and-hold.
5. **The parent area's Coloring screen** gets "Show the buttons" (plays every demo for a parent and kid to watch
   together) and a short tip to sit with the kid the first time.
6. **A colour wheel:** a ring of 12 big tappable segments of in-between hues, in the spare width beside the colour
   rail when the screen has room (the family laptop does); not shown otherwise, so no button shrinks.
7. Icons are kept plain and like the real thing; the undo icon is checked with a kid.

Prototype for review: https://claude.ai/artifact/K2TLhy1c3Avpcp2FznXLve (source: `docs/design/coloring-buttons-prototype.html`).

## Consequences
- Kids from about 3 should work out the tools alone; younger kids still need a parent, and the app now asks for
  that plainly.
- More sound files and narrator lines (40 coloring lines, made with the letters batch).
- The colour wheel shows only on wide enough screens, so the screen differs between devices.
- To check in a playtest: whether names get annoying, whether the badge hides what is being drawn, whether demos
  are watched or skipped, whether touch-down picks cause accidental picks.
