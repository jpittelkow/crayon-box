# Recipes

Step-by-step ways to make the things the app is built from, for any person or AI adding one. Asked for by the
owner on 2026-11-15. Each file has three parts:
- **Recipe:** the steps, in order, with the files to touch. Follow it top to bottom.
- **Patterns:** what has worked, to copy.
- **Anti-recipes:** what goes wrong, and has gone wrong here. If a plan matches one, stop and change it.

| File | Makes |
|---|---|
| [coloring-pages.md](coloring-pages.md) | A built-in coloring page or a whole theme |
| [vehicles.md](vehicles.md) | A driving-game vehicle, with its engine and horn |
| [scenery.md](scenery.md) | Toys, solid scenery, decor, animals and set pieces, each with its sounds |
| [maps.md](maps.md) | A driving map, with its sounds |
| [sounds.md](sounds.md) | A sound file for the driving game (or the app), from source to shipped |

In the driving game **sound is part of every asset**, not an afterthought: each recipe there has a sound step,
and an asset isn't done until it makes its noise (a stand-in is fine; silence is not).

## Rules every recipe keeps
- **The privacy rule** ([CLAUDE.md](../../CLAUDE.md)): no kids' names, places or family photos in anything
  committed. A map of a real place, a page from a family photo, a voice recording of the family: never in the repo.
- **Original or CC0 only** (ADR 0011): no franchise characters, vehicles, logos or tunes, and no artist named in an
  AI prompt.
- **Toddler rules** (ADR 0003): no text or numbers a kid has to read, big targets, nothing scary, nothing to lose.
- **Nothing gets hurt, nothing traps the car** in the driving game (ADR 0021,
  [driving-assets.md](../driving-assets.md), "Rules for every category").
- **The asset catalog decides the category.** Before building anything for the driving game, sort it with the
  rule in [driving-assets.md](../driving-assets.md) ("Which category?") and add or move its row there.
- **Tests and a look by eye**, every time: the tests the recipe names, then the thing seen in the app or the gallery.

Add to these files when something new is learned: a new pattern or a trap goes in the file it belongs to, with the
date it was found.
