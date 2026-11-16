# Coloring buttons a kid can work out, and a colour wheel (plan)

To-do section 2. In the playtest of 2026-11-15 a kid didn't know what any coloring button does, and the owner asked
for a colour wheel next to the swatches. Drafted 2026-11-15; the decision is
[ADR 0038](adr/0038-coloring-buttons-a-kid-can-work-out.md) (Accepted). **Built 2026-11-15:** phases B (names and
sounds), C (the tool at the finger) and D (the show-how); see "As built" under Phases. E and F are not built.

## The screen today
Left rail: back, paint bucket, brush, eraser, undo, start over. Under the page: three brush-size dots and two
coloring modes (color anywhere, stay in the lines). Right rail: 23 colours and the rainbow, 64 px, three across.
Every control is an icon (ADR 0003); a tap plays the same soft tap and a small bounce; the picked one is ringed.

## What the research says (2026-11-15)
Small studies (about 30 kids each, a few labs), so read as direction, not proof. Sources:
- **Under 3, kids can't read symbols;** from about 3 to 3½ they can if the icon looks like the real thing and is
  drawn plainly. Decoration on the symbol makes it worse.
  ([Hiniker et al. 2016, "Hidden symbols"](https://faculty.washington.edu/alexisr/HiddenSymbols.pdf))
- **Under 3, only a live adult showing them works.** Spoken prompts and on-screen demos start to work at about 3
  to 3½; a glow or other change on screen failed at every age.
  ([Hiniker et al. 2015](https://depts.washington.edu/chilllab/?p=186);
  toddlers copy a screen less well than a person: [Zack, Barr et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC2821208))
- **A cartoon hand showing how fails under 3;** at 3 it works only with speech ("move your hand like this one")
  (Hiniker 2016).
- **Press and hold is one of the hardest gestures** at 2 to 3 (about 40–60 % success when asked to;
  [Nacher et al. 2015](https://riunet.upv.es/bitstream/10251/64752/3/VersionAutor.pdf)). A hidden press-and-hold
  preview would not be found.
- **Sound that matches the action made preschoolers faster; spoken step help made them more accurate**
  ([Reach Every Reader summary](https://reacheveryreader.gse.harvard.edu/which-mobile-app-feedback-and-leveling-designs-best-scaffold-preschool-learning)).
  Pair speech with what is seen; fire picks on touch-down, because kids hold the finger down until something
  happens ([Cooney Center / Sesame best practices](https://joanganzcooneycenter.org/?p=19607)).
- **Modes:** no study for under-4s. Older work (KidPad) showed the tool at the cursor and found kids want one tap
  to swap tools ([KidPad, CHI 1997](https://www.cs.umd.edu/projects/hcil/jazz/learn/papers/chi-97-kidpad/KidPad6.html));
  keeping the sign of the tool and its effect in one place follows from Hiniker 2016.
- **Colour wheels:** no study with preschoolers. Fine drags are hard at this age and big targets matter
  ([NN/g](https://www.nngroup.com/articles/children-ux-physical-development/)); a toddler painting app used a big,
  simplified wheel of a few segments. 2 to 3 year olds mostly scribble in one colour; 4 year olds use many
  ([Yadav et al. 2017](https://zendy.io/title/10.1111/apa.13818)).
- **Undo:** nothing tested under 4; keep it big, repeatable and harmless (already true: start over is undoable).

## The design
Six parts. Parts 1 to 3 are the core; 4 is for the parent; 5 is the wheel; 6 is a smaller clean-up.

### 1. Each button says what it is, and sounds like what it does
- A tap on a tool, size, mode or colour plays **its own sound** (bucket: a splash; brush: a swish; eraser: a soft
  rub; undo: a short rewind; start over: a page turn; sizes: a small, middle and big pop) and then the narrator
  says **its name** ("Paint bucket." "Red."). Colours are named too: kids learn the colour words for free.
- Spoken only the first few times a kid picks that button (default: the first 3 picks per kid, then only the
  sound), so it never becomes noise. A parent setting turns names off, or on every time.
- Picks (tools, sizes, modes, colours) fire on **touch-down** (ADR 0003 already allows it after a playtest; the
  Sesame guidance supports it). Undo, start over and back stay on lift.
- Clips: made in the narrator batch with the letters lines (owner, 2026-11-15), before the voice retires on
  2026-12-31. Sounds: stand-ins from the shipped files first ([sounds recipe](recipes/sounds.md)).

### 2. The tool is shown where the finger is
- While a finger is on the page, a **small badge follows it**: the current tool's icon on a dot of the current
  colour, just above and to the side of the finger so it isn't hidden. The bucket's badge pours; the brush's dot
  is the brush's size; the eraser's is white.
- The picked tool in the rail is ringed **and bigger**, and the brush-size dots grey out while the bucket is
  picked (they don't apply), so what will happen next is visible in two places.

### 3. A first-time show-how, on the page, with the narrator
- The first time a kid ever opens a page, and once per tool the first time a kid picks it: a **2 to 3 second
  demo on the page itself**, not a cartoon hand. The tool's badge moves on its own across a corner of the page
  and does the thing (the bucket fills a small cloud shape drawn for the demo, the brush draws a squiggle, the
  eraser rubs it out), while the narrator says the "what it does" line ("Tap a space to fill it." "Draw with your
  finger." "Rub it out."). Then the demo marks fade and nothing is changed on the kid's picture.
- Any touch stops a demo at once. Never more than one demo per minute.
- No press-and-hold anywhere.

### 4. For the parent: show it once together
- Research says the thing that works under 3 is a person showing them. The parent area's Coloring screen gets
  **"Show the buttons"**: the next time that kid opens a page, the demos play for every tool in turn, slowly,
  for a parent and kid to watch together.
- A short **parent tip** beside it (parent screens may use text): "Sit with your kid the first time. Tap each
  button and say what it does."

### 5. The colour wheel
- A **ring of 12 big, tappable segments** (no dragging, no fine shades), each a clear hue, with the current
  colour in the middle. A tap picks the segment's colour, says its name the first few times, and works with all
  three tools like a swatch.
- **Where:** in the room the laptop's wider screen leaves beside the colour rail (the page is 4:3 and limited by
  height; at 1920 × 1080 there is a column of spare width). Each segment's tap area is at least 64 px across, like
  a swatch, so the wheel needs about 300 px of width. On a screen without that room the wheel is not shown (the
  rail is unchanged), so nothing gets smaller (ADR 0019).
- The wheel's 12 colours are in-between hues the rail lacks (e.g. coral, gold, mint, aqua, violet, magenta), so
  it adds colours, as the owner asked, rather than repeating the rail.
- Kept away from the screen's very edge, where wrists rest.

### 6. Smaller clean-ups
- Icons redrawn **plainer and more like the real thing** where they aren't already (a real bucket, a real
  brush). Undo's curved arrow is abstract: try a "backwards" hand-drawn scribble being wiped off, checked by eye
  with a kid.
- Modes and the eraser stay on the kid screen (the owner asked for the per-picture mode); the research would cut
  modes, so this is a decision below, not a change.

## Phases
| Phase | Builds | Done when |
|---|---|---|
| A. Clips | the 40 coloring lines in the narrator batch (tool names, what each does, sizes, modes, 24 colours) | picked takes committed before 2026-12-13 |
| B. Names and sounds | per-button sound and name, the "first 3 picks" counter per kid, the parent setting, picks on touch-down | unit tests for the counter; browser test: a pick plays its sound and name, then only its sound |
| C. The tool at the finger | the badge, the bigger picked tool, sizes greyed under the bucket | browser test: badge follows a touch and shows the tool and colour |
| D. Show-how | the per-tool demos, first page and first pick, stopped by a touch; parent "Show the buttons" and tip | unit: demo due rules; browser: a demo plays once and leaves the picture unchanged |
| E. Colour wheel | the 12-segment ring in spare width; hidden when there is no room | browser test at 1920 × 1080 (shown) and 1280 × 800 (hidden); every segment fills |
| F. Icons | plainer bucket, brush and undo, checked by eye | a kid playtest |

Then a playtest: do kids pick the tool they mean, does the badge help, do the demos get watched or skipped.

### As built (B and C, 2026-11-15)
- **Where:** `src/games/coloring/buttons.ts` (each button's sound and narrator clip, and the `Narrator` that plays
  them), `names.ts` (the per-kid counter and the parent setting), `badge.ts` (the badge), wired in `session.ts`.
  Pick buttons use `onPress` (`src/ui/kid.ts`); the shell's `Sound` gained `effect` and `preload` for a game's own
  sounds. Tests: `names.test.ts`, `tests/e2e/buttons.spec.ts`.
- **Names:** the sound plays at once and the name about 0.2 s later; a new pick cuts off a name still waiting or
  being said. A name counts when it is said (not when it is skipped or cut off), up to 3, kept per kid in the game's
  `kids/<id>/names.json`; nothing more is written after 3. Back, undo and start over say their names too (their clips
  were made), still on lift; undo with nothing to undo keeps its quiet "nothing" tap. Names follow the Sounds switch.
- **Parent setting:** Parent area › Coloring (a new screen, where D's "Show the buttons" will go): "First 3 times"
  (default), "Every time", "Never", for every kid (`button-names.json`).
- **Stand-in sounds** (ADR 0032, all under 0.3 s): bucket a raised splash (`drive/splash.wav`), brush a quick swish
  and eraser a slow soft rub (both cut from `ui/crayon.wav`), undo `ui/undo.wav`, start over the start of
  `ui/page.wav`, sizes the tap at three pitches, color anywhere a boing, stay in the lines a soft bump, every colour a
  short crayon dab, back the tap.
- **Badge:** on the whole coloring screen (so it can stand out over the margin), centred about 56 px right of and
  70 px above the first finger on the page; left of it near the right edge, below it near the top. 68, 80 or 94 px
  with the size (the bucket's is the middle one), the icon on a white disc; white for the eraser; the bucket's icon
  tips back and forth (it holds still with reduce motion on). Palms and second fingers don't move it.
- **Rail:** the picked tool is scaled 1.12; under the bucket the sizes are grey (grayscale, 40 % opacity) and none is
  ringed; tapping one still picks it and the brush.

### As built (D, 2026-11-15)
- **Where:** `src/games/coloring/showHow.ts` (when a demo is due, and what is kept), `demo.ts` (the demo on the page),
  wired in `session.ts`; the parent's card in `parentSections.ts`. The narrator gained `quiet()`, so a demo waits for a
  tool's name to finish. Tests: `showHow.test.ts`, `tests/e2e/showHow.spec.ts`.
- **When:** the first page a kid ever opens shows the current tool (the brush, which every page opens with) about
  1.2 s after the page appears; the first pick of each tool shows that tool after its name. At most one demo starts a
  minute; a demo held back by that is still due at the next pick. A demo counts as seen once it has run 1 s without a
  touch, so one cut off at once comes back later. Nothing starts while a finger is on the page.
- **What:** a box with the demo's dashed outline in the page's bottom-right corner (36 % of the page's width), over the
  page and never on it, with the tool's badge doing the thing: the brush draws a squiggle, the eraser rubs out a zigzag,
  the bucket comes over a cloud and fills it (with the fill sound). It paints in the current colour and brush size and
  fades out after about 2.8 s. The tool's rail button bounces, ringed with the same dashed line, while it plays. The
  narrator says the "what it does" line (`do-bucket`, `do-brush`, `do-eraser`).
- **Stopping:** any new touch anywhere on the screen stops a demo at once (caught on the way down, so the touch still
  paints or picks as usual); the demo never takes a touch, so nothing is ever locked.
- **Kept per kid** (two files, as the kid's screen and the parent area change them on their own, ADR 0024):
  `kids/<id>/show-how.json` (first page seen, tools seen, when the last demo started, the parent ask last answered) and
  `kids/<id>/show-buttons.json` (when a parent last asked). Both go with the kid's folder when a kid is deleted.
- **Show the buttons:** Parent area › Coloring has a "Show the buttons" card with the tip and one "Show <kid> the
  buttons" button per kid; the row says "Plays the next time <kid> opens a page." until it has played. Then, as that
  kid opens a page, each tool in turn is pointed at and named, and its demo plays slower (4.2 s); then undo and start
  over are pointed at, named and their line said (`do-undo`, `do-start-over`; they have no page demo). It doesn't wait
  out the minute, counts as seeing every demo, and never changes the kid's tool. It says the names even when the names
  setting is "Never" (the parent asked for it); names and lines follow the Sounds switch.
- Not done: no parent switch to turn the first-time demos off (not asked for); the playtest questions above still
  stand.

## Decisions for the owner
**Settled 2026-11-15:** the owner took every recommendation, C1 to C8.

| # | Decision | Options | Recommended |
|---|---|---|---|
| C1 | Names spoken | first 3 picks per button per kid · always · never | **first 3**, parent setting to change |
| C2 | Colour names spoken too | yes · tools only | **yes** |
| C3 | Picks on touch-down | yes · stay on lift | **yes** (undo, start over, back stay on lift) |
| C4 | The badge at the finger | yes · no | **yes** |
| C5 | Show-how demos | first page and first pick of each tool · only when a parent asks · none | **first page and first pick**, plus the parent button |
| C6 | Colour wheel | 12-segment ring in spare width · replace the rail with a bigger wheel · a wheel that opens over the page | **12-segment ring in spare width** (adds colours, nothing shrinks, no hidden screen) |
| C7 | Wheel colours | in-between hues the rail lacks · the rail's own hues | **in-between hues** |
| C8 | Modes on the kid screen | keep both · move "stay in the lines" to the parent area | **keep** (owner's earlier ask); revisit after the playtest |

## Mockups
An interactive prototype of parts 1, 2, 3 and 5: [the prototype](https://claude.ai/artifact/K2TLhy1c3Avpcp2FznXLve) (source:
[design/coloring-buttons-prototype.html](design/coloring-buttons-prototype.html)); the boards go on the mockup
canvas once the owner settles the decisions above.
