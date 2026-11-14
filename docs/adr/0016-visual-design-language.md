# 0016. Visual design language: Crayon Box

- Status: Accepted (by the owner, 2026-11-14); partly superseded by [0017](0017-new-pictures-and-my-pictures.md), [0018](0018-kid-names-and-photos.md) and [0019](0019-bigger-coloring-page.md)
- Date: 2026-11-14

## Context
ADR 0003 says how kid screens behave, but nothing says how the app looks. The first mockups were drawn screen by
screen before the ADR review, so each made its own choices about color, size and layout, and several no longer
matched the ADRs. Two very different people use the app: kids who can't read, and a parent who sets things up.
More games are coming (ADR 0012), and each one needs the same buttons, badges and rules.

## Decision
One design system, called **Crayon Box**, with two worlds and one gate between them. The full kit (tokens,
19 component cards with live previews, the rules below with examples) is a design-system artifact, and every
screen is drawn with it on the mockup canvas. Both are linked from the [ADR index](README.md). The artifacts are
private to the owner, so the rules that matter are repeated here.

### The eight rules
1. **Pictures for the kids, words for the grown-ups.** A kid screen has no letters, numbers or counts. The parent
   gate (ADR 0008) is the only text a kid can reach.
2. **If it has an ink outline and a ledge, you can press it; if you can press it, it has both.** Kid controls are
   chunky objects with a 5 px near-black outline and a hard 6 px drop underneath. A press moves the object down
   onto its ledge. Panels and decoration get neither.
3. **Shape says what it does.** Round things are picked from a set (colors, sizes, themes, kids). Rounded squares
   do something now (back, undo, the tools). Sheets of paper are pictures.
4. **Picked is ringed and bigger**, never a color change alone.
5. **One job per screen, one way back**, top-left.
6. **Nothing scrolls, nothing pops up, nothing asks.** Tiles are three across and two down; when there are more,
   the sixth tile is a "more" arrow. No dialogs, confirmations, errors or disabled controls on kid screens.
7. **A kid's color follows them.** The ground of every game screen is a soft tint of the playing kid's profile
   color (ADR 0007), so anyone can see whose turn it is.
8. **The parent world looks nothing like the kid world:** a cool gray ground, a dark navigation rail, text, and
   one blue for the main action.

### Values
| What | Value |
|---|---|
| Ink (outlines, line art, text) | `#23201c` |
| Kid grounds | manila `#fff1d6` when no kid is picked, else the kid's tint |
| Kid profile colors | orange, pink, purple, green, blue, teal, each with a tint |
| Paint colors | 23 plus rainbow, three across and eight down, one color family per row (list below) |
| Picked fill | yellow `#ffd23f`; nothing rests in yellow |
| Parent world | ground `#f1f3f6`, rail `#1d2733`, action `#2457d6` |
| Kid targets | 80 px minimum, 88 px tools, 104 px corner buttons, 12 px minimum gap (ADR 0003) |
| Parent targets | 48 px tall, because the parent area is used by touch too |
| Type (parent world only) | Fredoka for headings and the gate, Atkinson Hyperlegible for text, nothing under 15 px |
| Reference frame | 1280 × 800 |

Every value has a named token in the design system; the app's CSS custom properties take the same names.

The paint colors, in rail order (each line is one row):
1. light pink, pink, red
2. apricot, orange, dark red
3. yellow, light green, green
4. dark green, teal, light blue
5. pale blue, blue, dark blue
6. lavender, purple, gray
7. peach, tan, brown
8. dark brown, black, rainbow

### Screen decisions the mockups add
These were open or unstated in earlier ADRs. They are part of this decision.
- **The kid picker is its own screen** and comes first. The home screen with one tile per game follows it, and is
  skipped while only one game is enabled (ADR 0012).
- **The coloring screen:** tools in a rail on the left, the page in the middle, colors three wide in a rail on
  the right, and a tray under the page with the three brush sizes at one end and the coloring mode at the other.
  The size dots are drawn in the current color.
- **The coloring mode is two round picture buttons:** a scribble running over the edge of a shape (color
  anywhere) and a shape filled neatly to its edge (stay in the lines). It is set per picture (ADR 0004).
- **All 24 swatches are always on screen.** A picked swatch gets a tight ring and does not grow, because the
  swatches sit at the minimum 12 px gap.
- **Sizes belong to the brush and eraser.** While the bucket is picked the tray fades; tapping a size picks that
  size and the brush.
- **The blank page** is the last button in the theme strip, after "Our pages".
- **A started page shows the kid's coloring** on its tile. There is no "in progress" badge.
- **No sound button on kid screens.** Sounds are a parent setting.
- **The parent area has a Pictures screen** for restoring a previous version and deleting (ADR 0007). ADR 0008's
  list of parent screens does not name it yet.
- **AI setup** (key, model, the two account settings from ADR 0006) is its own screen, reached from Add a page.
- **Motion and sound:** an 80 ms press, a small pop on the newly picked item, a slide between screens, one short
  wordless sound per kind of touch. With "reduce motion" on, only the press remains. The parent world has neither.

### Licensing
Fredoka and Atkinson Hyperlegible are under the SIL Open Font License. The app bundles the font files, lists them
in `CREDITS.md`, and never loads fonts from the network. All icons in the kit are original and CC0 (ADR 0011).

## Consequences
- A new screen or game starts from existing parts, and can be checked against eight short rules.
- The palette is fixed at 23 colors plus rainbow. That is the most that fits at the 80 px minimum on the
  reference screen: the wider color rail already shrinks the page from about 850 × 640 to 780 × 588. More colors
  would mean a smaller page or a second page of colors, and both were turned down.
- The theme strip holds ten buttons at the minimum size: eight built-in themes, "Our pages" and the blank page.
  An eleventh theme needs a layout change, not a smaller button.
- The layout assumes a 16:10 screen at 1280 × 800. The target laptop's screen is still unrecorded (ADR 0004); a
  16:9 screen has less height: the color rail would hold seven rows, not eight, and the tray under the page is
  the first thing that would have to move.
- Two artifacts now need keeping in step with the ADRs: the design system and the mockup canvas.
