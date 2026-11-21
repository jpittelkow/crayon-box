# 0044. Kitchen: a game for making things step by step, pizza first

- Status: Proposed (2026-11-21). The owner picked "Kitchen, pizza first" from six ideas the same day; the choices
  inside it (K1 to K12 in [kitchen-plan.md](../kitchen-plan.md)) are still the owner's to settle
- Date: 2026-11-21
- Mockups: boards 25–34 on the mockup canvas (linked from the [ADR index](README.md))
- Builds on: [ADR 0003](0003-toddler-first-interaction-rules.md) (toddler rules), [0011](0011-line-art-licensing.md)
  (original or CC0 only), [0012](0012-multi-game-shell.md) (a game is a module), [0016](0016-visual-design-language.md)
  (Crayon Box), [0024](0024-family-sync-server.md) (how things are saved), [0032](0032-sounds-as-files.md) (sounds are
  files, one narrator), [0038](0038-coloring-buttons-a-kid-can-work-out.md) (buttons say their names, picks on
  touch-down)

## Context
The owner said on 2026-11-21 that the kids want games that are more hands-on, like the make-a-cupcake, make-a-cake
and make-a-pizza games on a well-known kids' games site. Those games sit behind a membership, so only the site's
own descriptions were read. What that kind of game is:
- a short, fixed run of steps (pick a base, add things, finish);
- a few choices at each step, and no wrong one;
- no timer, no score, no losing;
- a payoff at the end (it bakes, something eats it) and a thing the kid made.

That fits the toddler rules already, with two gaps: those games put words on their buttons, and most of their steps
are "tap one of these". The kids here are 4 and under and like doing things with their fingers (colouring,
knocking boxes over), so the steps should be things a hand does: pat, rub, sprinkle, drop, bite.

This is the app's fourth game. It is our own game of that kind, not a copy of any one of them: its own steps, look,
art and sounds (ADR 0011).

## Decision

### One game, many things to make
- A new game module, **Kitchen** (`src/games/kitchen/`, registry id `kitchen`), with a home tile like the others.
- Each thing to make is a **recipe**. Pizza is the first. Cupcake, birthday cake, ice cream and cookie are meant
  to follow, each as a new recipe and not a new game.
- With one recipe the game opens straight on the counter. With more, a start screen shows one big tile per recipe
  (three across, two down, ADR 0016 rule 6).

### The counter screen
- The thing being made sits big in the middle on a counter, on the kid's tint (ADR 0016 rule 7).
- The current step's choices, when it has any, are round buttons in a rail on the right: at most eight, all on
  screen, nothing scrolls. The picked one is ringed and bigger.
- **One next button,** a big arrow bottom right, moves to the next step. It is always there and always works;
  it pulses once the step has been done enough. **A step skipped does itself:** the dough flattens, the sauce
  spreads, in a quick animation, so what comes out always looks like the thing and nothing a kid does is wrong.
- Back, top left, leaves the game. The thing in progress is kept and is there when the kid comes back.
- No undo and no start over in the first version: there is nothing to get wrong, and eating it starts a new one.

### The pizza, step by step
1. **Dough.** A ball of dough on a floury board. Every pat or rub squashes it flatter and wider where it is
   touched, with a soft pat sound, until it is a round base with a raised edge.
2. **Sauce.** A finger rubbing the dough spreads sauce where it goes, kept inside the crust (the coloring game's
   "stay in the lines"). The rail offers the sauces; red is picked to begin with.
3. **Cheese.** A finger on the pizza shakes cheese down onto that spot; moving sprinkles a trail, holding piles it.
4. **Toppings.** The rail shows eight toppings. A kid picks one, then every touch on the pizza drops one there
   with a pop, and a drag drops a trail. It is the coloring screen's model, which the kids already know: pick
   from the rail, then touch the picture. A topping dropped off the pizza bounces away. Any number, any mix, or
   none.
5. **Oven.** Next slides the pizza into an oven. For about four seconds the cheese melts, the crust browns and it
   bubbles; then a bell, and it slides out steaming. Nothing can burn and there is nothing to time. A touch on
   the oven window makes it bubble.
6. **Eat.** The pizza is on a plate. Every touch takes a bite out of it where the finger is, with a munch. When
   the plate is nearly empty there are crumbs, the bell and a "Yum!", and a new ball of dough arrives.

### The toddler rules, applied
- **No text** (ADR 0003 rule 1): the only controls are back, next and the rail.
- **Picks fire on touch-down;** back and next fire on lift (ADR 0038).
- **Every finger works** (rule 3): each touch pats, spreads, sprinkles, drops or bites on its own, so a resting
  hand never blocks a step and two kids can make one pizza. Palms are ignored where the screen reports size.
- **Nothing to lose:** no order to follow, no customer waiting, no burnt pizza, no score.
- **Nothing is lost** (rule 6): the thing in progress is saved after every action.
- **Help when stuck:** after about 8 seconds with no touch, a small hand shows the step's movement once, as the
  letters game does.

### Recipes are data; the verbs are written once
- A recipe is a list of steps, and each step names a **verb** from a small set the game knows:

  | Verb | What a touch does | In the pizza |
  |---|---|---|
  | `press` | squashes a shape toward its finished form | dough |
  | `spread` | covers an area with a layer, inside a mask | sauce |
  | `sprinkle` | drops many small pieces that fall and stay | cheese |
  | `place` | puts one of the picked piece where touched | toppings |
  | `choose` | picks one look for a part, from the rail | which sauce |
  | `cook` | nothing; a short show with a sound and a bell | oven |
  | `eat` | takes a bite | eating |

  A later recipe adds a verb only when it needs one (`pour`, `squeeze`, `count` for candles).
- **What is being made is plain data** (the choices, a small grid of what is covered, the pieces and where they
  lie). The rules that change it are plain TypeScript with no DOM, like the letters checker and the driving
  simulation, so they have unit tests, and the same data draws the pizza at any size.
- Drawn on a 2D canvas. No three.js.

### Look
- Crayon Box (ADR 0016): the ink outline, flat bright colours, chunky pressable buttons. The food is original art
  drawn as SVG for this project and released as CC0 (ADR 0011). No brand, character or other game's look.
- A baked look is made from the same art (browner crust, melted cheese, darker toppings), not drawn twice.

### Sound and the narrator
- **Every verb has its own sound** (ADR 0032): pat, squelch, shake, pop, the oven's bubbling, the bell, munch.
  Stand-ins from files the app already ships come first; takes of their own follow the sounds recipe.
- **Things say their names** the first three times a kid picks them ("Mushroom."), under the same parent setting
  as the coloring buttons (ADR 0038). Each step has one short line the first few times ("Pat the dough.").
- **Every narrator line is made before 2026-12-31,** when the voice retires (ADR 0032): the lines for the pizza,
  for the four recipes meant to follow, and spares, in one batch. A line not made by then can't be added in the
  same voice.

### Saved
- Per kid, in the game's own storage namespace, through the storage interface, one file per thing that changes on
  its own (ADR 0024): the thing in progress for each recipe, each finished thing (its data and a small picture,
  taken when it leaves the oven), and how often each name has been said.
- **Finished things are kept on a shelf,** the newest 24 per kid, shown from the game's start screen. A parent
  can clear it in a Kitchen section of the parent area, which also holds the names setting.
- Deleting a kid deletes what the game kept for them.

### Starting out
- The game shows on the home screen by default; a parent can hide it
  ([ADR 0045](0045-every-game-shows-by-default.md), the owner's choice on 2026-11-21, in place of the first plan
  to keep it hidden while it was being built).

## Consequences
- A small game next to Driving: no 3D, no service, nothing the installer needs. It can be built and played in
  the web app.
- Adding a thing to make is art, sounds, lines and a recipe file, plus a new verb now and then. The first recipe
  pays for the verbs; a recipe doc joins [docs/recipes](../recipes/README.md) once the pizza is built.
- About fifteen new pieces of art for the pizza, a handful of sounds, and one more narrator batch with a hard
  date. Lines for recipes not yet designed are a guess; some will go unused and some will be missing.
- The home screen gets a fourth tile.
- "A step skipped does itself" means a kid can tap next six times and get a plain pizza without doing anything.
  That is on purpose at this age; the steps have to be fun enough that they don't.
- No undo means a topping can't be taken off. To check in a playtest, along with: whether rubbing and
  sprinkling are understood without words, whether the next arrow is found, whether four seconds of oven is too
  long, whether bites are more fun than slices, and whether names get annoying.
- Ideas kept for later, each its own decision: other shapes of dough, serving the pizza to someone, a pizza van
  that brings it in the driving game.
