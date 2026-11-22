# 0047. Home screen tiles are little pictures of the games, on bigger tiles

- Status: Accepted (by the owner, 2026-11-21: "Option B, scenes", from two mockups)
- Date: 2026-11-21
- Mockups: boards 35 (option A, not chosen) and 36 (option B) on the mockup canvas (linked from the
  [ADR index](README.md))
- Supersedes: in [ADR 0016](0016-visual-design-language.md), for the home screen with four games or fewer, "tiles
  are three across and two down"; and the small icon on a coloured tile that each game's home tile was
  ([ADR 0012](0012-multi-game-shell.md)'s `tileIcon` and `tileColor`). Everything else in those ADRs stands.

## Context
The home screen showed each game as a small icon on a coloured tile: a sheet of paper, a little car, a letter A, a
chef's hat. With four games on it (ADR 0045) the owner asked for new icons. Two options were mocked up: A, one bold
object a tile at the same tile size; B, a little picture of each game on bigger tiles. The owner chose B. A kid
who can't read picks by what the picture shows them doing.

## Decision
- **Each game's tile is a picture of the game,** filling the tile to its edges:
  - Coloring: a sheet with a coloured-in sun, flower and rainbow, and a row of seven crayons standing in front
    (the owner, 2026-11-21, on seeing the first one: more crayons and colours).
  - Driving: the game as it is seen, from behind a red car on a road that runs away between trees, with a star to
    collect ahead (the owner, the same day: the driving view, not a car from the side).
  - Letters: a big A being traced and a B waiting, on lined paper.
  - Kitchen: a pizza on its board and a cupcake, on the tiled counter.
- **With four games or fewer the tiles are big and two across:** 460 × 260 on the 1280 × 800 reference screen,
  growing with a bigger window as far as two rows still fit (620 × 350 at most). With five or six games the tiles
  go back to 300 × 220, three across (ADR 0016 rule 6), with the same pictures cropped at the sides.
- The pictures are original and CC0 (ADR 0011), drawn as SVG in `src/ui/tiles.ts`. A game's registry entry still
  gives its tile as SVG markup (`tileIcon`), and a colour behind it (`tileColor`) that shows only while it draws.
- A tile is still an outlined object with a ledge that presses (ADR 0016 rule 2), and carries no words.

## Consequences
- A new game needs a picture, not an icon: more to draw, and it has to read at 300 × 220 with its sides cropped,
  so nothing that matters goes at the far left or right.
- The Kitchen tile shows a pizza and a cupcake. When more things can be made it may want redrawing.
- The home screen now differs with the number of games: big tiles up to four, small ones above.
- The four old tile icons are gone from `src/ui/icons.ts`.
- To check with a kid: whether each picture is taken for its game, above all Coloring (a picture of a picture).
