# Kitchen: making things step by step, pizza first (plan)

Planned 2026-11-21, after the owner picked "Kitchen, pizza first" from six ideas for hands-on games (journal,
[2026-11-21](journal/2026-11-21.md)). The decision this plan asks for is
[ADR 0044](adr/0044-kitchen-make-it-game-pizza-first.md) (Proposed). This is a plan, not a decision: phases can be
reordered or split.

**Ground rules** for everything below: kid screens show no text (ADR 0003); every sound is a file (ADR 0032); art
is original or CC0 and looks like no other game (ADR 0011); nothing in the repo identifies the kids (CLAUDE.md).

## Where it stands (2026-11-21)
The owner saw the mockups and said to start building, changing none of K1 to K12, so the build is on every
recommended default. On the branch `kitchen/pizza`, not yet committed:
- **Phase B is built**, and most of phase C's look with it: a whole pizza can be made in the web app. It shows on
  the home screen by default (K2, ADR 0045). 19 unit tests and 4 browser tests pass.
- **Phase C, sounds:** every verb has a stand-in from the shipped files (`src/games/kitchen/sounds.ts`). No
  speech yet: there are no clips.
- **Phase A:** the batch is in `tools/sounds/generate.mjs` (`DRY=1 ONLY=kitchen` lists its 93 lines). **It has
  not been run**: that takes the owner's go-ahead (it runs on the family's server and spends a little on the key).
- **Left before the kids try it:** the narrator run and speech, the idle hand, the shelf and the parent screen
  (phase D), the recipe doc and playtest questions (phase E).

## The narrator deadline (read first)
The narrator's voice retires on **2026-12-31** (ADR 0032; the dates and the reasons to run early are in
[letters-plan.md](letters-plan.md)). Lines already made keep working; a new line can't be made after that. So
every line Kitchen may ever say is made in **one batch now**: the pizza's, the lines for the four recipes meant
to follow (which are not designed yet, so these are a guess), and spares.

| By | What | Who |
|---|---|---|
| 2026-11-21 (Sat) | This plan and ADR 0044 (Proposed) | Claude, done |
| 2026-11-29 (Sun) | Owner settles K1 to K12 below; K3, K4 and K8 are the ones the batch waits for | Owner |
| 2026-12-06 (Sun) | `ONLY=kitchen` added to `tools/sounds/generate.mjs`; one run in the sync container, three takes a line; the audition page. Sooner if K3, K4 and K8 are settled sooner | Claude, on the owner's request |
| 2026-12-13 (Sun) | Owner's picks by ear; redos and added lines in a second run; `prepare.mjs`; clips committed. **Last planned run** | Owner, Claude |
| 2026-12-20 (Sun) | Emergency run only | Claude |
| 2026-12-31 (Thu) | The voice is gone. Building goes on with the files in hand | |

### The lines (draft, about 95)
Already shipped and reused: the colour words, numbers 0 to 9 (for candles), the praise words, "Watch me." and
"Your turn!", "Cup.", "Jam.", "Pan.", the shape words.

- **Things to make:** Pizza. Cupcake. Cake. Ice cream. Cookie. Spares: Sandwich. Pancake. Smoothie.
- **Pizza things:** Dough. Tomato sauce. Green sauce. White sauce. Cheese. Pepperoni. Mushroom. Pepper. Olive.
  Tomato. Pineapple. Corn. Basil. Spares: Ham. Sausage. Onion. Spinach. Bacon. Chicken. Egg. Broccoli.
- **Things for the next recipes:** Batter. Frosting. Sprinkles. Cherry. Strawberry. Banana. Blueberry. Candy.
  Candle. Chocolate. Vanilla. Cone. Scoop. Chocolate sauce. Star. Heart. Oven. Plate.
- **Pizza steps:** Let's make a pizza! Pat the dough. Spread the sauce. Sprinkle the cheese. Pick a topping.
  Put it on the pizza. Into the oven! It's ready! Eat it up! All gone! Yum! Mmm, yummy! You made a pizza!
  Let's make another one.
- **Steps for the next recipes:** Let's make a cupcake! Let's make a cake! Let's make an ice cream! Let's make a
  cookie! What shall we make? Pour the batter. Stir it round. Squeeze the frosting. Shake the sprinkles. Put a
  cherry on top. Put the candles on. Blow out the candles! Happy birthday! Scoop the ice cream. Roll the dough.
  Cut out a shape. You made a cupcake! You made a cake! You made an ice cream! You made a cookie! You made it!
- **If K8 says so, for a car wash game** (the second pick of the six ideas): Let's wash the car! Squirt the
  water. Rub the soap on. Rinse it off. Dry it. All clean! Shiny! Soap. Sponge. Bubbles. Muddy.

## Decisions for the owner
Each has a default the build can start on; say which to change. **2026-11-21:** the owner said to start building
and changed none, so the build uses every default. They were not gone through one by one, so each can still be
overruled; K3, K4 and K8 are fixed for good once the narrator batch is run.

| # | Decision | Recommended |
|---|---|---|
| K1 | The game's name and home tile | "Kitchen" (never shown to a kid); the tile is a chef's hat, not a pizza, because more recipes follow |
| K2 | Shown or hidden | **Settled 2026-11-21: shown by default** ([ADR 0045](adr/0045-every-game-shows-by-default.md)); a parent can hide it. The recommendation had been hidden until phase E |
| K3 | The eight toppings | Pepperoni, mushroom, green pepper, olive, tomato, pineapple, corn, basil. Swap in what the kids like to eat |
| K4 | Sauces | Three: tomato (red), green, white. Red is picked to begin with |
| K5 | Eating | Bites where a finger touches. The other way is six slices, each tapped away |
| K6 | Keeping what was made | A shelf of the newest 24 per kid, cleared from the parent area. No file in the Pictures folder yet |
| K7 | Saying names | The first three times a kid picks a thing, with Kitchen's own setting in the parent area (always, three times, never), as in Coloring |
| K8 | How much the narrator batch covers | The pizza, the four recipes to follow, the spares, and the car wash lines: about 95 lines, three takes each (the letters batch of 246 takes cost about $0.34) |
| K9 | Undo | None in the first version; checked in the playtest |
| K10 | The recipe after pizza | Cupcake (it adds pouring and squeezing); then birthday cake (candles counted aloud) |
| K11 | Mockups before building | **Settled 2026-11-21:** the owner asked for mockups; they are boards 25 to 34 on the mockup canvas (home tile, start, the six pizza steps, the shelf, the parent screen). Still to say: whether they are right |
| K12 | Where it goes in the [to-do list](todo.md) | Phase A now (the deadline); phases B to E next, ahead of section 3 (more vehicles), because the kids asked for it |

## Phases

### A. The narrator batch (dated above)
- `tools/sounds/generate.mjs`: a `kitchen` batch beside `letters2`, `coloring` and `words` (`ONLY=kitchen`, and
  `DRY=1` to list the lines without making them). Ids: `food-<thing>` (the id the recipe's rail uses),
  `cook-<step>`, `wash-<thing>`. **In the script since 2026-11-21: 93 lines, 279 requests at three takes.**
- Run in the sync server's container on the owner's request (ADR 0029: the key stays on the server). Audition
  page, the owner's picks into `tools/sounds/picks.json`, `prepare.mjs`, clips into `assets/sounds/voice/`, a row
  each in `assets/sounds/sounds.json`.
- **Done when** every line in the list above is a committed clip, or is crossed off on purpose.

### B. The verbs and a bare pizza (built 2026-11-21)
The whole pizza, start to finish. Hidden.
- `src/games/kitchen/entry.ts` and one line in `src/shell/registry.ts` (`startsHidden`); `icons.kitchen()` and
  `icons.next()`.
- `recipe.ts`: what a recipe and a step are. `recipes/pizza.ts`: the first one, as data.
- `make/made.ts`: what is being made, as plain data, and reading a saved one safely. `make/verbs.ts`: the seven
  verbs (`press`, `spread`, `sprinkle`, `place`, `choose`, `cook`, `eat`) as plain functions with no DOM, and
  `next`, where "a step skipped does itself" lives.
- `game.ts`: the counter screen (canvas, the rail, next, back), pointer events with every finger working, palms
  ignored where the screen reports size. The oven and a held finger run on a timer, the drawing on frames.
- `store.ts`: the thing in progress, one file per kid and recipe (`kids/<id>/making/pizza.json`), saved 0.4 s
  after an action and again on the way out (the unmount promise, ADR 0012).
- **Tests.** Unit (`kitchen.test.ts`, 19): each verb; a skipped step finishes itself and keeps what the kid did;
  the data survives a save and a load and odd data is dropped; every rail option has art. Browser
  (`tests/e2e/kitchen.spec.ts`, 3): a whole pizza by touch (a palm ignored, picks on the touch, a miss off the
  pizza, a dragged trail, the oven, a bite, leave and come back); next on an untouched pizza; eating it all.
  Still to add to the recipe check once they exist: a sound and a narrator line for every option.

### C. The look and the sound
- **Art (built 2026-11-21),** original, CC0, in the Crayon Box look (ADR 0016), as data in `look/art.ts` and
  drawn by `look/pizza.ts`: the board, the dough (lump to base), three sauces, cheese shreds, eight toppings, the
  oven, the plate, bites and crumbs. The baked look is the same art with its second colours; cheese shreds
  swell into melted pools as the oven runs. To check by eye on the laptop, and against the mockups.
- **Sounds** (ADR 0032, [the sounds recipe](recipes/sounds.md)): one per verb. **Stand-ins are in**
  (`sounds.ts`, 2026-11-21):

  | Sound | Stand-in |
  |---|---|
  | pat | `drive/bump.wav`, soft and low |
  | spreading | the crayon loop, lower |
  | cheese landing | `ui/tap.wav`, quiet and high |
  | a topping dropped | the app's fill (the pop) |
  | a topping that missed | `ui/tap.wav`, quiet and low |
  | into the oven | `ui/page.wav`, low |
  | a touch on the oven window | `drive/puddle.wav`, short and high |
  | the oven bell, the empty plate | the app's cheer (the bell) |
  | a bite | `drive/bump.wav`, short and high |

  Wanted as takes of their own: a pat, a squelch, a shake, bubbling, an oven bell, a munch.
- **Speech (not built):** names on a pick and one line a step, through a queue so lines never talk over each
  other (the letters game has one in `voice.ts`; share it if it fits). Waits for phase A's clips.
- **The idle hand (not built):** after 8 seconds with no touch, a hand shows the step's movement once.
- **Frame time:** the scene is drawn every frame (about 400 shreds and 80 toppings at most; the oldest are
  dropped quietly); only the eaten pizza is kept on spare canvases. Not yet measured on the laptop: if it is slow
  there, draw what has landed onto a layer once. The reduce-motion check (the next arrow's pulse stops; the rest
  is not checked).
- **Done when** the pizza looks and sounds like one, speaks, and the browser tests still pass.

### D. Keeping what was made
- A picture and the data of each pizza as it leaves the oven; the newest 24 per kid; one file per pizza
  (ADR 0024's rules, in [gotchas](memory/gotchas.md)).
- The start screen: the recipe tiles and the shelf (three across, two down, the sixth tile a "more" arrow).
- The parent area's Kitchen section: the names setting, clearing a kid's shelf. `forgetKid`.

### E. Ready for the kids
- A recipe doc, `docs/recipes/kitchen.md`: how to add a thing to make (steps, patterns, anti-recipes).
- The [playtest guide](playtest.md) gets Kitchen's questions (ADR 0044's last consequence).
- The mockup canvas has the Kitchen boards (25 to 34, 2026-11-21); bring them in line with what was built. The
  design system artifact gets the new tile, the counter and the rail ([gotchas](memory/gotchas.md)).
- ADR 0044 accepted; a release. (It already shows by default: K2.)

### F. More recipes (each its own PR, by the recipe doc)
Cupcake (`pour`, `squeeze`), birthday cake (`count`: candles tapped out and counted aloud), ice cream, cookie.
Each is art, sounds, a recipe file, and a new verb where one is needed.

## Not in this plan
The other five ideas (car wash, vehicle workshop, robot or monster, garden, building site), other dough shapes,
serving the pizza to someone, and a pizza van in the driving game. Each would be its own decision.
