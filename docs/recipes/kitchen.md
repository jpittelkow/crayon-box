# Recipe: a thing to make in Kitchen

How to add a thing a kid makes step by step (ADR 0044; the pizza and the cupcake are the two to copy). Written
2026-11-21, after the second one. The rules every recipe keeps are in the [recipes README](README.md).

## Recipe
1. **Write the steps down first,** as what a hand does, in order: pick, pat, rub, pour, shake, drop, wait, bite.
   Five to seven steps. Each must be finishable by doing nothing ("a step skipped does itself").
2. **Check the narrator has every line** before designing round one: the things' names and one line a step. The
   clips are in `assets/sounds/voice/` (`food-*`, `cook-*`, the colour words, the numbers). After 2026-12-31 no
   line can be added in the narrator's voice, so a thing that needs a missing word either does without or reuses
   one (the cupcake's frostings say the flavours, its wrappers the colours).
3. **The recipe file,** `src/games/kitchen/recipes/<id>.ts`: data only. Each step is a verb from `recipe.ts`
   (`press`, `spread`, `pour`, `sprinkle`, `place`, `choose`, `cook`, `eat`) with its numbers, its rail of at
   most eight options, and its line (`say`). Give the thing its size (`r`), and, when it isn't round, where bits
   and pieces go (`area`, a few ovals) and what gets eaten (`body`, one oval).
4. **Option ids are the game's own, across all recipes:** an id names the art, the clip (`food-<id>`, or the
   option's `say`) and what is saved. Don't reuse a pizza's id for something else.
5. **The art,** in `look/art.ts`: each piece as a few SVG paths round 0,0 about 26 units to its edge, with an ink
   outline; a colour may be a pair, raw then baked. Add what the rail needs to `optionArt`.
6. **The look,** `look/<id>.ts`: a class with `draw(ctx, recipe, made, view)` that draws the scene for the open
   step from the plain data. Use `look/kit.ts` for the oven (`ovenScene`), the eaten thing (`Bitten`), pieces and
   colours. Draw the cook step with the thing inside the oven, and the eat step through `Bitten`.
7. **Register it** in `RECIPES` in `game.ts`, with its look and how its tile's picture is framed. The tile is
   drawn by the look from a finished sample; there is no tile art to make.
8. **A new verb only if no verb fits.** It is a plain function in `make/verbs.ts` with its place in `progress`,
   `doneEnough`, `finish` and `touch`, a field in `Made` that `readMade` checks, and unit tests.
9. **Sounds:** every verb already has one. A new verb gets a stand-in from the shipped files in `sounds.ts`,
   listed in [kitchen-plan.md](../kitchen-plan.md).
10. **Tests.** Unit, in the recipe's own test file: every option has art and a clip, every line ships, each new
    rule, next on every step of an untouched one, a save and a load. Browser, in `tests/e2e/kitchen.spec.ts`: the
    whole thing made by touch, then left and come back to.
11. **Look at it** in the running app at 1280 × 800: every step, the oven, a few bites, its tile.

## Patterns
- **One list of data, two looks.** Cheese is a list of shreds: thin lines raw, thick ones melted. Sprinkles are
  the same kind of list drawn in colours. Prefer drawing the same data differently to saving more.
- **The same model as coloring:** pick from the rail, then touch the thing. Every finger does the step.
- **A touch anywhere counts** where aiming isn't the point (pouring). Where it is (toppers), a miss bounces away.
- **Something shows the verb while a finger is down:** the jug pours, the piping bag squeezes.
- **Shapes as ovals.** The cupcake's frosting is five ovals; that was enough to keep sprinkles off the air beside
  it and let a cherry sit on the peak.
- **A unit test that the area fits the body, and the body the square,** caught a peak that could never be eaten.

## Anti-recipes
- **A step that can be got wrong** (too much, burnt, the wrong order, a customer waiting). Nothing in Kitchen can.
- **A step that needs a wait the kid must time.** The oven runs by itself for four seconds, and next skips it.
- **Adding to a tenth ten times and testing for 1.** Floats don't; `pour` snaps to full just below it.
- **A look that keeps its own state about the thing.** Everything drawn comes from `Made`, so a saved thing looks
  the same on another device. Only what flies for a moment (crumbs, a pop) lives in the screen.
- **A picture cached by how many bites it has.** A new thing with the same count showed the last one; the cache
  is keyed by the thing itself as well.
- **Words on the screen, or a count.** The names are spoken; nothing is written (ADR 0003).
